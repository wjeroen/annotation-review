import { InsertContext } from "./types";

/**
 * Writing annotations. The parser in `detect.ts` reads these back, so keeping
 * every format in one place means the two can't drift apart unnoticed. The
 * round trip is covered in tests/detect.mjs.
 */

export function authorLabel(author: string): string {
	return author ? `[${author}] ` : "";
}

export function composeComment(selected: string, comment: string, author: string): string {
	return `==${selected}==^[${authorLabel(author)}${comment}]`;
}

export function composeDelete(selected: string, author: string): string {
	return `==${selected}==^[${authorLabel(author)}delete]`;
}

export function composeReplace(selected: string, replacement: string, author: string): string {
	return `==${selected}==^[${authorLabel(author)}→ "${replacement}"]`;
}

/**
 * Percent marks don't render inside a fenced block, so those need the
 * highlight form. Inside an existing `%%...%%` span the doubled form closes
 * and reopens the surrounding comment, without which the text around the new
 * insert would break out of its comment and become visible prose.
 */
export function composeInsert(selected: string, author: string, context: InsertContext): string {
	const label = authorLabel(author);
	if (context === "fenced") return `==++${label}${selected}++==`;
	if (context === "native-comment") return `%%%%${label}${selected}%%%%`;
	return `%%${label}${selected}%%`;
}
