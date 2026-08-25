import { AdmonitionBlock, Annotation, AnnotationReply, AnnotationType, ExcludedRange, InsertContext, InsertPoint, MetaChannel, TextSpan, Wrapper } from "./types";

/*
 * The grammar, in one line:
 *
 *     <wrapper> <op> text <op> </wrapper> <entry>*
 *
 * The wrapper is `{...}`, `==...==` or `%%...%%` and only decides how the note
 * shows the text. The operator inside is `--` (delete), `++` (insert), or a
 * replacement written as `--old~>new++`, `--old--++new++` or `~~old~>new~~`.
 * No operator means a comment on the wrapped text. Each entry after the
 * wrapper is a footnote `^[...]` or a brace comment `{>>...<<}`, attached by
 * adjacency. The first entry carries `[Author]` and the reason, every entry
 * after it is a reply. A `{>>...<<}` with nothing in front of it is a comment
 * on that spot rather than on a span.
 */

interface FenceRange extends ExcludedRange {
	isAdBlock: boolean;
	infoString: string;
	bodyStart: number;
	bodyEnd: number;
}

/**
 * One footnote or brace comment attached to an annotation. Coordinates are
 * absolute while scanning and relative to `fullMatch` once stored.
 */
interface MetaEntry {
	channel: MetaChannel;
	contentStart: number;
	contentEnd: number;
	fullStart: number;
	fullEnd: number;
}

/** The operation an annotation performs, and where its text sits inside `fullMatch`. */
interface Body {
	type: AnnotationType;
	originalSpan?: TextSpan;
	bodySpan?: TextSpan;
	replacementSpan?: TextSpan;
}

const FENCE_REGEX = /^[\s>]*(`{3,}|~{3,})\s*(\S*)/;
const HIGHLIGHT_REGEX = /==([\s\S]+?)==/g;
const PERCENT_REGEX = /%%%%([\s\S]+?)%%%%|%%([\s\S]+?)%%/g;
const BRACE_OPEN_REGEX = /\{(--|\+\+|~~|==|>>)/g;
const FOOTNOTE_REGEX = /\^\[((?:\[[^\]]*\])?[^\]]*)\]/g;
const BRACE_COMMENT_REGEX = /\{>>([\s\S]*?)<<\}/g;
const AUTHOR_REGEX = /^\[([^\]]+)\]\s*/;
const INLINE_CODE_REGEX = /`([^`\n]+?)`/g;
const MARKDOWN_LINK_REGEX = /\[([^\]]*)\]\(([^)]*)\)/g;
const HTML_COMMENT_REGEX = /<!--[\s\S]*?-->/g;

const BRACE_OPENERS = new Set(["{--", "{++", "{~~", "{==", "{>>"]);
const BRACE_CLOSERS = new Set(["--}", "++}", "~~}", "==}", "<<}"]);

function rangeAt(pos: number, ranges: ExcludedRange[]): ExcludedRange | undefined {
	return ranges.find(r => pos >= r.start && pos < r.end);
}

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
	/** The label plus the whitespace after it. */
	authorSpan?: TextSpan;
	/** Right after the label's closing bracket, before any whitespace. */
	labelEnd: number;
	restStart: number;
}

/** Reads a leading `[Author] ` label out of a segment of `text`. */
function parseAuthorAt(text: string, contentStart: number, contentEnd: number): AuthorParse {
	const m = AUTHOR_REGEX.exec(text.slice(contentStart, contentEnd));
	if (m) {
		return {
			author: m[1],
			authorSpan: { start: contentStart, end: contentStart + m[0].length },
			labelEnd: contentStart + m[1].length + 2,
			restStart: contentStart + m[0].length
		};
	}
	return { labelEnd: contentStart, restStart: contentStart };
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
	const regex = new RegExp(pattern.source, "g");
	let m: RegExpExecArray | null;
	while ((m = regex.exec(content)) !== null) {
		ranges.push({ start: m.index, end: m.index + m[0].length });
	}
	return ranges;
}

/**
 * Reads the run of entries attached at `from`: footnotes and brace comments in
 * any mix, each one starting exactly where the previous one ended.
 */
function extractMeta(content: string, from: number): MetaEntry[] {
	const entries: MetaEntry[] = [];
	const footnote = new RegExp(FOOTNOTE_REGEX.source, "y");
	const braceComment = new RegExp(BRACE_COMMENT_REGEX.source, "y");
	let pos = from;
	for (;;) {
		let entry: MetaEntry | null = null;
		if (content.startsWith("^[", pos)) {
			footnote.lastIndex = pos;
			const m = footnote.exec(content);
			if (m) entry = { channel: "footnote", contentStart: pos + 2, contentEnd: pos + 2 + m[1].length, fullStart: pos, fullEnd: pos + m[0].length };
		} else if (content.startsWith("{>>", pos)) {
			braceComment.lastIndex = pos;
			const m = braceComment.exec(content);
			if (m) entry = { channel: "brace", contentStart: pos + 3, contentEnd: pos + 3 + m[1].length, fullStart: pos, fullEnd: pos + m[0].length };
		}
		if (!entry) break;
		entries.push(entry);
		pos = entry.fullEnd;
	}
	return entries;
}

interface FirstEntry {
	author?: string;
	authorSpan?: TextSpan;
	authorClearSpan?: TextSpan;
	authorInsert?: InsertPoint;
	text: string;
	reasonSpan?: TextSpan;
	reasonClearSpan?: TextSpan;
	reasonInsert?: InsertPoint;
	nextChannel: MetaChannel;
}

/**
 * The first entry carries the author and the reason. Every field also records
 * how to add, change or remove it, since the sidebar edits them in place.
 * Without an entry at all, both get a whole new footnote.
 */
function parseFirst(fullMatch: string, entry: MetaEntry | undefined, wrapperEnd: number, hasReplies: boolean, channel: MetaChannel): FirstEntry {
	if (!entry) {
		const [open, close] = channel === "brace" ? ["{>>", "<<}"] : ["^[", "]"];
		return {
			text: "",
			authorInsert: { at: wrapperEnd, prefix: `${open}[`, suffix: `]${close}` },
			reasonInsert: { at: wrapperEnd, prefix: open, suffix: close },
			nextChannel: channel
		};
	}
	const a = parseAuthorAt(fullMatch, entry.contentStart, entry.contentEnd);
	const textSpan = trimmedSpan(fullMatch, a.restStart, entry.contentEnd);
	const text = fullMatch.slice(textSpan.start, textSpan.end);
	const hasText = text.length > 0;
	const whole = { start: entry.fullStart, end: entry.fullEnd };
	const out: FirstEntry = { author: a.author, authorSpan: a.authorSpan, text, nextChannel: entry.channel };

	if (a.author) {
		// Removing the last thing in an entry removes the entry, unless replies
		// follow it, since the first entry is what makes them replies.
		out.authorClearSpan = hasText || hasReplies ? a.authorSpan : whole;
	} else {
		out.authorInsert = { at: entry.contentStart, prefix: "[", suffix: hasText ? "] " : "]" };
	}

	if (hasText) {
		out.reasonSpan = textSpan;
		out.reasonClearSpan = a.author
			? { start: a.labelEnd, end: entry.contentEnd }
			: hasReplies ? { start: entry.contentStart, end: entry.contentEnd } : whole;
	} else {
		const needsSpace = !!a.author && a.labelEnd === entry.contentEnd;
		out.reasonInsert = { at: entry.contentEnd, prefix: needsSpace ? " " : "", suffix: "" };
	}
	return out;
}

function parseReply(fullMatch: string, entry: MetaEntry): AnnotationReply {
	const a = parseAuthorAt(fullMatch, entry.contentStart, entry.contentEnd);
	const textSpan = trimmedSpan(fullMatch, a.restStart, entry.contentEnd);
	return {
		author: a.author,
		authorSpan: a.authorSpan,
		authorInsert: { at: entry.contentStart, prefix: "[", suffix: textSpan.end > textSpan.start ? "] " : "]" },
		text: fullMatch.slice(textSpan.start, textSpan.end),
		textSpan,
		fullSpan: { start: entry.fullStart, end: entry.fullEnd },
		channel: entry.channel
	};
}

/**
 * Works out the operation from the markers at both ends of the wrapped text.
 * `base` is where that text starts inside fullMatch, so the spans come out
 * relative to it. Whitespace is kept exactly as written, since `++is ++`
 * inserting its own trailing space is the whole point of the markers.
 */
function classifyInner(inner: string, base: number): Body {
	const n = inner.length;
	if (n >= 4) {
		const head = inner.slice(0, 2);
		const tail = inner.slice(-2);
		const mid = inner.slice(2, -2);
		const replace = (splitAt: number, splitLen: number): Body => ({
			type: "replace",
			originalSpan: { start: base + 2, end: base + 2 + splitAt },
			replacementSpan: { start: base + 2 + splitAt + splitLen, end: base + n - 2 }
		});
		if (head === "~~" && tail === "~~") {
			const k = mid.indexOf("~>");
			if (k !== -1) return replace(k, 2);
		} else if (head === "--" && tail === "++") {
			const arrow = mid.indexOf("~>");
			const fused = mid.indexOf("--++");
			if (arrow !== -1 && (fused === -1 || arrow < fused)) return replace(arrow, 2);
			if (fused !== -1) return replace(fused, 4);
		} else if (head === "--" && tail === "--") {
			return { type: "delete", originalSpan: { start: base + 2, end: base + n - 2 } };
		} else if (head === "++" && tail === "++") {
			return { type: "insert", bodySpan: { start: base + 2, end: base + n - 2 } };
		}
	}
	return { type: "comment", originalSpan: { start: base, end: base + n } };
}

interface BraceScan {
	closeStart: number;
	closeEnd: number;
	/** The `~>` or `--++` dividing old text from new, for a replacement. */
	split?: TextSpan;
}

/**
 * Finds the closer for the brace opener at `start`. Braces are the one wrapper
 * whose opening and closing marks differ, so they can nest, and the depth
 * count is what lets `{++a {++b++} c++}` close at the last `++}` rather than
 * the first. Anything in an excluded range is stepped over whole.
 */
function scanBrace(content: string, start: number, excluded: ExcludedRange[]): BraceScan | null {
	const op = content.slice(start + 1, start + 3);
	let depth = 0;
	let split: TextSpan | undefined;
	let i = start + 3;
	while (i < content.length) {
		const skip = rangeAt(i, excluded);
		if (skip) {
			i = skip.end;
			continue;
		}
		const three = content.slice(i, i + 3);
		if (BRACE_OPENERS.has(three)) {
			depth++;
			i += 3;
			continue;
		}
		if (BRACE_CLOSERS.has(three)) {
			if (depth > 0) {
				depth--;
				i += 3;
				continue;
			}
			const closer = three.slice(0, 2);
			const fits =
				op === "--" ? closer === (split ? "++" : "--") :
				op === "~~" ? closer === "~~" && !!split :
				op === "++" ? closer === "++" :
				op === "==" ? closer === "==" :
				closer === "<<";
			return fits ? { closeStart: i, closeEnd: i + 3, split } : null;
		}
		if (depth === 0 && !split) {
			if ((op === "--" || op === "~~") && content.startsWith("~>", i)) {
				split = { start: i, end: i + 2 };
				i += 2;
				continue;
			}
			if (op === "--" && content.startsWith("--++", i)) {
				split = { start: i, end: i + 4 };
				i += 4;
				continue;
			}
		}
		i++;
	}
	return null;
}

/** The body of a brace annotation, with spans relative to its opener. */
function braceBody(op: string, start: number, scan: BraceScan): Body | null {
	const contentEnd = scan.closeStart - start;
	if (op === "++") return { type: "insert", bodySpan: { start: 3, end: contentEnd } };
	if (op === "==") return { type: "comment", originalSpan: { start: 3, end: contentEnd } };
	if (scan.split) {
		return {
			type: "replace",
			originalSpan: { start: 3, end: scan.split.start - start },
			replacementSpan: { start: scan.split.end - start, end: contentEnd }
		};
	}
	if (op === "--") return { type: "delete", originalSpan: { start: 3, end: contentEnd } };
	return null;
}

interface Built {
	annotation: Annotation;
	/** The entries in absolute coordinates, so later scans can skip them. */
	entries: MetaEntry[];
}

function buildAnnotation(
	content: string,
	filePath: string,
	fullStart: number,
	wrapperEnd: number,
	body: Body,
	wrapper: Wrapper,
	isPoint: boolean,
	insideAdBlock: boolean,
	channel: MetaChannel
): Built {
	const entries = extractMeta(content, wrapperEnd);
	const matchEnd = entries.length ? entries[entries.length - 1].fullEnd : wrapperEnd;
	const fullMatch = content.slice(fullStart, matchEnd);
	const relative = entries.map(e => ({
		channel: e.channel,
		contentStart: e.contentStart - fullStart,
		contentEnd: e.contentEnd - fullStart,
		fullStart: e.fullStart - fullStart,
		fullEnd: e.fullEnd - fullStart
	}));
	const replies = relative.slice(1).map(e => parseReply(fullMatch, e));
	const first = parseFirst(fullMatch, relative[0], wrapperEnd - fullStart, replies.length > 0, channel);
	const slice = (span?: TextSpan) => (span ? fullMatch.slice(span.start, span.end) : undefined);

	const annotation: Annotation = {
		id: makeId(filePath, fullStart, fullMatch),
		type: body.type,
		filePath,
		line: lineAt(content, fullStart),
		matchStart: fullStart,
		matchEnd,
		fullMatch,
		wrapper,
		isPoint,
		isPlain: body.type === "comment" && entries.length === 0 && !isPoint,
		originalText: slice(body.originalSpan) ?? "",
		insertedText: slice(body.bodySpan),
		replacement: slice(body.replacementSpan),
		commentText: body.type === "comment" && first.text ? first.text : undefined,
		reason: body.type !== "comment" && first.text ? first.text : undefined,
		author: first.author,
		insideAdBlock,
		replies,
		originalSpan: body.originalSpan,
		bodySpan: body.bodySpan,
		replacementSpan: body.replacementSpan,
		authorSpan: first.authorSpan,
		authorClearSpan: first.authorClearSpan,
		authorInsert: first.authorInsert,
		reasonSpan: first.reasonSpan,
		reasonClearSpan: first.reasonClearSpan,
		reasonInsert: first.reasonInsert,
		// A reply goes after whatever is last, so it matches that one's channel.
		nextChannel: relative.length ? relative[relative.length - 1].channel : first.nextChannel
	};
	return { annotation, entries };
}

export interface DetectOptions {
	/** Where a first entry goes when an annotation has none. Footnotes unless told otherwise. */
	channel?: MetaChannel;
}

export function detectAnnotations(content: string, filePath: string, options: DetectOptions = {}): Annotation[] {
	const channel = options.channel ?? "footnote";
	const fenceRanges = getFenceRanges(content);
	const inlineCode = collectRanges(content, INLINE_CODE_REGEX);
	const links = collectRanges(content, MARKDOWN_LINK_REGEX);
	const htmlComments = collectRanges(content, HTML_COMMENT_REGEX);
	const footnotes = collectRanges(content, FOOTNOTE_REGEX);
	const braceComments = collectRanges(content, BRACE_COMMENT_REGEX);
	const nonAdFences = fenceRanges.filter(r => !r.isAdBlock);

	// Delimiters inside code, links, or the text of an entry are not delimiters.
	const prose: ExcludedRange[] = [...inlineCode, ...links, ...htmlComments, ...footnotes, ...braceComments];
	const wrapperExcluded: ExcludedRange[] = [...nonAdFences, ...prose];
	// Percent marks do not render inside any fenced block, admonitions included.
	const percentExcluded: ExcludedRange[] = [...fenceRanges, ...prose];
	const pointExcluded: ExcludedRange[] = [...nonAdFences, ...inlineCode, ...links, ...htmlComments, ...footnotes];

	const isInsideAdBlock = (offset: number) =>
		fenceRanges.some(r => r.isAdBlock && offset >= r.start && offset < r.end);

	const results: Annotation[] = [];
	/** Entries already claimed by an annotation, so they are not read as point comments too. */
	const consumed: ExcludedRange[] = [];
	const publish = (built: Built) => {
		results.push(built.annotation);
		for (const e of built.entries) consumed.push({ start: e.fullStart, end: e.fullEnd });
	};
	let m: RegExpExecArray | null;

	// Braces. Every opener gets its turn, including ones nested inside another
	// brace annotation, so both the outer and the inner one are found.
	const braceEqOpen = new Set<number>();
	const braceEqClose = new Set<number>();
	const braceRegex = new RegExp(BRACE_OPEN_REGEX.source, "g");
	while ((m = braceRegex.exec(content)) !== null) {
		const start = m.index;
		if (m[1] === ">>") continue;
		if (rangeAt(start, wrapperExcluded)) continue;
		const scan = scanBrace(content, start, wrapperExcluded);
		if (!scan) continue;
		const body = braceBody(m[1], start, scan);
		if (!body) continue;
		if (m[1] === "==") {
			braceEqOpen.add(start);
			braceEqClose.add(scan.closeStart);
		}
		publish(buildAnnotation(content, filePath, start, scan.closeEnd, body, "brace", false, isInsideAdBlock(start), channel));
	}

	// Highlights. Whenever a pairing is rejected only the opening delimiter
	// counts as consumed, so the closing one gets a fresh chance to pair with
	// its real partner. Consuming both used to let one stray == desync every
	// annotation after it.
	const highlightRegex = new RegExp(HIGHLIGHT_REGEX.source, "g");
	while ((m = highlightRegex.exec(content)) !== null) {
		const fullStart = m.index;
		const highlightEnd = fullStart + m[0].length;
		const retry = () => {
			highlightRegex.lastIndex = fullStart + 2;
		};
		// The == of a {==...==} belongs to the braces.
		if (braceEqOpen.has(fullStart - 1) || braceEqClose.has(fullStart)) {
			retry();
			continue;
		}
		if (/\n\s*\n/.test(m[1])) {
			retry();
			continue;
		}
		if (hasDelimiterInsideRanges(fullStart, highlightEnd, wrapperExcluded)) {
			retry();
			continue;
		}
		// An ordinary highlight with nothing attached counts too, as a plain
		// comment, so the sidebar can list it or filter it out.
		const body = classifyInner(m[1], 2);
		const built = buildAnnotation(content, filePath, fullStart, highlightEnd, body, "highlight", false, isInsideAdBlock(fullStart), channel);
		publish(built);
		highlightRegex.lastIndex = built.annotation.matchEnd;
	}

	// Percent marks. An ordinary hidden comment with nothing attached counts
	// as a plain comment, the same as a bare highlight.
	const percentRegex = new RegExp(PERCENT_REGEX.source, "g");
	while ((m = percentRegex.exec(content)) !== null) {
		const fullStart = m.index;
		const end = fullStart + m[0].length;
		const doubled = m[1] !== undefined;
		const delim = doubled ? 4 : 2;
		if (hasDelimiterInsideRanges(fullStart, end, percentExcluded)) {
			percentRegex.lastIndex = fullStart + delim;
			continue;
		}
		const body = classifyInner(doubled ? m[1] : m[2], delim);
		const built = buildAnnotation(content, filePath, fullStart, end, body, "percent", false, false, channel);
		publish(built);
		percentRegex.lastIndex = built.annotation.matchEnd;
	}

	// Point comments: whatever {>>...<<} is left over once the ones attached to
	// an annotation have been claimed.
	const pointRegex = /\{>>/g;
	while ((m = pointRegex.exec(content)) !== null) {
		const start = m.index;
		if (rangeAt(start, consumed) || rangeAt(start, pointExcluded)) continue;
		const built = buildAnnotation(content, filePath, start, start, { type: "comment" }, "brace", true, isInsideAdBlock(start), channel);
		if (built.entries.length === 0) continue;
		publish(built);
		pointRegex.lastIndex = built.annotation.matchEnd;
	}

	results.sort((a, b) => a.matchStart - b.matchStart);
	return results;
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
 * Percent marks do not render inside a fenced block, so those need another
 * wrapper. Inside an existing percent mark annotation the new insert has to
 * close and reopen it, and the surrounding operator has to be closed and
 * reopened too, or the two halves stop being well formed and the text around
 * the new insert breaks out as visible prose.
 */
export function getInsertContext(content: string, offset: number): InsertContext {
	const fenceRanges = getFenceRanges(content);
	if (fenceRanges.some(r => offset > r.start && offset < r.end)) return { kind: "fenced" };

	const excluded: ExcludedRange[] = [
		...fenceRanges,
		...collectRanges(content, INLINE_CODE_REGEX),
		...collectRanges(content, MARKDOWN_LINK_REGEX),
		...collectRanges(content, HTML_COMMENT_REGEX)
	];
	const regex = new RegExp(PERCENT_REGEX.source, "g");
	let m: RegExpExecArray | null;
	while ((m = regex.exec(content)) !== null) {
		const start = m.index;
		const end = m.index + m[0].length;
		if (hasDelimiterInsideRanges(start, end, excluded)) continue;
		if (offset <= start || offset >= end) continue;
		const doubled = m[1] !== undefined;
		const body = classifyInner(doubled ? m[1] : m[2], start + (doubled ? 4 : 2));
		let marker = "";
		if (body.type === "insert") marker = "++";
		else if (body.type === "delete") marker = "--";
		else if (body.type === "replace" && body.originalSpan && body.replacementSpan) {
			// Inside a replacement, match whichever half the caret is in.
			marker = offset <= body.originalSpan.end ? "--" : "++";
		}
		return { kind: "nested", marker };
	}
	return { kind: "plain" };
}
