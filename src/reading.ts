import { AuthorColors, applyChipColor, authorColor } from "./authors";
import { AuthorStyle } from "./settings";

/*
 * Styling annotations in reading view.
 *
 * Reading view is rendered HTML, so there is no document to decorate and no
 * caret to reveal for. Obsidian has already turned `==...==` into <mark>,
 * `~~...~~` into <del>, `^[...]` into a footnote, and dropped `%%...%%`
 * altogether, which is right for text that is hidden until approved. What is
 * left is literal brace syntax in text nodes, and operator marks inside
 * <mark> and <del>. This walks the rendered block and restyles those, using
 * the same classes as live preview so the two look the same.
 *
 * Only the simple cases are handled: an annotation whose text has no inline
 * formatting of its own. One split across elements, `{++**bold**++}`, is
 * left as it is rather than half-styled. Code blocks and inline code are
 * never touched.
 */

export interface ReadingSettings {
	renderInEditor: boolean;
	changeAuthorStyle: AuthorStyle;
	commentAuthorStyle: AuthorStyle;
	authorColors: AuthorColors;
}

/** The chosen colors and styles, set for the duration of one processReadingView call, which is synchronous. */
let colors: AuthorColors = {};
let changeStyle: AuthorStyle = "chip";
let commentStyle: AuthorStyle = "underline";

const META_PREFIX = /^(\{[^}]*\}|\[[^\]]+\])@@/;
const LABEL_PREFIX = /^\[([^\]]+)\]\s+/;

function readAuthor(raw: string): string | undefined {
	if (raw.startsWith("[")) return raw.slice(1, -1);
	try {
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		const value = parsed?.author ?? parsed?.a;
		return typeof value === "string" && value ? value : undefined;
	} catch {
		return undefined;
	}
}

/** Splits an `@@` author prefix, or in prose a `[Author] ` label, off the front of `text`. */
function splitAuthor(text: string, allowLabel: boolean): { author?: string; rest: string } {
	const m = META_PREFIX.exec(text);
	if (m) return { author: readAuthor(m[1]), rest: text.slice(m[0].length) };
	if (allowLabel) {
		const l = LABEL_PREFIX.exec(text);
		if (l) return { author: l[1], rest: text.slice(l[0].length) };
	}
	return { rest: text };
}

/** A span of annotated text, styled for its operation and its author. */
function piece(cls: string, text: string, author: string | undefined, style: AuthorStyle): HTMLElement {
	const span = document.createElement("span");
	span.className = cls;
	span.textContent = text;
	if (author && style === "underline") {
		span.classList.add("arv-author");
		span.style.textDecorationColor = authorColor(author, colors);
		span.title = author;
	}
	return span;
}

function chip(author: string): HTMLElement {
	const el = document.createElement("span");
	el.className = "arv-chip";
	el.textContent = author;
	applyChipColor(el, author, colors);
	return el;
}

/**
 * The styled replacement for one annotation's inner text, markers included.
 * A prose entry is a `{>>...<<}` in running text, a reply or a comment on
 * a spot, and gets the small gap on both sides, as in the editor.
 */
function render(inner: string, isProse: boolean): DocumentFragment | null {
	const out = document.createDocumentFragment();
	const style = changeStyle;
	const withAuthor = (cls: string, text: string, author: string | undefined, s: AuthorStyle) => {
		if (author && s === "chip") out.appendChild(chip(author));
		out.appendChild(piece(cls, text, author, s));
	};
	const n = inner.length;
	const head = inner.slice(0, 2);
	const tail = inner.slice(-2);
	if (n >= 4 && head === "--" && tail === "--") {
		const { author, rest } = splitAuthor(inner.slice(2, -2), false);
		withAuthor("arv-del", rest, author, style);
		return out;
	}
	if (n >= 4 && head === "++" && tail === "++") {
		const { author, rest } = splitAuthor(inner.slice(2, -2), false);
		withAuthor("arv-ins", rest, author, style);
		return out;
	}
	if (n >= 4 && head === "~~" && tail === "~~") {
		const { author, rest } = splitAuthor(inner.slice(2, -2), false);
		const k = rest.indexOf("~>");
		if (k !== -1) {
			if (author && style === "chip") out.appendChild(chip(author));
			out.appendChild(piece("arv-del", rest.slice(0, k), author, style));
			out.appendChild(piece("arv-ins", rest.slice(k + 2), author, style));
			return out;
		}
	}
	if (isProse || (n >= 4 && head === ">>" && tail === "<<")) {
		const { author, rest } = splitAuthor(isProse ? inner : inner.slice(2, -2), true);
		withAuthor("arv-comment", rest, author, commentStyle);
		if (isProse && out.firstElementChild) out.firstElementChild.classList.add("arv-attached");
		if (out.lastElementChild) out.lastElementChild.classList.add("arv-gap-after");
		return out;
	}
	return null;
}

function insideCode(node: Node): boolean {
	let el: Node | null = node;
	while (el) {
		if (el instanceof HTMLElement && (el.tagName === "CODE" || el.tagName === "PRE")) return true;
		el = el.parentNode;
	}
	return false;
}

/**
 * Moves a chip at the start of `el` out in front of the <mark> it sits in,
 * so the yellow does not run behind it. The editor puts the chip in front
 * of the wrapper for the same reason.
 */
function hoistChip(el: Element) {
	const first = el.firstElementChild;
	if (!first || !first.classList.contains("arv-chip")) return;
	const mark = el.closest("mark");
	if (mark) mark.before(first);
}

/** Drops a leading `{` from the text node before `el` and a trailing `}` from the one after, if both are there. */
function stripBraces(el: Element): boolean {
	const before = el.previousSibling;
	const after = el.nextSibling;
	if (!(before instanceof Text) || !(after instanceof Text)) return false;
	if (!before.data.endsWith("{") || !after.data.startsWith("}")) return false;
	before.data = before.data.slice(0, -1);
	after.data = after.data.slice(1);
	return true;
}

const BRACE_OP = /\{(--|\+\+)((?:\{[^}]*\}|\[[^\]]+\])@@)?([\s\S]*?)\1\}/g;
const BRACE_COMMENT = /\{>>([\s\S]*?)<<\}/g;

export function processReadingView(root: HTMLElement, settings: ReadingSettings) {
	if (!settings.renderInEditor) return;
	colors = settings.authorColors;
	changeStyle = settings.changeAuthorStyle;
	commentStyle = settings.commentAuthorStyle;

	// Highlights: the operator marks and author sit inside the <mark>.
	for (const mark of Array.from(root.querySelectorAll("mark"))) {
		if (insideCode(mark) || mark.children.length > 0) continue;
		const text = mark.textContent ?? "";
		if (stripBraces(mark)) {
			// {==text==}: CriticMarkup's own comment span, which keeps
			// Obsidian's yellow the way a commented highlight does.
			const { author, rest } = splitAuthor(text, false);
			if (author) {
				mark.textContent = rest;
				if (commentStyle === "chip") mark.before(chip(author));
				else if (commentStyle === "underline") {
					mark.classList.add("arv-author");
					mark.style.textDecorationColor = authorColor(author, colors);
					mark.title = author;
				}
			}
			continue;
		}
		const styled = render(text, false);
		if (styled) {
			mark.textContent = "";
			mark.appendChild(styled);
			hoistChip(mark);
		} else {
			// A comment on a highlighted span, or a plain highlight: Obsidian's
			// yellow stays. Only an author prefix, if any, is taken off.
			const { author, rest } = splitAuthor(text, false);
			if (author) {
				mark.textContent = rest;
				if (commentStyle === "chip") mark.before(chip(author));
				else if (commentStyle === "underline") {
					mark.classList.add("arv-author");
					mark.style.textDecorationColor = authorColor(author, colors);
					mark.title = author;
				}
			}
		}
	}

	// {~~old~>new~~}: Obsidian renders the tildes as a strikethrough.
	for (const del of Array.from(root.querySelectorAll("del"))) {
		if (insideCode(del) || del.children.length > 0) continue;
		const text = del.textContent ?? "";
		if (!text.includes("~>")) continue;
		const styled = render(`~~${text}~~`, false);
		if (!styled) continue;
		const inBraces = stripBraces(del);
		if (!inBraces && !(del.parentElement instanceof HTMLElement && del.parentElement.tagName === "MARK")) continue;
		del.classList.add("arv-replace");
		del.textContent = "";
		del.appendChild(styled);
		hoistChip(del);
	}

	// Literal brace syntax in text: deletions, insertions and comments.
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
	const textNodes: Text[] = [];
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (node instanceof Text && !insideCode(node) && /\{(--|\+\+|>>)/.test(node.data)) textNodes.push(node);
	}
	for (const node of textNodes) {
		const data = node.data;
		const pattern = new RegExp(`${BRACE_OP.source}|${BRACE_COMMENT.source}`, "g");
		const fragment = document.createDocumentFragment();
		let last = 0;
		let m: RegExpExecArray | null;
		while ((m = pattern.exec(data)) !== null) {
			fragment.appendChild(document.createTextNode(data.slice(last, m.index)));
			const styled = m[1] !== undefined ? render(m[0].slice(1, -1), false) : render(m[4], true);
			if (styled) fragment.appendChild(styled);
			else fragment.appendChild(document.createTextNode(m[0]));
			last = m.index + m[0].length;
		}
		if (last === 0) continue;
		fragment.appendChild(document.createTextNode(data.slice(last)));
		node.replaceWith(fragment);
	}

	// Footnote bodies at the bottom: the label at the start becomes the author.
	for (const li of Array.from(root.querySelectorAll(".footnotes li, section.footnotes li"))) {
		const first = li.querySelector("p") ?? li;
		const node = first.firstChild;
		if (!(node instanceof Text)) continue;
		const { author, rest } = splitAuthor(node.data, true);
		if (!author) continue;
		node.data = rest;
		if (commentStyle === "chip") first.prepend(chip(author));
		else if (commentStyle === "underline") {
			const span = piece("", rest, author, commentStyle);
			node.replaceWith(span);
		}
	}
}
