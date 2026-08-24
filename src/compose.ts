import { InsertContext } from "./types";

/**
 * Writing annotations. The parser in `detect.ts` reads these back, so keeping
 * every format in one place means the two can't drift apart unnoticed. The
 * round trip is covered in tests/detect.mjs.
 *
 * Each one returns where the cursor should land, so a command can drop the
 * annotation straight into the note and leave the caret wherever text still
 * needs typing, instead of asking for it in a dialog first.
 */

export interface Composed {
	text: string;
	/** Offset into `text` where the caret belongs. */
	cursor: number;
}

export function authorLabel(author: string): string {
	return author ? `[${author}] ` : "";
}

/** Caret inside the empty footnote, ready for the comment. */
export function composeComment(selected: string, author: string): Composed {
	const text = `==${selected}==^[${authorLabel(author)}]`;
	return { text, cursor: text.length - 1 };
}

/** Caret after the keyword, so a reason can be typed without moving. */
export function composeDelete(selected: string, author: string): Composed {
	const text = `==${selected}==^[${authorLabel(author)}delete]`;
	return { text, cursor: text.length - 1 };
}

/** Caret between the quotes, ready for the replacement text. */
export function composeReplace(selected: string, author: string): Composed {
	const text = `==${selected}==^[${authorLabel(author)}→ ""]`;
	return { text, cursor: text.length - 2 };
}

/** Caret after the keyword and its comma, ready for the reason. */
export function composeInsertWithReason(selected: string, author: string): Composed {
	const text = `==${selected}==^[${authorLabel(author)}insert, ]`;
	return { text, cursor: text.length - 1 };
}

/**
 * Percent marks don't render inside a fenced block, so those need the
 * highlight form. Inside an existing `%%...%%` span the doubled form closes
 * and reopens the surrounding comment, without which the text around the new
 * insert would break out of its comment and become visible prose.
 *
 * The inserted text is already the selection, so the caret goes to the end.
 */
export function composeInsert(selected: string, author: string, context: InsertContext): Composed {
	const label = authorLabel(author);
	let text: string;
	if (context === "fenced") text = `==++${label}${selected}++==`;
	else if (context === "native-comment") text = `%%%%${label}${selected}%%%%`;
	else text = `%%${label}${selected}%%`;
	return { text, cursor: text.length };
}
