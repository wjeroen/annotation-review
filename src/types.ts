export type AnnotationType = "comment" | "delete" | "replace" | "insert";

/**
 * Which delimiters an annotation is wrapped in. The wrapper only decides how
 * the note shows the annotated text: braces show it as it is, highlights show
 * it highlighted, percent marks hide it. The operation comes from the markers
 * inside the wrapper, so any wrapper can carry any operation.
 */
export type Wrapper = "brace" | "highlight" | "percent";

/**
 * Where replies are written. A footnote renders natively in Obsidian, a brace
 * comment stays readable in any CriticMarkup tool. Both attach by sitting
 * directly after the wrapper with no space in between.
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

/** Anything that carries an author: an annotation or one of its replies. */
export interface Authored {
	author?: string;
	/**
	 * The author as written, `{"author":"X"}@@`, `[X]@@` or `[X] `, so it can
	 * be changed or removed in place.
	 */
	authorSpan?: TextSpan;
	/** The other fields of a metadata object, kept so editing the author does not drop them. */
	authorMeta?: Record<string, unknown>;
	/**
	 * The name of the set this belongs to, from `[X][Lname]@@` or a `link`
	 * field in the metadata. Annotations that share one are one decision: a
	 * move is a deletion in one place and an insertion in another.
	 */
	link?: string;
	/** Where an author goes when there is none, and the syntax to wrap it in. */
	authorInsert: InsertPoint;
}

export interface AnnotationReply extends Authored {
	text: string;
	channel: MetaChannel;
	textSpan: TextSpan;
	/** The whole entry, so a single reply can be removed. */
	fullSpan: TextSpan;
}

export interface Annotation extends Authored {
	id: string;
	type: AnnotationType;
	filePath: string;
	line: number;
	matchStart: number;
	matchEnd: number;
	fullMatch: string;
	wrapper: Wrapper;
	/** A comment on a spot rather than a span: `{>>note<<}` or `%%note%%`. Its text is its own. */
	isPoint: boolean;
	/**
	 * An ordinary highlight or hidden note with nothing attached and no author.
	 * Listed so nothing in the note goes unseen, and filterable, since a note
	 * can be full of highlights that have nothing to do with review.
	 */
	isPlain: boolean;
	/** The annotated text for a comment or deletion, the old text for a replacement, empty otherwise. */
	originalText: string;
	/** A comment on a spot: the note itself. */
	commentText?: string;
	replacement?: string;
	insertedText?: string;
	insideAdBlock: boolean;
	/** Every entry attached to the annotation. The reason for a change is simply the first one. */
	replies: AnnotationReply[];

	originalSpan?: TextSpan;
	/** The inserted text. */
	bodySpan?: TextSpan;
	replacementSpan?: TextSpan;
	commentSpan?: TextSpan;
	/** Where the wrapper ends inside `fullMatch`, before any replies. */
	wrapperLength: number;
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
