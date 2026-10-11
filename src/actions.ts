import { Annotation } from "./types";
import { replyEntry } from "./compose";
import { detectAnnotations } from "./detect";

export type AnnotationAction = "approve" | "dismiss";

/** One range of the note and the text that replaces it. */
export interface TextChange {
	from: number;
	to: number;
	replacement: string;
}

export interface MutationSuccess {
	ok: true;
	newContent: string;
	/**
	 * The exact ranges replaced, so an open editor can apply just these, as
	 * one edit and one undo step. Every range is in the note as it was before
	 * any of them, and they are listed from the last in the note to the
	 * first, so each one is still where it was when its turn comes.
	 */
	changes: TextChange[];
}

export type MutationResult = MutationSuccess | { ok: false; reason: string };

const NOT_FOUND = "This annotation changed or moved since the sidebar last read the note. Rescanning, please try again.";

/**
 * Where the annotation starts now, or null when it is not there anymore. A
 * card holds the note as it was at the last scan, so it only acts when that
 * exact annotation, replies included, still starts at the same spot in the
 * note as it reads now. Searching the note for the same text acted on the
 * wrong annotation: two members of a linked rename hold the same text, and
 * on the one with a reply that text is only the front part. A card that went
 * stale is refused instead, and the rescan that follows brings a fresh one.
 * `current` is the note already parsed, when the caller has it.
 */
function locate(content: string, annotation: Annotation, current?: Annotation[]): number | null {
	const { matchStart, fullMatch } = annotation;
	const found = (current ?? detectAnnotations(content, annotation.filePath)).some(
		a => a.matchStart === matchStart && a.fullMatch === fullMatch
	);
	return found ? matchStart : null;
}

/** Applies changes listed from the last in the note to the first. */
function applyChanges(content: string, changes: TextChange[]): MutationSuccess {
	let newContent = content;
	for (const c of changes) newContent = newContent.slice(0, c.from) + c.replacement + newContent.slice(c.to);
	return { ok: true, newContent, changes };
}

/**
 * The text an annotation leaves behind when approved or dismissed, or null
 * when the action does not apply. The texts are used exactly as written,
 * spaces and line breaks included, since an insertion of `is ` carries its
 * own trailing space and trimming it would run two words together.
 */
function replacementFor(annotation: Annotation, action: AnnotationAction): string | null {
	const { type } = annotation;
	if (action === "dismiss") {
		// An HTML comment's text is the note itself rather than text of the
		// document, so dismissing it takes the text along.
		return type === "insert" || annotation.wrapper === "html" ? "" : annotation.originalText;
	}
	switch (type) {
		case "comment":
			return null;
		case "delete":
			return "";
		case "replace":
			return annotation.replacement ?? "";
		case "insert":
			return annotation.insertedText ?? "";
	}
}

/** Approving or dismissing replaces the whole annotation, replies included, with the text that should remain. */
export function computeMutation(content: string, annotation: Annotation, action: AnnotationAction): MutationResult {
	const replacement = replacementFor(annotation, action);
	if (replacement === null) return { ok: false, reason: "Plain comments can only be dismissed." };
	const start = locate(content, annotation);
	if (start === null) return { ok: false, reason: NOT_FOUND };
	return applyChanges(content, [{ from: start, to: start + annotation.fullMatch.length, replacement }]);
}

/**
 * Every annotation on one link, as a single edit. Each one is found in the
 * same reading of the note first, and when one of them is missing nothing
 * changes, since half a move leaves the note broken. One undo then brings
 * the whole set back. A comment cannot be approved, so an approve steps over
 * it and leaves it in the note.
 */
export function computeLinkedMutation(content: string, annotations: Annotation[], action: AnnotationAction): MutationResult {
	if (annotations.length === 0) return { ok: false, reason: NOT_FOUND };
	const current = detectAnnotations(content, annotations[0].filePath);
	const changes: TextChange[] = [];
	for (const annotation of annotations) {
		const replacement = replacementFor(annotation, action);
		if (replacement === null) continue;
		const start = locate(content, annotation, current);
		if (start === null) {
			return {
				ok: false,
				reason: "One of the linked annotations changed or moved since the sidebar last read the note, so none of them were changed. Rescanning, please try again."
			};
		}
		changes.push({ from: start, to: start + annotation.fullMatch.length, replacement });
	}
	if (changes.length === 0) return { ok: false, reason: "Plain comments can only be dismissed." };
	changes.sort((a, b) => b.from - a.from);
	// Two changes to the same text cannot be one edit, and whichever went
	// second would undo the first.
	for (let i = 1; i < changes.length; i++) {
		if (changes[i].to > changes[i - 1].from) {
			return { ok: false, reason: "These linked annotations sit inside each other, so they cannot be changed together. Use the buttons on their own cards." };
		}
	}
	return applyChanges(content, changes);
}

/** A reply goes on the end, in the same channel as the entries already there. */
export function computeAddReply(content: string, annotation: Annotation, author: string, text: string): MutationResult {
	const start = locate(content, annotation);
	if (start === null) return { ok: false, reason: NOT_FOUND };
	const end = start + annotation.fullMatch.length;
	return applyChanges(content, [{ from: end, to: end, replacement: replyEntry(author, text, annotation.nextChannel) }]);
}

/**
 * Replaces a span inside an annotation. Spans are relative to fullMatch, so
 * they are applied from wherever the annotation starts. A zero-width span
 * inserts rather than replaces.
 */
export function computeSpanReplace(
	content: string,
	annotation: Annotation,
	spanStart: number,
	spanEnd: number,
	replacement: string
): MutationResult {
	const start = locate(content, annotation);
	if (start === null) return { ok: false, reason: NOT_FOUND };
	if (spanStart < 0 || spanEnd > annotation.fullMatch.length || spanStart > spanEnd) {
		return { ok: false, reason: "That part of the annotation moved. Rescanning, please try again." };
	}
	return applyChanges(content, [{ from: start + spanStart, to: start + spanEnd, replacement }]);
}

/**
 * Removes an admonition block. Like a card, it only acts on the block where
 * it was found, so a block that went stale never removes an identical one
 * elsewhere in the note.
 */
export function computeRemoval(content: string, expectedStart: number, expectedRaw: string): MutationResult {
	if (content.slice(expectedStart, expectedStart + expectedRaw.length) !== expectedRaw) {
		return { ok: false, reason: "This block changed or moved since the sidebar last read the note. Rescanning, please try again." };
	}
	let removeStart = expectedStart;
	let removeEnd = expectedStart + expectedRaw.length;

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

	return applyChanges(content, [{ from: removeStart, to: removeEnd, replacement: "" }]);
}
