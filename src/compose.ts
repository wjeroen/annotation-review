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
 * The author goes inside the wrapper, right after the opening operator marks,
 * so every operation carries its own. Only a comment opens a reply for
 * typing, since its text is the point of it.
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

/**
 * The author as it goes inside a wrapper: the CriticMarkup plugin's metadata
 * in braces, so that plugin agrees on every author, and the lighter `[X]@@`
 * elsewhere. Nothing at all when there is no author.
 */
export function authorPrefix(author: string, wrapper: Wrapper): string {
	if (!author) return "";
	return wrapper === "brace" ? JSON.stringify({ author }) + "@@" : `[${author}]@@`;
}

/** The author at the start of a reply: metadata in a brace comment, a label in a footnote. */
export function replyAuthor(author: string, channel: MetaChannel): string {
	if (!author) return "";
	return channel === "brace" ? JSON.stringify({ author }) + "@@" : `[${author}] `;
}

function replyMarks(channel: MetaChannel): [string, string] {
	return channel === "brace" ? ["{>>", "<<}"] : ["^[", "]"];
}

/** A finished reply in the given channel. */
export function replyEntry(author: string, text: string, channel: MetaChannel): string {
	const [open, close] = replyMarks(channel);
	return open + replyAuthor(author, channel) + text + close;
}

/** A reply left open for typing, with the caret just before its closing marks. */
export function openReply(author: string, channel: MetaChannel): Composed {
	const [open, close] = replyMarks(channel);
	const head = open + replyAuthor(author, channel);
	return { text: head + close, cursor: head.length };
}

/**
 * Caret inside the reply, ready for the comment. The span itself carries no
 * author, since it was written by whoever wrote the note. With braces the
 * span is marked as `{==text==}`, CriticMarkup's own form, since bare braces
 * mean nothing. With percent marks the span is hidden and the reply shows,
 * which is the accepted cost.
 */
export function composeComment(selected: string, author: string, wrapper: Wrapper, channel: MetaChannel): Composed {
	const body = wrapper === "brace" ? `{==${selected}==}` : wrap(wrapper, selected);
	const reply = openReply(author, channel);
	return { text: body + reply.text, cursor: body.length + reply.cursor };
}

/** Caret at the end. */
export function composeDelete(selected: string, author: string, wrapper: Wrapper): Composed {
	const text = wrap(wrapper, `--${authorPrefix(author, wrapper)}${selected}--`);
	return { text, cursor: text.length };
}

/** Caret after the arrow, ready for the replacement text. CriticMarkup's `~~old~>new~~` in every wrapper. */
export function composeReplace(selected: string, author: string, wrapper: Wrapper): Composed {
	const head = `${OPEN[wrapper]}~~${authorPrefix(author, wrapper)}${selected}~>`;
	return { text: `${head}~~${CLOSE[wrapper]}`, cursor: head.length };
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
export function composeInsert(selected: string, author: string, context: InsertContext, wrapper: Wrapper, fallback: Wrapper): Composed {
	let text: string;
	if (context.kind === "nested") {
		text = `${context.marker}%%%%++${authorPrefix(author, "percent")}${selected}++%%%%${context.marker}`;
	} else {
		const w = context.kind === "fenced" && wrapper === "percent" ? fallback : wrapper;
		text = wrap(w, `++${authorPrefix(author, w)}${selected}++`);
	}
	return { text, cursor: text.length };
}

/**
 * A comment on a spot rather than a span, with the caret inside. The `>>`
 * operator in whichever wrapper is chosen: `{>>note<<}`, `==>>note<<==` or
 * `%%>>note<<%%`, the author written the way it is for any other operation.
 */
export function composePointComment(author: string, wrapper: Wrapper): Composed {
	if (wrapper === "brace") return openReply(author, "brace");
	const head = `${OPEN[wrapper]}>>${authorPrefix(author, wrapper)}`;
	return { text: `${head}<<${CLOSE[wrapper]}`, cursor: head.length };
}
