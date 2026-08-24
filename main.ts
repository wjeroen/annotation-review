import { Editor, EditorPosition, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf, debounce } from "obsidian";
import { detectAdmonitionBlocks, detectAnnotations, getInsertContext } from "./src/detect";
import { computeAddReply, computeMutation, computeRemoval, computeSetInsertReason, computeSpanReplace, AnnotationAction, MutationResult } from "./src/actions";
import { AdmonitionBlock, Annotation, InsertContext } from "./src/types";
import { AuthorModal, AnnotationTypePicker } from "./src/modals";
import { Composed, composeComment, composeDelete, composeInsert, composeInsertWithReason, composeReplace } from "./src/compose";
import { AnnotationReviewView, VIEW_TYPE_ANNOTATION_REVIEW } from "./src/view";

interface AnnotationReviewSettings {
	/** Prefilled author label for new annotations. Blank means no label. */
	defaultAuthor: string;
	/** Expanded state carries across notes, and is tracked per tab. */
	repliesExpanded: boolean;
	admonitionsExpanded: boolean;
}

const DEFAULT_SETTINGS: AnnotationReviewSettings = {
	defaultAuthor: "",
	repliesExpanded: false,
	admonitionsExpanded: false
};

/** How long to wait after the last keystroke before rescanning the note. */
const RESCAN_DELAY_MS = 400;

export default class AnnotationReviewPlugin extends Plugin {
	annotations: Annotation[] = [];
	admonitions: AdmonitionBlock[] = [];
	settings: AnnotationReviewSettings = { ...DEFAULT_SETTINGS };
	/** Path of the note the current annotation list came from. */
	scannedPath: string | null = null;
	/** Only the newest scan is allowed to publish its result. */
	private scanToken = 0;

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_ANNOTATION_REVIEW, leaf => new AnnotationReviewView(leaf, this));

		this.addRibbonIcon("check-check", "Open Annotation Review", () => this.activateView());
		this.addCommand({
			id: "open-annotation-review",
			name: "Open Annotation Review sidebar",
			callback: () => this.activateView()
		});
		this.addCommand({
			id: "refresh-annotation-review",
			name: "Refresh Annotation Review",
			callback: () => this.rescanActiveFile()
		});

		this.registerAnnotationCommands();

		const debouncedRescan = debounce(() => this.rescanActiveFile(), RESCAN_DELAY_MS, true);

		// All three of these just ask for a rescan. Concurrency is handled
		// inside rescanActiveFile rather than by trying to predict which events
		// are worth reacting to, and a rescan that finds nothing new does not
		// redraw the panel, so the redundant ones cost nothing visible.
		this.registerEvent(this.app.workspace.on("file-open", () => this.rescanActiveFile()));
		this.registerEvent(this.app.workspace.on("editor-change", () => debouncedRescan()));
		this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.rescanActiveFile()));

		this.app.workspace.onLayoutReady(() => this.rescanActiveFile());
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_ANNOTATION_REVIEW)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_ANNOTATION_REVIEW, active: true });
		}
		if (leaf) workspace.revealLeaf(leaf);
	}

	/**
	 * The editor showing a file, if one is open.
	 *
	 * Everything reads and writes through this when available. Obsidian only
	 * flushes keystrokes to disk a second or two after you stop typing, so
	 * `vault.read` returns a stale copy of a note being actively edited, and
	 * `vault.modify` would overwrite whatever hadn't been saved yet.
	 */
	private getEditorFor(filePath: string): Editor | null {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (view instanceof MarkdownView && view.file?.path === filePath) return view.editor;
		}
		return null;
	}

	private async readContent(file: TFile): Promise<string> {
		const editor = this.getEditorFor(file.path);
		return editor ? editor.getValue() : await this.app.vault.read(file);
	}

	private async applyMutation(file: TFile, result: MutationResult): Promise<boolean> {
		if (!result.ok) {
			new Notice(`Annotation Review: ${result.reason}`);
			await this.rescanActiveFile();
			return false;
		}
		const editor = this.getEditorFor(file.path);
		if (editor) {
			// Going through the editor keeps this in the undo history and
			// leaves any unsaved edits elsewhere in the note untouched.
			editor.replaceRange(result.replacement, editor.offsetToPos(result.from), editor.offsetToPos(result.to));
		} else {
			await this.app.vault.modify(file, result.newContent);
		}
		await this.rescanActiveFile();
		return true;
	}

	private fileFor(filePath: string): TFile | null {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			new Notice("Annotation Review: could not find that file anymore.");
			return null;
		}
		return file;
	}

	/**
	 * Rescans whichever note is on screen.
	 *
	 * Switching notes fires several events at once, and reading a note is
	 * asynchronous, so without the token an older read could finish last and
	 * overwrite a newer one, leaving the panel showing a different note's
	 * annotations than the one in front of you.
	 */
	async rescanActiveFile() {
		const token = ++this.scanToken;
		const file = this.app.workspace.getActiveFile();

		if (!file || file.extension !== "md") {
			this.annotations = [];
			this.admonitions = [];
			this.scannedPath = null;
			this.refreshView();
			return;
		}

		const content = await this.readContent(file);
		if (token !== this.scanToken) return;

		this.annotations = detectAnnotations(content, file.path);
		this.admonitions = detectAdmonitionBlocks(content, file.path);
		this.scannedPath = file.path;
		this.refreshView();

		// The note on screen changed while this one was being read, so nothing
		// above describes what the user is looking at. Go again for the new one.
		const current = this.app.workspace.getActiveFile();
		if (current && current.path !== file.path) void this.rescanActiveFile();
	}

	refreshView() {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_ANNOTATION_REVIEW)) {
			const view = leaf.view;
			if (view instanceof AnnotationReviewView) view.refreshFromData();
		}
	}

	async applyAction(annotation: Annotation, action: AnnotationAction) {
		const file = this.fileFor(annotation.filePath);
		if (!file) return;
		const content = await this.readContent(file);
		await this.applyMutation(file, computeMutation(content, annotation, action));
	}

	/**
	 * The reply field is prefilled with an author bracket, so its text already
	 * carries whatever label the user wants. Empty brackets mean they left it
	 * blank, so drop them rather than writing `^[[] text]`.
	 */
	async addReply(annotation: Annotation, replyText: string) {
		const cleaned = replyText.replace(/^\[\s*\]\s*/, "").trim();
		if (!cleaned) return;
		const file = this.fileFor(annotation.filePath);
		if (!file) return;
		const content = await this.readContent(file);
		await this.applyMutation(file, computeAddReply(content, annotation, cleaned));
	}

	/** Replaces a span inside an annotation, or inserts when start equals end. */
	async replaceSpan(annotation: Annotation, start: number, end: number, replacement: string) {
		const file = this.fileFor(annotation.filePath);
		if (!file) return;
		const content = await this.readContent(file);
		await this.applyMutation(file, computeSpanReplace(content, annotation, start, end, replacement));
	}

	/** Sets or clears an insertion's reason, rewriting it into the matching form. */
	async setInsertReason(annotation: Annotation, reason: string) {
		const file = this.fileFor(annotation.filePath);
		if (!file) return;
		const content = await this.readContent(file);
		await this.applyMutation(file, computeSetInsertReason(content, annotation, reason));
	}

	async deleteAdmonition(block: AdmonitionBlock) {
		const file = this.fileFor(block.filePath);
		if (!file) return;
		const content = await this.readContent(file);
		await this.applyMutation(file, computeRemoval(content, block.matchStart, block.raw));
	}

	/**
	 * Reveals an annotation in the note, selecting the whole thing rather than
	 * placing a caret, since a card in the middle of the screen is otherwise
	 * hard to match up with the text it refers to.
	 */
	async revealRange(filePath: string, start: number, end: number) {
		const file = this.fileFor(filePath);
		if (!file) return;
		// Clicking a card makes the sidebar the active leaf, and the note has
		// to open in the main area rather than on top of this panel.
		const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
		await leaf.openFile(file);
		const view = leaf.view;
		if (!(view instanceof MarkdownView)) return;

		const from = view.editor.offsetToPos(start);
		const to = view.editor.offsetToPos(end);

		// Reading view has no visible editor, so selecting in it would act on
		// an offscreen instance and appear to do nothing. Nothing there can be
		// selected, so scroll to the line instead, the same way Obsidian moves
		// to an internal link.
		if (view.getMode() === "preview") {
			view.setEphemeralState({ line: from.line });
			return;
		}

		view.editor.setSelection(from, to);
		view.editor.scrollIntoView({ from, to }, true);
		// Without focus the selection is not drawn, since the click left focus
		// in the sidebar.
		view.editor.focus();
	}


	// Creating annotations from the editor.

	/**
	 * Every annotation type, in the order they appear in menus. Each one writes
	 * straight into the note and leaves the caret where text is still needed,
	 * so none of them opens a dialog first.
	 */
	private annotationActions(): { id: string; label: string; icon: string; description: string; run: (editor: Editor) => void }[] {
		return [
			{
				id: "comment",
				label: "Comment",
				icon: "message-square",
				description: "Leave a remark on the selected text",
				run: editor => this.annotate(editor, sel => composeComment(sel, this.settings.defaultAuthor))
			},
			{
				id: "delete",
				label: "Delete",
				icon: "strikethrough",
				description: "Propose removing the selected text",
				run: editor => this.annotate(editor, sel => composeDelete(sel, this.settings.defaultAuthor))
			},
			{
				id: "replace",
				label: "Replace",
				icon: "replace",
				description: "Propose new wording for the selected text",
				run: editor => this.annotate(editor, sel => composeReplace(sel, this.settings.defaultAuthor))
			},
			{
				id: "insert",
				label: "Insert",
				icon: "text-cursor-input",
				description: "Mark the selected text as newly inserted",
				run: editor => this.annotateInsert(editor)
			},
			{
				id: "insert-highlight",
				label: "Insert (highlight form)",
				icon: "highlighter",
				description: "Always uses the ==++text++== form",
				run: editor => this.annotateInsert(editor, "fenced")
			},
			{
				id: "insert-reason",
				label: "Insert with a reason",
				icon: "list-plus",
				description: "Uses the footnote form, so a reason can be given",
				run: editor => this.annotate(editor, sel => composeInsertWithReason(sel, this.settings.defaultAuthor))
			}
		];
	}

	private registerAnnotationCommands() {
		for (const action of this.annotationActions()) {
			this.addCommand({
				id: `annotate-${action.id}`,
				name: action.label,
				editorCallback: editor => action.run(editor)
			});
		}
		this.addCommand({
			id: "annotate-pick",
			name: "Choose type of annotation",
			editorCallback: editor => this.pickAnnotationType(editor)
		});
		this.addCommand({
			id: "annotate-set-author",
			name: "Set default author",
			callback: () => this.setDefaultAuthor()
		});

		// The same actions on the editor's right click menu. setSection groups
		// them together so Obsidian draws a divider around them, since the API
		// has no submenus.
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				if (!editor.getSelection()) return;
				for (const action of this.annotationActions()) {
					menu.addItem(item =>
						item
							.setSection("annotation-review")
							.setTitle(action.label)
							.setIcon(action.icon)
							.onClick(() => action.run(editor))
					);
				}
			})
		);
	}

	/** The selected text with its range, which stays valid even if focus moves. */
	private requireSelection(editor: Editor): { text: string; from: EditorPosition; to: EditorPosition } | null {
		const text = editor.getSelection();
		if (!text) {
			new Notice("Annotation Review: select the text you want to annotate first.");
			return null;
		}
		return { text, from: editor.getCursor("from"), to: editor.getCursor("to") };
	}

	/** Writes an annotation over the selection and puts the caret where it belongs. */
	private annotate(editor: Editor, build: (selected: string) => Composed) {
		const selection = this.requireSelection(editor);
		if (selection === null) return;
		const composed = build(selection.text);
		const startOffset = editor.posToOffset(selection.from);
		editor.replaceRange(composed.text, selection.from, selection.to);
		editor.setCursor(editor.offsetToPos(startOffset + composed.cursor));
		editor.focus();
	}

	private annotateInsert(editor: Editor, forcedContext?: InsertContext) {
		const selection = this.requireSelection(editor);
		if (selection === null) return;
		const context = forcedContext ?? getInsertContext(editor.getValue(), editor.posToOffset(selection.from));
		this.annotate(editor, sel => composeInsert(sel, this.settings.defaultAuthor, context));
	}

	private pickAnnotationType(editor: Editor) {
		const actions = this.annotationActions();
		new AnnotationTypePicker(
			this.app,
			actions.map(a => ({ id: a.id, label: a.label, description: a.description })),
			id => {
				const action = actions.find(a => a.id === id);
				// Let the picker finish closing before the editor is touched.
				if (action) window.setTimeout(() => action.run(editor), 0);
			}
		).open();
	}

	private setDefaultAuthor() {
		new AuthorModal(this.app, this.settings.defaultAuthor, async author => {
			this.settings.defaultAuthor = author;
			await this.saveSettings();
			new Notice(author ? `Annotation Review: author set to ${author}.` : "Annotation Review: author label cleared.");
		}).open();
	}
}
