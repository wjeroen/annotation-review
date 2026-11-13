/**
 * The links in a piece of card text, so the sidebar can draw them the way
 * live preview does: the link text, clickable, with the address hidden.
 * Everything else stays as written. Pure, so the tests can read it.
 */

export interface TextPiece {
	text: string;
	/** An address for a markdown link or a bare one. */
	url?: string;
	/** A note for a wikilink, `[[Note]]` or `[[Note|shown]]`. */
	note?: string;
}

/**
 * A markdown link, a wikilink, or a bare web address, whichever comes first.
 * A markdown link's address may hold one pair of parentheses, as Wikipedia
 * addresses do, the same rule the parser uses.
 */
const LINK_REGEX = /\[([^[\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)|\[\[([^[\]|]+)(?:\|([^[\]]+))?\]\]|https?:\/\/[^\s<>()[\]]+/g;

/** Punctuation that ends a sentence rather than an address. */
const TRAILING = /[.,;:!?'"]+$/;

export function linkPieces(text: string): TextPiece[] {
	const pieces: TextPiece[] = [];
	let last = 0;
	const push = (piece: TextPiece) => {
		if (piece.text) pieces.push(piece);
	};
	for (const m of text.matchAll(LINK_REGEX)) {
		const start = m.index ?? 0;
		let end = start + m[0].length;
		let piece: TextPiece;
		if (m[1] !== undefined) piece = { text: m[1], url: m[2] };
		else if (m[3] !== undefined) piece = { text: (m[4] ?? m[3]).trim(), note: m[3].trim() };
		else {
			const url = m[0].replace(TRAILING, "");
			end = start + url.length;
			piece = { text: url, url };
		}
		push({ text: text.slice(last, start) });
		push(piece);
		last = end;
	}
	push({ text: text.slice(last) });
	return pieces;
}
