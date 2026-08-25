import { Editor, EditorPosition, MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf, debounce } from "obsidian";
import { EditorView } from "@codemirror/view";
import { detectAdmonitionBlocks, detectAnnotations, getInsertContext } from "./src/detect";
import { computeAddReply, computeMutation, computeRemoval, computeSpanReplace, AnnotationAction, MutationResult } from "./src/actions";
import { AdmonitionBlock, Annotation, AnnotationType, Wrapper } from "./src/types";
import { AuthorModal, AnnotationTypePicker } from "./src/modals";
import { Composed, composeComment, composeDelete, composeInsert, composePointComment, composeReplace, openReply } from "./src/compose";
import { AnnotationReviewView, VIEW_TYPE_ANNOTATION_REVIEW } from "./src/view";
import { AnnotationReviewSettings, AnnotationReviewSettingTab, DEFAULT_SETTINGS } from "./src/settings";
import { editorExtensions } from "./src/editor";
import type { Extension } from "@codemirror/state";

/** How long to wait after the last keystroke before rescanning the note. */
const RESCAN_DELAY_MS = 400;

/** Obsidian's editor keeps its CodeMirror view on `cm`. Undocumented, so treated as optional. */
interface EditorWithCm extends Editor {
	cm?: EditorView;
}

/**
 * The annotation enclosing the range, the innermost one when braces are
 * nested. A caret is a range of zero width, and selecting an annotation
 * whole counts as being inside it.
 */
function innermostAt(annotations: Annotation[], from: number, to: number = from): Annotation | undefined {
	let best: Annotation | undefined;
	for (const a of annotations) {
		if (from < a.matchStart || to > a.matchEnd) continue;
		if (!best || a.matchEnd - a.matchStart < best.matchEnd - best.matchStart) best = a;
	}
	return best;
}

export default class AnnotationReviewPlugin extends Plugin {
	annotations: Annotation[] = [];
	admonitions: AdmonitionBlock[] = [];
	settings: AnnotationReviewSettings = { ...DEFAULT_SETTINGS };
	/** Path of the note the current annotation list came from. */
	scannedPath: string | null = null;
	/** The annotation the caret is inside, if any. */
	activeAnnotationId: string | null = null;
	/** Only the newest scan is allowed to publish its result. */
	private scanToken = 0;
	/**
	 * Registered once and mutated in place, since Obsidian reconfigures the
	 * editors from the same array when asked to.
	 */
	private editorExtensionSlot: Extension[] = [];

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_ANNOTATION_REVIEW, leaf => new AnnotationReviewView(leaf, this));
		this.addSettingTab(new AnnotationReviewSettingTab(this.app, this));

		this.editorExtensionSlot.push(...editorExtensions(this.settings));
		this.registerEditorExtension(this.editorExtensionSlot);

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

		// Obsidian has no caret-moved event, so this hangs off CodeMirror's
		// update listener instead. It fires for every editor, and the note is
		// worked out from the view that owns the editor.
		this.registerEditorExtension(
			EditorView.updateListener.of(update => {
				if (update.selectionSet || update.docChanged) {
					this.syncCursor(update.view, update.state.selection.main.head);
				}
			})
		);

		this.app.workspace.onLayoutReady(() => this.rescanActiveFile());
	}

	async loadSettings() {
		const saved = ((await this.loadData()) ?? {}) as Partial<AnnotationReviewSettings> & { wrapper?: Wrapper; insertWrapper?: Wrapper };
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
		// Nested objects, so a key added in a later version still gets its default.
		this.settings.filters = { ...DEFAULT_SETTINGS.filters, ...(saved.filters ?? {}) };
		this.settings.wrappers = { ...DEFAULT_SETTINGS.wrappers, ...(saved.wrappers ?? {}) };
		// The first 0.6.0 betas had one wrapper for three operations and one for
		// insertions, and only wrote footnotes. Carry that over rather than
		// silently switching someone to CriticMarkup.
		if (!saved.wrappers && (saved.wrapper || saved.insertWrapper)) {
			const w = saved.wrapper ?? "highlight";
			this.settings.wrappers = { comment: w, delete: w, replace: w, insert: saved.insertWrapper ?? "percent" };
			this.settings.fencedFallback = "highlight";
			this.settings.channel = "footnote";
			await this.saveSettings();
		}
		// A comment cannot hide its span, so percent marks are no longer offered for it.
		if (this.settings.wrappers.comment === "percent") this.settings.wrappers.comment = "highlight";
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** Swaps the editor extensions for ones built from the current settings, in every open editor. */
	applyEditorSettings() {
		this.editorExtensionSlot.length = 0;
		this.editorExtensionSlot.push(...editorExtensions(this.settings));
		this.app.workspace.updateOptions();
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

	private detect(content: string, filePath: string): Annotation[] {
		return detectAnnotations(content, filePath, { channel: this.settings.channel });
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
			this.activeAnnotationId = null;
			this.refreshView();
			return;
		}

		const content = await this.readContent(file);
		if (token !== this.scanToken) return;

		this.annotations = this.detect(content, file.path);
		this.admonitions = detectAdmonitionBlocks(content, file.path);
		this.scannedPath = file.path;
		// Offsets are fresh now, so work out the active card again before drawing.
		const editor = this.getEditorFor(file.path);
		this.activeAnnotationId = editor ? (innermostAt(this.annotations, editor.posToOffset(editor.getCursor()))?.id ?? null) : null;
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

	/** The note an editor belongs to, found through the view that owns it. */
	private pathForEditorView(cm: EditorView): string | null {
		let anyKnown = false;
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;
			const own = (view.editor as EditorWithCm).cm;
			if (own) anyKnown = true;
			if (own === cm) return view.file?.path ?? null;
		}
		// If no editor exposes its view at all, the active note is the best guess.
		return anyKnown ? null : this.app.workspace.getActiveFile()?.path ?? null;
	}

	/** Marks the card whose annotation the caret sits in, and scrolls it into view. */
	private syncCursor(cm: EditorView, offset: number) {
		if (this.pathForEditorView(cm) !== this.scannedPath) return;
		const id = innermostAt(this.annotations, offset)?.id ?? null;
		if (id === this.activeAnnotationId) return;
		this.activeAnnotationId = id;
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_ANNOTATION_REVIEW)) {
			const view = leaf.view;
			if (view instanceof AnnotationReviewView) view.setActiveAnnotation(id);
		}
	}

	async applyAction(annotation: Annotation, action: AnnotationAction) {
		const file = this.fileFor(annotation.filePath);
		if (!file) return;
		const content = await this.readContent(file);
		await this.applyMutation(file, computeMutation(content, annotation, action));
	}

	/**
	 * The reply field is prefilled with an author bracket, so the text typed
	 * into it carries whatever label the user wants. The label is read back
	 * off the front and written in the annotation's own channel.
	 */
	async addReply(annotation: Annotation, replyText: string) {
		const m = /^\[([^\]]*)\]\s*/.exec(replyText);
		const author = m ? m[1].trim() : "";
		const text = (m ? replyText.slice(m[0].length) : replyText).trim();
		if (!text) return;
		const file = this.fileFor(annotation.filePath);
		if (!file) return;
		const content = await this.readContent(file);
		await this.applyMutation(file, computeAddReply(content, annotation, author, text));
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
	private annotationActions(): { id: AnnotationType; label: string; icon: string; description: string; run: (editor: Editor) => void }[] {
		const author = () => this.settings.defaultAuthor;
		return [
			{
				id: "comment",
				label: "Comment",
				icon: "message-square",
				description: "Comment on the selection, reply to the annotation under the caret, or leave a note on the spot",
				run: editor => this.comment(editor)
			},
			{
				id: "delete",
				label: "Delete",
				icon: "strikethrough",
				description: "Propose removing the selected text",
				run: editor => this.annotate(editor, sel => composeDelete(sel, author(), this.wrapperFor("delete", editor)))
			},
			{
				id: "replace",
				label: "Replace",
				icon: "replace",
				description: "Propose new wording for the selected text",
				run: editor => this.annotate(editor, sel => composeReplace(sel, author(), this.wrapperFor("replace", editor)))
			},
			{
				id: "insert",
				label: "Insert",
				icon: "text-cursor-input",
				description: "Mark the selected text as newly inserted",
				run: editor => this.annotateInsert(editor)
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
		// has no submenus. Comment is always there and says what it will do,
		// the other three need a selection outside any annotation.
		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor) => {
				const hasSelection = !!editor.getSelection();
				const target = this.annotationAtCaret(editor);
				for (const action of this.annotationActions()) {
					if (action.id !== "comment" && (!hasSelection || target)) continue;
					const title = action.id !== "comment" ? action.label : target ? "Reply" : "Comment";
					menu.addItem(item =>
						item
							.setSection("annotation-review")
							.setTitle(title)
							.setIcon(action.icon)
							.onClick(() => action.run(editor))
					);
				}
			})
		);
	}

	/**
	 * The chosen wrapper for an operation, unless that is percent marks inside
	 * a fenced block, where they do not render and the fallback stands in.
	 * Highlights and braces work everywhere, so those choices hold inside
	 * admonitions too.
	 */
	private wrapperFor(type: AnnotationType, editor: Editor): Wrapper {
		const chosen = this.settings.wrappers[type];
		if (chosen !== "percent") return chosen;
		const context = getInsertContext(editor.getValue(), editor.posToOffset(editor.getCursor("from")));
		return context.kind === "fenced" ? this.settings.fencedFallback : chosen;
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

	private annotateInsert(editor: Editor) {
		const selection = this.requireSelection(editor);
		if (selection === null) return;
		const context = getInsertContext(editor.getValue(), editor.posToOffset(selection.from));
		const { wrappers, fencedFallback, defaultAuthor } = this.settings;
		this.annotate(editor, sel => composeInsert(sel, defaultAuthor, context, wrappers.insert, fencedFallback));
	}

	/**
	 * The annotation the caret or selection is inside, parsed fresh since the
	 * scanned list may be stale mid-edit.
	 */
	private annotationAtCaret(editor: Editor): Annotation | undefined {
		const path = this.app.workspace.getActiveFile()?.path ?? "";
		const from = editor.posToOffset(editor.getCursor("from"));
		const to = editor.posToOffset(editor.getCursor("to"));
		return innermostAt(this.detect(editor.getValue(), path), from, to);
	}

	/** Writes `text` at `at` and puts the caret `cursor` characters into it. */
	private insertAtCaret(editor: Editor, at: number, composed: Composed) {
		const pos = editor.offsetToPos(at);
		editor.replaceRange(composed.text, pos, pos);
		editor.setCursor(editor.offsetToPos(at + composed.cursor));
		editor.focus();
	}

	/**
	 * One command for every kind of remark, since a comment, a reason and a
	 * reply are the same thing in different places. Inside an annotation it
	 * adds a reply. On a selection outside any annotation it comments on that
	 * text. With nothing selected it leaves a comment on that spot.
	 */
	private comment(editor: Editor) {
		const { defaultAuthor: author, channel } = this.settings;
		const target = this.annotationAtCaret(editor);
		if (target) {
			this.insertAtCaret(editor, target.matchEnd, openReply(author, target.nextChannel));
			return;
		}
		if (editor.getSelection()) {
			this.annotate(editor, sel => composeComment(sel, author, this.wrapperFor("comment", editor), channel));
			return;
		}
		this.insertAtCaret(editor, editor.posToOffset(editor.getCursor()), composePointComment(author, channel));
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
