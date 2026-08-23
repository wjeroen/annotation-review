import { Annotation } from "./types";

export type AnnotationAction = "approve" | "dismiss";

export interface MutationSuccess {
	ok: true;
	newContent: string;
	/** The exact range replaced, so an open editor can apply just this edit. */
	from: number;
	to: number;
	replacement: string;
}

export type MutationResult = MutationSuccess | { ok: false; reason: string };

/**
 * The exact text we last saw may have shifted position, since typing anywhere
 * earlier in the note, or an approve/dismiss elsewhere, changes its length.
 * Look for the expected text near its last known offset before giving up, so
 * an action doesn't fail just because something else moved it. Only a
 * genuinely missing or changed match should fail.
 */
function locateMatch(content: string, expectedStart: number, expectedText: string): number | null {
	if (content.slice(expectedStart, expectedStart + expectedText.length) === expectedText) {
		return expectedStart;
	}
	let bestIndex = -1;
	let bestDistance = Infinity;
	let idx = content.indexOf(expectedText);
	while (idx !== -1) {
		const distance = Math.abs(idx - expectedStart);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestIndex = idx;
		}
		idx = content.indexOf(expectedText, idx + 1);
	}
	return bestIndex === -1 ? null : bestIndex;
}

function replaceRange(content: string, from: number, to: number, replacement: string): MutationSuccess {
	return {
		ok: true,
		newContent: content.slice(0, from) + replacement + content.slice(to),
		from,
		to,
		replacement
	};
}

const NOT_FOUND = "This annotation's text couldn't be found anymore. Rescanning, please try again.";

export function computeMutation(content: string, annotation: Annotation, action: AnnotationAction): MutationResult {
	const { fullMatch, type } = annotation;
	const matchStart = locateMatch(content, annotation.matchStart, fullMatch);
	if (matchStart === null) return { ok: false, reason: NOT_FOUND };
	const matchEnd = matchStart + fullMatch.length;

	let replacement: string;
	if (action === "dismiss") {
		replacement = type === "insert" ? "" : annotation.originalText;
	} else {
		switch (type) {
			case "comment":
				return { ok: false, reason: "Plain comments can only be dismissed." };
			case "delete":
				replacement = "";
				break;
			case "replace":
				replacement = annotation.replacement ?? "";
				break;
			case "insert":
				replacement = annotation.insertedText ?? "";
				break;
		}
	}

	return replaceRange(content, matchStart, matchEnd, replacement);
}

export function computeAddReply(content: string, annotation: Annotation, replyText: string): MutationResult {
	const matchStart = locateMatch(content, annotation.matchStart, annotation.fullMatch);
	if (matchStart === null) return { ok: false, reason: NOT_FOUND };
	const matchEnd = matchStart + annotation.fullMatch.length;
	return replaceRange(content, matchEnd, matchEnd, `^[${replyText}]`);
}

/**
 * Replaces a span inside an annotation. Spans are relative to fullMatch, so
 * the annotation is relocated first and the span applied wherever it landed.
 * A zero-width span inserts rather than replaces.
 */
export function computeSpanReplace(
	content: string,
	annotation: Annotation,
	spanStart: number,
	spanEnd: number,
	replacement: string
): MutationResult {
	const matchStart = locateMatch(content, annotation.matchStart, annotation.fullMatch);
	if (matchStart === null) return { ok: false, reason: NOT_FOUND };
	if (spanStart < 0 || spanEnd > annotation.fullMatch.length || spanStart > spanEnd) {
		return { ok: false, reason: "That part of the annotation moved. Rescanning, please try again." };
	}
	return replaceRange(content, matchStart + spanStart, matchStart + spanEnd, replacement);
}

export function computeRemoval(content: string, expectedStart: number, expectedRaw: string): MutationResult {
	const matchStart = locateMatch(content, expectedStart, expectedRaw);
	if (matchStart === null) {
		return { ok: false, reason: "This block's text couldn't be found anymore. Rescanning, please try again." };
	}
	let removeStart = matchStart;
	let removeEnd = matchStart + expectedRaw.length;

	// Removing the block alone leaves the blank line that was above it and the
	// blank line that was below it sitting next to each other, three blank
	// lines where there should be one. Collapse the gap below into the gap
	// above, but only when that line is genuinely empty. Prefer below, fall
	// back to above, and touch neither if both neighbours have content.
	const afterBlank = /^\n[ \t]*\n/.exec(content.slice(removeEnd));
	if (afterBlank) {
		removeEnd += afterBlank[0].length;
	} else {
		const beforeBlank = /\n[ \t]*\n$/.exec(content.slice(0, removeStart));
		if (beforeBlank) {
			removeStart -= beforeBlank[0].length;
		}
	}

	return replaceRange(content, removeStart, removeEnd, "");
}
