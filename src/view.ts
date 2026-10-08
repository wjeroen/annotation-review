import { ItemView, MarkdownRenderer, Menu, Platform, WorkspaceLeaf, setIcon, setTooltip } from "obsidian";
import type AnnotationReviewPlugin from "../main";
import { AdmonitionBlock, Annotation, AnnotationType, Authored, NoteAnnotations, TextSpan, AnnotationReply } from "./types";
import { AnnotationFilters, NotesSort } from "./settings";
import { applyChipColor } from "./authors";

/**
 * Sizes a textarea to its content, so it shows every line and grows as more
 * are typed. The height is set from scratch each time, so it shrinks too.
 */
function fitToContent(field: HTMLTextAreaElement) {
	field.style.height = "auto";
	const style = getComputedStyle(field);
	const extra =
		style.boxSizing === "border-box"
			? field.offsetHeight - field.clientHeight
			: -(parseFloat(style.paddingTop) + parseFloat(style.paddingBottom));
	field.style.height = `${field.scrollHeight + extra}px`;
}

/** How long the list is held in place while the keyboard opens, in milliseconds. */
const KEYBOARD_SETTLE_MS = 1500;

/** Breathing room left under a field brought up from behind the keyboard. */
const KEYBOARD_GAP_PX = 8;

/**
 * Keeps a field that has just taken focus clear of the on-screen keyboard.
 * A field near the end of the list is otherwise left behind the keyboard,
 * where it cannot be read or typed into.
 *
 * The list moves by the smallest amount that brings the field into view, so
 * a field already in the clear is left where it is and the card keeps the
 * text above it on screen. A field taller than what is left of the list is
 * shown from its top instead. The list is given room at its end only when it
 * cannot scroll far enough on its own, and only as much as is missing. The
 * move is a scrollTop of our own rather than scrollIntoView, which is free
 * to pick a target of its own and to scroll containers we do not own. It is
 * repeated while the keyboard slides open, since Obsidian resizes the app
 * around it and a scroll made during that is undone.
 */
function keepAboveKeyboard(field: HTMLElement, scrollArea: HTMLElement | null) {
	if (!Platform.isMobile || !scrollArea) return;
	const lift = () => {
		if (!field.isConnected || !scrollArea.isConnected) return stop();
		// Measured without any room of ours, so it is never counted twice.
		scrollArea.style.removeProperty("padding-bottom");
		const area = scrollArea.getBoundingClientRect();
		const box = field.getBoundingClientRect();
		// The drawer keeps its full height while the keyboard is up, so the
		// list's own bottom edge sits behind the keyboard. The keyboard's top,
		// from the height Obsidian sets on the root element, is the limit then.
		const viewport = window.visualViewport;
		const screenBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
		const keyboard = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--keyboard-height")) || 0;
		const bottom = Math.min(area.bottom, screenBottom - keyboard);
		const move =
			box.height > bottom - area.top || box.top < area.top
				? box.top - area.top
				: Math.max(0, box.bottom + KEYBOARD_GAP_PX - bottom);
		if (move === 0) return;
		const canScroll = scrollArea.scrollHeight - scrollArea.clientHeight - scrollArea.scrollTop;
		if (move > canScroll) scrollArea.style.paddingBottom = `${move - canScroll}px`;
		scrollArea.scrollTop += move;
	};
	const ticking = window.setInterval(lift, 100);
	const settled = window.setTimeout(() => window.clearInterval(ticking), KEYBOARD_SETTLE_MS);
	const stop = () => {
		window.clearInterval(ticking);
		window.clearTimeout(settled);
		field.removeEventListener("blur", onBlur);
		scrollArea.style.removeProperty("padding-bottom");
	};
	// A phone can blur a field for a moment while the keyboard opens, so a
	// blur only counts when the field really is not the one being typed into.
	const onBlur = () => {
		if (field !== field.ownerDocument.activeElement) stop();
	};
	field.addEventListener("blur", onBlur);
	lift();
}

/**
 * Every name on an annotation, its own and the ones on its comments. A
 * comment on a selection carries its author on the comment rather than on
 * the annotation, so reading only the annotation left the writer out of the
 * filter and put their card under No author.
 */
function authorsOf(annotation: Annotation): string[] {
	const names: string[] = [];
	if (annotation.author) names.push(annotation.author);
	for (const reply of annotation.replies) {
		if (reply.author && !names.includes(reply.author)) names.push(reply.author);
	}
	return names;
}

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
 * What the sidebar shows of a note's annotations under the current filters.
 * A linked set stays whole as soon as one of its members matches. Half a move
 * in the list is worse than a card the filter did not ask for. The list of
 * notes counts with this too, so the numbers on a note are the cards it opens
 * to.
 */
function visibleAnnotations(annotations: Annotation[], filters: AnnotationFilters, author: string): Annotation[] {
	const matches = (a: Annotation) => {
		if (!filters[a.type]) return false;
		const names = authorsOf(a);
		if (names.length === 0 && !filters.noAuthor) return false;
		if (a.isPlain && !filters.plain) return false;
		if (author === ALL_VALUE) return true;
		if (author === NO_AUTHOR) return names.length === 0;
		return names.includes(author);
	};
	const kept = new Set(annotations.filter(matches).map(a => a.link).filter((link): link is string => !!link));
	return annotations.filter(a => matches(a) || (a.link !== undefined && kept.has(a.link)));
}

interface EditableOptions {
	inline?: boolean;
	/**
	 * Makes the field erasable: submitting it empty removes this wider range
	 * instead. Without one, an empty submit just cancels.
	 */
	clearSpan?: TextSpan;
	/** Save the text exactly as typed. Annotated text carries its own spaces. */
	keepWhitespace?: boolean;
}

/**
 * Rewrites an author mark in whatever spelling it already has: metadata stays
 * metadata with its other fields intact, `[X]@@` stays `[X]@@`, and a label
 * keeps the whitespace after it. An empty author removes the mark, unless
 * metadata has other fields worth keeping.
 */
function rewriteAuthor(current: string, author: string, meta?: Record<string, unknown>): string {
	if (current.startsWith("{")) {
		const fields: Record<string, unknown> = author ? { author, ...(meta ?? {}) } : { ...(meta ?? {}) };
		return Object.keys(fields).length ? JSON.stringify(fields) + "@@" : "";
	}
	// The markers are not part of the name, so they stay put. They are known
	// by their shape, a letter and digits, wherever in the bracket they sit.
	const label = /^\[([^\]]*)\]@@$/.exec(current);
	if (label) {
		const markers = label[1]
			.split(":")
			.map(part => part.trim())
			.filter(part => /^[LT]\d+$/.test(part));
		const tail = markers.length ? `:${markers.join(":")}` : "";
		return author || tail ? `[${author}${tail}]@@` : "";
	}
	if (!author) return "";
	return `[${author}]` + current.replace(/^\[[^\]]*\]/, "");
}

export class AnnotationReviewView extends ItemView {
	plugin: AnnotationReviewPlugin;
	private activeTab: "annotations" | "admonitions" = "annotations";
	private selectedAuthor: string = ALL_VALUE;
	private selectedAdType: string = ALL_VALUE;
	private scrollArea: HTMLElement | null = null;
	private lastSignature = "";
	/** The list of every annotated note in the vault, in place of this note's cards. */
	private showNotes = false;
	/** What the last vault scan found, null while one is running for a list just opened. */
	private notes: NoteAnnotations[] | null = null;
	/** Only the newest vault scan may publish, like the note scans in the plugin. */
	private notesToken = 0;
	/** False while the panel is off screen, which on a phone means the drawer is closed. */
	private onScreen = true;
	private visibility: IntersectionObserver | null = null;

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
		// The list of notes is read when it opens, not with every change to
		// the note on screen.
		if (this.listingNotes()) return;
		if (this.dataSignature() === this.lastSignature) {
			this.setActiveAnnotation(this.plugin.activeAnnotationId);
			return;
		}
		if (this.isEditing()) return;
		this.render();
	}

	private listingNotes(): boolean {
		return this.activeTab === "annotations" && this.showNotes;
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

	/** Highlights the card the caret is in, without redrawing anything. */
	setActiveAnnotation(id: string | null) {
		const cards = Array.from(this.containerEl.querySelectorAll<HTMLElement>(".annotation-review-annotation-card"));
		let target: HTMLElement | null = null;
		for (const card of cards) {
			const on = id !== null && card.dataset.id === id;
			card.toggleClass("is-active", on);
			if (on) target = card;
		}
		// A panel that is off screen has no place to scroll in, so the scroll
		// waits for the moment it comes back. Without that, tapping an
		// annotation in the note with the drawer closed left the list wherever
		// it stood, until some later event scrolled it.
		if (target && this.onScreen) target.scrollIntoView({ block: "nearest" });
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
		// Coming back on screen, the card is taken from the plugin rather than
		// from anything kept here, since the answer can arrive after the tap:
		// a note that had not been scanned yet has no card to mark at all, and
		// the first tap in it used to be the one that got left behind.
		this.visibility = new IntersectionObserver(entries => {
			this.onScreen = entries.some(entry => entry.isIntersecting);
			if (this.onScreen) this.setActiveAnnotation(this.plugin.activeAnnotationId);
		});
		this.visibility.observe(this.containerEl);
	}

	async onClose() {
		this.visibility?.disconnect();
		this.visibility = null;
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
		if (this.listingNotes()) {
			this.renderNotesList(scrollArea);
		} else if (this.activeTab === "annotations") {
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
			// In the list of notes the authors are the whole vault's, so the
			// menu picks out every note one person annotated.
			const listed = this.showNotes ? (this.notes ?? []).flatMap(n => n.annotations) : this.plugin.annotations;
			const authors = new Set<string>();
			let hasNoAuthor = false;
			let hasMoreReplies = false;
			for (const a of listed) {
				const names = authorsOf(a);
				for (const name of names) authors.add(name);
				if (names.length === 0) hasNoAuthor = true;
				const extra = a.replies.length - (this.noteOf(a) ? 1 : 0);
				if (extra > 1) hasMoreReplies = true;
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

			// What kinds of annotation to show. Saved, and the same for every
			// note, unlike the author filter, which lasts while the panel is open.
			const filters = this.plugin.settings.filters;
			const anyOff = Object.values(filters).some(v => !v);
			const filterBtn = filterRow.createEl("button", {
				cls: `clickable-icon annotation-review-filter-toggle ${anyOff ? "is-active" : ""}`
			});
			setIcon(filterBtn, "list-filter");
			setTooltip(filterBtn, "Filter");
			filterBtn.addEventListener("click", () => {
				const menu = new Menu();
				const toggle = (title: string, key: keyof AnnotationFilters) =>
					menu.addItem(item =>
						item
							.setTitle(title)
							.setChecked(filters[key])
							.onClick(() => {
								filters[key] = !filters[key];
								this.plugin.saveLocalState();
								this.render();
							})
					);
				toggle("Comments", "comment");
				toggle("Deletions", "delete");
				toggle("Insertions", "insert");
				toggle("Replacements", "replace");
				menu.addSeparator();
				toggle("No author", "noAuthor");
				toggle("Bare selections", "plain");
				const rect = filterBtn.getBoundingClientRect();
				menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
			});

			if (this.showNotes) {
				// The order of the list of notes, in the place the expand toggle
				// has on the cards. Kept on this device, like the filters.
				const sortBtn = filterRow.createEl("button", { cls: "clickable-icon" });
				setIcon(sortBtn, "arrow-up-down");
				setTooltip(sortBtn, "Sort");
				sortBtn.addEventListener("click", () => {
					const menu = new Menu();
					const choice = (title: string, value: NotesSort) =>
						menu.addItem(item =>
							item
								.setTitle(title)
								.setChecked(this.plugin.settings.notesSort === value)
								.onClick(() => {
									this.plugin.settings.notesSort = value;
									this.plugin.saveLocalState();
									this.render();
								})
						);
					choice("Most annotations", "count");
					choice("Recently changed", "recent");
					const rect = sortBtn.getBoundingClientRect();
					menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
				});
			} else if (hasMoreReplies) {
				// The first reply is always shown, so the toggle only matters
				// once some annotation has more than one.
				const expandBtn = filterRow.createEl("button", { cls: "clickable-icon" });
				setIcon(expandBtn, this.plugin.settings.repliesExpanded ? "chevrons-down-up" : "chevrons-up-down");
				setTooltip(expandBtn, this.plugin.settings.repliesExpanded ? "Collapse comments" : "Expand comments");
				expandBtn.addEventListener("click", () => {
					this.plugin.settings.repliesExpanded = !this.plugin.settings.repliesExpanded;
					this.plugin.saveLocalState();
					this.render();
				});
			}

			// Everything after this sits at the right end, so the notes button
			// keeps its place next to Refresh whatever the author label says.
			filterRow.createEl("div", { cls: "annotation-review-spacer" });

			// Every note in the vault that holds an annotation. The vault is
			// read each time the list opens, so it is never older than that.
			const notesBtn = filterRow.createEl("button", {
				cls: `clickable-icon annotation-review-notes-toggle ${this.showNotes ? "is-active" : ""}`
			});
			setIcon(notesBtn, "files");
			setTooltip(notesBtn, this.showNotes ? "Back to this note" : "Notes with annotations");
			notesBtn.addEventListener("click", () => {
				this.showNotes = !this.showNotes;
				// A list just opened starts at the top.
				this.scrollArea = null;
				if (this.showNotes) void this.loadNotes(true);
				else this.render();
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
			setIcon(expandBtn, this.plugin.settings.admonitionsExpanded ? "chevrons-down-up" : "chevrons-up-down");
			setTooltip(expandBtn, this.plugin.settings.admonitionsExpanded ? "Collapse all" : "Expand all");
			expandBtn.addEventListener("click", () => {
				this.plugin.settings.admonitionsExpanded = !this.plugin.settings.admonitionsExpanded;
				this.plugin.saveLocalState();
				this.render();
			});

			filterRow.createEl("div", { cls: "annotation-review-spacer" });
		}

		const refreshBtn = filterRow.createEl("button", { cls: "clickable-icon annotation-review-refresh" });
		setIcon(refreshBtn, "refresh-cw");
		setTooltip(refreshBtn, "Refresh");
		refreshBtn.addEventListener("click", () => (this.listingNotes() ? void this.loadNotes(false) : void this.plugin.rescanActiveFile()));
	}

	private renderAnnotationsList(container: Element) {
		const annotations = this.plugin.annotations;
		const filtered = visibleAnnotations(annotations, this.plugin.settings.filters, this.selectedAuthor);

		const list = container.createEl("div", { cls: "annotation-review-list" });
		if (filtered.length === 0) {
			list.createEl("div", {
				cls: "annotation-review-empty",
				text: annotations.length === 0 ? "No annotations found in this note." : "No annotations match these filters."
			});
			return;
		}

		const sets = new Map<string, Annotation[]>();
		for (const annotation of filtered) {
			if (!annotation.link) continue;
			const members = sets.get(annotation.link) ?? [];
			members.push(annotation);
			sets.set(annotation.link, members);
		}

		const drawn = new Set<string>();
		for (const annotation of filtered) {
			const members = annotation.link ? sets.get(annotation.link) : undefined;
			// A link with nobody else on it is just an annotation.
			if (!members || members.length < 2) {
				this.renderAnnotationItem(list, annotation);
				continue;
			}
			if (drawn.has(annotation.link as string)) continue;
			drawn.add(annotation.link as string);
			this.renderLinkedSet(list, members);
		}
	}

	/**
	 * Annotations that carry the same link are one decision, a move being a
	 * deletion in one place and an insertion in another, so they are drawn
	 * together where the first of them sits, however far apart they are in the
	 * note. The header acts on all of them at once. Each keeps its own card,
	 * its own line number and its own buttons, since a set can still be taken
	 * apart on purpose.
	 */
	private renderLinkedSet(container: Element, members: Annotation[]) {
		const box = container.createEl("div", { cls: "annotation-review-linked" });
		const header = box.createEl("div", { cls: "annotation-review-linked-header" });
		const label = header.createEl("span", { cls: "annotation-review-linked-label" });
		setIcon(label.createEl("span", { cls: "annotation-review-linked-icon" }), "link");
		label.createEl("span", { text: `${members.length} linked [${members[0].link}]` });

		const actions = header.createEl("div", { cls: "annotation-review-actions" });
		// A comment cannot be approved, so the button is only there for a set
		// that holds something else.
		if (members.some(a => a.type !== "comment")) {
			const approveBtn = actions.createEl("button", { cls: "annotation-review-approve" });
			setIcon(approveBtn.createEl("span", { cls: "annotation-review-action-icon" }), "check");
			approveBtn.createEl("span", { cls: "annotation-review-action-label", text: "Approve all" });
			approveBtn.addEventListener("click", evt => {
				evt.stopPropagation();
				this.plugin.applyLinkedAction(members, "approve");
			});
		}
		const dismissBtn = actions.createEl("button", { cls: "annotation-review-dismiss" });
		setIcon(dismissBtn.createEl("span", { cls: "annotation-review-action-icon" }), "x");
		dismissBtn.createEl("span", { cls: "annotation-review-action-label", text: "Dismiss all" });
		dismissBtn.addEventListener("click", evt => {
			evt.stopPropagation();
			this.plugin.applyLinkedAction(members, "dismiss");
		});

		const thread = box.createEl("div", { cls: "annotation-review-linked-body" });
		for (const annotation of members) this.renderAnnotationItem(thread, annotation);
	}

	/** The text with every annotation nested inside it cut out. Spans are relative to the annotation, the list is absolute. */
	private withoutNested(annotation: Annotation, span: TextSpan, text: string): string {
		const start = annotation.matchStart + span.start;
		const end = annotation.matchStart + span.end;
		const cuts = this.plugin.annotations
			.filter(n => n !== annotation && n.matchStart >= start && n.matchEnd <= end && n.matchEnd > n.matchStart)
			.map(n => ({ from: n.matchStart - start, to: n.matchEnd - start }))
			.sort((a, b) => a.from - b.from);
		if (cuts.length === 0) return text;
		let out = "";
		let pos = 0;
		for (const cut of cuts) {
			if (cut.from < pos) continue;
			out += text.slice(pos, cut.from);
			pos = cut.to;
		}
		return out + text.slice(pos);
	}

	/** A text field that turns into an inline editor on click. */
	private renderEditableText(
		container: Element,
		cls: string,
		annotation: Annotation,
		span: TextSpan,
		text: string,
		options: EditableOptions = {}
	): HTMLElement {
		const el = container.createEl(options.inline ? "span" : "div", { cls: `${cls} annotation-review-editable` });

		// An annotation nested inside this text has a card of its own, so the
		// display leaves it out, syntax and all. The edit box keeps the raw
		// text, so what you edit is exactly what is in the note.
		const shown = this.withoutNested(annotation, span, text);
		const showDisplay = () => {
			el.empty();
			el.removeClass("annotation-review-whitespace");
			// Text that is nothing but spaces or line breaks would show as an
			// empty box, so say what it is instead.
			if (shown.length > 0 && shown.trim().length === 0) {
				el.setText(shown.includes("\n") ? "(blank line)" : "(space)");
				el.addClass("annotation-review-whitespace");
			} else {
				el.setText(shown);
			}
		};
		showDisplay();
		setTooltip(el, options.clearSpan ? "Click to edit, clear to remove" : "Click to edit");

		el.addEventListener("click", evt => {
			evt.stopPropagation();
			el.empty();
			el.removeClass("annotation-review-whitespace");
			const input = el.createEl("textarea", { cls: "annotation-review-edit-input", attr: { rows: "1" } });
			input.value = text;
			input.addEventListener("input", () => fitToContent(input));
			input.focus();
			input.select();
			fitToContent(input);
			keepAboveKeyboard(input, this.scrollArea);

			let committed = false;
			const commit = () => {
				if (committed) return;
				committed = true;
				const newVal = options.keepWhitespace ? input.value : input.value.trim();
				// Give up focus first, otherwise the refresh that follows the
				// save is suppressed as an edit in progress and the panel keeps
				// showing the old text.
				input.blur();
				if (!newVal && options.clearSpan) {
					this.plugin.replaceSpan(annotation, options.clearSpan.start, options.clearSpan.end, "");
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

	/** Sets, changes or clears an author, in whatever spelling it already has. */
	private saveAuthor(annotation: Annotation, target: Authored, newAuthor: string) {
		if (target.authorSpan) {
			const current = annotation.fullMatch.slice(target.authorSpan.start, target.authorSpan.end);
			this.plugin.replaceSpan(annotation, target.authorSpan.start, target.authorSpan.end, rewriteAuthor(current, newAuthor, target.authorMeta));
		} else if (newAuthor) {
			const p = target.authorInsert;
			this.plugin.replaceSpan(annotation, p.at, p.at, `${p.prefix}${newAuthor}${p.suffix}`);
		}
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
				applyChipColor(el, author, this.plugin.settings.authorColors);
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
			keepAboveKeyboard(input, this.scrollArea);

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
	 * A hidden single-line form revealed by a toolbar button, for replies. It
	 * sits above the action buttons so the field has the full card width and
	 * appears where its result will show up.
	 */
	private createInlineForm(
		container: Element,
		placeholder: string,
		onSubmit: (text: string) => void,
		prefill?: { value: string; cursor: number }
	) {
		const form = container.createEl("div", { cls: "annotation-review-inline-form is-hidden" });
		// A textarea rather than an input so a long reply wraps and the field
		// grows with it. Enter still submits, and any newline a paste brings
		// in becomes a space, since an entry is one line in the note.
		const input = form.createEl("textarea", {
			cls: "annotation-review-inline-input",
			attr: { rows: "1", placeholder }
		});
		input.addEventListener("input", () => fitToContent(input));
		const sendBtn = form.createEl("button", { cls: "clickable-icon" });
		setIcon(sendBtn, "send");
		setTooltip(sendBtn, "Save");

		const submit = () => {
			const text = input.value.replace(/\s*\n\s*/g, " ").trim();
			input.blur();
			// Submitting an empty field, including one left at just its
			// prefilled brackets, closes it. Otherwise there is no way to put
			// away a field opened by mistake.
			if (!text || text === "[]" || /^\[[^\]]*\]$/.test(text)) {
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
				// Only now that it is shown, since a hidden field measures as empty.
				fitToContent(input);
				input.focus();
				if (prefill) input.setSelectionRange(prefill.cursor, prefill.cursor);
				keepAboveKeyboard(input, this.scrollArea);
			}
		};
	}

	/**
	 * An author chip followed by text, the way a reply reads. The chip moves
	 * onto its own line when the text needs more than one.
	 */
	private renderAuthoredLine(
		container: Element,
		cls: string,
		author: string | undefined,
		onAuthor: (author: string) => void,
		renderText: (row: HTMLElement) => HTMLElement
	): HTMLElement {
		const row = container.createEl("div", { cls });
		this.renderAuthorBadge(row, author, `${cls}-author`, onAuthor);
		row.appendText(" ");
		const textEl = renderText(row);
		// An inline span reports one rect per line it occupies, so more than
		// one means the text didn't fit beside its author.
		window.setTimeout(() => {
			if (textEl.getClientRects().length > 1) row.addClass("is-stacked");
		}, 0);
		return row;
	}

	/**
	 * The entry shown as the annotation's own text rather than as a comment
	 * on it. For a comment on a selection that is the first reply, which is
	 * the comment itself. For a change it is the first reply when the
	 * change's author wrote it, since that is the reason for the change. A
	 * reply by someone else, or on an unauthored change, is a comment.
	 */
	private noteOf(annotation: Annotation): AnnotationReply | undefined {
		const first = annotation.replies[0];
		if (!first) return undefined;
		if (annotation.type === "comment" && !annotation.isPoint) return first;
		return annotation.author && first.author === annotation.author ? first : undefined;
	}

	private renderAnnotationItem(container: Element, annotation: Annotation) {
		const card = container.createEl("div", {
			cls: `annotation-review-card annotation-review-annotation-card annotation-type-${annotation.type} annotation-wrapper-${annotation.wrapper}`
		});
		card.dataset.id = annotation.id;
		if (annotation.id === this.plugin.activeAnnotationId) card.addClass("is-active");

		// Top to bottom: the text the annotation is about, then what and who
		// with the line number at the far end, then the replies.
		const body = card.createEl("div", { cls: "annotation-review-body" });
		if (annotation.type === "insert" && annotation.bodySpan) {
			this.renderEditableText(
				body,
				"annotation-review-text annotation-review-insert-text",
				annotation,
				annotation.bodySpan,
				annotation.insertedText ?? "",
				{ keepWhitespace: true }
			);
		} else if (annotation.originalSpan) {
			this.renderEditableText(body, "annotation-review-text", annotation, annotation.originalSpan, annotation.originalText, {
				keepWhitespace: true
			});
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
				annotation.replacement ?? "",
				{ keepWhitespace: true }
			);
		}

		// A comment on a selection reads like a comment on a spot with the
		// selected text above it: its first reply is the comment itself, that
		// reply's author goes in the header, and only later replies are
		// replies. A bare selection has no first reply, and no badge either,
		// since nothing says it is a comment.
		const note = this.noteOf(annotation);
		const replies = note ? annotation.replies.slice(1) : annotation.replies;
		const isSelectionComment = annotation.type === "comment" && !annotation.isPoint;

		// The type leads: it is what varies from card to card, and the louder
		// of the two chips. Same order as the syntax, operator then author.
		// No chip at all without an author: the note does not say who did it,
		// so the card does not either. Only replies say "No author".
		const header = card.createEl("div", { cls: "annotation-review-header" });
		if (!annotation.isPlain) header.createEl("span", { cls: "annotation-review-badge", text: TYPE_LABELS[annotation.type] });
		if (isSelectionComment) {
			// An unsigned comment shows no chip. Only a reply says No author.
			if (note?.author) this.renderAuthorBadge(header, note.author, "", a => this.saveAuthor(annotation, note, a));
		} else if (annotation.author) {
			this.renderAuthorBadge(header, annotation.author, "", a => this.saveAuthor(annotation, annotation, a));
		}

		// The comment itself, on its own line: a comment on a spot carries it
		// inside, a comment on a selection in its first reply.
		if (annotation.commentSpan) {
			this.renderEditableText(card, "annotation-review-note", annotation, annotation.commentSpan, annotation.commentText ?? "");
		} else if (note) {
			this.renderEditableText(card, "annotation-review-note", annotation, note.textSpan, note.text);
		}

		// The first reply is always shown, since for a change it is the
		// reason. The rest fold away.
		if (replies.length > 0) {
			const repliesEl = card.createEl("div", { cls: "annotation-review-replies" });
			const shown = this.plugin.settings.repliesExpanded ? replies : replies.slice(0, 1);
			for (const reply of shown) {
				const replyEl = this.renderAuthoredLine(
					repliesEl,
					"annotation-review-reply",
					reply.author,
					a => this.saveAuthor(annotation, reply, a),
					row => this.renderEditableText(row, "annotation-review-reply-text", annotation, reply.textSpan, reply.text, { inline: true })
				);
				const removeBtn = replyEl.createEl("button", { cls: "clickable-icon annotation-review-reply-dismiss" });
				setIcon(removeBtn, "x");
				setTooltip(removeBtn, "Dismiss this comment");
				removeBtn.addEventListener("click", evt => {
					evt.stopPropagation();
					this.plugin.replaceSpan(annotation, reply.fullSpan.start, reply.fullSpan.end, "");
				});
			}
			const hidden = replies.length - shown.length;
			if (hidden > 0) {
				repliesEl.createEl("div", {
					cls: "annotation-review-replies-collapsed",
					text: `${hidden} more ${hidden === 1 ? "comment" : "comments"}`
				});
			}
		}

		// Prefilled with an author bracket, since a reply's author has to be
		// typed as part of its text. The cursor lands inside the brackets when
		// there is no default author to fill in. An HTML comment is a note on
		// its own and takes no comments, so it gets no field.
		const defaultAuthor = this.plugin.settings.defaultAuthor;
		const replyPrefill = defaultAuthor
			? { value: `[${defaultAuthor}] `, cursor: defaultAuthor.length + 3 }
			: { value: "[] ", cursor: 1 };
		const replyForm =
			annotation.wrapper === "html"
				? null
				: this.createInlineForm(
						card,
						"Comment...",
						text => {
							// Show the replies, otherwise a new one lands under a collapsed
							// count and looks like nothing happened.
							this.plugin.settings.repliesExpanded = true;
							this.plugin.saveLocalState();
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
			approveBtn.createEl("span", { cls: "annotation-review-action-label", text: "Approve" });
			approveBtn.addEventListener("click", evt => {
				evt.stopPropagation();
				this.plugin.applyAction(annotation, "approve");
			});
		}
		const dismissBtn = actions.createEl("button", { cls: "annotation-review-dismiss" });
		const dismissIcon = dismissBtn.createEl("span", { cls: "annotation-review-action-icon" });
		setIcon(dismissIcon, "x");
		dismissBtn.createEl("span", { cls: "annotation-review-action-label", text: "Dismiss" });
		dismissBtn.addEventListener("click", evt => {
			evt.stopPropagation();
			this.plugin.applyAction(annotation, "dismiss");
		});

		// A comment goes on anything but an HTML comment, so the button sits
		// with the other two, kept in the quiet icon-button style so it reads
		// as a different kind of action. Nothing in the sidebar is called a
		// reply: the syntax has replies, the user just has comments. The line
		// number moves to the far end of this row.
		if (replyForm) {
			const commentBtn = actions.createEl("button", { cls: "clickable-icon annotation-review-comment" });
			const commentIcon = commentBtn.createEl("span", { cls: "annotation-review-action-icon" });
			setIcon(commentIcon, "message-square-plus");
			commentBtn.createEl("span", { cls: "annotation-review-comment-label", text: "Comment" });
			setTooltip(commentBtn, "Comment");
			commentBtn.addEventListener("click", evt => {
				evt.stopPropagation();
				replyForm.toggle();
			});
		}
		actions.createEl("span", { cls: "annotation-review-line", text: `Line ${annotation.line}` });
	}

	/**
	 * Reads the vault for the list of notes. A list just opened says it is
	 * scanning, while a refresh keeps the old list on screen until the new
	 * one is in, so it does not jump to the top and back.
	 */
	private async loadNotes(fresh: boolean) {
		const token = ++this.notesToken;
		if (fresh) {
			this.notes = null;
			this.render();
		}
		const notes = await this.plugin.scanVault();
		if (token !== this.notesToken) return;
		this.notes = notes;
		if (this.listingNotes()) this.render();
	}

	private renderNotesList(container: Element) {
		const list = container.createEl("div", { cls: "annotation-review-list" });
		if (this.notes === null) {
			list.createEl("div", { cls: "annotation-review-empty", text: "Scanning the vault..." });
			return;
		}
		const filters = this.plugin.settings.filters;
		const shown = this.notes
			.map(note => ({ note, visible: visibleAnnotations(note.annotations, filters, this.selectedAuthor) }))
			.filter(entry => entry.visible.length > 0);
		// The count is the cards a note opens to, the same numbers as its
		// badges. The vault scan returns the newest first and the sort keeps
		// that order between notes with as many, so a tie goes to the newest.
		if (this.plugin.settings.notesSort === "count") shown.sort((a, b) => b.visible.length - a.visible.length);
		if (shown.length === 0) {
			list.createEl("div", {
				cls: "annotation-review-empty",
				text: this.notes.length === 0 ? "No notes with annotations in this vault." : "No notes match these filters."
			});
			return;
		}
		for (const { note, visible } of shown) this.renderNoteCard(list, note, visible);
	}

	/**
	 * One note in the list: its name and folder, how many of each kind it
	 * holds in the colors of the type badges, and who wrote them. Both rows
	 * wrap when the sidebar is narrow. A bare selection is not known to be a
	 * comment, so it is counted on its own, in grey.
	 */
	private renderNoteCard(container: Element, note: NoteAnnotations, visible: Annotation[]) {
		const card = container.createEl("div", { cls: "annotation-review-card annotation-review-file-card" });
		card.createEl("div", { cls: "annotation-review-file-name", text: note.name });
		if (note.folder) card.createEl("div", { cls: "annotation-review-file-folder", text: note.folder });

		const counts = card.createEl("div", { cls: "annotation-review-file-row" });
		const count = (n: number, label: string, type?: AnnotationType) => {
			if (n === 0) return;
			const holder = counts.createEl("span", { cls: type ? `annotation-type-${type}` : "" });
			holder.createEl("span", { cls: "annotation-review-badge", text: `${n} ${label}` });
		};
		for (const type of ["delete", "insert", "replace", "comment"] as AnnotationType[]) {
			count(visible.filter(a => a.type === type && !a.isPlain).length, TYPE_LABELS[type], type);
		}
		count(visible.filter(a => a.isPlain).length, "Bare");

		const names = Array.from(new Set(visible.flatMap(authorsOf))).sort((a, b) => a.localeCompare(b));
		if (names.length > 0) {
			const authors = card.createEl("div", { cls: "annotation-review-file-row" });
			for (const name of names) {
				const chip = authors.createEl("span", { cls: "annotation-review-author", text: name });
				applyChipColor(chip, name, this.plugin.settings.authorColors);
			}
		}

		card.addEventListener("click", () => void this.openNote(note.path));
	}

	/**
	 * Opens a note from the list and goes back to its cards. The author filter
	 * stays as it was, so a note picked for one author opens on that author's
	 * cards.
	 */
	private async openNote(path: string) {
		this.showNotes = false;
		this.scrollArea = null;
		await this.plugin.openNote(path);
		await this.plugin.rescanActiveFile();
		this.render();
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
