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
		this.renderFilterRow(container);

		const scrollArea = container.createEl("div", { cls: "annotation-review-scroll-area" });
		if (this.activeTab === "annotations") {
			this.renderAnnotationsList(scrollArea);
		} else {
			this.renderAdmonitionsList(scrollArea);
		}
	}

	private renderToolbar(container: Element) {
		const toolbar = container.createEl("div", { cls: "annotation-review-toolbar" });

		const tabs = toolbar.createEl("div", { cls: "annotation-review-tabs" });
		const annotationsTab = tabs.createEl("button", {
			cls: `annotation-review-tab ${this.activeTab === "annotations" ? "is-active" : ""}`
		});
		const annIcon = annotationsTab.createEl("span", { cls: "annotation-review-tab-icon" });
		setIcon(annIcon, "check-check");
		annotationsTab.createEl("span", { text: "Annotations" });
		annotationsTab.addEventListener("click", () => {
			this.activeTab = "annotations";
			this.render();
		});

		const admonitionsTab = tabs.createEl("button", {
			cls: `annotation-review-tab ${this.activeTab === "admonitions" ? "is-active" : ""}`
		});
		const admIcon = admonitionsTab.createEl("span", { cls: "annotation-review-tab-icon" });
		setIcon(admIcon, "info");
		admonitionsTab.createEl("span", { text: "Admonitions" });
		admonitionsTab.addEventListener("click", () => {
			this.activeTab = "admonitions";
			this.render();
		});
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

	private renderFilterRow(container: Element) {
		const filterRow = container.createEl("div", { cls: "annotation-review-filter-row" });

		if (this.activeTab === "annotations") {
			const authors = new Set<string>();
			let hasNoAuthor = false;
			for (const a of this.plugin.annotations) {
				if (a.author) authors.add(a.author);
				else hasNoAuthor = true;
			}
			const sortedAuthors = Array.from(authors).sort((a, b) => a.localeCompare(b));
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
		} else {
			const types = Array.from(new Set(this.plugin.admonitions.map(b => b.adType))).sort((a, b) => a.localeCompare(b));
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
		}

		const refreshBtn = filterRow.createEl("button", { cls: "clickable-icon annotation-review-refresh" });
		setIcon(refreshBtn, "refresh-cw");
		setTooltip(refreshBtn, "Refresh");
		refreshBtn.addEventListener("click", () => this.plugin.rescanActiveFile());
	}

	private renderAnnotationsList(container: Element) {
		const annotations = this.plugin.annotations;
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
			cls: `annotation-review-card annotation-review-annotation-card annotation-type-${annotation.type}`
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

		if (annotation.replies.length > 0) {
			const repliesEl = card.createEl("div", { cls: "annotation-review-replies" });
			for (const reply of annotation.replies) {
				const replyEl = repliesEl.createEl("div", { cls: "annotation-review-reply" });
				if (reply.author) {
					replyEl.createEl("span", { cls: "annotation-review-reply-author", text: `${reply.author}: ` });
				}
				replyEl.createEl("span", { text: reply.text });
			}
		}

		card.addEventListener("click", evt => {
			if ((evt.target as HTMLElement).closest("button, input")) return;
			this.plugin.jumpToOffset(annotation.filePath, annotation.matchStart);
		});

		if (annotation.fullMatch.startsWith("==")) {
			this.renderReplyForm(card, annotation);
		}

		const actions = card.createEl("div", { cls: "annotation-review-actions" });
		if (annotation.type !== "comment") {
			const approveBtn = actions.createEl("button", { cls: "annotation-review-approve" });
			const approveIcon = approveBtn.createEl("span", { cls: "annotation-review-action-icon" });
			setIcon(approveIcon, "check");
			approveBtn.createEl("span", { text: "Approve" });
			approveBtn.addEventListener("click", evt => {
				evt.stopPropagation();
				this.plugin.applyAction(annotation, "approve");
			});
		}
		const dismissBtn = actions.createEl("button", { cls: "annotation-review-dismiss" });
		const dismissIcon = dismissBtn.createEl("span", { cls: "annotation-review-action-icon" });
		setIcon(dismissIcon, "x");
		dismissBtn.createEl("span", { text: "Dismiss" });
		dismissBtn.addEventListener("click", evt => {
			evt.stopPropagation();
			this.plugin.applyAction(annotation, "dismiss");
		});
	}

	private renderReplyForm(card: Element, annotation: Annotation) {
		const replyRow = card.createEl("div", { cls: "annotation-review-reply-row" });
		const toggleBtn = replyRow.createEl("button", { cls: "clickable-icon" });
		setIcon(toggleBtn, "reply");
		setTooltip(toggleBtn, "Reply");

		const form = replyRow.createEl("div", { cls: "annotation-review-reply-form is-hidden" });
		const input = form.createEl("input", { cls: "annotation-review-reply-input", attr: { type: "text", placeholder: "Reply..." } });
		const sendBtn = form.createEl("button", { cls: "clickable-icon" });
		setIcon(sendBtn, "send");
		setTooltip(sendBtn, "Send reply");

		toggleBtn.addEventListener("click", evt => {
			evt.stopPropagation();
			const wasHidden = form.hasClass("is-hidden");
			form.toggleClass("is-hidden", !wasHidden);
			if (wasHidden) input.focus();
		});

		const submit = () => {
			const text = input.value.trim();
			if (!text) return;
			this.plugin.addReply(annotation, text);
		};
		sendBtn.addEventListener("click", evt => {
			evt.stopPropagation();
			submit();
		});
		input.addEventListener("click", evt => evt.stopPropagation());
		input.addEventListener("keydown", evt => {
			if (evt.key === "Enter") submit();
		});
	}

	private renderAdmonitionsList(container: Element) {
		const blocks = this.plugin.admonitions;
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

		const header = card.createEl("div", { cls: "annotation-review-ad-header" });
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
