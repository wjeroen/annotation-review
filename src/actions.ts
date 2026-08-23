import { Annotation } from "./types";

export type AnnotationAction = "approve" | "dismiss";

export type MutationResult =
	| { ok: true; newContent: string }
	| { ok: false; reason: string };

export function computeMutation(content: string, annotation: Annotation, action: AnnotationAction): MutationResult {
	const { matchStart, matchEnd, fullMatch, type } = annotation;
	const currentSlice = content.slice(matchStart, matchEnd);
	if (currentSlice !== fullMatch) {
		return { ok: false, reason: "The note changed since this annotation was detected. Rescanning, please try again." };
	}

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

export function computeRemoval(content: string, matchStart: number, matchEnd: number, expectedRaw: string): MutationResult {
	const currentSlice = content.slice(matchStart, matchEnd);
	if (currentSlice !== expectedRaw) {
		return { ok: false, reason: "The note changed since this block was detected. Rescanning, please try again." };
	}
	const newContent = content.slice(0, matchStart) + content.slice(matchEnd);
	return { ok: true, newContent };
}
