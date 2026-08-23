export type AnnotationType = "comment" | "delete" | "replace" | "insert";

export interface Annotation {
	id: string;
	type: AnnotationType;
	filePath: string;
	line: number;
	matchStart: number;
	matchEnd: number;
	fullMatch: string;
	originalText: string;
	commentText: string;
	author?: string;
	reason?: string;
	replacement?: string;
	insertedText?: string;
	insideAdBlock: boolean;
}

export interface ExcludedRange {
	start: number;
	end: number;
}
