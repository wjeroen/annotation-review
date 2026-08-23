export type AnnotationType = "comment" | "delete" | "replace" | "insert";

/**
 * A range inside an annotation's `fullMatch` string, never an absolute file
 * offset. Keeping spans relative to fullMatch means an edit stays correct even
 * when typing elsewhere in the note has shifted the annotation's position,
 * since fullMatch gets relocated first and the span is applied to wherever it
 * actually landed.
 */
export interface TextSpan {
	start: number;
	end: number;
}

/** Where to add a field that doesn't exist yet, and the syntax to wrap it in. */
export interface InsertPoint {
	at: number;
	prefix: string;
	suffix: string;
}

export interface AnnotationReply {
	author?: string;
	text: string;
	authorSpan?: TextSpan;
	authorInsertAt: number;
	textSpan: TextSpan;
	/** The whole `^[...]` footnote, so a single reply can be removed. */
	fullSpan: TextSpan;
}

export interface Annotation {
	id: string;
	type: AnnotationType;
	filePath: string;
	line: number;
	matchStart: number;
	matchEnd: number;
	fullMatch: string;
	originalText: string;
	commentText?: string;
	author?: string;
	reason?: string;
	replacement?: string;
	insertedText?: string;
	insideAdBlock: boolean;
	replies: AnnotationReply[];

	authorSpan?: TextSpan;
	authorInsertAt: number;
	/** The comment text for a comment, or the inserted text for an insert. */
	bodySpan?: TextSpan;
	replacementSpan?: TextSpan;
	reasonSpan?: TextSpan;
	/** Set only when there is no reason yet, so one can still be added. */
	reasonInsert?: InsertPoint;
}

export interface AdmonitionBlock {
	id: string;
	filePath: string;
	line: number;
	matchStart: number;
	matchEnd: number;
	adType: string;
	preview: string;
	raw: string;
}

export interface ExcludedRange {
	start: number;
	end: number;
}

/** Which insert syntax fits at a given spot in a note. */
export type InsertContext = "fenced" | "native-comment" | "plain";
