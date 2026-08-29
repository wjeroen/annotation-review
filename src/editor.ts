import { EditorState, Extension, Range, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, GutterMarker, WidgetType, gutter } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import { detectAnnotations } from "./detect";
import { Annotation, Authored, TextSpan } from "./types";
import { AuthorColors, applyChipColor, authorColor, chipStyle } from "./authors";
import { AuthorStyle } from "./settings";

/*
 * Drawing annotations in the editor.
 *
 * In live preview the syntax is hidden and the text is colored the way a
 * diff reads: red for what goes, green for what arrives, and a blue
 * background for comments and replies. The author is either a colored line
 * under the text, in the same color as their chip in the sidebar with the
 * name in a tooltip, or the name itself drawn as a chip, or nothing. The
 * moment the caret or the selection touches an annotation, every bit of its
 * syntax comes back, the way Obsidian reveals its own `==` and `**`, so there
 * is never a hidden character under the caret. Source mode leaves the text
 * alone and keeps only the gutter, a line down the left edge of every changed
 * line, so the edits can still be found there.
 *
 * Nothing here parses on its own: the annotations come from the same parser
 * as the sidebar, which already skips code blocks, backticks and links, so
 * an example of the syntax in a code block is left exactly as it is.
 */

export interface EditorRenderSettings {
	renderInEditor: boolean;
	changeAuthorStyle: AuthorStyle;
	commentAuthorStyle: AuthorStyle;
	showGutter: boolean;
	gutterBand: number;
	gutterBandGap: number;
	authorColors: AuthorColors;
}

/** The annotations in a document, reparsed whenever it changes. */
const annotationsField = StateField.define<Annotation[]>({
	create: state => detectAnnotations(state.doc.toString(), ""),
	update: (value, tr) => (tr.docChanged ? detectAnnotations(tr.newDoc.toString(), "") : value)
});

const hide = Decoration.replace({});
const mark = (cls: string) => Decoration.mark({ class: cls });
const authorLine = (author: string, colors: AuthorColors) =>
	Decoration.mark({
		class: "arv-author",
		attributes: { style: `text-decoration-color: ${authorColor(author, colors)}`, title: author }
	});
const authorChip = (author: string, colors: AuthorColors, attached = false) =>
	Decoration.mark({
		class: attached ? "arv-chip arv-attached" : "arv-chip",
		attributes: { style: chipStyle(author, colors) }
	});

/**
 * The author of an annotation as a widget in front of its wrapper, rather
 * than a mark on the name inside it. Inside the wrapper the name sits in
 * Obsidian's own span for the highlight, strikethrough or comment, and a
 * child cannot undo a parent's background, so the chip took the yellow. In
 * front of the wrapper it is outside that span and inherits none of it,
 * while the line's font size still reaches it, so it grows in a heading.
 * Replies keep the mark form: a footnote's smaller size is set on a span
 * the widget would sit outside of.
 */
class ChipWidget extends WidgetType {
	constructor(
		readonly author: string,
		readonly colors: AuthorColors
	) {
		super();
	}
	eq(other: ChipWidget) {
		return other.author === this.author && other.colors[this.author] === this.colors[this.author];
	}
	toDOM() {
		const el = document.createElement("span");
		// The gap in front, so a chip never touches the word before it.
		el.className = "arv-chip arv-attached";
		el.textContent = this.author;
		applyChipColor(el, this.author, this.colors);
		return el;
	}
}

/**
 * The decorations for every annotation, given the current selection. Spans
 * come from the parser relative to each annotation, and are shifted to
 * absolute positions here.
 */
function buildDecorations(state: EditorState, settings: EditorRenderSettings): DecorationSet {
	const annotations = state.field(annotationsField);
	const selection = state.selection.main;
	const ranges: Range<Decoration>[] = [];

	for (const a of annotations) {
		// A plain highlight or hidden note with nothing attached is drawn the
		// same way as one with a reply, so its braces or percent marks
		// disappear too and it never looks different for lacking a reply.
		const base = a.matchStart;
		const add = (span: TextSpan, deco: Decoration) => {
			if (span.end > span.start) ranges.push(deco.range(base + span.start, base + span.end));
		};
		// Revealed when the selection touches it, or touches an annotation it
		// is nested in. Raw syntax for the outer one with the inner still
		// drawn would be half a picture.
		const touches = (x: Annotation) => selection.from <= x.matchEnd && selection.to >= x.matchStart;
		const within = (inner: Annotation, outer: Annotation) => inner !== outer && outer.matchStart <= inner.matchStart && inner.matchEnd <= outer.matchEnd;
		const revealed = touches(a) || annotations.some(o => within(a, o) && touches(o));
		// Red and green inside percent marks are toned down to the grey
		// Obsidian gives hidden text. Never opacity: that stacks on the grey.
		const faint = a.wrapper === "percent" ? " arv-faint" : "";

		/**
		 * The author's mark, in whatever style is chosen. A chip is the name
		 * itself, styled in place with the rest of the mark hidden, so it
		 * sits where the syntax puts it and takes the size of its
		 * surroundings, shrinking inside a footnote.
		 */
		const author = (who: Authored, textSpans: TextSpan[], style: AuthorStyle, before?: number, attached = false) => {
			if (!who.authorSpan) return;
			if (style === "underline" && who.author) {
				for (const span of textSpans) add(span, authorLine(who.author, settings.authorColors));
			}
			if (revealed) return;
			const s = who.authorSpan;
			if (style === "chip" && who.author && before !== undefined) {
				add(s, hide);
				const widget = new ChipWidget(who.author, settings.authorColors);
				ranges.push(Decoration.widget({ widget, side: -1 }).range(base + before));
				return;
			}
			const raw = a.fullMatch.slice(s.start, s.end);
			const at = who.author && style === "chip" ? raw.indexOf(who.author) : -1;
			if (at < 0) {
				add(s, hide);
				return;
			}
			add({ start: s.start, end: s.start + at }, hide);
			add({ start: s.start + at, end: s.start + at + who.author!.length }, authorChip(who.author!, settings.authorColors, attached));
			add({ start: s.start + at + who.author!.length, end: s.end }, hide);
		};

		// Colors stay on while revealed, only the hiding stops.
		// The span a comment is about gets no color of its own. Obsidian's
		// yellow already marks it in a highlight and in braces, where blue on
		// top came out green, and percent marks are already drawn in
		// Obsidian's faint grey. Only the comment itself goes blue.
		if (a.originalSpan && a.type !== "comment") add(a.originalSpan, mark("arv-del" + faint));
		if (a.bodySpan) add(a.bodySpan, mark("arv-ins" + faint));
		if (a.replacementSpan) add(a.replacementSpan, mark("arv-ins" + faint));
		// A comment on a spot inside percent marks is toned down like the
		// rest of what sits inside them. A reply after the wrapper is not.
		// A comment on a spot gets the small gap on both sides, like a reply.
		// When its chip is drawn in front, the chip carries the gap, and the
		// text gets none of its own, or the two would stack.
		if (a.commentSpan) {
			const chipFirst = settings.commentAuthorStyle === "chip" && !!a.author;
			add(a.commentSpan, mark((chipFirst ? "arv-comment arv-gap-after" : "arv-comment arv-attached arv-gap-after") + faint));
		}
		for (const r of a.replies) {
			// A footnote is drawn by Obsidian and already reads as a remark,
			// and a genuine footnote must not turn blue, so only a brace
			// comment gets the background. A brace reply sits right against
			// the text it follows, so whichever of its parts comes first, the
			// chip or the text, gets a small gap in front of it.
			if (r.channel !== "brace") continue;
			const chipFirst = settings.commentAuthorStyle === "chip" && !!r.author;
			add(r.textSpan, mark(chipFirst ? "arv-comment arv-gap-after" : "arv-comment arv-attached arv-gap-after"));
		}
		const contentSpans = [a.originalSpan, a.replacementSpan, a.bodySpan, a.commentSpan].filter((s): s is TextSpan => !!s);
		const ownStyle = a.type === "comment" ? settings.commentAuthorStyle : settings.changeAuthorStyle;
		author(a, contentSpans, ownStyle, 0);
		// With chips, a nested annotation's chip takes over visually until the
		// outer text ends, so the outer author's chip returns after each
		// directly nested annotation that still has outer text behind it.
		// Underlines need none of this, since they color the text itself.
		if (!revealed && ownStyle === "chip" && a.author && contentSpans.length > 0) {
			const contentEnd = base + Math.max(...contentSpans.map(s => s.end));
			for (const n of annotations) {
				if (!within(n, a) || n.matchEnd >= contentEnd) continue;
				if (annotations.some(m => within(n, m) && within(m, a))) continue;
				const widget = new ChipWidget(a.author, settings.authorColors);
				ranges.push(Decoration.widget({ widget, side: 1 }).range(n.matchEnd));
			}
		}
		// A footnote reply's line runs over its square brackets, not the ^, so
		// an empty signed reply still shows who left it.
		for (const r of a.replies) author(r, [r.channel === "footnote" ? { start: r.fullSpan.start + 1, end: r.fullSpan.end } : r.textSpan], settings.commentAuthorStyle, undefined, r.channel === "brace");

		if (revealed) continue;

		// The wrapper. Everything that is not text is hidden: the opening and
		// closing marks, and the arrow of a replacement, so the old and new
		// text sit right against each other.
		if (contentSpans.length > 0) {
			const contentStart = Math.min(...contentSpans.map(s => s.start));
			const contentEnd = Math.max(...contentSpans.map(s => s.end));
			add({ start: 0, end: a.authorSpan ? a.authorSpan.start : contentStart }, hide);
			if (a.originalSpan && a.replacementSpan) add({ start: a.originalSpan.end, end: a.replacementSpan.start }, hide);
			add({ start: contentEnd, end: a.wrapperLength }, hide);
		}

		// Replies. A brace comment loses its markers, a footnote keeps its
		// brackets since Obsidian draws those.
		for (const r of a.replies) {
			if (r.channel !== "brace") continue;
			add({ start: r.fullSpan.start, end: r.authorSpan ? r.authorSpan.start : r.textSpan.start }, hide);
			add({ start: r.textSpan.end, end: r.fullSpan.end }, hide);
		}
	}

	return Decoration.set(ranges, true);
}

/**
 * A state field rather than a view plugin, so the decorations can hide text.
 * Recomputed when the document, the selection, or the editing mode changes.
 */
function decorationsField(settings: EditorRenderSettings) {
	const compute = (state: EditorState) =>
		settings.renderInEditor && state.field(editorLivePreviewField, false) ? buildDecorations(state, settings) : Decoration.none;
	return StateField.define<DecorationSet>({
		create: compute,
		update: (value, tr) => {
			const modeChanged = tr.state.field(editorLivePreviewField, false) !== tr.startState.field(editorLivePreviewField, false);
			return tr.docChanged || tr.selection || modeChanged ? compute(tr.state) : value;
		},
		provide: field => EditorView.decorations.from(field)
	});
}

/** The colors, kept in the stylesheet so a theme can reach them. */
const GUTTER_COLOR: Record<string, string> = {
	delete: "var(--arv-gutter-delete)",
	insert: "var(--arv-gutter-insert)",
	comment: "var(--arv-gutter-comment)"
};

/**
 * What happens on the line, in the order it appears, each thing once. A
 * replacement takes text away and puts text back, so it counts as both. A
 * bare selection is not a change and not known to be a comment, so it counts
 * for nothing. A comment on a change is a reply rather than an annotation of
 * its own, so it never reaches this at all.
 */
function kindsOn(state: EditorState, from: number, to: number): string[] {
	const kinds: string[] = [];
	for (const a of state.field(annotationsField)) {
		if (a.isPlain || a.matchEnd < from || a.matchStart > to) continue;
		for (const kind of a.type === "replace" ? ["delete", "insert"] : [a.type]) {
			if (!kinds.includes(kind)) kinds.push(kind);
		}
	}
	return kinds;
}

/**
 * The line beside one text line: one band per color, side by side. Above
 * each other a color would read as if it belonged to the words beside it,
 * while the whole line is what it marks. The bands are drawn as one gradient
 * with hard edges, so a band and the space after it are exact pixels.
 */
class LineMarker extends GutterMarker {
	constructor(
		readonly kinds: string,
		readonly joined: boolean,
		readonly band: number,
		readonly between: number
	) {
		super();
	}
	eq(other: LineMarker) {
		return (
			other.kinds === this.kinds &&
			other.joined === this.joined &&
			other.band === this.band &&
			other.between === this.between
		);
	}
	toDOM() {
		const el = document.createElement("div");
		el.className = this.joined ? "arv-gutter arv-gutter-joined" : "arv-gutter";
		const stops: string[] = [];
		let at = 0;
		for (const kind of this.kinds.split(" ")) {
			if (at > 0 && this.between > 0) {
				stops.push(`transparent ${at}px ${at + this.between}px`);
				at += this.between;
			}
			stops.push(`${GUTTER_COLOR[kind]} ${at}px ${at + this.band}px`);
			at += this.band;
		}
		el.style.width = `${at}px`;
		el.style.background = `linear-gradient(to right, ${stops.join(", ")})`;
		return el;
	}
}

const markers = new Map<string, LineMarker>();
/** One marker object per look, since CodeMirror compares them by identity first. */
function marker(kinds: string[], joined: boolean, band: number, between: number): LineMarker {
	const list = kinds.join(" ");
	const key = `${list}|${joined}|${band}|${between}`;
	let found = markers.get(key);
	if (!found) markers.set(key, (found = new LineMarker(list, joined, band, between)));
	return found;
}

/**
 * A line down the left edge of every line an annotation touches, in the
 * colors of what happens there, right aligned so lines of one, two or three
 * colors all end against the text.
 *
 * CodeMirror gives each gutter element the height of its own line and turns
 * whatever sits between two lines into a margin on the next one, which broke
 * the line at every paragraph. So a strip reaches past its own line, far
 * enough to cross that margin, whenever the next line draws exactly the same
 * colors. Then the overhang lands under the next strip and nobody sees it.
 * With different colors it would not: the bands are right aligned, so a wider
 * line would leave its leftmost bands hanging below itself.
 */
function diffGutter(settings: EditorRenderSettings) {
	return gutter({
		class: "arv-diff-gutter",
		lineMarker(view, line) {
			const kinds = kindsOn(view.state, line.from, line.to);
			if (kinds.length === 0) return null;
			const doc = view.state.doc;
			const next = line.to + 1 <= doc.length ? doc.lineAt(line.to + 1) : null;
			const joined = next !== null && kindsOn(view.state, next.from, next.to).join(" ") === kinds.join(" ");
			return marker(kinds, joined, settings.gutterBand, settings.gutterBandGap);
		},
		lineMarkerChange: update => update.docChanged,
		initialSpacer: () => marker(["delete"], false, settings.gutterBand, settings.gutterBandGap)
	});
}

/** The editor extensions for the current settings. Rebuilt when they change. */
export function editorExtensions(settings: EditorRenderSettings): Extension[] {
	const extensions: Extension[] = [annotationsField, decorationsField(settings)];
	if (settings.showGutter) extensions.push(diffGutter(settings));
	return extensions;
}
