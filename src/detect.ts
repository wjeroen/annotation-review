import { AdmonitionBlock, Annotation, AnnotationReply, ExcludedRange, InsertContext, InsertPoint, TextSpan } from "./types";

interface FenceRange extends ExcludedRange {
	isAdBlock: boolean;
	infoString: string;
	bodyStart: number;
	bodyEnd: number;
}

/** A footnote's content range, in whatever coordinate space the caller passed in. */
interface FootnoteSpan {
	content: string;
	start: number;
	end: number;
}

interface RawHighlightMatch {
	fullStart: number;
	matchEnd: number;
	isPlusWrapped: boolean;
	innerText: string;
	/** The inner text's range inside fullMatch. */
	innerSpan: TextSpan;
	/** Length of the `==...==` part, so a new footnote can be placed right after it. */
	highlightLen: number;
	footnotes: FootnoteSpan[];
	fullMatch: string;
}

const FENCE_REGEX = /^[\s>]*(`{3,}|~{3,})\s*(\S*)/;
const HIGHLIGHT_REGEX = /==(\+\+)?([\s\S]+?)\1==/g;
const FOOTNOTE_REGEX = /^\^\[((?:\[[^\]]*\])?[^\]]*)\]/;
const AUTHOR_REGEX = /^\[([^\]]+)\]\s*/;
const ARROW_REPLACE_REGEX = /^(→\s*")([^"]*)("\s*,?\s*)([\s\S]*)$/;
const DELETE_REGEX = /^(delete\b\s*,?\s*)([\s\S]*)$/i;
const INSERT_KEYWORD_REGEX = /^(insert\b\s*,?\s*)([\s\S]*)$/i;
/**
 * Stricter than INSERT_KEYWORD_REGEX, for the forms where a trailing footnote
 * could just as easily be a reply. "insert" and "insert, reason" match, while
 * a reply like "insert reads well here" does not, so replies aren't swallowed
 * as reasons.
 */
const INSERT_REASON_REGEX = /^insert\b[ \t]*(?:,[ \t]*([\s\S]*))?$/i;
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

function skipWhitespace(text: string, index: number, end: number): number {
	let i = index;
	while (i < end && /\s/.test(text[i])) i++;
	return i;
}

/** The span of [start, end) with surrounding whitespace trimmed off both ends. */
function trimmedSpan(text: string, start: number, end: number): TextSpan {
	let s = start;
	let e = end;
	while (s < e && /\s/.test(text[s])) s++;
	while (e > s && /\s/.test(text[e - 1])) e--;
	return { start: s, end: e };
}

interface AuthorParse {
	author?: string;
	authorSpan?: TextSpan;
	authorInsertAt: number;
	/** Where the content after the author label begins. */
	restStart: number;
}

/** Reads a leading `[Author] ` label out of a segment of `text`. */
function parseAuthorAt(text: string, contentStart: number, contentEnd: number): AuthorParse {
	const segment = text.slice(contentStart, contentEnd);
	const m = AUTHOR_REGEX.exec(segment);
	if (m) {
		return {
			author: m[1],
			authorSpan: { start: contentStart, end: contentStart + m[0].length },
			authorInsertAt: contentStart,
			restStart: contentStart + m[0].length
		};
	}
	return {
		authorInsertAt: contentStart,
		restStart: skipWhitespace(text, contentStart, contentEnd)
	};
}

function getFenceRanges(content: string): FenceRange[] {
	const ranges: FenceRange[] = [];
	const lines = content.split("\n");
	let currentStart: number | null = null;
	let currentBodyStart: number | null = null;
	let currentMarkerChar: string | null = null;
	let currentIsAd = false;
	let currentInfoString = "";
	let pos = 0;
	for (const line of lines) {
		const lineStart = pos;
		const lineEnd = pos + line.length;
		const m = FENCE_REGEX.exec(line);
		if (m) {
			const markerChar = m[1][0];
			if (currentMarkerChar === markerChar) {
				ranges.push({
					start: currentStart!,
					end: lineEnd,
					isAdBlock: currentIsAd,
					infoString: currentInfoString,
					bodyStart: currentBodyStart!,
					bodyEnd: lineStart
				});
				currentStart = null;
				currentBodyStart = null;
				currentMarkerChar = null;
				currentIsAd = false;
				currentInfoString = "";
			} else if (currentMarkerChar === null) {
				currentStart = lineStart;
				currentBodyStart = Math.min(lineEnd + 1, content.length);
				currentMarkerChar = markerChar;
				currentInfoString = (m[2] || "").toLowerCase();
				currentIsAd = /^ad-/i.test(currentInfoString);
			}
		}
		pos = lineEnd + 1;
	}
	if (currentStart !== null) {
		ranges.push({
			start: currentStart,
			end: content.length,
			isAdBlock: currentIsAd,
			infoString: currentInfoString,
			bodyStart: currentBodyStart!,
			bodyEnd: content.length
		});
	}
	return ranges;
}

function collectRanges(content: string, pattern: RegExp): ExcludedRange[] {
	const ranges: ExcludedRange[] = [];
	const regex = new RegExp(pattern);
	let m: RegExpExecArray | null;
	while ((m = regex.exec(content)) !== null) {
		ranges.push({ start: m.index, end: m.index + m[0].length });
	}
	return ranges;
}

/**
 * Reads a run of footnotes (`^[a]^[b]`) from the start of `rest`, returning
 * each one's content span relative to `rest` plus how much text they consumed.
 */
function extractFootnotes(rest: string): { footnotes: FootnoteSpan[]; consumedLength: number } {
	const footnotes: FootnoteSpan[] = [];
	let pos = 0;
	for (;;) {
		const m = FOOTNOTE_REGEX.exec(rest.slice(pos));
		if (!m) break;
		const contentStart = pos + 2; // past the opening "^["
		footnotes.push({
			content: m[1],
			start: contentStart,
			end: contentStart + m[1].length
		});
		pos += m[0].length;
	}
	return { footnotes, consumedLength: pos };
}

/** Shifts footnote spans from `rest` coordinates into `fullMatch` coordinates. */
function shiftFootnotes(footnotes: FootnoteSpan[], offset: number): FootnoteSpan[] {
	return footnotes.map(f => ({ content: f.content, start: f.start + offset, end: f.end + offset }));
}

function parseReplies(fullMatch: string, footnotes: FootnoteSpan[]): AnnotationReply[] {
	return footnotes.map(fn => {
		const parsed = parseAuthorAt(fullMatch, fn.start, fn.end);
		const textSpan = trimmedSpan(fullMatch, parsed.restStart, fn.end);
		return {
			author: parsed.author,
			authorSpan: parsed.authorSpan,
			authorInsertAt: parsed.authorInsertAt,
			text: fullMatch.slice(textSpan.start, textSpan.end),
			textSpan
		};
	});
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

		if (/\n\s*\n/.test(innerText)) {
			// This pairing is almost certainly wrong, most likely the opening
			// == is stray text (someone typing == literally, e.g. describing
			// the syntax itself) rather than a real delimiter, and it happened
			// to pair with a real annotation's opening ==. Only the first ==
			// gets treated as consumed, so the second one gets a fresh chance
			// to pair with its own real closing ==. Without this, one stray ==
			// desyncs every real annotation for the rest of the file.
			regex.lastIndex = fullStart + (isPlusWrapped ? 4 : 2);
			continue;
		}

		const rest = content.slice(highlightEnd);
		const { footnotes, consumedLength } = extractFootnotes(rest);
		const matchEnd = highlightEnd + consumedLength;

		if (hasDelimiterInsideRanges(fullStart, matchEnd, excludedRanges)) continue;

		const highlightLen = highlightEnd - fullStart;
		const innerStart = isPlusWrapped ? 4 : 2;
		matches.push({
			fullStart,
			matchEnd,
			isPlusWrapped,
			innerText,
			innerSpan: { start: innerStart, end: innerStart + innerText.length },
			highlightLen,
			footnotes: shiftFootnotes(footnotes, highlightLen),
			fullMatch: content.slice(fullStart, matchEnd)
		});
	}
	return matches;
}

/**
 * Pulls an optional reason out of a footnote that reads like `insert` or
 * `insert, reason`. Returns null when the footnote is something else, which
 * means it belongs to the replies instead.
 */
function readInsertReasonFootnote(
	fullMatch: string,
	footnote: FootnoteSpan
): { author?: string; authorSpan?: TextSpan; authorInsertAt: number; reason?: string; reasonSpan?: TextSpan; reasonInsertAt: number } | null {
	const parsed = parseAuthorAt(fullMatch, footnote.start, footnote.end);
	const segment = fullMatch.slice(parsed.restStart, footnote.end);
	const m = INSERT_REASON_REGEX.exec(segment.trim());
	if (!m) return null;

	const contentEnd = trimmedSpan(fullMatch, parsed.restStart, footnote.end).end;
	if (m[1] && m[1].trim()) {
		const reasonStart = fullMatch.lastIndexOf(m[1].trim(), contentEnd);
		return {
			author: parsed.author,
			authorSpan: parsed.authorSpan,
			authorInsertAt: parsed.authorInsertAt,
			reason: m[1].trim(),
			reasonSpan: { start: reasonStart, end: reasonStart + m[1].trim().length },
			reasonInsertAt: contentEnd
		};
	}
	return {
		author: parsed.author,
		authorSpan: parsed.authorSpan,
		authorInsertAt: parsed.authorInsertAt,
		reasonInsertAt: contentEnd
	};
}

function classifyHighlightMatch(
	match: RawHighlightMatch,
	filePath: string,
	content: string,
	isInsideAdBlock: (offset: number) => boolean
): Annotation | null {
	const fullMatch = match.fullMatch;
	const base = {
		id: makeId(filePath, match.fullStart, fullMatch),
		filePath,
		line: lineAt(content, match.fullStart),
		matchStart: match.fullStart,
		matchEnd: match.matchEnd,
		fullMatch,
		insideAdBlock: isInsideAdBlock(match.fullStart)
	};

	// The ==++text++== insert form. The author sits inside the highlight, and a
	// leading "insert, reason" footnote (if any) carries the reason.
	if (match.isPlusWrapped) {
		const innerAuthor = parseAuthorAt(fullMatch, match.innerSpan.start, match.innerSpan.end);
		const bodySpan = trimmedSpan(fullMatch, innerAuthor.restStart, match.innerSpan.end);

		let author = innerAuthor.author;
		let authorSpan = innerAuthor.authorSpan;
		let authorInsertAt = innerAuthor.authorInsertAt;
		let reason: string | undefined;
		let reasonSpan: TextSpan | undefined;
		let reasonInsert: InsertPoint | undefined;
		let replies: AnnotationReply[];

		const reasonFootnote = match.footnotes[0] ? readInsertReasonFootnote(fullMatch, match.footnotes[0]) : null;
		if (reasonFootnote) {
			if (!author && reasonFootnote.author) {
				author = reasonFootnote.author;
				authorSpan = reasonFootnote.authorSpan;
				authorInsertAt = reasonFootnote.authorInsertAt;
			}
			reason = reasonFootnote.reason;
			reasonSpan = reasonFootnote.reasonSpan;
			if (!reason) reasonInsert = { at: reasonFootnote.reasonInsertAt, prefix: ", ", suffix: "" };
			replies = parseReplies(fullMatch, match.footnotes.slice(1));
		} else {
			replies = parseReplies(fullMatch, match.footnotes);
			// A brand new reason becomes the first footnote, right after ++==,
			// so it lands ahead of any existing replies.
			reasonInsert = { at: match.highlightLen, prefix: "^[insert, ", suffix: "]" };
		}

		return {
			...base,
			type: "insert",
			originalText: "",
			author,
			reason,
			insertedText: fullMatch.slice(bodySpan.start, bodySpan.end),
			replies,
			authorSpan,
			authorInsertAt,
			bodySpan,
			reasonSpan,
			reasonInsert
		};
	}

	const first = match.footnotes[0];
	if (!first) return null;

	const parsed = parseAuthorAt(fullMatch, first.start, first.end);
	const segStart = parsed.restStart;
	const segment = fullMatch.slice(segStart, first.end);
	const contentEnd = trimmedSpan(fullMatch, segStart, first.end).end;
	const replies = parseReplies(fullMatch, match.footnotes.slice(1));
	const authorBits = {
		author: parsed.author,
		authorSpan: parsed.authorSpan,
		authorInsertAt: parsed.authorInsertAt
	};

	const arrowMatch = ARROW_REPLACE_REGEX.exec(segment);
	if (arrowMatch) {
		const replacementStart = segStart + arrowMatch[1].length;
		const reasonStart = replacementStart + arrowMatch[2].length + arrowMatch[3].length;
		const hasReason = !!arrowMatch[4].trim();
		return {
			...base,
			...authorBits,
			type: "replace",
			originalText: match.innerText,
			replacement: arrowMatch[2],
			reason: hasReason ? arrowMatch[4].trim() : undefined,
			replies,
			replacementSpan: { start: replacementStart, end: replacementStart + arrowMatch[2].length },
			reasonSpan: hasReason ? trimmedSpan(fullMatch, reasonStart, first.end) : undefined,
			reasonInsert: hasReason ? undefined : { at: contentEnd, prefix: ", ", suffix: "" }
		};
	}

	const deleteMatch = DELETE_REGEX.exec(segment);
	if (deleteMatch) {
		const hasReason = !!deleteMatch[2].trim();
		return {
			...base,
			...authorBits,
			type: "delete",
			originalText: match.innerText,
			reason: hasReason ? deleteMatch[2].trim() : undefined,
			replies,
			reasonSpan: hasReason ? trimmedSpan(fullMatch, segStart + deleteMatch[1].length, first.end) : undefined,
			reasonInsert: hasReason ? undefined : { at: contentEnd, prefix: ", ", suffix: "" }
		};
	}

	const insertMatch = INSERT_KEYWORD_REGEX.exec(segment);
	if (insertMatch) {
		const hasReason = !!insertMatch[2].trim();
		return {
			...base,
			...authorBits,
			type: "insert",
			originalText: "",
			insertedText: match.innerText,
			reason: hasReason ? insertMatch[2].trim() : undefined,
			replies,
			bodySpan: match.innerSpan,
			reasonSpan: hasReason ? trimmedSpan(fullMatch, segStart + insertMatch[1].length, first.end) : undefined,
			reasonInsert: hasReason ? undefined : { at: contentEnd, prefix: ", ", suffix: "" }
		};
	}

	const bodySpan = trimmedSpan(fullMatch, segStart, first.end);
	return {
		...base,
		...authorBits,
		type: "comment",
		originalText: match.innerText,
		commentText: fullMatch.slice(bodySpan.start, bodySpan.end),
		replies,
		bodySpan
	};
}

function findNativeCommentMatches(content: string, filePath: string, excludedRanges: ExcludedRange[]): Annotation[] {
	const results: Annotation[] = [];
	const regex = new RegExp(NATIVE_COMMENT_REGEX);
	let m: RegExpExecArray | null;
	while ((m = regex.exec(content)) !== null) {
		const fullStart = m.index;
		const commentEnd = m.index + m[0].length;
		if (hasDelimiterInsideRanges(fullStart, commentEnd, excludedRanges)) continue;

		const rest = content.slice(commentEnd);
		const { footnotes, consumedLength } = extractFootnotes(rest);
		const matchEnd = commentEnd + consumedLength;
		regex.lastIndex = matchEnd;

		const fullMatch = content.slice(fullStart, matchEnd);
		const commentLen = commentEnd - fullStart;
		const raw = m[1] !== undefined ? m[1] : m[2];
		const delimLen = m[1] !== undefined ? 4 : 2;
		const innerSpan: TextSpan = { start: delimLen, end: delimLen + raw.length };
		const shifted = shiftFootnotes(footnotes, commentLen);

		const innerAuthor = parseAuthorAt(fullMatch, innerSpan.start, innerSpan.end);
		const bodySpan = trimmedSpan(fullMatch, innerAuthor.restStart, innerSpan.end);

		let author = innerAuthor.author;
		let authorSpan = innerAuthor.authorSpan;
		let authorInsertAt = innerAuthor.authorInsertAt;
		let reason: string | undefined;
		let reasonSpan: TextSpan | undefined;
		let reasonInsert: InsertPoint | undefined;
		let replies: AnnotationReply[];

		const reasonFootnote = shifted[0] ? readInsertReasonFootnote(fullMatch, shifted[0]) : null;
		if (reasonFootnote) {
			if (!author && reasonFootnote.author) {
				author = reasonFootnote.author;
				authorSpan = reasonFootnote.authorSpan;
				authorInsertAt = reasonFootnote.authorInsertAt;
			}
			reason = reasonFootnote.reason;
			reasonSpan = reasonFootnote.reasonSpan;
			if (!reason) reasonInsert = { at: reasonFootnote.reasonInsertAt, prefix: ", ", suffix: "" };
			replies = parseReplies(fullMatch, shifted.slice(1));
		} else {
			replies = parseReplies(fullMatch, shifted);
			reasonInsert = { at: commentLen, prefix: "^[insert, ", suffix: "]" };
		}

		results.push({
			id: makeId(filePath, fullStart, fullMatch),
			type: "insert",
			filePath,
			line: lineAt(content, fullStart),
			matchStart: fullStart,
			matchEnd,
			fullMatch,
			originalText: "",
			author,
			reason,
			insertedText: fullMatch.slice(bodySpan.start, bodySpan.end),
			insideAdBlock: false,
			replies,
			authorSpan,
			authorInsertAt,
			bodySpan,
			reasonSpan,
			reasonInsert
		});
	}
	return results;
}

export function detectAnnotations(content: string, filePath: string): Annotation[] {
	const fenceRanges = getFenceRanges(content);
	const inlineCode = collectRanges(content, INLINE_CODE_REGEX);
	const links = collectRanges(content, MARKDOWN_LINK_REGEX);
	const htmlComments = collectRanges(content, HTML_COMMENT_REGEX);

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

export function detectAdmonitionBlocks(content: string, filePath: string): AdmonitionBlock[] {
	const fenceRanges = getFenceRanges(content).filter(r => r.isAdBlock);
	return fenceRanges.map(r => {
		const body = content.slice(r.bodyStart, r.bodyEnd).trim();
		const preview = body.length > 140 ? `${body.slice(0, 140)}…` : body;
		return {
			id: makeId(filePath, r.start, r.infoString),
			filePath,
			line: lineAt(content, r.start),
			matchStart: r.start,
			matchEnd: r.end,
			adType: r.infoString || "ad",
			preview,
			raw: content.slice(r.start, r.end)
		};
	});
}

/**
 * Which insert syntax belongs at `offset`.
 *
 * Percent marks don't render inside a fenced block, so those need the highlight
 * form. Inside an existing `%%...%%` span the new insert has to close and
 * reopen the surrounding comment, which is what the doubled form does, and
 * without it the surrounding text would break out of its comment and become
 * visible prose.
 */
export function getInsertContext(content: string, offset: number): InsertContext {
	const fenceRanges = getFenceRanges(content);
	if (fenceRanges.some(r => offset > r.start && offset < r.end)) return "fenced";

	const excluded: ExcludedRange[] = [
		...fenceRanges,
		...collectRanges(content, INLINE_CODE_REGEX),
		...collectRanges(content, MARKDOWN_LINK_REGEX),
		...collectRanges(content, HTML_COMMENT_REGEX)
	];
	const regex = new RegExp(NATIVE_COMMENT_REGEX);
	let m: RegExpExecArray | null;
	while ((m = regex.exec(content)) !== null) {
		const start = m.index;
		const end = m.index + m[0].length;
		if (hasDelimiterInsideRanges(start, end, excluded)) continue;
		if (offset > start && offset < end) return "native-comment";
	}
	return "plain";
}
