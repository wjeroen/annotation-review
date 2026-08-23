import { Annotation } from "./types";

export type AnnotationAction = "approve" | "dismiss";

export type MutationResult =
	| { ok: true; newContent: string }
	| { ok: false; reason: string };

/**
 * The exact text we last saw may have shifted position, since an earlier
 * approve/dismiss elsewhere in the file changes its length. Look for the
 * expected text near its last known offset before giving up, so an action
 * doesn't fail just because a different annotation was handled a moment
 * earlier. Only a genuinely missing or changed match should fail.
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

export function computeMutation(content: string, annotation: Annotation, action: AnnotationAction): MutationResult {
	const { fullMatch, type } = annotation;
	const matchStart = locateMatch(content, annotation.matchStart, fullMatch);
	if (matchStart === null) {
		return { ok: false, reason: "This annotation's text couldn't be found anymore. Rescanning, please try again." };
	}
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

	const newContent = content.slice(0, matchStart) + replacement + content.slice(matchEnd);
	return { ok: true, newContent };
}

export function computeAddReply(content: string, annotation: Annotation, replyText: string): MutationResult {
	const matchStart = locateMatch(content, annotation.matchStart, annotation.fullMatch);
	if (matchStart === null) {
		return { ok: false, reason: "This annotation's text couldn't be found anymore. Rescanning, please try again." };
	}
	const matchEnd = matchStart + annotation.fullMatch.length;
	const newFootnote = `^[${replyText}]`;
	const newContent = content.slice(0, matchEnd) + newFootnote + content.slice(matchEnd);
	return { ok: true, newContent };
}

export function computeRemoval(content: string, expectedStart: number, expectedRaw: string): MutationResult {
	const matchStart = locateMatch(content, expectedStart, expectedRaw);
	if (matchStart === null) {
		return { ok: false, reason: "This block's text couldn't be found anymore. Rescanning, please try again." };
	}
	const matchEnd = matchStart + expectedRaw.length;
	const newContent = content.slice(0, matchStart) + content.slice(matchEnd);
	return { ok: true, newContent };
}
