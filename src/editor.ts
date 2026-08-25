import { EditorState, Extension, Range, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, GutterMarker, WidgetType, gutter } from "@codemirror/view";
import { editorLivePreviewField } from "obsidian";
import { detectAnnotations } from "./detect";
import { Annotation, TextSpan } from "./types";
import { authorBackground } from "./authors";

/*
 * Drawing annotations in the editor.
 *
 * In live preview the syntax is hidden and the text is coloured the way a
 * diff reads: red for what goes, green for what arrives, blue for comments.
 * The moment the caret or the selection touches an annotation, every bit of
 * its syntax comes back, the way Obsidian reveals its own `==` and `**`, so
 * there is never a hidden character under the caret. Source mode leaves the
 * text alone and keeps only the gutter, a line down the left edge of every
 * changed line, so the edits can still be found there.
 *
 * Nothing here parses on its own: the annotations come from the same parser
 * as the sidebar, which already skips code blocks, backticks and links, so
 * an example of the syntax in a code block is left exactly as it is.
 */

export interface EditorRenderSettings {
	renderInEditor: boolean;
	showAuthorsInEditor: boolean;
	showGutter: boolean;
}

/** The annotations in a document, reparsed whenever it changes. */
const annotationsField = StateField.define<Annotation[]>({
	create: state => detectAnnotations(state.doc.toString(), ""),
	update: (value, tr) => (tr.docChanged ? detectAnnotations(tr.newDoc.toString(), "") : value)
});

const hide = Decoration.replace({});
const mark = (cls: string) => Decoration.mark({ class: cls });

class ChipWidget extends WidgetType {
	constructor(readonly author: string) {
		super();
	}
	eq(other: ChipWidget) {
		return other.author === this.author;
	}
	toDOM() {
		const el = document.createElement("span");
		el.className = "arv-chip";
		el.textContent = this.author;
		el.style.backgroundColor = authorBackground(this.author);
		return el;
	}
	ignoreEvent() {
		return false;
	}
}

class ArrowWidget extends WidgetType {
	eq() {
		return true;
	}
	toDOM() {
		const el = document.createElement("span");
		el.className = "arv-arrow";
		el.textContent = "→";
		return el;
	}
}

const arrow = Decoration.replace({ widget: new ArrowWidget() });

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
		// An ordinary highlight or hidden note is left to Obsidian.
		if (a.isPlain) continue;
		const base = a.matchStart;
		const abs = (s: TextSpan) => ({ from: base + s.start, to: base + s.end });
		const add = (from: number, to: number, deco: Decoration) => {
			if (to > from) ranges.push(deco.range(from, to));
		};
		const revealed = selection.from <= a.matchEnd && selection.to >= a.matchStart;
		const faint = a.wrapper === "percent" ? " arv-faint" : "";

		// Colours stay on while revealed, only the hiding stops.
		if (a.originalSpan) {
			const s = abs(a.originalSpan);
			add(s.from, s.to, mark(a.type === "comment" ? "arv-span" : "arv-del" + faint));
		}
		if (a.bodySpan) {
			const s = abs(a.bodySpan);
			add(s.from, s.to, mark("arv-ins" + faint));
		}
		if (a.replacementSpan) {
			const s = abs(a.replacementSpan);
			add(s.from, s.to, mark("arv-ins" + faint));
		}
		if (a.commentSpan && a.wrapper !== "percent") {
			const s = abs(a.commentSpan);
			add(s.from, s.to, mark("arv-reply"));
		}
		for (const r of a.replies) {
			const t = abs(r.textSpan);
			if (r.channel === "brace") add(t.from, t.to, mark("arv-reply"));
			else {
				const f = abs(r.fullSpan);
				add(f.from, f.to, mark("arv-footnote"));
			}
		}

		if (revealed) continue;

		// The wrapper. Everything that is not text is hidden, except the
		// percent marks, which stay visible as they do without any plugin.
		const contentSpans = [a.originalSpan, a.replacementSpan, a.bodySpan, a.commentSpan].filter((s): s is TextSpan => !!s);
		if (contentSpans.length > 0) {
			const contentStart = Math.min(...contentSpans.map(s => s.start));
			const contentEnd = Math.max(...contentSpans.map(s => s.end));
			const openEnd = a.authorSpan ? a.authorSpan.start : contentStart;
			const keepOpen = a.wrapper === "percent" ? (a.fullMatch.startsWith("%%%%") ? 4 : 2) : 0;
			add(base + keepOpen, base + openEnd, hide);
			if (a.authorSpan) {
				const s = abs(a.authorSpan);
				add(s.from, s.to, hide);
				// The author reads like a signature, after the text it applies to.
				if (settings.showAuthorsInEditor && a.author) {
					ranges.push(Decoration.widget({ widget: new ChipWidget(a.author), side: 1 }).range(base + contentEnd));
				}
			}
			if (a.originalSpan && a.replacementSpan) {
				add(base + a.originalSpan.end, base + a.replacementSpan.start, arrow);
			}
			const keepClose = a.wrapper === "percent" ? keepOpen : 0;
			add(base + contentEnd, base + a.wrapperLength - keepClose, hide);
		}

		// Replies. A brace comment loses its markers and shows its author as a
		// chip in front, the way a speaker is named. A footnote is left to
		// Obsidian, which draws it as a footnote, and only its label becomes a
		// chip.
		for (const r of a.replies) {
			const full = abs(r.fullSpan);
			const text = abs(r.textSpan);
			if (r.channel === "brace") {
				add(full.from, r.authorSpan ? base + r.authorSpan.start : text.from, hide);
				add(text.to, full.to, hide);
			}
			if (r.authorSpan) {
				const s = abs(r.authorSpan);
				if (settings.showAuthorsInEditor && r.author) {
					ranges.push(Decoration.replace({ widget: new ChipWidget(r.author) }).range(s.from, s.to));
				} else {
					add(s.from, s.to, hide);
				}
			}
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

class LineMarker extends GutterMarker {
	constructor(readonly kind: string) {
		super();
	}
	eq(other: LineMarker) {
		return other.kind === this.kind;
	}
	toDOM() {
		const el = document.createElement("div");
		el.className = `arv-gutter arv-gutter-${this.kind}`;
		return el;
	}
}

const MARKERS: Record<string, LineMarker> = {
	delete: new LineMarker("delete"),
	insert: new LineMarker("insert"),
	replace: new LineMarker("replace"),
	comment: new LineMarker("comment")
};

/**
 * A line down the left edge of every line an annotation touches, in the
 * colour of what happens there. A change outranks a comment when a line has
 * both, since a comment can sit anywhere.
 */
const diffGutter = gutter({
	class: "arv-diff-gutter",
	lineMarker(view, line) {
		let kind: string | null = null;
		for (const a of view.state.field(annotationsField)) {
			if (a.isPlain || a.matchEnd < line.from || a.matchStart > line.to) continue;
			if (kind === null || (kind === "comment" && a.type !== "comment")) kind = a.type;
		}
		return kind ? MARKERS[kind] : null;
	},
	lineMarkerChange: update => update.docChanged,
	initialSpacer: () => MARKERS.delete
});

/** The editor extensions for the current settings. Rebuilt when they change. */
export function editorExtensions(settings: EditorRenderSettings): Extension[] {
	const extensions: Extension[] = [annotationsField, decorationsField(settings)];
	if (settings.showGutter) extensions.push(diffGutter);
	return extensions;
}
