import { ItemView, MarkdownRenderer, Menu, WorkspaceLeaf, setIcon, setTooltip } from "obsidian";
import type AnnotationReviewPlugin from "../main";
import { AdmonitionBlock, Annotation, AnnotationType } from "./types";

export const VIEW_TYPE_ANNOTATION_REVIEW = "annotation-review-view";

const TYPE_LABELS: Record<AnnotationType, string> = {
	comment: "Comment",
	delete: "Delete",
	replace: "Replace",
	insert: "Insert"
};

const NO_AUTHOR = "__none__";
const ALL_VALUE = "";

function authorHue(name: string): number {
	let h1 = 0;
	for (let i = 0; i < name.length; i++) {
		h1 = (h1 * 31 + name.charCodeAt(i)) | 0;
	}
	let h2 = 0;
	for (let i = name.length - 1; i >= 0; i--) {
		h2 = (h2 * 37 + name.charCodeAt(i)) | 0;
	}
	return ((h1 ^ h2) >>> 0) % 360;
}

export class AnnotationReviewView extends ItemView {
	plugin: AnnotationReviewPlugin;
	private activeTab: "annotations" | "admonitions" = "annotations";
	private selectedAuthor: string = ALL_VALUE;
	private selectedAdType: string = ALL_VALUE;
	private admonitionsExpanded = false;

	constructor(leaf: WorkspaceLeaf, plugin: AnnotationReviewPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_ANNOTATION_REVIEW;
	}

	getDisplayText() {
		return "Annotation Review";
	}

	getIcon() {
		return "check-check";
	}

	async onOpen() {
		this.render();
	}

	render() {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("annotation-review-container");

		this.renderToolbar(container);

		if (this.activeTab === "annotations") {
			this.renderAnnotationsTab(container);
		} else {
			this.renderAdmonitionsTab(container);
		}
	}

	private renderToolbar(container: Element) {
		const toolbar = container.createEl("div", { cls: "annotation-review-toolbar" });

		const tabs = toolbar.createEl("div", { cls: "annotation-review-tabs" });
		const annotationsTab = tabs.createEl("button", {
			cls: `annotation-review-tab ${this.activeTab === "annotations" ? "is-active" : ""}`
		});
		setIcon(annotationsTab, "check-check");
		setTooltip(annotationsTab, "Annotations");
		annotationsTab.addEventListener("click", () => {
			this.activeTab = "annotations";
			this.render();
		});

		const admonitionsTab = tabs.createEl("button", {
			cls: `annotation-review-tab ${this.activeTab === "admonitions" ? "is-active" : ""}`
		});
		setIcon(admonitionsTab, "info");
		setTooltip(admonitionsTab, "Admonitions");
		admonitionsTab.addEventListener("click", () => {
			this.activeTab = "admonitions";
			this.render();
		});

		const refreshBtn = toolbar.createEl("button", { cls: "clickable-icon" });
		setIcon(refreshBtn, "refresh-cw");
		setTooltip(refreshBtn, "Refresh");
		refreshBtn.addEventListener("click", () => this.plugin.rescanActiveFile());
	}

	private createFilterButton(container: Element, label: string, buildMenu: (menu: Menu) => void): HTMLElement {
		const btn = container.createEl("button", { cls: "annotation-review-filter-btn" });
		btn.createEl("span", { cls: "annotation-review-filter-label", text: label });
		const chevron = btn.createEl("span", { cls: "annotation-review-filter-chevron" });
		setIcon(chevron, "chevron-down");
		btn.addEventListener("click", () => {
			const menu = new Menu();
			buildMenu(menu);
			const rect = btn.getBoundingClientRect();
			menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
		});
		return btn;
	}

	private renderAnnotationsTab(container: Element) {
		const annotations = this.plugin.annotations;

		const authors = new Set<string>();
		let hasNoAuthor = false;
		for (const a of annotations) {
			if (a.author) authors.add(a.author);
			else hasNoAuthor = true;
		}
		const sortedAuthors = Array.from(authors).sort((a, b) => a.localeCompare(b));

		const filterRow = container.createEl("div", { cls: "annotation-review-filter-row" });
		const currentLabel =
			this.selectedAuthor === ALL_VALUE ? "All authors" : this.selectedAuthor === NO_AUTHOR ? "No author" : this.selectedAuthor;
		this.createFilterButton(filterRow, currentLabel, menu => {
			menu.addItem(item =>
				item
					.setTitle("All authors")
					.setChecked(this.selectedAuthor === ALL_VALUE)
					.onClick(() => {
						this.selectedAuthor = ALL_VALUE;
						this.render();
					})
			);
			for (const author of sortedAuthors) {
				menu.addItem(item =>
					item
						.setTitle(author)
						.setChecked(this.selectedAuthor === author)
						.onClick(() => {
							this.selectedAuthor = author;
							this.render();
						})
				);
			}
			if (hasNoAuthor) {
				menu.addItem(item =>
					item
						.setTitle("No author")
						.setChecked(this.selectedAuthor === NO_AUTHOR)
						.onClick(() => {
							this.selectedAuthor = NO_AUTHOR;
							this.render();
						})
				);
			}
		});

		const filtered = annotations.filter(a => {
			if (this.selectedAuthor === ALL_VALUE) return true;
			if (this.selectedAuthor === NO_AUTHOR) return !a.author;
			return a.author === this.selectedAuthor;
		});

		const list = container.createEl("div", { cls: "annotation-review-list" });
		if (filtered.length === 0) {
			list.createEl("div", {
				cls: "annotation-review-empty",
				text: annotations.length === 0 ? "No annotations found in this note." : "No annotations match this filter."
			});
			return;
		}

		for (const annotation of filtered) {
			this.renderAnnotationItem(list, annotation);
		}
	}

	private renderAnnotationItem(container: Element, annotation: Annotation) {
		const card = container.createEl("div", {
			cls: `annotation-review-card annotation-type-${annotation.type}`
		});

		const header = card.createEl("div", { cls: "annotation-review-header" });
		header.createEl("span", { cls: "annotation-review-badge", text: TYPE_LABELS[annotation.type] });
		if (annotation.author) {
			const hue = authorHue(annotation.author);
			const authorEl = header.createEl("span", {
				cls: "annotation-review-author",
				text: annotation.author
			});
			authorEl.style.backgroundColor = `hsla(${hue}, 55%, 45%, 0.45)`;
			authorEl.style.color = "var(--text-normal)";
		} else {
			header.createEl("span", { cls: "annotation-review-author annotation-review-author-none", text: "No author" });
		}
		header.createEl("span", { cls: "annotation-review-line", text: `Line ${annotation.line}` });

		const body = card.createEl("div", { cls: "annotation-review-body" });
		if (annotation.type === "insert") {
			body.createEl("div", {
				cls: "annotation-review-text annotation-review-insert-text",
				text: annotation.insertedText ?? ""
			});
		} else {
			body.createEl("div", { cls: "annotation-review-text", text: annotation.originalText });
		}

		if (annotation.type === "replace" && annotation.replacement) {
			body.createEl("div", { cls: "annotation-review-replacement", text: `→ ${annotation.replacement}` });
		}

		const note = annotation.type === "comment" ? annotation.commentText : annotation.reason;
		if (note) {
			body.createEl("div", { cls: "annotation-review-comment", text: note });
		}

		card.addEventListener("click", evt => {
			if ((evt.target as HTMLElement).closest("button")) return;
			this.plugin.jumpToOffset(annotation.filePath, annotation.matchStart);
		});

		const actions = card.createEl("div", { cls: "annotation-review-actions" });
		if (annotation.type !== "comment") {
			const approveBtn = actions.createEl("button", {
				cls: "annotation-review-approve",
				text: "Approve"
			});
			approveBtn.addEventListener("click", evt => {
				evt.stopPropagation();
				this.plugin.applyAction(annotation, "approve");
			});
		}
		const dismissBtn = actions.createEl("button", {
			cls: "annotation-review-dismiss",
			text: "Dismiss"
		});
		dismissBtn.addEventListener("click", evt => {
			evt.stopPropagation();
			this.plugin.applyAction(annotation, "dismiss");
		});
	}

	private renderAdmonitionsTab(container: Element) {
		const blocks = this.plugin.admonitions;
		const types = Array.from(new Set(blocks.map(b => b.adType))).sort((a, b) => a.localeCompare(b));

		const filterRow = container.createEl("div", { cls: "annotation-review-filter-row" });
		const currentLabel = this.selectedAdType === ALL_VALUE ? "All types" : this.selectedAdType;
		this.createFilterButton(filterRow, currentLabel, menu => {
			menu.addItem(item =>
				item
					.setTitle("All types")
					.setChecked(this.selectedAdType === ALL_VALUE)
					.onClick(() => {
						this.selectedAdType = ALL_VALUE;
						this.render();
					})
			);
			for (const t of types) {
				menu.addItem(item =>
					item
						.setTitle(t)
						.setChecked(this.selectedAdType === t)
						.onClick(() => {
							this.selectedAdType = t;
							this.render();
						})
				);
			}
		});

		const expandBtn = filterRow.createEl("button", { cls: "clickable-icon" });
		setIcon(expandBtn, this.admonitionsExpanded ? "chevrons-down-up" : "chevrons-up-down");
		setTooltip(expandBtn, this.admonitionsExpanded ? "Collapse all" : "Expand all");
		expandBtn.addEventListener("click", () => {
			this.admonitionsExpanded = !this.admonitionsExpanded;
			this.render();
		});

		const filtered = blocks.filter(b => this.selectedAdType === ALL_VALUE || b.adType === this.selectedAdType);

		const list = container.createEl("div", { cls: "annotation-review-list" });
		if (filtered.length === 0) {
			list.createEl("div", {
				cls: "annotation-review-empty",
				text: blocks.length === 0 ? "No admonition blocks found in this note." : "No admonition blocks match this filter."
			});
			return;
		}

		for (const block of filtered) {
			this.renderAdmonitionItem(list, block);
		}
	}

	private renderAdmonitionItem(container: Element, block: AdmonitionBlock) {
		const card = container.createEl("div", { cls: "annotation-review-card annotation-review-admonition-card" });

		const header = card.createEl("div", { cls: "annotation-review-header" });
		header.createEl("span", { cls: "annotation-review-ad-type", text: block.adType });
		header.createEl("span", { cls: "annotation-review-line", text: `Line ${block.line}` });

		const deleteBtn = header.createEl("button", { cls: "clickable-icon annotation-review-ad-delete" });
		setIcon(deleteBtn, "trash-2");
		setTooltip(deleteBtn, "Delete this block");
		deleteBtn.addEventListener("click", evt => {
			evt.stopPropagation();
			this.plugin.deleteAdmonition(block);
		});

		const renderZone = card.createEl("div", {
			cls: `annotation-review-ad-render ${this.admonitionsExpanded ? "is-expanded" : ""}`
		});
		MarkdownRenderer.render(this.app, block.raw, renderZone, block.filePath, this).catch(() => {
			renderZone.setText(block.preview);
		});

		card.addEventListener("click", evt => {
			if ((evt.target as HTMLElement).closest("button")) return;
			this.plugin.jumpToOffset(block.filePath, block.matchStart);
		});
	}
}
