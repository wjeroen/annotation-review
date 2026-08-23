import { MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf, debounce } from "obsidian";
import { detectAnnotations } from "./src/detect";
import { computeMutation, AnnotationAction } from "./src/actions";
import { Annotation } from "./src/types";
import { AnnotationReviewView, VIEW_TYPE_ANNOTATION_REVIEW } from "./src/view";

export default class AnnotationReviewPlugin extends Plugin {
	annotations: Annotation[] = [];
	activeFile: TFile | null = null;

	async onload() {
		this.registerView(VIEW_TYPE_ANNOTATION_REVIEW, leaf => new AnnotationReviewView(leaf, this));

		this.addRibbonIcon("check-check", "Open Annotation Review", () => this.activateView());
		this.addCommand({
			id: "open-annotation-review",
			name: "Open Annotation Review sidebar",
			callback: () => this.activateView()
		});

		const debouncedRescan = debounce(() => this.rescanActiveFile(), 400, true);

		this.registerEvent(
			this.app.workspace.on("file-open", file => {
				this.activeFile = file;
				this.rescanActiveFile();
			})
		);
		this.registerEvent(
			this.app.workspace.on("editor-change", () => {
				debouncedRescan();
			})
		);

		this.app.workspace.onLayoutReady(() => {
			this.activeFile = this.app.workspace.getActiveFile();
			this.rescanActiveFile();
		});
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

	async rescanActiveFile() {
		const file = this.activeFile;
		if (!file || file.extension !== "md") {
			this.annotations = [];
			this.refreshView();
			return;
		}
		const content = await this.app.vault.read(file);
		this.annotations = detectAnnotations(content, file.path);
		this.refreshView();
	}

	refreshView() {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_ANNOTATION_REVIEW)) {
			const view = leaf.view;
			if (view instanceof AnnotationReviewView) view.render();
		}
	}

	async applyAction(annotation: Annotation, action: AnnotationAction) {
		const file = this.app.vault.getAbstractFileByPath(annotation.filePath);
		if (!(file instanceof TFile)) {
			new Notice("Annotation Review: could not find the file for this annotation.");
			return;
		}
		const content = await this.app.vault.read(file);
		const result = computeMutation(content, annotation, action);
		if (!result.ok) {
			new Notice(`Annotation Review: ${result.reason}`);
			await this.rescanActiveFile();
			return;
		}
		await this.app.vault.modify(file, result.newContent);
		await this.rescanActiveFile();
	}

	async jumpToAnnotation(annotation: Annotation) {
		const file = this.app.vault.getAbstractFileByPath(annotation.filePath);
		if (!(file instanceof TFile)) return;
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);
		const view = leaf.view;
		if (view instanceof MarkdownView) {
			const pos = view.editor.offsetToPos(annotation.matchStart);
			view.editor.setCursor(pos);
			view.editor.scrollIntoView({ from: pos, to: pos }, true);
		}
	}
}
