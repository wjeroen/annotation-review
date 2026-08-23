import { MarkdownView, Notice, Plugin, TFile, WorkspaceLeaf, debounce } from "obsidian";
import { detectAdmonitionBlocks, detectAnnotations } from "./src/detect";
import { computeAddReply, computeEdit, computeMutation, computeRemoval, AnnotationAction } from "./src/actions";
import { AdmonitionBlock, Annotation } from "./src/types";
import { AnnotationReviewView, VIEW_TYPE_ANNOTATION_REVIEW } from "./src/view";

export default class AnnotationReviewPlugin extends Plugin {
	annotations: Annotation[] = [];
	admonitions: AdmonitionBlock[] = [];
	activeFile: TFile | null = null;

	async onload() {
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

		const debouncedRescan = debounce(() => this.rescanActiveFile(), 150, true);

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
			this.admonitions = [];
			this.refreshView();
			return;
		}
		const content = await this.app.vault.read(file);
		this.annotations = detectAnnotations(content, file.path);
		this.admonitions = detectAdmonitionBlocks(content, file.path);
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

	async addReply(annotation: Annotation, replyText: string) {
		const file = this.app.vault.getAbstractFileByPath(annotation.filePath);
		if (!(file instanceof TFile)) {
			new Notice("Annotation Review: could not find the file for this annotation.");
			return;
		}
		const content = await this.app.vault.read(file);
		const result = computeAddReply(content, annotation, replyText);
		if (!result.ok) {
			new Notice(`Annotation Review: ${result.reason}`);
			await this.rescanActiveFile();
			return;
		}
		await this.app.vault.modify(file, result.newContent);
		await this.rescanActiveFile();
	}

	async editText(annotation: Annotation, oldText: string, newText: string) {
		const file = this.app.vault.getAbstractFileByPath(annotation.filePath);
		if (!(file instanceof TFile)) {
			new Notice("Annotation Review: could not find the file for this annotation.");
			return;
		}
		const content = await this.app.vault.read(file);
		const result = computeEdit(content, annotation, oldText, newText);
		if (!result.ok) {
			new Notice(`Annotation Review: ${result.reason}`);
			await this.rescanActiveFile();
			return;
		}
		await this.app.vault.modify(file, result.newContent);
		await this.rescanActiveFile();
	}

	async deleteAdmonition(block: AdmonitionBlock) {
		const file = this.app.vault.getAbstractFileByPath(block.filePath);
		if (!(file instanceof TFile)) {
			new Notice("Annotation Review: could not find the file for this block.");
			return;
		}
		const content = await this.app.vault.read(file);
		const result = computeRemoval(content, block.matchStart, block.raw);
		if (!result.ok) {
			new Notice(`Annotation Review: ${result.reason}`);
			await this.rescanActiveFile();
			return;
		}
		await this.app.vault.modify(file, result.newContent);
		await this.rescanActiveFile();
	}

	async jumpToOffset(filePath: string, offset: number) {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file);
		const view = leaf.view;
		if (view instanceof MarkdownView) {
			const pos = view.editor.offsetToPos(offset);
			view.editor.setCursor(pos);
			view.editor.scrollIntoView({ from: pos, to: pos }, true);
		}
	}
}
