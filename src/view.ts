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
	private scrollArea: HTMLElement | null = null;
	private lastSignature = "";

	constructor(leaf: WorkspaceLeaf, plugin: AnnotationReviewPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	/**
	 * Rebuilding wipes the panel, which loses the scroll position and any open
	 * field, so a data refresh only redraws when something actually changed.
	 * Typing in a note fires constant rescans that mostly produce identical
	 * results, and redrawing on each of those made the list jump to the top.
	 */
	refreshFromData() {
		if (this.dataSignature() === this.lastSignature) return;
		if (this.isEditing()) return;
		this.render();
	}

	private dataSignature(): string {
		const annotations = this.plugin.annotations.map(a => `${a.matchStart}:${a.fullMatch}`).join("|");
		const admonitions = this.plugin.admonitions.map(b => `${b.matchStart}:${b.raw}`).join("|");
		return `${this.plugin.scannedPath}##${annotations}##${admonitions}`;
	}

	/** True while a field inside the panel has focus, so it isn't torn down mid-edit. */
	private isEditing(): boolean {
		const el = document.activeElement;
		if (!el || !this.containerEl.contains(el)) return false;
		return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
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
		const previousScroll = this.scrollArea?.scrollTop ?? 0;
		container.empty();
		container.addClass("annotation-review-container");

		this.renderToolbar(container);
		this.renderFilterRow(container);

		const scrollArea = container.createEl("div", { cls: "annotation-review-scroll-area" });
		this.scrollArea = scrollArea;
		if (this.activeTab === "annotations") {
			this.renderAnnotationsList(scrollArea);
		} else {
			this.renderAdmonitionsList(scrollArea);
		}

		if (previousScroll > 0) {
			scrollArea.scrollTop = previousScroll;
			// Admonitions render asynchronously and change the height as they
			// land, so put the scroll position back once more after that.
			window.setTimeout(() => {
				if (this.scrollArea === scrollArea) scrollArea.scrollTop = previousScroll;
			}, 0);
		}
		this.lastSignature = this.dataSignature();
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
			if (this.activeTab === "annotations") return;
			this.activeTab = "annotations";
			// A fresh tab starts at the top rather than inheriting the other
			// tab's scroll position.
			this.scrollArea = null;
			this.render();
		});

		const admonitionsTab = tabs.createEl("button", {
			cls: `annotation-review-tab ${this.activeTab === "admonitions" ? "is-active" : ""}`
		});
		const admIcon = admonitionsTab.createEl("span", { cls: "annotation-review-tab-icon" });
		setIcon(admIcon, "info");
		admonitionsTab.createEl("span", { text: "Admonitions" });
		admonitionsTab.addEventListener("click", () => {
			if (this.activeTab === "admonitions") return;
			this.activeTab = "admonitions";
			this.scrollArea = null;
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
				setIcon(expandBtn, this.plugin.settings.repliesExpanded ? "chevrons-down-up" : "chevrons-up-down");
				setTooltip(expandBtn, this.plugin.settings.repliesExpanded ? "Collapse all replies" : "Expand all replies");
				expandBtn.addEventListener("click", () => {
					this.plugin.settings.repliesExpanded = !this.plugin.settings.repliesExpanded;
					void this.plugin.saveSettings();
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
			setIcon(expandBtn, this.plugin.settings.admonitionsExpanded ? "chevrons-down-up" : "chevrons-up-down");
			setTooltip(expandBtn, this.plugin.settings.admonitionsExpanded ? "Collapse all" : "Expand all");
			expandBtn.addEventListener("click", () => {
				this.plugin.settings.admonitionsExpanded = !this.plugin.settings.admonitionsExpanded;
				void this.plugin.saveSettings();
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

	/**
	 * A text field that turns into an inline editor on click.
	 *
	 * `clearSpan` makes the field erasable: submitting it empty removes that
	 * wider range instead, which is how a reason takes the separator before it
	 * with it rather than leaving a dangling comma. Without one, an empty
	 * submit just cancels.
	 */
	private renderEditableText(
		container: Element,
		cls: string,
		annotation: Annotation,
		span: TextSpan,
		text: string,
		inline = false,
		clearSpan?: TextSpan
	): HTMLElement {
		const el = container.createEl(inline ? "span" : "div", { cls: `${cls} annotation-review-editable` });

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

			let committed = false;
			const commit = () => {
				if (committed) return;
				committed = true;
				const newVal = input.value.trim();
				// Give up focus first, otherwise the refresh that follows the
				// save is suppressed as an edit in progress and the panel keeps
				// showing the old text.
				input.blur();
				if (!newVal && clearSpan) {
					this.plugin.replaceSpan(annotation, clearSpan.start, clearSpan.end, "");
				} else if (newVal && newVal !== text) {
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

		return el;
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

			let committed = false;
			const commit = () => {
				if (committed) return;
				committed = true;
				const newVal = input.value.trim();
				input.blur();
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
	private createInlineForm(
		container: Element,
		placeholder: string,
		onSubmit: (text: string) => void,
		prefill?: { value: string; cursor: number }
	) {
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
			input.blur();
			// Submitting an empty field, including one left at just its
			// prefilled brackets, closes it. Otherwise there is no way to put
			// away a field opened by mistake.
			if (!text || text === "[]") {
				input.value = "";
				form.addClass("is-hidden");
				return;
			}
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
				input.blur();
				form.addClass("is-hidden");
			}
		});

		return {
			toggle: () => {
				const wasHidden = form.hasClass("is-hidden");
				form.toggleClass("is-hidden", !wasHidden);
				if (!wasHidden) return;
				if (prefill) input.value = prefill.value;
				input.focus();
				if (prefill) input.setSelectionRange(prefill.cursor, prefill.cursor);
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
		} else if (annotation.type !== "insert" && annotation.originalSpan) {
			this.renderEditableText(
				body,
				"annotation-review-text",
				annotation,
				annotation.originalSpan,
				annotation.originalText
			);
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
			// Clearing the field removes the reason, along with the comma that
			// introduced it, or the whole footnote when that is all it carried.
			this.renderEditableText(
				body,
				"annotation-review-comment",
				annotation,
				annotation.reasonSpan,
				annotation.reason ?? "",
				false,
				annotation.reasonClearSpan
			);
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
			if (this.plugin.settings.repliesExpanded) {
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
					replyEl.appendText(" ");
					const textEl = this.renderEditableText(
						replyEl,
						"annotation-review-reply-text",
						annotation,
						reply.textSpan,
						reply.text,
						true
					);
					const removeBtn = replyEl.createEl("button", { cls: "clickable-icon annotation-review-reply-dismiss" });
					setIcon(removeBtn, "x");
					setTooltip(removeBtn, "Dismiss this reply");
					removeBtn.addEventListener("click", evt => {
						evt.stopPropagation();
						this.plugin.replaceSpan(annotation, reply.fullSpan.start, reply.fullSpan.end, "");
					});

					// An inline span reports one rect per line it occupies, so
					// more than one means the reply didn't fit beside its author
					// and reads better with the author on its own line above.
					window.setTimeout(() => {
						if (textEl.getClientRects().length > 1) replyEl.addClass("is-stacked");
					}, 0);
				}
			} else {
				card.createEl("div", {
					cls: "annotation-review-replies-collapsed",
					text: `${annotation.replies.length} ${annotation.replies.length === 1 ? "reply" : "replies"}`
				});
			}
		}

		// Prefilled with an author bracket, since a reply's author has to be
		// typed as part of its text. The cursor lands inside the brackets when
		// there is no default author to fill in.
		const defaultAuthor = this.plugin.settings.defaultAuthor;
		const replyPrefill = defaultAuthor
			? { value: `[${defaultAuthor}] `, cursor: defaultAuthor.length + 3 }
			: { value: "[] ", cursor: 1 };
		const replyForm = this.createInlineForm(
			card,
			"Reply...",
			text => {
				// Show the replies, otherwise a new one lands under a collapsed
				// count and looks like nothing happened.
				this.plugin.settings.repliesExpanded = true;
				void this.plugin.saveSettings();
				this.plugin.addReply(annotation, text);
			},
			replyPrefill
		);

		card.addEventListener("click", evt => {
			if ((evt.target as HTMLElement).closest("button, input, textarea, .annotation-review-editable, .annotation-review-author")) return;
			this.plugin.revealRange(annotation.filePath, annotation.matchStart, annotation.matchEnd);
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
			cls: `annotation-review-ad-render ${this.plugin.settings.admonitionsExpanded ? "is-expanded" : ""}`
		});
		MarkdownRenderer.render(this.app, block.raw, renderZone, block.filePath, this).catch(() => {
			renderZone.setText(block.preview);
		});

		card.addEventListener("click", evt => {
			if ((evt.target as HTMLElement).closest("button")) return;
			this.plugin.revealRange(block.filePath, block.matchStart, block.matchEnd);
		});
	}
}
