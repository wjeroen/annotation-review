import { Editor, EditorPosition, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf, debounce } from "obsidian";
import { detectAdmonitionBlocks, detectAnnotations, getInsertContext } from "./src/detect";
import { computeAddReply, computeMutation, computeRemoval, computeSpanReplace, AnnotationAction, MutationResult } from "./src/actions";
import { AdmonitionBlock, Annotation, InsertContext } from "./src/types";
import { AnnotationInputModal, AnnotationTypePicker } from "./src/modals";
import { composeComment, composeDelete, composeInsert, composeReplace } from "./src/compose";
import { AnnotationReviewView, VIEW_TYPE_ANNOTATION_REVIEW } from "./src/view";

interface AnnotationReviewSettings {
	/** Prefilled author label for new annotations. Blank means no label. */
	defaultAuthor: string;
}

const DEFAULT_SETTINGS: AnnotationReviewSettings = {
	defaultAuthor: ""
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

	async deleteAdmonition(block: AdmonitionBlock) {
		const file = this.fileFor(block.filePath);
		if (!file) return;
		const content = await this.readContent(file);
		await this.applyMutation(file, computeRemoval(content, block.matchStart, block.raw));
	}

	async jumpToOffset(filePath: string, offset: number) {
		const file = this.fileFor(filePath);
		if (!file) return;
		// Clicking a card makes the sidebar the active leaf, and the note has
		// to open in the main area rather than on top of this panel.
		const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf(true);
		await leaf.openFile(file);
		const view = leaf.view;
		if (view instanceof MarkdownView) {
			const pos = view.editor.offsetToPos(offset);
			view.editor.setCursor(pos);
			view.editor.scrollIntoView({ from: pos, to: pos }, true);
		}
	}

	// Creating annotations from the editor.

	private registerAnnotationCommands() {
		this.addCommand({
			id: "annotate-comment",
			name: "Annotate: comment on selection",
			editorCallback: editor => this.annotateComment(editor)
		});
		this.addCommand({
			id: "annotate-delete",
			name: "Annotate: mark selection for deletion",
			editorCallback: editor => this.annotateDelete(editor)
		});
		this.addCommand({
			id: "annotate-replace",
			name: "Annotate: replace selection",
			editorCallback: editor => this.annotateReplace(editor)
		});
		this.addCommand({
			id: "annotate-insert",
			name: "Annotate: mark selection as an insertion",
			editorCallback: editor => this.annotateInsert(editor)
		});
		this.addCommand({
			id: "annotate-insert-highlight",
			name: "Annotate: mark selection as an insertion (highlight form)",
			editorCallback: editor => this.annotateInsert(editor, "fenced")
		});
		this.addCommand({
			id: "annotate-pick",
			name: "Annotate: choose type for selection",
			editorCallback: editor => this.pickAnnotationType(editor)
		});
		this.addCommand({
			id: "annotate-set-author",
			name: "Annotate: set default author",
			callback: () => this.setDefaultAuthor()
		});
	}

	/**
	 * The selected text together with its range.
	 *
	 * The range matters for the commands that open a modal first: the modal
	 * takes focus, and writing the result back with `replaceSelection` would
	 * rely on a selection that may no longer be there, which would insert the
	 * annotation while leaving the original text behind. Replacing an explicit
	 * range avoids depending on that.
	 */
	private requireSelection(editor: Editor): { text: string; from: EditorPosition; to: EditorPosition } | null {
		const text = editor.getSelection();
		if (!text) {
			new Notice("Annotation Review: select the text you want to annotate first.");
			return null;
		}
		return { text, from: editor.getCursor("from"), to: editor.getCursor("to") };
	}

	private pickAnnotationType(editor: Editor) {
		new AnnotationTypePicker(
			this.app,
			[
				{ id: "comment", label: "Comment", description: "Leave a remark on the selected text" },
				{ id: "delete", label: "Delete", description: "Propose removing the selected text" },
				{ id: "replace", label: "Replace", description: "Propose new wording for the selected text" },
				{ id: "insert", label: "Insert", description: "Mark the selected text as newly inserted" },
				{ id: "insert-highlight", label: "Insert (highlight form)", description: "Force the ==++text++== form" }
			],
			id => {
				// Let the picker finish closing before another modal opens.
				window.setTimeout(() => {
					if (id === "comment") this.annotateComment(editor);
					else if (id === "delete") this.annotateDelete(editor);
					else if (id === "replace") this.annotateReplace(editor);
					else if (id === "insert") this.annotateInsert(editor);
					else this.annotateInsert(editor, "fenced");
				}, 0);
			}
		).open();
	}

	private annotateComment(editor: Editor) {
		const selection = this.requireSelection(editor);
		if (selection === null) return;
		new AnnotationInputModal(this.app, {
			title: "Comment on selection",
			textLabel: "Comment",
			placeholder: "What do you want to say about this text?",
			initialAuthor: this.settings.defaultAuthor,
			submitLabel: "Add comment",
			onSubmit: async (text, author) => {
				await this.rememberAuthor(author);
				editor.replaceRange(composeComment(selection.text, text, author), selection.from, selection.to);
			}
		}).open();
	}

	private annotateDelete(editor: Editor) {
		const selection = this.requireSelection(editor);
		if (selection === null) return;
		// No prompt: a deletion needs nothing beyond the selection itself, and
		// a reason can still be added later from the sidebar.
		editor.replaceRange(composeDelete(selection.text, this.settings.defaultAuthor), selection.from, selection.to);
	}

	private annotateReplace(editor: Editor) {
		const selection = this.requireSelection(editor);
		if (selection === null) return;
		new AnnotationInputModal(this.app, {
			title: "Replace selection",
			textLabel: "Replacement text",
			placeholder: "What should this text say instead?",
			initialAuthor: this.settings.defaultAuthor,
			submitLabel: "Add replacement",
			onSubmit: async (text, author) => {
				await this.rememberAuthor(author);
				editor.replaceRange(composeReplace(selection.text, text, author), selection.from, selection.to);
			}
		}).open();
	}

	private annotateInsert(editor: Editor, forcedContext?: InsertContext) {
		const selection = this.requireSelection(editor);
		if (selection === null) return;
		const context = forcedContext ?? getInsertContext(editor.getValue(), editor.posToOffset(selection.from));
		editor.replaceRange(composeInsert(selection.text, this.settings.defaultAuthor, context), selection.from, selection.to);
	}

	private setDefaultAuthor() {
		new AnnotationInputModal(this.app, {
			title: "Default author for new annotations",
			textLabel: null,
			initialAuthor: this.settings.defaultAuthor,
			submitLabel: "Save",
			onSubmit: async (_text, author) => {
				this.settings.defaultAuthor = author;
				await this.saveSettings();
				new Notice(author ? `Annotation Review: author set to ${author}.` : "Annotation Review: author label cleared.");
			}
		}).open();
	}

	private async rememberAuthor(author: string) {
		if (author === this.settings.defaultAuthor) return;
		this.settings.defaultAuthor = author;
		await this.saveSettings();
	}
}
