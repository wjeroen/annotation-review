# Architecture

How the plugin is put together, and why the syntax is the way it is. `README.md` is the user guide, `CLAUDE.md` holds the working rules and the list of things that have bitten before, `TODO.md` is tasks only.

## Codebase map

| File | Responsibility |
| --- | --- |
| `main.ts` | Plugin entry point. Event wiring, scanning the active note, reading and writing files, the editor commands, caret tracking. |
| `src/detect.ts` | Parsing. Turns note text into `Annotation` and `AdmonitionBlock` objects, and records where every editable piece sits. The grammar is described at the top of the file. |
| `src/compose.ts` | Writing. The syntax for each annotation type, used by the editor commands. |
| `src/actions.ts` | Rewriting. Works out what text changes for an approve, dismiss, edit, reply, or removal. Pure functions, no Obsidian imports. |
| `src/view.ts` | The sidebar. All rendering and interaction. |
| `src/editor.ts` | Live preview decorations and the diff gutter, as CodeMirror extensions. Reads the same parser output as the sidebar. |
| `src/reading.ts` | Reading view, as a markdown post processor over the rendered HTML. Same classes as live preview, but its own small parser, since there is no source text to decorate. |
| `src/authors.ts` | The author color, shared by the sidebar chips and the editor. A color chosen in settings wins over the computed one. |
| `src/colorpicker.ts` | The slider picker used on mobile, where the system color input is poor. Desktop keeps the native one. |
| `src/settings.ts` | The settings tab and the settings shape. |
| `src/modals.ts` | The author prompt and the annotation type picker. |
| `src/types.ts` | Shared types. Start here to understand the data model. |
| `tests/` | Parsing and rewriting tests, plus note-switching behavior. The two stubs stand in for Obsidian and CodeMirror. |
| `skills/annotation-review/SKILL.md` | The syntax reference for whoever writes the annotations, human or AI. Maintained by the repo owner from a master copy in their vault. |

## How the pieces fit

One parser, three consumers. `detect.ts` turns a note into a list of annotations with every editable span recorded relative to the annotation's own text. The sidebar lists them, the editor extension decorates them, and the reading view restyles them, and none of the three parses on its own. Anything the parser skips, such as code blocks, backticks and links, is skipped everywhere for free.

`detect.ts` and `compose.ts` are two halves of one contract: one reads the syntax, the other writes it. The round-trip tests in `tests/detect.mjs` fail if they disagree.

Spans are relative to an annotation's `fullMatch`, never absolute file offsets, because typing anywhere earlier in the note shifts everything after it. An edit relocates the annotation's text first and then applies the span to wherever it landed.

Reading and writing go through the open editor when there is one, since Obsidian only flushes keystrokes to disk a second or two later, and going through the editor also keeps the plugin's edits in the undo history.

## The syntax, and why

The full grammar with every form per operation lives in the repo owner's test note, and the short version is in the README. The decisions that were not obvious, kept here because the reasoning still matters:

- **A link is a marker inside the author bracket.** `[X L3]@@`, or a `link` field in the metadata form. A second bracket was tried first and cannot work, since `[X][L3]` is a reference link in markdown. It names a set rather than a person, so a move, which is a deletion in one place and an insertion in another, is one decision. The sidebar draws a set together where its first member sits, on a thread under a header that acts on all of it, and the members keep their own cards and buttons. Acting on a set walks it from the last member backwards, since replacing an earlier one moves everything after it.
- **The author lives inside the wrapper, terminated by `@@`.** Every entry after the wrapper is a reply, and there is no reason concept in the data: the sidebar shows the first reply prominently, that is all. A plain `[Author] ` label inside the operator marks was rejected because, once whitespace inside the markers is significant, the space after the label is ambiguous. `@@` is what removes the ambiguity, and it is also the separator the CriticMarkup plugin for Obsidian uses for its metadata.
- **`{"author":"X"}@@` in braces, `[X]@@` elsewhere.** The first is that plugin's metadata format, so a note annotated in braces reads the same in both plugins. The second is lighter and lives only where that plugin never looks. Square brackets over `{Author}` because rendering and the graph were both checked and neither produces a phantom link.
- **One replacement form, `~~old~>new~~`, in every wrapper.** The `--old~>new++` variant existed only because Obsidian draws `~~` as a strikethrough, and once the rendering removes that line for replacements there was no reason left to keep a form other CriticMarkup tools reject.
- **Whitespace inside the markers is significant.** `{++is ++}` inserts the word and its trailing space, which is the whole CriticMarkup idiom. Nothing between the operator marks may be trimmed, in the parser or in the sidebar's edit fields. Reply text is prose and is trimmed.
- **Braces are the only wrapper that nests**, since their opening and closing marks differ. `==` and `%%` cannot nest, and percent marks chain by closing and reopening, operator included: `%%++A ++%%%%++X++%%%%++B++%%`.
- **`>>` is an operator.** Braces already told a span from a spot by operator, `{==span==}` against `{>>note<<}`, and `%%note%%` was ambiguous precisely because it left that to the wrapper. So a comment on a spot is `>>note<<` in any wrapper, and a wrapper with no operator is always a comment on the span inside it. The wrapper never carries meaning, only visibility. `%%span%%^[reply]` comments on a hidden span, the reply showing being the accepted cost of hiding it. In highlights it is not read: Obsidian never opens a highlight whose first character is `>`, so `==>>note<<==` cannot render, and the parser skips it whole rather than letting its closing `==` pair with the next highlight. A comment on a spot is braces or percent marks, chosen in its own setting.
- **A bare `==highlight==` or `%%note%%` is listed as a plain comment**, so nothing in a note goes unseen, and filtered out through a saved setting. The cost is that a stray `==` on the same line as a real annotation pairs with it, since there is no way left to tell an unintended pairing from a plain highlight. A blank line between them still breaks the pairing.
- **A footnote inside a percent or highlight wrapper was tried** as a way to keep hidden annotations silent, and does not work: live preview breaks, reading view still lists the footnote, and the highlight equivalent swallows the rest of the line. Replies always sit outside the wrapper.
- **Migration was never a goal.** The old keyword syntax was deleted from the parser rather than converted.
- **Plain CriticMarkup is the default for a fresh install**, since that is the standard people arrive with. Everything is a setting.

## Rendering

Live preview is a CodeMirror `StateField` of decorations, recomputed when the document, the selection or the editing mode changes. Syntax is hidden with `Decoration.replace`, text is colored with `Decoration.mark`, and every hiding decoration is skipped for an annotation the selection touches, so there is never an invisible character under the caret. A `StateField` rather than a `ViewPlugin` because only state-field decorations may hide text that affects line layout. The gutter is a CodeMirror `gutter` reading the same parsed list, and it is the only thing drawn in source mode. Obsidian puts the gutter inside the note's own column, in front of the lines but under the inline title, so a gutter with any width indents every line while the title stays put. Ours keeps its width and the container is pulled into the page margin by exactly that width, so no line moves. That pull is a setting: without it the box stands in the row like any other gutter. The space beside the line is a second setting, and both reach the stylesheet as a class and a variable on the body. Obsidian's own margins on the gutter container are dropped in both positions, so the space beside the line is the setting and nothing else. The bands are drawn as one left to right gradient with hard edges, built in `editor.ts` and set on the marker element, since the width depends on what the line holds. The stylesheet keeps the colors and the width the column reserves.

Reading view is a markdown post processor over rendered HTML. Obsidian has already turned `==` into `<mark>`, `~~` into `<del>`, `^[...]` into a footnote and dropped `%%...%%` entirely, and split anything with inline formatting across elements. The post processor restyles only what sits whole inside one text node or one `<mark>` or `<del>`, and leaves the rest raw rather than half styled.

The author is drawn as a colored underline, a chip, or nothing, chosen in settings separately for changes and for comments and replies, and applied to both views. The color comes from `authors.ts` and matches the sidebar chip, and a color chosen in settings replaces the computed one in all three places at once. A chip on a reply is the author's own name styled in place, with the rest of the mark hidden, so it takes the size of whatever it sits in and shrinks inside a footnote. A chip on the annotation itself is a widget placed in front of the wrapper instead, so it sits outside Obsidian's highlight, strikethrough or comment span and inherits none of it, while the line's font size still reaches it in a heading. Reading view moves the chip in front of the `<mark>` for the same reason.
