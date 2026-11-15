import { InsertContext, MetaChannel, Wrapper } from "./types";
import { Stamp, formatTime } from "./dates";

/**
 * Writing annotations. The parser in `detect.ts` reads these back, so keeping
 * every format in one place means the two can't drift apart unnoticed. The
 * round trip is covered in tests/detect.mjs.
 *
 * Each one returns where the caret should land, so a command can drop the
 * annotation straight into the note and leave the caret wherever text still
 * needs typing, instead of asking for it in a dialog first.
 *
 * The author and the time go inside the wrapper, right after the opening
 * operator marks, so every operation carries its own. Only a comment opens a
 * reply for typing, since its text is the point of it.
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
 * The author and the time in the CriticMarkup plugin's metadata,
 * `{"author":"X","time":1794601440}@@`. The time is always seconds since
 * 1970 in UTC here, since that plugin reads nothing else. Nothing at all when
 * there is neither.
 */
function metadata(author: string, stamp?: Stamp): string {
	const fields: Record<string, unknown> = {};
	if (author) fields.author = author;
	if (stamp) fields.time = stamp.time;
	return Object.keys(fields).length ? JSON.stringify(fields) + "@@" : "";
}

/**
 * The inside of a label, `Claude:2026-11-13T20:24:00`, or `Claude:T1794601440`
 * when seconds are asked for. Empty when there is neither.
 */
function label(author: string, stamp?: Stamp): string {
	const time = !stamp ? "" : stamp.seconds ? `T${stamp.time}` : formatTime(stamp.time);
	return [author, time].filter(Boolean).join(":");
}

/**
 * The author and the time as they go inside a wrapper: metadata in braces,
 * so the CriticMarkup plugin agrees on both, and the lighter
 * `[X:2026-11-13T20:24:00]@@` elsewhere.
 */
export function authorPrefix(author: string, wrapper: Wrapper, stamp?: Stamp): string {
	if (wrapper === "brace") return metadata(author, stamp);
	const inside = label(author, stamp);
	return inside ? `[${inside}]@@` : "";
}

/** The author and the time at the start of a reply: metadata in a brace comment, a label in a footnote. */
export function replyAuthor(author: string, channel: MetaChannel, stamp?: Stamp): string {
	if (channel === "brace") return metadata(author, stamp);
	const inside = label(author, stamp);
	return inside ? `[${inside}] ` : "";
}

function replyMarks(channel: MetaChannel): [string, string] {
	return channel === "brace" ? ["{>>", "<<}"] : ["^[", "]"];
}

/** A finished reply in the given channel. */
export function replyEntry(author: string, text: string, channel: MetaChannel, stamp?: Stamp): string {
	const [open, close] = replyMarks(channel);
	return open + replyAuthor(author, channel, stamp) + text + close;
}

/** A reply left open for typing, with the caret just before its closing marks. */
export function openReply(author: string, channel: MetaChannel, stamp?: Stamp): Composed {
	const [open, close] = replyMarks(channel);
	const head = open + replyAuthor(author, channel, stamp);
	return { text: head + close, cursor: head.length };
}

/**
 * Caret inside the reply, ready for the comment. The span itself carries no
 * author, since it was written by whoever wrote the note. With braces the
 * span is marked as `{==text==}`, CriticMarkup's own form, since bare braces
 * mean nothing. With percent marks the span is hidden and the reply shows,
 * which is the accepted cost.
 */
export function composeComment(selected: string, author: string, wrapper: Wrapper, channel: MetaChannel, stamp?: Stamp): Composed {
	const body = wrapper === "brace" ? `{==${selected}==}` : wrap(wrapper, selected);
	const reply = openReply(author, channel, stamp);
	return { text: body + reply.text, cursor: body.length + reply.cursor };
}

/** Caret at the end. */
export function composeDelete(selected: string, author: string, wrapper: Wrapper, stamp?: Stamp): Composed {
	const text = wrap(wrapper, `--${authorPrefix(author, wrapper, stamp)}${selected}--`);
	return { text, cursor: text.length };
}

/** Caret after the arrow, ready for the replacement text. CriticMarkup's `~~old~>new~~` in every wrapper. */
export function composeReplace(selected: string, author: string, wrapper: Wrapper, stamp?: Stamp): Composed {
	const head = `${OPEN[wrapper]}~~${authorPrefix(author, wrapper, stamp)}${selected}~>`;
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
export function composeInsert(selected: string, author: string, context: InsertContext, wrapper: Wrapper, fallback: Wrapper, stamp?: Stamp): Composed {
	let head: string;
	let tail: string;
	if (context.kind === "nested") {
		head = `${context.marker}%%%%++${authorPrefix(author, "percent", stamp)}`;
		tail = `++%%%%${context.marker}`;
	} else {
		const w = context.kind === "fenced" && wrapper === "percent" ? fallback : wrapper;
		head = `${OPEN[w]}++${authorPrefix(author, w, stamp)}`;
		tail = `++${CLOSE[w]}`;
	}
	const text = head + selected + tail;
	// With text selected the insertion is complete and the caret goes after
	// it. With nothing selected it is empty and the caret goes inside, ready
	// to type, the way a comment on a spot works.
	return { text, cursor: selected ? text.length : head.length };
}

/**
 * A comment on a spot rather than a selection, with the caret inside. The
 * `>>` operator in braces or percent marks, `{>>note<<}` or `%%>>note<<%%`,
 * the author written the way it is for any other operation.
 */
export function composePointComment(author: string, wrapper: Wrapper, stamp?: Stamp): Composed {
	// A highlight cannot hold one, Obsidian never opens a highlight that
	// starts with >, so anything but percent marks means braces.
	if (wrapper !== "percent") return openReply(author, "brace", stamp);
	const head = `${OPEN[wrapper]}>>${authorPrefix(author, wrapper, stamp)}`;
	return { text: `${head}<<${CLOSE[wrapper]}`, cursor: head.length };
}
