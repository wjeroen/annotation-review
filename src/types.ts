export type AnnotationType = "comment" | "delete" | "replace" | "insert";

/**
 * Which shape an insert is written in. The `++` markers only exist to say
 * "this highlighted text is an insertion" when there is no footnote to carry
 * the keyword, so they belong to the no-reason forms only.
 */
export type InsertForm = "percent" | "percent-nested" | "highlight" | "footnote";

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
	/** The highlighted source text, for the types that have one. */
	originalSpan?: TextSpan;
	replacementSpan?: TextSpan;
	reasonSpan?: TextSpan;
	/**
	 * What to remove to clear the reason. Wider than `reasonSpan`, since it
	 * also takes the separator before it, or the whole footnote when the
	 * footnote exists only to carry the reason.
	 */
	reasonClearSpan?: TextSpan;
	/** Set only when there is no reason yet, so one can still be added. */
	reasonInsert?: InsertPoint;
	/** Which shape an insert is written in, so it can be rewritten in another. */
	insertForm?: InsertForm;
	/** The reply footnotes verbatim, to carry across a rewrite untouched. */
	repliesRaw: string;
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
