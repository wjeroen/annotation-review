import { InsertContext, MetaChannel, Wrapper } from "./types";

/**
 * Writing annotations. The parser in `detect.ts` reads these back, so keeping
 * every format in one place means the two can't drift apart unnoticed. The
 * round trip is covered in tests/detect.mjs.
 *
 * Each one returns where the caret should land, so a command can drop the
 * annotation straight into the note and leave the caret wherever text still
 * needs typing, instead of asking for it in a dialog first.
 *
 * Only a comment opens an entry for typing, since its text is the point of
 * it. The other commands name the author when there is one and otherwise
 * write nothing after the wrapper. A reason is added by its own command.
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

/** The opening and closing marks of an entry in the given channel. */
function entryMarks(channel: MetaChannel): [string, string] {
	return channel === "brace" ? ["{>>", "<<}"] : ["^[", "]"];
}

/** An author-only entry, or nothing when there is no author to name. */
export function authorEntry(author: string, channel: MetaChannel): string {
	if (!author) return "";
	const [open, close] = entryMarks(channel);
	return `${open}[${author}]${close}`;
}

/** An entry left open for typing, with the caret just before its closing marks. */
export function openEntry(author: string, channel: MetaChannel): Composed {
	const [open, close] = entryMarks(channel);
	const head = open + (author ? `[${author}] ` : "");
	return { text: head + close, cursor: head.length };
}

/**
 * Caret inside the entry, ready for the comment. With braces the span is
 * marked as `{==text==}`, CriticMarkup's own form, since bare braces mean
 * nothing.
 */
export function composeComment(selected: string, author: string, wrapper: Wrapper, channel: MetaChannel): Composed {
	const body = wrap(wrapper, wrapper === "brace" ? `==${selected}==` : selected);
	const entry = openEntry(author, channel);
	return { text: body + entry.text, cursor: body.length + entry.cursor };
}

/** Caret at the end. */
export function composeDelete(selected: string, author: string, wrapper: Wrapper, channel: MetaChannel): Composed {
	const text = wrap(wrapper, `--${selected}--`) + authorEntry(author, channel);
	return { text, cursor: text.length };
}

/** Caret after the arrow, ready for the replacement text. */
export function composeReplace(selected: string, author: string, wrapper: Wrapper, channel: MetaChannel): Composed {
	const head = `${OPEN[wrapper]}--${selected}~>`;
	const text = `${head}++${CLOSE[wrapper]}${authorEntry(author, channel)}`;
	return { text, cursor: head.length };
}

/**
 * The inserted text is already the selection, so the caret goes to the end.
 *
 * Inside an existing percent mark annotation the new one closes and reopens
 * it, and closes and reopens its operator too, so `%%++A B++%%` becomes
 * `%%++A ++%%%%++X++%%%%++B++%%`, three well formed insertions in a row.
 * Percent marks do not render inside a fenced block, so `fallback` stands in
 * for them there.
 */
export function composeInsert(
	selected: string,
	author: string,
	context: InsertContext,
	wrapper: Wrapper,
	fallback: Wrapper,
	channel: MetaChannel
): Composed {
	let text: string;
	if (context.kind === "nested") {
		text = `${context.marker}%%%%++${selected}++%%${authorEntry(author, channel)}%%${context.marker}`;
	} else {
		const w = context.kind === "fenced" && wrapper === "percent" ? fallback : wrapper;
		text = wrap(w, `++${selected}++`) + authorEntry(author, channel);
	}
	return { text, cursor: text.length };
}
