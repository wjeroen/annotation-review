export type AnnotationType = "comment" | "delete" | "replace" | "insert";

/**
 * Which delimiters an annotation is wrapped in. The wrapper only decides how
 * the note shows the annotated text: braces show it as it is, highlights show
 * it highlighted, percent marks hide it. The operation comes from the markers
 * inside the wrapper, so any wrapper can carry any operation.
 */
export type Wrapper = "brace" | "highlight" | "percent";

/**
 * Where the author and reason are written. A footnote renders natively in
 * Obsidian, a brace comment stays readable in any CriticMarkup tool. Both
 * attach by sitting directly after the wrapper with no space in between.
 */
export type MetaChannel = "footnote" | "brace";

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
	channel: MetaChannel;
	authorSpan?: TextSpan;
	authorInsert: InsertPoint;
	textSpan: TextSpan;
	/** The whole entry, so a single reply can be removed. */
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
	wrapper: Wrapper;
	/** A bare `{>>...<<}` with nothing in front of it: a remark on a spot rather than a span. */
	isPoint: boolean;
	/** The annotated text for a comment or deletion, the old text for a replacement, empty for an insertion. */
	originalText: string;
	commentText?: string;
	author?: string;
	reason?: string;
	replacement?: string;
	insertedText?: string;
	insideAdBlock: boolean;
	replies: AnnotationReply[];

	originalSpan?: TextSpan;
	/** The inserted text. */
	bodySpan?: TextSpan;
	replacementSpan?: TextSpan;
	authorSpan?: TextSpan;
	/**
	 * What to remove to clear the author. Wider than `authorSpan` when the
	 * label is all the entry carries, so the empty entry goes with it.
	 */
	authorClearSpan?: TextSpan;
	/** Set only when there is no author yet, so one can still be added. */
	authorInsert?: InsertPoint;
	/** The reason, or the comment text for a comment. */
	reasonSpan?: TextSpan;
	/**
	 * What to remove to clear the reason. Wider than `reasonSpan`, since it
	 * also takes the space after the author label, or the whole entry when the
	 * reason is all it carried.
	 */
	reasonClearSpan?: TextSpan;
	/** Set only when there is no reason yet, so one can still be added. */
	reasonInsert?: InsertPoint;
	/** The channel a new reply should use, matching whatever is already there. */
	nextChannel: MetaChannel;
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

/**
 * Which insert syntax fits at a given spot in a note. Inside an existing
 * percent mark annotation the new one has to close and reopen it, and `marker`
 * is the operator the surrounding one uses, so the halves stay well formed.
 */
export type InsertContext =
	| { kind: "plain" }
	| { kind: "fenced" }
	| { kind: "nested"; marker: string };
