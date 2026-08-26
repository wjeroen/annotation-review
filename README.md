# Annotation Review

An Obsidian plugin that finds text annotations in a note (comments, insertions, deletions, replacements) and lets you approve or dismiss each one from a sidebar, rewriting the note automatically. Annotations can be written by anyone, the syntax is just designed to be easy for AI tools to produce. It grew out of two plugins: [Sidebar Highlights](https://github.com/trevware/obsidian-sidebar-highlights) by trevware, for reviewing marks from a sidebar with footnote comments, and [Fevol's CriticMarkup plugin](https://github.com/Fevol/obsidian-criticmarkup), for the syntax, the author metadata and the way changes are drawn in the editor.

The syntax follows [CriticMarkup](http://criticmarkup.com), with two additions: the same markers can be wrapped in Obsidian's own highlight or comment delimiters instead of braces, and an author and reason can be attached to any change.

## The syntax

An annotation is a wrapper, an operator, an optional author, and any number of replies:

```
<wrapper> <operator> <author>@@? text <operator> </wrapper> <reply>*
```

**The wrapper decides how the note shows the text.** Any of the three works with any operation.

| Wrapper | In the note |
| --- | --- |
| `{...}` | Shown as it is, with the braces visible. Standard CriticMarkup. |
| `==...==` | Highlighted. |
| `%%...%%` | Hidden until approved. |

**The operator decides the operation.**

| Operation | Markers | Example |
| --- | --- | --- |
| Delete | `--text--` | `This is ==--is --==a test.` |
| Insert | `++text++` | `This {++is ++}a test.` |
| Replace | `~~old~>new~~` | `This {~~isn't~>is~~} a test.` |
| Comment on a span | no operator | `==This is a test==^[What is it a test of?]` |
| Comment on a spot | `>>note<<`, braces or percent marks only | `This is a test.{>>What is it a test of?<<}` |

Whitespace inside the markers is kept exactly as written, so `{++is ++}` inserts the word and the space after it. That is how CriticMarkup avoids having to select exact word boundaries.

**The author goes inside the wrapper**, right after the opening operator marks, terminated by `@@` so the text after it keeps every space:

```
{--{"author":"Claude"}@@is --}      the CriticMarkup plugin's metadata, written in braces
==--[Claude]@@is --==               the lighter form, written in highlights and percent marks
```

Both spellings are read in every wrapper. From the metadata only `author` is used (`a` works too). Other fields such as `time` are kept as written and ignored. An annotation is authored by the author inside its wrapper, or by nobody. That is the whole rule.

**Every entry after the wrapper is a reply.** A footnote `^[...]` or a CriticMarkup comment `{>>...<<}`, written directly after the wrapper with no space in between, in any mix. There is no separate word for a reason: the reason for a change is simply its first reply, the way Google Docs does it. A reply's author is `{"author":"X"}@@` at the start, which is what the plugin writes in a brace comment, or `[X] `, which is what it writes in a footnote. `^[[Claude]]` is an empty reply by Claude and nothing more.

```
This is {--{"author":"Claude"}@@is --}{>>{"author":"Claude"}@@The word is repeated.<<}{>>{"author":"Alex"}@@Agreed.<<}a test.
This is ==--[Claude]@@is --==^[[Claude] The word is repeated.]^[[Alex] Agreed.]a test.
```

A few rules that follow from this:

- A comment on a span needs no author inside the wrapper: the span was written by whoever wrote the note, and the person commenting signs their reply.
- `>>` is an operator like the others, so a comment on a spot is `{>>note<<}` or `%%>>note<<%%`. Not `==>>note<<==`: Obsidian never opens a highlight that starts with `>`, so that form cannot render, and the plugin does not read it. A `{>>...<<}` directly after another annotation is a reply to it instead.
- A commented `%%hidden span%%` shows its reply while the span stays hidden, which is the accepted cost of hiding it.
- A bare `==highlight==` or `%%hidden text%%` is listed as a bare selection, since nothing says it is a comment, so nothing in a note goes unseen. The filter button hides those, and that choice is remembered.
- Braces nest, because their opening and closing marks differ: `{++outer {++inner++} rest++}` is two insertions. Highlights and percent marks cannot nest. To insert inside an existing percent mark insertion, close and reopen it: `%%++A ++%%%%++X++%%%%++B++%%` is three insertions in a row, and the insert command writes this for you.
- Percent marks do not render inside any fenced block, admonitions included, so use highlights or braces there.
- A highlight cannot cross a blank line, but braces and percent marks can, which is the only way to insert or delete a paragraph break: `{++\n\n++}`.

### Compatibility with the CriticMarkup plugin

Braces, the five CriticMarkup marks, `{~~old~>new~~}`, adjacent `{>>...<<}` comments as replies, and the `{"author":"..."}@@` author are all shared with [Fevol's obsidian-criticmarkup](https://github.com/Fevol/obsidian-criticmarkup), so a note annotated in braces reads the same in both. Highlights, percent marks, footnotes, `[Author]` labels and annotations inside admonitions are this plugin's own.

## Creating annotations from the editor

Select the text you want to annotate, then either right click it or run a command. None of the commands are bound to a hotkey by default, bind whichever you use most in Settings, Hotkeys.

Nothing opens a dialog. Each one writes the annotation straight into the note and leaves the caret where text is still needed, so you can type the comment or replacement immediately and carry on. Out of the box everything is written as plain CriticMarkup, which is what the table shows, with Claude as the author.

| Command | Writes | Caret lands |
| --- | --- | --- |
| Comment | On a selection, `{==text==}{>>{"author":"Claude"}@@ <<}`. Inside an annotation, a reply. With nothing selected, a comment on that spot, `{>>...<<}` in the chosen wrapper, braces or percent marks | Inside the reply, ready to type |
| Delete | `{--{"author":"Claude"}@@text--}` | At the end |
| Replace | `{~~{"author":"Claude"}@@text~>~~}` | After the arrow, ready for the replacement |
| Insert | `{++{"author":"Claude"}@@text++}`, or an empty insertion with nothing selected | At the end when text was selected, inside when not |
| Choose type of annotation | Asks which of the four, then behaves the same | |
| Set default author | Sets the author written into new annotations | |

A comment, a reason and a reply are the same thing in different places, so one command covers all three and the context decides. Selecting an annotation whole counts as being inside it, so Comment never wraps an annotation in a second one. With no author set, nothing is written after the operator marks.

The right click menu always shows Comment, named Reply when the caret is inside an annotation that already has a comment or a reply. On a bare selection it stays Comment. Delete and Replace appear when text is selected outside any annotation, Insert whenever the caret is outside one, with or without a selection. All of them sit under their own divider.

Which wrapper each operation writes is a setting, per operation. Percent marks do not render inside fenced blocks, so a fallback wrapper stands in for them there, and inside an existing percent mark annotation the insert command writes the close-and-reopen form.

## In the editor

In live preview the syntax is hidden and the text is colored the way a diff reads: red for what goes, green for what arrives. A highlight keeps its background under the color, braces and percent marks disappear, with the text inside percent marks staying Obsidian's faint grey and its red and green toned down to match. A plain `{==highlight==}` or `%%hidden note%%` with nothing attached is drawn the same way, so it never looks different from one with a reply. A replacement shows the old text in red and the new text in green right against each other. A `~~replacement~~` is also a strikethrough to Obsidian. Ours loses the line, a genuine `~~strikethrough~~` keeps it.

Comments and replies sit on a blue background: a `{>>comment<<}` on a spot and a `{>>reply<<}`, with their markers hidden. A `^[reply]` is left to Obsidian, which draws it as a footnote, and gets nothing added, so a genuine footnote is never touched. The span a comment is about gets no color of its own: a `==highlight==` and a `{==braced span==}` keep Obsidian's yellow, and a hidden `%%span%%` is already fainter. So a plain yellow highlight reads as a comment and nothing else does.

The author is shown one of three ways, chosen in settings. A line under the text in the author's color, the same color as their chip in the sidebar, with the name in a tooltip. The name itself as a chip, sized by whatever it sits in, so it shrinks inside a footnote. Or not at all. The `[Author]` labels and `{"author":"..."}@@` metadata are hidden either way. With underlines, an empty insertion or an empty comment has no text to underline and shows nothing in the editor until the caret touches it. It is still listed in the sidebar.

The moment the caret or the selection touches an annotation, all of its syntax comes back, the way Obsidian reveals its own `==` and `**`. Inside braces, which nest, revealing the outer annotation reveals everything nested in it, and when authors are chips the outer author's chip returns after each nested annotation, so the text that follows is not mistaken for the inner author's. Nothing inside backticks or a code block is ever styled, admonitions excepted.

Reading view is styled the same way, from the rendered HTML: brace syntax in the text, operator marks inside a highlight, and a `{~~replacement~~}` Obsidian rendered as a strikethrough. Percent marks are dropped by Obsidian in reading view, which is right for text that is hidden until approved. Footnote labels at the bottom of the page become the author. An annotation whose text carries its own inline formatting is left as it is rather than half styled.

A gutter draws a colored line down the left edge of every annotated line, in live preview and in source mode, where the text itself stays uncolored: red, green, both for a replacement, blue for a comment. The styling, the author display and the gutter are each a setting.

## Sidebar features

- **Annotations tab**: lists every detected annotation with Approve/Dismiss buttons, filterable by author via an Obsidian-native menu, not a native `<select>`, which renders as an ugly OS popup on mobile. Each author gets a consistent, hashed color badge, gray if unlabeled, distinct even for similar names.
- **Card layout**: the annotated text first, then the type badge and author chip with the line number at the far end, then the replies. For a change the first reply is the reason and is always shown, the rest fold behind the expand toggle. A comment on a selection reads like a comment on a spot with the selected text above it: its first reply is the comment itself, with that reply's author in the header when it has one. A bare selection shows no badge, since nothing says it is a comment. An annotation nested inside another, which braces allow, is left out of the outer card's text, since it has a card of its own. Click the text to edit it and the raw text comes back, nested syntax included. Text that goes away is red and text that arrives is green, the way a diff reads, softened toward the text color and with no strikethrough. A card shows an author chip only when the annotation names one. The note does not say who made an unauthored change, so the card does not either. Only an unsigned reply says No author.
- **Filter button**: between the author menu and the expand toggle. Toggles each annotation type, annotations without an author, and bare selections. Remembered across notes, unlike the author filter, which only means something within one note.
- **Wrapper at a glance**: a thin line along the top of each card says how the annotation is written in the note, yellow for a highlight, gray for hidden percent marks, purple for braces.
- **Follows the caret**: the card whose annotation the caret is inside is marked and scrolled into view, so the note and the sidebar stay in step whichever one you are looking at.
- **Editing in place**: click any text on a card to edit it inline, including the annotated text itself, the reason or comment, the replacement, the inserted text, and a reply. Click an author chip to set, change, or clear the author, on the annotation itself or on any reply. Everything saves straight back to the note, spaces and line breaks included.
- **Comments**: the Comment button next to Approve and Dismiss, in the quieter icon-button style, opens a field above the buttons where the comment will appear. The field is prefilled with an author bracket, since a comment's author is part of its own text. Nothing in the sidebar is called a reply, only the syntax has them. The line number sits at the far end of that row. When the sidebar gets narrow the Comment label goes first, then the Approve and Dismiss labels, so the row never wraps.
- **Admonitions tab**: lists every `ad-*` block in the note (`ad-info`, `ad-c`, `ad-j`, anything), filterable by type. Each block is rendered live through Obsidian's own markdown pipeline, so if you have the Admonition plugin installed, it looks exactly like it does in your note, your custom colors, icons, and titles included. Without Admonition installed, it falls back to a plain rendered code block. A trash icon per block deletes that entire block in one action, also collapsing the blank line left behind so you don't end up with three blank lines where there should be one. An expand/collapse-all toggle sits in the filter row for reading full content instead of the clipped preview, and that choice is remembered across notes.
- **Refresh button**: an icon-only button in the filter row forces a rescan of the active note if the list ever looks stale.
- **Finding the text**: clicking a card opens the note and selects the whole annotation, so it is obvious which one the card refers to. In reading view nothing can be selected, so it scrolls to the line instead. On a phone or tablet it only scrolls, with no selection and the caret left alone, so the keyboard stays down.

## Settings

The defaults are plain CriticMarkup: braces for everything, with `{>>...<<}` carrying the author, reason and replies. Change any of it to taste.

- **Author**: written inside every new annotation and at the start of every reply.
- **Wrappers**: braces, highlight, or percent marks, chosen separately for comments on a selection, deletions, replacements and insertions. Comments on a spot choose between braces and percent marks, since Obsidian cannot draw one as a highlight.
- **Inside fenced blocks**: braces or highlight, standing in for percent marks where they do not render. Greyed out while no operation uses percent marks.
- **Style annotations in live preview**, **Authors on changes**, **Authors on comments and replies**, **Show the diff gutter**: the parts of the editor rendering, each its own setting. Authors are shown as a colored underline, a chip, or not at all, chosen separately for changes (deletions, insertions and replacements) and for comments and replies, since a line under text that is already red or green gets busy while it stays compact under a comment. All but the gutter apply to reading view as well.
- **Replies**: footnote or CriticMarkup comment. An annotation that already has replies keeps their style.
- **Author chip opacity** and **Type badge opacity**: how strong the fills behind the author chips and the type badges are, everywhere they appear. Underlines stay solid, since a thin line needs its full color to be seen. Text on a chip or a badge is black or white, whichever reads against the fill at that opacity, by one brightness rule for both, tuned by eye to where black starts reading better than white on each theme accent over a light page. Every accent at full strength keeps white text, and on a dark page the text never flips.
- **Author colors**: each author gets a color from their name, the same in the sidebar and the editor. Pick one here to use instead, per author. Each row shows the chip as it will look. A new row gets its picker once the name is in, on Enter or on leaving the field, starting at the color that name gets on its own, so adjusting is a nudge rather than a search. On a phone or tablet, tapping the color opens the plugin's own picker, since the system one there is poor: a preview chip, three sliders for hue, saturation and lightness, and a hex field.

Everything above follows the vault through sync, and is picked up the moment it arrives, no restart needed. The sidebar's own state, expanded replies and the type filter, stays on the device, since it changes with every click.

## Code block handling

- Fenced blocks whose info string starts with `ad-` (`ad-c`, `ad-j`, any future letter) are scanned for highlight and brace annotations, since [Admonition](https://github.com/ebullient/obsidian-admonition) renders their contents as real markdown. Percent marks are ignored there, since they do not render.
- Any other fenced block (plain code, no info string, etc.) is left alone entirely, since code blocks don't render markdown and shouldn't be treated as annotations.
- A bare, undecorated general comment (a plain paragraph inside an `ad-c` block with no highlight) is intentionally **not** picked up. It's meant to stay a purely visual note rendered by Admonition, not something tracked here.

## How edits reach the note

While a note is open, Obsidian keeps your typing in memory and only writes it to disk a second or two later. So the plugin reads from the open editor rather than from the file on disk, which is what keeps the sidebar in step with what you are actually looking at, and it writes through the editor too, so its changes join the normal undo history and never overwrite unsaved typing.

Refreshing rebuilds the panel, which would otherwise lose your scroll position and close whatever field you had open, so a refresh is skipped entirely when the annotations haven't actually changed, and while a field inside the panel has focus. Scroll position is restored across the rebuilds that do happen.

## Development

```
npm install
npm run build
npm test
```

`npm test` covers the parsing and rewriting rules, plus the note-switching behavior. The latter matters because scanning a note is asynchronous while several Obsidian events can ask for a scan at once, and an older read landing after a newer one used to leave the panel showing a different note's annotations.

Changes ship as pre-releases (`0.6.0-beta.1` and so on) so they can be tested through BRAT before being called a version. `ARCHITECTURE.md` has the codebase map and the reasoning behind the syntax, `CLAUDE.md` the gotchas worth knowing before changing the parser or the sidebar.

`skills/annotation-review/SKILL.md` is the syntax reference written to be handed to an AI tool as a skill or system prompt, so its output is readable by the plugin.
