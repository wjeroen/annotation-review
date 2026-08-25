# Annotation Review

An Obsidian plugin that finds text annotations in a note (comments, insertions, deletions, replacements) and lets you approve or dismiss each one from a sidebar, rewriting the note automatically. Annotations can be written by anyone, the syntax is just designed to be easy for AI tools to produce. Inspired by [trevware/obsidian-sidebar-highlights](https://github.com/trevware/obsidian-sidebar-highlights).

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
| Comment on a spot | `>>note<<` | `This is a test.{>>What is it a test of?<<}` |

Whitespace inside the markers is kept exactly as written, so `{++is ++}` inserts the word and the space after it. That is how CriticMarkup avoids having to select exact word boundaries.

**The author goes inside the wrapper**, right after the opening operator marks, terminated by `@@` so the text after it keeps every space:

```
{--{"author":"Claude"}@@is --}      the CriticMarkup plugin's metadata, written in braces
==--[Claude]@@is --==               the lighter form, written in highlights and percent marks
```

Both spellings are read in every wrapper. From the metadata only `author` is used (`a` works too); other fields such as `time` are kept as written and ignored. An annotation is authored by the author inside its wrapper, or by nobody. That is the whole rule.

**Every entry after the wrapper is a reply.** A footnote `^[...]` or a CriticMarkup comment `{>>...<<}`, written directly after the wrapper with no space in between, in any mix. There is no separate word for a reason: the reason for a change is simply its first reply, the way Google Docs does it. A reply's author is `{"author":"X"}@@` at the start, which is what the plugin writes in a brace comment, or `[X] `, which is what it writes in a footnote. `^[[Claude]]` is an empty reply by Claude and nothing more.

```
This is {--{"author":"Claude"}@@is --}{>>{"author":"Claude"}@@The word is repeated.<<}{>>{"author":"Alex"}@@Agreed.<<}a test.
This is ==--[Claude]@@is --==^[[Claude] The word is repeated.]^[[Alex] Agreed.]a test.
```

A few rules that follow from this:

- A comment on a span needs no author inside the wrapper: the span was written by whoever wrote the note, and the person commenting signs their reply.
- `>>` is an operator like the others, so a comment on a spot exists in every wrapper: `{>>note<<}`, `==>>note<<==`, `%%>>note<<%%`. A `{>>...<<}` directly after another annotation is a reply to it instead.
- A commented `%%hidden span%%` shows its reply while the span stays hidden, which is the accepted cost of hiding it.
- A bare `==highlight==` or `%%hidden text%%` is listed as a plain comment on that text, so nothing in a note goes unseen. The filter button hides both, and that choice is remembered.
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
| Comment | On a selection, `{==text==}{>>{"author":"Claude"}@@ <<}`. Inside an annotation, a reply. With nothing selected, a comment on that spot, `{>>...<<}` in the chosen wrapper | Inside the reply, ready to type |
| Delete | `{--{"author":"Claude"}@@text--}` | At the end |
| Replace | `{~~{"author":"Claude"}@@text~>~~}` | After the arrow, ready for the replacement |
| Insert | `{++{"author":"Claude"}@@text++}` | At the end, since the selection is already the inserted text |
| Choose type of annotation | Asks which of the four, then behaves the same | |
| Set default author | Sets the author written into new annotations | |

A comment, a reason and a reply are the same thing in different places, so one command covers all three and the context decides. Selecting an annotation whole counts as being inside it, so Comment never wraps an annotation in a second one. With no author set, nothing is written after the operator marks.

The right click menu always shows Comment, named Reply when the caret is inside an annotation. The other three appear when text is selected outside any annotation. All of them sit under their own divider.

Which wrapper each operation writes is a setting, per operation. Percent marks do not render inside fenced blocks, so a fallback wrapper stands in for them there, and inside an existing percent mark annotation the insert command writes the close-and-reopen form.

## In the editor

In live preview the syntax is hidden and the text is colored the way a diff reads: red for what goes, green for what arrives. A highlight keeps its background under the color, braces and percent marks disappear, with the text inside percent marks staying Obsidian's faint grey and its red and green toned down to match. A plain `{==highlight==}` or `%%hidden note%%` with nothing attached is drawn the same way, so it never looks different from one with a reply. A replacement shows the old text in red and the new text in green right against each other. A `~~replacement~~` is also a strikethrough to Obsidian. Ours loses the line, a genuine `~~strikethrough~~` keeps it.

Comments and replies sit on a blue background: a `{>>comment<<}` on a spot and a `{>>reply<<}`, with their markers hidden. A `^[reply]` is left to Obsidian, which draws it as a footnote, and gets nothing added, so a genuine footnote is never touched. The span a comment is about gets no color of its own: a `==highlight==` and a `{==braced span==}` keep Obsidian's yellow, and a hidden `%%span%%` is already fainter. So a plain yellow highlight reads as a comment and nothing else does.

The author is shown one of three ways, chosen in settings: a line under the text in the author's color, the same color as their chip in the sidebar, with the name in a tooltip; the name itself as a chip, sized by whatever it sits in, so it shrinks inside a footnote; or not at all. The `[Author]` labels and `{"author":"..."}@@` metadata are hidden either way.

The moment the caret or the selection touches an annotation, all of its syntax comes back, the way Obsidian reveals its own `==` and `**`. Nothing inside backticks or a code block is ever styled, admonitions excepted.

Reading view is styled the same way, from the rendered HTML: brace syntax in the text, operator marks inside a highlight, and a `{~~replacement~~}` Obsidian rendered as a strikethrough. Percent marks are dropped by Obsidian in reading view, which is right for text that is hidden until approved. Footnote labels at the bottom of the page become the author. An annotation whose text carries its own inline formatting is left as it is rather than half styled.

A gutter draws a colored line down the left edge of every annotated line, in live preview and in source mode, where the text itself stays uncolored: red, green, both for a replacement, blue for a comment. The styling, the author display and the gutter are each a setting.

## Sidebar features

- **Annotations tab**: lists every detected annotation with Approve/Dismiss buttons, filterable by author via an Obsidian-native menu, not a native `<select>`, which renders as an ugly OS popup on mobile. Each author gets a consistent, hashed color badge, gray if unlabeled, distinct even for similar names.
- **Card layout**: the annotated text first, then the type badge and author chip with the line number at the far end, then the replies. The first reply is always shown, since for a change it is the reason and for a comment on a span it is the comment; the rest fold behind the expand toggle. Text that goes away is red and text that arrives is green, the way a diff reads, softened toward the text color and with no strikethrough. A card shows an author chip only when the annotation names one. The note does not say who made an unauthored change, so the card does not either; only an unsigned reply says No author.
- **Filter button**: between the author menu and the expand toggle. Toggles each annotation type, annotations without an author, and plain highlights and comments. Remembered across notes, unlike the author filter, which only means something within one note.
- **Wrapper at a glance**: a thin line along the top of each card says how the annotation is written in the note, yellow for a highlight, gray for hidden percent marks, purple for braces.
- **Follows the caret**: the card whose annotation the caret is inside is marked and scrolled into view, so the note and the sidebar stay in step whichever one you are looking at.
- **Editing in place**: click any text on a card to edit it inline, including the annotated text itself, the reason or comment, the replacement, the inserted text, and a reply. Click an author chip to set, change, or clear the author, on the annotation itself or on any reply. Everything saves straight back to the note, spaces and line breaks included.
- **Replies**: the reply button opens a field above the buttons, where the reply itself will appear. The field is prefilled with an author bracket, since a reply's author is part of its own text, and the cursor lands inside the brackets when there's no default author to fill in. A reply is written in the same channel as the entries already there, footnote or brace comment. Each reply has its own dismiss button. Replies collapse to a count by default, with an expand/collapse-all toggle in the filter row once any annotation has one, and adding one expands them automatically. Whether replies are expanded is remembered across notes, separately from the admonition setting. A reply sits beside its author when it fits on one line, and moves below the author name when it needs more.
- **Admonitions tab**: lists every `ad-*` block in the note (`ad-info`, `ad-c`, `ad-j`, anything), filterable by type. Each block is rendered live through Obsidian's own markdown pipeline, so if you have the Admonition plugin installed, it looks exactly like it does in your note, your custom colors, icons, and titles included. Without Admonition installed, it falls back to a plain rendered code block. A trash icon per block deletes that entire block in one action, also collapsing the blank line left behind so you don't end up with three blank lines where there should be one. An expand/collapse-all toggle sits in the filter row for reading full content instead of the clipped preview, and that choice is remembered across notes.
- **Refresh button**: an icon-only button in the filter row forces a rescan of the active note if the list ever looks stale.
- **Finding the text**: clicking a card opens the note and selects the whole annotation, so it is obvious which one the card refers to. In reading view nothing can be selected, so it scrolls to the line instead.

## Settings

The defaults are plain CriticMarkup: braces for everything, with `{>>...<<}` carrying the author, reason and replies. Change any of it to taste.

- **Author**: written inside every new annotation and at the start of every reply.
- **Wrappers**: braces, highlight, or percent marks, chosen separately for comments, deletions, replacements and insertions.
- **Inside fenced blocks**: braces or highlight, standing in for percent marks where they do not render. Greyed out while no operation uses percent marks.
- **Style annotations in live preview**, **Authors in the editor** (underline, chip, or none), **Show the diff gutter**: the three parts of the editor rendering, each its own setting. The first two apply to reading view as well.
- **Replies**: footnote or CriticMarkup comment. An annotation that already has replies keeps their style.

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
