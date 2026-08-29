import { AdmonitionBlock, Annotation, AnnotationReply, AnnotationType, ExcludedRange, InsertContext, InsertPoint, MetaChannel, TextSpan, Wrapper } from "./types";

/*
 * The grammar, in one line:
 *
 *     <wrapper> <op> <author>@@? text <op> </wrapper> <reply>*
 *
 * The wrapper is `{...}`, `==...==` or `%%...%%` and only decides how the note
 * shows the text. The operator inside is `--` (delete), `++` (insert), `>>`
 * (a comment on that spot, the text being the remark), or `~~old~>new~~`
 * (replace). No operator means a comment on the wrapped text. Right after the opening operator marks an
 * optional author, `{"author":"X"}@@` (the CriticMarkup plugin's metadata) or
 * `[X]@@`, terminated by `@@` so the text after it keeps every space.
 *
 * Each entry after the wrapper is a footnote `^[...]` or a brace comment
 * `{>>...<<}`, attached by adjacency, and every one of them is a reply with
 * its own author. A `{>>...<<}` with nothing in front of it is a comment on
 * that spot rather than a reply.
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
	/** A comment on a spot: the remark itself, between `>>` and `<<`. */
	pointSpan?: TextSpan;
}

const FENCE_REGEX = /^[\s>]*(`{3,}|~{3,})\s*(\S*)/;
const HIGHLIGHT_REGEX = /==([\s\S]+?)==/g;
const PERCENT_REGEX = /%%%%([\s\S]+?)%%%%|%%([\s\S]+?)%%/g;
const BRACE_OPEN_REGEX = /\{(--|\+\+|~~|==|>>)/g;
const FOOTNOTE_REGEX = /\^\[((?:\[[^\]]*\])?[^\]]*)\]/g;
const BRACE_COMMENT_REGEX = /\{>>([\s\S]*?)<<\}/g;
/**
 * An author terminated by `@@`, in either spelling. The bracket may be empty,
 * and it may carry markers behind colons, `[Claude:L3]`, which name the set
 * the annotation belongs to rather than a person. A second bracket is not
 * used for that: `[Claude][L3]` is a reference link in markdown, so Obsidian
 * eats the brackets and draws the name as a link.
 */
const META_REGEX = /^(\{[^}]*\}|\[[^\]]*\])@@/;
/** A plain `[Author] ` label, only meaningful at the start of prose. */
const LABEL_REGEX = /^\[([^\]]+)\]\s*/;
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

/** Reads the author out of `{"author":"X"}` or `[X]`, keeping any other metadata fields. */
/**
 * A label is a name, then any number of markers behind colons. A colon never
 * appears in a name, so nothing is guessed: `[Claude:L3]` is Claude in set 3,
 * `[:L3]` is set 3 with nobody signing it, and `[L3]` is a person called L3.
 * A marker we do not know is left where it is.
 */
function readLabel(raw: string): { author?: string; link?: string } {
	const parts = raw.slice(1, -1).split(":").map(part => part.trim());
	const author = parts[0] || undefined;
	for (const marker of parts.slice(1)) {
		const m = /^L(\d+)$/.exec(marker);
		if (m) return { author, link: m[1] };
	}
	return { author };
}

function readMeta(raw: string): { author?: string; link?: string; meta?: Record<string, unknown> } {
	if (raw.startsWith("[")) return readLabel(raw);
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return { meta: {} };
	}
	if (!parsed || typeof parsed !== "object") return { meta: {} };
	const fields = { ...(parsed as Record<string, unknown>) };
	const value = fields.author ?? fields.a;
	delete fields.author;
	delete fields.a;
	return { author: typeof value === "string" && value ? value : undefined, link: linkIn(fields), meta: fields };
}

/** The set a metadata annotation belongs to, `{"author":"X","link":3}`. Numbers only. */
function linkIn(meta?: Record<string, unknown>): string | undefined {
	const value = meta?.link;
	if (typeof value === "number" && Number.isInteger(value) && value >= 0) return String(value);
	return typeof value === "string" && /^\d+$/.test(value) ? value : undefined;
}

interface AuthorParse {
	author?: string;
	link?: string;
	authorSpan?: TextSpan;
	authorMeta?: Record<string, unknown>;
	/** Where the text after the author begins. */
	restStart: number;
}

/**
 * Reads an author from the start of [contentStart, contentEnd). The `@@`
 * forms are read anywhere. The plain `[Author] ` label is only read in prose,
 * since in annotated text the space after it would be ambiguous.
 */
function parseAuthorAt(text: string, contentStart: number, contentEnd: number, allowLabel: boolean): AuthorParse {
	const segment = text.slice(contentStart, contentEnd);
	const m = META_REGEX.exec(segment);
	if (m) {
		const { author, link, meta } = readMeta(m[1]);
		return {
			author,
			link,
			authorMeta: meta,
			authorSpan: { start: contentStart, end: contentStart + m[0].length },
			restStart: contentStart + m[0].length
		};
	}
	if (allowLabel) {
		const l = LABEL_REGEX.exec(segment);
		if (l) {
			// A marker is read off a label as well, so a name with one behind
			// it comes out as the name.
			const { author } = readLabel(`[${l[1]}]`);
			return { author, authorSpan: { start: contentStart, end: contentStart + l[0].length }, restStart: contentStart + l[0].length };
		}
	}
	return { restStart: contentStart };
}

/** How a new author is written at a spot: metadata in braces, the light form elsewhere, a label in prose. */
function authorInsertFor(at: number, form: "brace" | "light" | "label"): InsertPoint {
	if (form === "brace") return { at, prefix: '{"author":"', suffix: '"}@@' };
	if (form === "light") return { at, prefix: "[", suffix: "]@@" };
	return { at, prefix: "[", suffix: "] " };
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

function parseReply(fullMatch: string, entry: MetaEntry): AnnotationReply {
	const a = parseAuthorAt(fullMatch, entry.contentStart, entry.contentEnd, true);
	const textSpan = trimmedSpan(fullMatch, a.restStart, entry.contentEnd);
	return {
		author: a.author,
		link: a.link,
		authorSpan: a.authorSpan,
		authorMeta: a.authorMeta,
		authorInsert: authorInsertFor(entry.contentStart, entry.channel === "brace" ? "brace" : "label"),
		text: fullMatch.slice(textSpan.start, textSpan.end),
		textSpan,
		fullSpan: { start: entry.fullStart, end: entry.fullEnd },
		channel: entry.channel
	};
}

/**
 * Works out the operation from the markers at both ends of the wrapped text,
 * for highlights and percent marks. `base` is where that text starts inside
 * fullMatch, so the spans come out relative to it. Whitespace is kept exactly
 * as written, since `++is ++` inserting its own trailing space is the whole
 * point of the markers. The author, if any, is read off the spans afterwards.
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
		} else if (head === "--" && tail === "--") {
			return { type: "delete", originalSpan: { start: base + 2, end: base + n - 2 } };
		} else if (head === "++" && tail === "++") {
			return { type: "insert", bodySpan: { start: base + 2, end: base + n - 2 } };
		} else if (head === ">>" && tail === "<<") {
			return { type: "comment", pointSpan: { start: base + 2, end: base + n - 2 } };
		}
	}
	return { type: "comment", originalSpan: { start: base, end: base + n } };
}

interface BraceScan {
	closeStart: number;
	closeEnd: number;
	/** The `~>` dividing old text from new, for a replacement. */
	split?: TextSpan;
}

/**
 * Finds the closer for the brace opener at `start`. Braces are the one wrapper
 * whose opening and closing marks differ, so they can nest, and the depth
 * count is what lets `{++a {++b++} c++}` close at the last `++}` rather than
 * the first. Anything in an excluded range is stepped over whole. Braces take
 * CriticMarkup's forms only, so a replacement is `{~~old~>new~~}` and nothing
 * else, since that is what the CriticMarkup plugin reads.
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
			const fits = op === "~~" ? closer === "~~" && !!split : closer === op;
			return fits ? { closeStart: i, closeEnd: i + 3, split } : null;
		}
		if (depth === 0 && !split && op === "~~" && content.startsWith("~>", i)) {
			split = { start: i, end: i + 2 };
			i += 2;
			continue;
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
	if (op === "--") return { type: "delete", originalSpan: { start: 3, end: contentEnd } };
	if (op === "~~" && scan.split) {
		return {
			type: "replace",
			originalSpan: { start: 3, end: scan.split.start - start },
			replacementSpan: { start: scan.split.end - start, end: contentEnd }
		};
	}
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
	channel: MetaChannel,
	/**
	 * For a comment on a spot, `{>>note<<}`, the wrapper's own content: the
	 * note itself, with its author. In fullMatch coordinates.
	 */
	selfEntry?: MetaEntry
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
	const replies = relative.map(e => parseReply(fullMatch, e));

	// Copies, since reading the author off the front shortens the span.
	const originalSpan = body.originalSpan ? { ...body.originalSpan } : undefined;
	const bodySpan = body.bodySpan ? { ...body.bodySpan } : undefined;
	let author: string | undefined;
	let link: string | undefined;
	let authorSpan: TextSpan | undefined;
	let authorMeta: Record<string, unknown> | undefined;
	let authorInsert: InsertPoint;
	let commentSpan: TextSpan | undefined;

	if (selfEntry) {
		// The note is prose, so a plain label counts as well as the @@ forms.
		const a = parseAuthorAt(fullMatch, selfEntry.contentStart, selfEntry.contentEnd, true);
		author = a.author;
		link = a.link;
		authorSpan = a.authorSpan;
		authorMeta = a.authorMeta;
		commentSpan = trimmedSpan(fullMatch, a.restStart, selfEntry.contentEnd);
		authorInsert = authorInsertFor(selfEntry.contentStart, wrapper === "brace" ? "brace" : "label");
	} else {
		// The author sits at the start of the annotated text, or of the old
		// text for a replacement.
		const lead = originalSpan ?? bodySpan;
		if (lead) {
			const a = parseAuthorAt(fullMatch, lead.start, lead.end, false);
			if (a.authorSpan) {
				author = a.author;
				link = a.link;
				authorSpan = a.authorSpan;
				authorMeta = a.authorMeta;
				lead.start = a.restStart;
			}
			authorInsert = authorInsertFor(authorSpan ? authorSpan.start : lead.start, wrapper === "brace" ? "brace" : "light");
		} else {
			authorInsert = authorInsertFor(0, "light");
		}
	}

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
		// A highlight or hidden text with nothing attached and nobody named
		// could be ordinary Obsidian markup. A >> comment never is.
		isPlain: body.type === "comment" && !isPoint && !author && replies.length === 0,
		originalText: slice(originalSpan) ?? "",
		commentText: slice(commentSpan),
		insertedText: slice(bodySpan),
		replacement: slice(body.replacementSpan),
		author,
		// A set is a set of changes. A comment is not approved, so it has
		// nothing to add to one and never carries a link.
		link: body.type === "comment" ? undefined : link,
		authorSpan,
		authorMeta,
		authorInsert,
		insideAdBlock,
		replies,
		originalSpan,
		bodySpan,
		replacementSpan: body.replacementSpan,
		commentSpan,
		wrapperLength: wrapperEnd - fullStart,
		// A reply goes after whatever is last, so it matches that one's channel.
		nextChannel: relative.length ? relative[relative.length - 1].channel : channel
	};
	return { annotation, entries };
}

/** A highlight or percent mark annotation, which is a comment on a spot when its operator is `>>`. */
function buildWrapped(
	content: string,
	filePath: string,
	fullStart: number,
	wrapperEnd: number,
	body: Body,
	wrapper: Wrapper,
	insideAdBlock: boolean,
	channel: MetaChannel
): Built {
	if (body.pointSpan) {
		const self: MetaEntry = { channel, contentStart: body.pointSpan.start, contentEnd: body.pointSpan.end, fullStart: 0, fullEnd: wrapperEnd - fullStart };
		return buildAnnotation(content, filePath, fullStart, wrapperEnd, { type: "comment" }, wrapper, true, insideAdBlock, channel, self);
	}
	return buildAnnotation(content, filePath, fullStart, wrapperEnd, body, wrapper, false, insideAdBlock, channel);
}

export interface DetectOptions {
	/** Where a first reply goes when an annotation has none. Footnotes unless told otherwise. */
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
		// Obsidian never opens a highlight whose first character is >, so a
		// ==>>note<<== cannot render there. It is skipped whole, both marks,
		// rather than letting its closing == pair with the next highlight.
		const body = classifyInner(m[1], 2);
		if (body.pointSpan) {
			highlightRegex.lastIndex = highlightEnd;
			continue;
		}
		// An ordinary highlight with nothing attached counts too, as a bare
		// selection, so the sidebar can list it or filter it out.
		const built = buildWrapped(content, filePath, fullStart, highlightEnd, body, "highlight", isInsideAdBlock(fullStart), channel);
		publish(built);
		highlightRegex.lastIndex = built.annotation.matchEnd;
	}

	// Percent marks. A comment on a hidden span shows its reply, which is the
	// accepted cost of hiding the span. A bare %%note%% is a plain comment,
	// the same as a bare highlight, and the filter can hide it.
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
		const built = buildWrapped(content, filePath, fullStart, end, classifyInner(doubled ? m[1] : m[2], delim), "percent", false, channel);
		publish(built);
		percentRegex.lastIndex = built.annotation.matchEnd;
	}

	// Point comments: whatever {>>...<<} is left over once the ones attached to
	// an annotation have been claimed.
	const pointRegex = /\{>>/g;
	const pointBody = new RegExp(BRACE_COMMENT_REGEX.source, "y");
	while ((m = pointRegex.exec(content)) !== null) {
		const start = m.index;
		if (rangeAt(start, consumed) || rangeAt(start, pointExcluded)) continue;
		pointBody.lastIndex = start;
		const own = pointBody.exec(content);
		if (!own) continue;
		const self: MetaEntry = { channel: "brace", contentStart: 3, contentEnd: 3 + own[1].length, fullStart: 0, fullEnd: own[0].length };
		const built = buildAnnotation(content, filePath, start, start + own[0].length, { type: "comment" }, "brace", true, isInsideAdBlock(start), channel, self);
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
		// Inside a replacement or a comment there is nothing sensible to
		// reopen, so the surrounding one is simply closed and reopened as is.
		const marker = body.type === "insert" ? "++" : body.type === "delete" ? "--" : "";
		return { kind: "nested", marker };
	}
	return { kind: "plain" };
}
