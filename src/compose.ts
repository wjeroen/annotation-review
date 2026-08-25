import { InsertContext, Wrapper } from "./types";

/**
 * Writing annotations. The parser in `detect.ts` reads these back, so keeping
 * every format in one place means the two can't drift apart unnoticed. The
 * round trip is covered in tests/detect.mjs.
 *
 * Each one returns where the caret should land, so a command can drop the
 * annotation straight into the note and leave the caret wherever text still
 * needs typing, instead of asking for it in a dialog first.
 */

export interface Composed {
	text: string;
	/** Offset into `text` where the caret belongs. */
	cursor: number;
}

const OPEN: Record<Wrapper, string> = { highlight: "==", brace: "{", percent: "%%" };
const CLOSE: Record<Wrapper, string> = { highlight: "==", brace: "}", percent: "%%" };

function wrap(wrapper: Wrapper, inner: string): string {
	return OPEN[wrapper] + inner + CLOSE[wrapper];
}

/** An author-only footnote, or nothing when there is no author to name. */
function authorFootnote(author: string): string {
	return author ? `^[[${author}]]` : "";
}

/** A footnote left open for typing, so the caret goes just before its closing bracket. */
function openFootnote(author: string): string {
	return author ? `^[[${author}] ]` : "^[]";
}

function withOpenFootnote(body: string, author: string): Composed {
	const text = body + openFootnote(author);
	return { text, cursor: text.length - 1 };
}

/**
 * Caret inside the footnote, ready for the comment. A comment has no operator,
 * except with braces, where `{==text==}` is CriticMarkup's own way of marking
 * a span for a comment, since bare braces mean nothing.
 */
export function composeComment(selected: string, author: string, wrapper: Wrapper): Composed {
	const inner = wrapper === "brace" ? `==${selected}==` : selected;
	return withOpenFootnote(wrap(wrapper, inner), author);
}

/** Caret inside the footnote, ready for an optional reason. */
export function composeDelete(selected: string, author: string, wrapper: Wrapper): Composed {
	return withOpenFootnote(wrap(wrapper, `--${selected}--`), author);
}

/** Caret after the arrow, ready for the replacement text. */
export function composeReplace(selected: string, author: string, wrapper: Wrapper): Composed {
	const head = `${OPEN[wrapper]}--${selected}~>`;
	const text = `${head}++${CLOSE[wrapper]}${authorFootnote(author)}`;
	return { text, cursor: head.length };
}

/**
 * The two halves of an insertion, with the footnote going between them.
 *
 * Inside an existing percent mark annotation the new one closes and reopens
 * it, and closes and reopens its operator too, so `%%++A B++%%` becomes
 * `%%++A ++%%%%++X++%%%%++B++%%`, three well formed insertions in a row.
 * Percent marks do not render inside a fenced block, so a highlight is used
 * there instead.
 */
function insertParts(selected: string, context: InsertContext, wrapper: Wrapper): { pre: string; post: string } {
	if (context.kind === "nested") {
		return { pre: `${context.marker}%%%%++${selected}++%%`, post: `%%${context.marker}` };
	}
	const w = context.kind === "fenced" && wrapper === "percent" ? "highlight" : wrapper;
	return { pre: wrap(w, `++${selected}++`), post: "" };
}

/** The inserted text is already the selection, so the caret goes to the end. */
export function composeInsert(selected: string, author: string, context: InsertContext, wrapper: Wrapper): Composed {
	const { pre, post } = insertParts(selected, context, wrapper);
	const text = pre + authorFootnote(author) + post;
	return { text, cursor: text.length };
}

/** Same, with the footnote left open for the reason. */
export function composeInsertWithReason(selected: string, author: string, context: InsertContext, wrapper: Wrapper): Composed {
	const { pre, post } = insertParts(selected, context, wrapper);
	const footnote = openFootnote(author);
	return { text: pre + footnote + post, cursor: pre.length + footnote.length - 1 };
}
