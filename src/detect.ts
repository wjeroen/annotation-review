import { Annotation, ExcludedRange } from "./types";

interface FenceRange extends ExcludedRange {
	isAdBlock: boolean;
}

interface RawHighlightMatch {
	fullStart: number;
	matchEnd: number;
	isPlusWrapped: boolean;
	innerText: string;
	footnoteContent: string | null;
	fullMatch: string;
}

const FENCE_REGEX = /^[\s>]*(`{3,}|~{3,})\s*(\S*)/;
const HIGHLIGHT_REGEX = /==(\+\+)?([\s\S]+?)\1==/g;
const FOOTNOTE_REGEX = /^\^\[((?:\[[^\]]*\])?[^\]]*)\]/;
const AUTHOR_REGEX = /^\[([^\]]+)\]\s*/;
const ARROW_REPLACE_REGEX = /^→\s*"([^"]*)"/;
const DELETE_REGEX = /^delete\b\s*,?\s*(.*)$/i;
const INSERT_KEYWORD_REGEX = /^insert\b\s*,?\s*(.*)$/i;
const NATIVE_COMMENT_REGEX = /%%%%([\s\S]+?)%%%%|%%([\s\S]+?)%%/g;
const INLINE_CODE_REGEX = /`([^`\n]+?)`/g;
const MARKDOWN_LINK_REGEX = /\[([^\]]*)\]\(([^)]*)\)/g;
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;

function hasDelimiterInsideRanges(start: number, end: number, ranges: ExcludedRange[]): boolean {
	return ranges.some(range =>
		(start >= range.start && start < range.end) ||
		(end > range.start && end <= range.end)
	);
}

function lineAt(content: string, offset: number): number {
	let line = 1;
	for (let i = 0; i < offset; i++) {
		if (content.charCodeAt(i) === 10) line++;
	}
	return line;
}

function makeId(filePath: string, start: number, fullMatch: string): string {
	let hash = 0;
	const s = `${filePath}|${start}|${fullMatch}`;
	for (let i = 0; i < s.length; i++) {
		hash = (hash * 31 + s.charCodeAt(i)) | 0;
	}
	return `ann-${start}-${hash}`;
}

function getFenceRanges(content: string): FenceRange[] {
	const ranges: FenceRange[] = [];
	const lines = content.split("\n");
	let currentStart: number | null = null;
	let currentMarkerChar: string | null = null;
	let currentIsAd = false;
	let pos = 0;
	for (const line of lines) {
		const lineStart = pos;
		const lineEnd = pos + line.length;
		const m = FENCE_REGEX.exec(line);
		if (m) {
			const markerChar = m[1][0];
			if (currentMarkerChar === markerChar) {
				ranges.push({ start: currentStart!, end: lineEnd, isAdBlock: currentIsAd });
				currentStart = null;
				currentMarkerChar = null;
				currentIsAd = false;
			} else if (currentMarkerChar === null) {
				currentStart = lineStart;
				currentMarkerChar = markerChar;
				currentIsAd = /^ad-/i.test(m[2] || "");
			}
		}
		pos = lineEnd + 1;
	}
	if (currentStart !== null) {
		ranges.push({ start: currentStart, end: content.length, isAdBlock: currentIsAd });
	}
	return ranges;
}

function getInlineCodeRanges(content: string): ExcludedRange[] {
	const ranges: ExcludedRange[] = [];
	let m: RegExpExecArray | null;
	const regex = new RegExp(INLINE_CODE_REGEX);
	while ((m = regex.exec(content)) !== null) {
		ranges.push({ start: m.index, end: m.index + m[0].length });
	}
	return ranges;
}

function getMarkdownLinkRanges(content: string): ExcludedRange[] {
	const ranges: ExcludedRange[] = [];
	let m: RegExpExecArray | null;
	const regex = new RegExp(MARKDOWN_LINK_REGEX);
	while ((m = regex.exec(content)) !== null) {
		ranges.push({ start: m.index, end: m.index + m[0].length });
	}
	return ranges;
}

function getHtmlCommentRanges(content: string): ExcludedRange[] {
	const ranges: ExcludedRange[] = [];
	let m: RegExpExecArray | null;
	const regex = new RegExp(HTML_COMMENT_REGEX);
	while ((m = regex.exec(content)) !== null) {
		ranges.push({ start: m.index, end: m.index + m[0].length });
	}
	return ranges;
}

function findHighlightMatches(content: string, excludedRanges: ExcludedRange[]): RawHighlightMatch[] {
	const matches: RawHighlightMatch[] = [];
	const regex = new RegExp(HIGHLIGHT_REGEX);
	let m: RegExpExecArray | null;
	while ((m = regex.exec(content)) !== null) {
		const fullStart = m.index;
		const highlightEnd = m.index + m[0].length;
		const isPlusWrapped = !!m[1];
		const innerText = m[2];

		if (/\n\s*\n/.test(innerText)) continue;

		const rest = content.slice(highlightEnd);
		const footnoteMatch = FOOTNOTE_REGEX.exec(rest);
		const matchEnd = footnoteMatch ? highlightEnd + footnoteMatch[0].length : highlightEnd;
		const footnoteContent = footnoteMatch ? footnoteMatch[1] : null;

		if (hasDelimiterInsideRanges(fullStart, matchEnd, excludedRanges)) continue;

		matches.push({
			fullStart,
			matchEnd,
			isPlusWrapped,
			innerText,
			footnoteContent,
			fullMatch: content.slice(fullStart, matchEnd)
		});
	}
	return matches;
}

function classifyHighlightMatch(
	match: RawHighlightMatch,
	filePath: string,
	content: string,
	isInsideAdBlock: (offset: number) => boolean
): Annotation | null {
	const line = lineAt(content, match.fullStart);
	const insideAdBlock = isInsideAdBlock(match.fullStart);
	const base = {
		id: makeId(filePath, match.fullStart, match.fullMatch),
		filePath,
		line,
		matchStart: match.fullStart,
		matchEnd: match.matchEnd,
		fullMatch: match.fullMatch,
		insideAdBlock
	};

	if (match.isPlusWrapped) {
		let insertedRaw = match.innerText;
		let author: string | undefined;
		const authorMatch = AUTHOR_REGEX.exec(insertedRaw);
		if (authorMatch) {
			author = authorMatch[1];
			insertedRaw = insertedRaw.slice(authorMatch[0].length);
		}

		let reason: string | undefined;
		if (match.footnoteContent) {
			let fc = match.footnoteContent;
			const fAuthor = AUTHOR_REGEX.exec(fc);
			if (fAuthor && !author) {
				author = fAuthor[1];
				fc = fc.slice(fAuthor[0].length);
			}
			const insertKw = INSERT_KEYWORD_REGEX.exec(fc.trim());
			if (insertKw && insertKw[1]) reason = insertKw[1].trim();
		}

		return {
			...base,
			type: "insert",
			originalText: "",
			commentText: reason ? `insert, ${reason}` : "insert",
			author,
			reason,
			insertedText: insertedRaw.trim()
		};
	}

	if (!match.footnoteContent) return null;

	let fc = match.footnoteContent;
	let author: string | undefined;
	const authorMatch = AUTHOR_REGEX.exec(fc);
	if (authorMatch) {
		author = authorMatch[1];
		fc = fc.slice(authorMatch[0].length);
	}
	fc = fc.trim();

	const arrowMatch = ARROW_REPLACE_REGEX.exec(fc);
	if (arrowMatch) {
		return {
			...base,
			type: "replace",
			originalText: match.innerText,
			commentText: fc,
			author,
			replacement: arrowMatch[1]
		};
	}

	const deleteMatch = DELETE_REGEX.exec(fc);
	if (deleteMatch) {
		return {
			...base,
			type: "delete",
			originalText: match.innerText,
			commentText: fc,
			author,
			reason: deleteMatch[1] ? deleteMatch[1].trim() : undefined
		};
	}

	return {
		...base,
		type: "comment",
		originalText: match.innerText,
		commentText: fc,
		author
	};
}

function findNativeCommentMatches(content: string, filePath: string, excludedRanges: ExcludedRange[]): Annotation[] {
	const results: Annotation[] = [];
	const regex = new RegExp(NATIVE_COMMENT_REGEX);
	let m: RegExpExecArray | null;
	while ((m = regex.exec(content)) !== null) {
		const fullStart = m.index;
		const matchEnd = m.index + m[0].length;
		if (hasDelimiterInsideRanges(fullStart, matchEnd, excludedRanges)) continue;

		const raw = m[1] !== undefined ? m[1] : m[2];
		let text = raw;
		let author: string | undefined;
		const authorMatch = AUTHOR_REGEX.exec(text);
		if (authorMatch) {
			author = authorMatch[1];
			text = text.slice(authorMatch[0].length);
		}

		results.push({
			id: makeId(filePath, fullStart, m[0]),
			type: "insert",
			filePath,
			line: lineAt(content, fullStart),
			matchStart: fullStart,
			matchEnd,
			fullMatch: m[0],
			originalText: "",
			commentText: "insert",
			author,
			insertedText: text.trim(),
			insideAdBlock: false
		});
	}
	return results;
}

export function detectAnnotations(content: string, filePath: string): Annotation[] {
	const fenceRanges = getFenceRanges(content);
	const inlineCode = getInlineCodeRanges(content);
	const links = getMarkdownLinkRanges(content);
	const htmlComments = getHtmlCommentRanges(content);

	const nonAdFenceRanges = fenceRanges.filter(r => !r.isAdBlock);
	const highlightExcluded: ExcludedRange[] = [...nonAdFenceRanges, ...inlineCode, ...links, ...htmlComments];
	const nativeCommentExcluded: ExcludedRange[] = [...fenceRanges, ...inlineCode, ...links, ...htmlComments];

	const isInsideAdBlock = (offset: number) =>
		fenceRanges.some(r => r.isAdBlock && offset >= r.start && offset < r.end);

	const highlightMatches = findHighlightMatches(content, highlightExcluded);
	const highlightAnnotations = highlightMatches
		.map(m => classifyHighlightMatch(m, filePath, content, isInsideAdBlock))
		.filter((a): a is Annotation => a !== null);

	const nativeCommentAnnotations = findNativeCommentMatches(content, filePath, nativeCommentExcluded);

	const all = [...highlightAnnotations, ...nativeCommentAnnotations];
	all.sort((a, b) => a.matchStart - b.matchStart);
	return all;
}
