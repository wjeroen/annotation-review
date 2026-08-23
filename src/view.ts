import { ItemView, MarkdownRenderer, Menu, WorkspaceLeaf, setIcon, setTooltip } from "obsidian";
import type AnnotationReviewPlugin from "../main";
import { AdmonitionBlock, Annotation, AnnotationType, TextSpan } from "./types";

export const VIEW_TYPE_ANNOTATION_REVIEW = "annotation-review-view";

const TYPE_LABELS: Record<AnnotationType, string> = {
	comment: "Comment",
	delete: "Delete",
	replace: "Replace",
	insert: "Insert"
};

const NO_AUTHOR = "__none__";
const ALL_VALUE = "";

/**
 * A stable hue per author name. Two hashes running in opposite directions get
 * mixed so that names sharing a prefix, like "Jeroen W" and "Jeroen B", land
 * far apart on the colour wheel instead of next to each other.
 */
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
	private repliesExpanded = false;

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
			let hasReplies = false;
			for (const a of this.plugin.annotations) {
				if (a.author) authors.add(a.author);
				else hasNoAuthor = true;
				if (a.replies.length > 0) hasReplies = true;
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

			if (hasReplies) {
				const expandBtn = filterRow.createEl("button", { cls: "clickable-icon" });
				setIcon(expandBtn, this.repliesExpanded ? "chevrons-down-up" : "chevrons-up-down");
				setTooltip(expandBtn, this.repliesExpanded ? "Collapse all replies" : "Expand all replies");
				expandBtn.addEventListener("click", () => {
					this.repliesExpanded = !this.repliesExpanded;
					this.render();
				});
			}
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

	/** A text field that turns into an inline editor on click. */
	private renderEditableText(container: Element, cls: string, annotation: Annotation, span: TextSpan, text: string) {
		const el = container.createEl("div", { cls: `${cls} annotation-review-editable` });

		const showDisplay = () => {
			el.empty();
			el.setText(text);
		};
		showDisplay();
		setTooltip(el, "Click to edit");

		el.addEventListener("click", evt => {
			evt.stopPropagation();
			el.empty();
			const input = el.createEl("textarea", { cls: "annotation-review-edit-input" });
			input.value = text;
			input.focus();
			input.select();

			const commit = () => {
				const newVal = input.value.trim();
				if (newVal && newVal !== text) {
					this.plugin.replaceSpan(annotation, span.start, span.end, newVal);
				} else {
					showDisplay();
				}
			};
			input.addEventListener("click", inner => inner.stopPropagation());
			input.addEventListener("blur", commit);
			input.addEventListener("keydown", inner => {
				if (inner.key === "Enter" && !inner.shiftKey) {
					inner.preventDefault();
					commit();
				} else if (inner.key === "Escape") {
					showDisplay();
				}
			});
		});
	}

	/** An author chip that turns into an inline editor on click. */
	private renderAuthorBadge(container: Element, author: string | undefined, extraCls: string, onSave: (author: string) => void) {
		const el = container.createEl("span", { cls: `annotation-review-author ${extraCls}` });

		const showDisplay = () => {
			el.empty();
			el.removeClass("annotation-review-author-none");
			el.style.removeProperty("background-color");
			el.style.removeProperty("color");
			if (author) {
				el.setText(author);
				el.style.backgroundColor = `hsla(${authorHue(author)}, 55%, 45%, 0.45)`;
				el.style.color = "var(--text-normal)";
			} else {
				el.setText("No author");
				el.addClass("annotation-review-author-none");
			}
		};
		showDisplay();
		setTooltip(el, "Click to set the author");

		el.addEventListener("click", evt => {
			evt.stopPropagation();
			el.empty();
			el.removeClass("annotation-review-author-none");
			el.style.removeProperty("background-color");
			const input = el.createEl("input", {
				cls: "annotation-review-author-input",
				attr: { type: "text", placeholder: "Author" }
			});
			input.value = author ?? "";
			input.focus();
			input.select();

			const commit = () => {
				const newVal = input.value.trim();
				if (newVal !== (author ?? "")) onSave(newVal);
				else showDisplay();
			};
			input.addEventListener("click", inner => inner.stopPropagation());
			input.addEventListener("blur", commit);
			input.addEventListener("keydown", inner => {
				if (inner.key === "Enter") {
					inner.preventDefault();
					commit();
				} else if (inner.key === "Escape") {
					showDisplay();
				}
			});
		});
	}

	/**
	 * A hidden single-line form revealed by a toolbar button. Used for both
	 * replies and reasons, which sit above the action buttons so the field has
	 * the full card width and appears where its result will show up.
	 */
	private createInlineForm(container: Element, placeholder: string, onSubmit: (text: string) => void) {
		const form = container.createEl("div", { cls: "annotation-review-inline-form is-hidden" });
		const input = form.createEl("input", {
			cls: "annotation-review-inline-input",
			attr: { type: "text", placeholder }
		});
		const sendBtn = form.createEl("button", { cls: "clickable-icon" });
		setIcon(sendBtn, "send");
		setTooltip(sendBtn, "Save");

		const submit = () => {
			const text = input.value.trim();
			if (!text) return;
			onSubmit(text);
		};
		sendBtn.addEventListener("click", evt => {
			evt.stopPropagation();
			submit();
		});
		input.addEventListener("click", evt => evt.stopPropagation());
		input.addEventListener("keydown", evt => {
			if (evt.key === "Enter") {
				evt.preventDefault();
				submit();
			} else if (evt.key === "Escape") {
				form.addClass("is-hidden");
			}
		});

		return {
			toggle: () => {
				const wasHidden = form.hasClass("is-hidden");
				form.toggleClass("is-hidden", !wasHidden);
				if (wasHidden) input.focus();
			}
		};
	}

	private renderAnnotationItem(container: Element, annotation: Annotation) {
		const card = container.createEl("div", {
			cls: `annotation-review-card annotation-review-annotation-card annotation-type-${annotation.type}`
		});

		const header = card.createEl("div", { cls: "annotation-review-header" });
		header.createEl("span", { cls: "annotation-review-badge", text: TYPE_LABELS[annotation.type] });
		this.renderAuthorBadge(header, annotation.author, "", newAuthor => {
			const replacement = newAuthor ? `[${newAuthor}] ` : "";
			if (annotation.authorSpan) {
				this.plugin.replaceSpan(annotation, annotation.authorSpan.start, annotation.authorSpan.end, replacement);
			} else if (newAuthor) {
				this.plugin.replaceSpan(annotation, annotation.authorInsertAt, annotation.authorInsertAt, replacement);
			}
		});
		header.createEl("span", { cls: "annotation-review-line", text: `Line ${annotation.line}` });

		const body = card.createEl("div", { cls: "annotation-review-body" });
		if (annotation.type === "insert" && annotation.bodySpan) {
			this.renderEditableText(
				body,
				"annotation-review-text annotation-review-insert-text",
				annotation,
				annotation.bodySpan,
				annotation.insertedText ?? ""
			);
		} else if (annotation.type !== "insert") {
			body.createEl("div", { cls: "annotation-review-text", text: annotation.originalText });
		}

		// The arrow sits on its own line so the old and new text stay left
		// aligned under each other and are easy to compare.
		if (annotation.type === "replace" && annotation.replacementSpan) {
			body.createEl("div", { cls: "annotation-review-arrow", text: "→" });
			this.renderEditableText(
				body,
				"annotation-review-replacement",
				annotation,
				annotation.replacementSpan,
				annotation.replacement ?? ""
			);
		}

		if (annotation.type === "comment" && annotation.bodySpan) {
			this.renderEditableText(body, "annotation-review-comment", annotation, annotation.bodySpan, annotation.commentText ?? "");
		} else if (annotation.reasonSpan) {
			this.renderEditableText(body, "annotation-review-comment", annotation, annotation.reasonSpan, annotation.reason ?? "");
		}

		// Each form sits where its result will end up: a reason under the body
		// where the reason renders, a reply under the replies list.
		const reasonInsert = annotation.reasonInsert;
		const reasonForm = reasonInsert
			? this.createInlineForm(card, "Reason...", text => {
					this.plugin.replaceSpan(annotation, reasonInsert.at, reasonInsert.at, `${reasonInsert.prefix}${text}${reasonInsert.suffix}`);
				})
			: null;

		if (annotation.replies.length > 0) {
			if (this.repliesExpanded) {
				const repliesEl = card.createEl("div", { cls: "annotation-review-replies" });
				for (const reply of annotation.replies) {
					const replyEl = repliesEl.createEl("div", { cls: "annotation-review-reply" });
					this.renderAuthorBadge(replyEl, reply.author, "annotation-review-reply-author", newAuthor => {
						const replacement = newAuthor ? `[${newAuthor}] ` : "";
						if (reply.authorSpan) {
							this.plugin.replaceSpan(annotation, reply.authorSpan.start, reply.authorSpan.end, replacement);
						} else if (newAuthor) {
							this.plugin.replaceSpan(annotation, reply.authorInsertAt, reply.authorInsertAt, replacement);
						}
					});
					this.renderEditableText(replyEl, "annotation-review-reply-text", annotation, reply.textSpan, reply.text);
				}
			} else {
				card.createEl("div", {
					cls: "annotation-review-replies-collapsed",
					text: `${annotation.replies.length} ${annotation.replies.length === 1 ? "reply" : "replies"}`
				});
			}
		}

		const replyForm = this.createInlineForm(card, "Reply...", text => this.plugin.addReply(annotation, text));

		card.addEventListener("click", evt => {
			if ((evt.target as HTMLElement).closest("button, input, textarea, .annotation-review-editable, .annotation-review-author")) return;
			this.plugin.jumpToOffset(annotation.filePath, annotation.matchStart);
		});

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

		const trailing = actions.createEl("div", { cls: "annotation-review-trailing-actions" });
		if (reasonForm) {
			const addReasonBtn = trailing.createEl("button", { cls: "clickable-icon" });
			setIcon(addReasonBtn, "plus");
			setTooltip(addReasonBtn, "Add a reason");
			addReasonBtn.addEventListener("click", evt => {
				evt.stopPropagation();
				reasonForm.toggle();
			});
		}
		const replyBtn = trailing.createEl("button", { cls: "clickable-icon" });
		setIcon(replyBtn, "reply");
		setTooltip(replyBtn, "Reply");
		replyBtn.addEventListener("click", evt => {
			evt.stopPropagation();
			replyForm.toggle();
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
