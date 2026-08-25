# Annotation Review

An Obsidian plugin that finds text annotations in a note (comments, insertions, deletions, replacements) and lets you approve or dismiss each one from a sidebar, rewriting the note automatically. Annotations can be written by anyone, the syntax is just designed to be easy for AI tools to produce. Inspired by [trevware/obsidian-sidebar-highlights](https://github.com/trevware/obsidian-sidebar-highlights).

The syntax follows [CriticMarkup](http://criticmarkup.com), with two additions: the same markers can be wrapped in Obsidian's own highlight or comment delimiters instead of braces, and an author and reason can be attached to any change.

## The syntax

An annotation is three independent choices:

```
<wrapper> <operator> text <operator> </wrapper> <entry>*
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
| Replace | `--old~>new++`, `--old--++new++`, or CriticMarkup's `~~old~>new~~` | `This ==--isn't~>is++== a test.` |
| Comment | no operator | `==This is a test==^[What is it a test of?]` |

Whitespace inside the markers is kept exactly as written, so `{++is ++}` inserts the word and the space after it. That is how CriticMarkup avoids having to select exact word boundaries.

**The entries carry who and why.** An entry is a footnote `^[...]` or a CriticMarkup comment `{>>...<<}`, written directly after the wrapper with no space in between. The first entry holds the `[Author]` label and the reason, every entry after it is a reply.

```
This is {--is --}^[[Claude] The word is repeated.]^[[Alex] Agreed.]a test.
This is {--is --}{>>[Claude] The word is repeated.<<}{>>[Alex] Agreed.<<}a test.
```

A few rules that follow from this:

- A bare `==highlight==` or `%%comment%%` with no entry attached is not an annotation, it is just an ordinary Obsidian highlight or comment. `{==text==}` on its own is, since braces mean nothing else in Markdown.
- A `{>>comment<<}` with nothing in front of it is a comment on that spot rather than on a span. It shows up as a comment card with no text of its own.
- There is no reply without a reason in front of it. `{--is --}^[[Alex] Agreed.]` is Alex's deletion, not a reply. To reply to an annotation that gave no reason, the author-only entry has to be there first: `^[[Claude]]^[[Alex] Agreed.]`.
- Braces nest, because their opening and closing marks differ: `{++outer {++inner++} rest++}` is two insertions. Highlights and percent marks cannot nest. To insert inside an existing percent mark insertion, close and reopen it: `%%++A ++%%%%++X++%%%%++B++%%` is three insertions in a row, and the insert command writes this for you.
- Percent marks do not render inside any fenced block, admonitions included, so use highlights or braces there.
- A highlight cannot cross a blank line, but braces and percent marks can, which is the only way to insert or delete a paragraph break: `{++\n\n++}`.

## Creating annotations from the editor

Select the text you want to annotate, then either right click it or run a command. None of the commands are bound to a hotkey by default, bind whichever you use most in Settings, Hotkeys.

Nothing opens a dialog. Each one writes the annotation straight into the note and leaves the caret where text is still needed, so you can type the comment or reason immediately and carry on.

| Command | Writes | Caret lands |
| --- | --- | --- |
| Comment | `==text==^[[Author] ]` | Inside the footnote, ready for the comment |
| Delete | `==--text--==^[[Author] ]` | Inside the footnote, ready for an optional reason |
| Replace | `==--text~>++==^[[Author]]` | After the arrow, ready for the replacement |
| Insert | `%%++text++%%^[[Author]]` | At the end, since the selection is already the inserted text |
| Insert (highlight form) | `==++text++==^[[Author]]` | Same, always with a highlight |
| Insert with a reason | `%%++text++%%^[[Author] ]` | Inside the footnote, ready for the reason |
| Choose type of annotation | Asks which of the above, then behaves the same | |
| Set default author | Sets the `[Author]` label used for new annotations | |

The same actions appear in the editor right click menu when text is selected, grouped together under their own divider.

Which wrapper the commands write is a setting: highlights for comments, deletions and replacements, percent marks for insertions, by default. Insertions fall back to a highlight inside a fenced block, and to the close-and-reopen form inside an existing percent mark annotation.

## Sidebar features

- **Annotations tab**: lists every detected annotation with Approve/Dismiss buttons, filterable by author via an Obsidian-native menu, not a native `<select>`, which renders as an ugly OS popup on mobile. Each author gets a consistent, hashed color badge, grey if unlabeled, distinct even for similar names.
- **Wrapper at a glance**: a thin line along the top of each card says how the annotation is written in the note, yellow for a highlight, grey for hidden percent marks, purple for braces.
- **Follows the caret**: the card whose annotation the caret is inside is marked and scrolled into view, so the note and the sidebar stay in step whichever one you are looking at.
- **Editing in place**: click any text on a card to edit it inline, including the annotated text itself, the reason or comment, the replacement, the inserted text, and a reply. Click an author chip to set, change, or clear the author, on the annotation itself or on any reply. Everything saves straight back to the note, spaces and line breaks included. The author sits at the start of the reason, the way a reply reads, and stays in the header when there is no reason.
- **Adding and removing a reason**: annotations without a reason get a plus button next to the reply button, since there would otherwise be no field to click. It disappears once a reason exists. Clearing the reason field removes the reason again, along with the entry when that is all it carried.
- **Replies**: the reply button opens a field above the buttons, where the reply itself will appear. The field is prefilled with an author bracket, since a reply's author is part of its own text, and the cursor lands inside the brackets when there's no default author to fill in. A reply is written in the same channel as the entries already there, footnote or brace comment. Each reply has its own dismiss button. Replies collapse to a count by default, with an expand/collapse-all toggle in the filter row once any annotation has one, and adding one expands them automatically. Whether replies are expanded is remembered across notes, separately from the admonition setting. A reply sits beside its author when it fits on one line, and moves below the author name when it needs more.
- **Admonitions tab**: lists every `ad-*` block in the note (`ad-info`, `ad-c`, `ad-j`, anything), filterable by type. Each block is rendered live through Obsidian's own markdown pipeline, so if you have the Admonition plugin installed, it looks exactly like it does in your note, your custom colors, icons, and titles included. Without Admonition installed, it falls back to a plain rendered code block. A trash icon per block deletes that entire block in one action, also collapsing the blank line left behind so you don't end up with three blank lines where there should be one. An expand/collapse-all toggle sits in the filter row for reading full content instead of the clipped preview, and that choice is remembered across notes.
- **Refresh button**: an icon-only button in the filter row forces a rescan of the active note if the list ever looks stale.
- **Finding the text**: clicking a card opens the note and selects the whole annotation, so it is obvious which one the card refers to. In reading view nothing can be selected, so it scrolls to the line instead.

## Settings

- **Author**: the `[Author]` label written into new annotations.
- **Wrapper for comments, deletions and replacements**: highlight, braces, or percent marks.
- **Wrapper for insertions**: the same choice, used outside fenced blocks.

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

`npm test` covers the parsing and rewriting rules, plus the note-switching behaviour. The latter matters because scanning a note is asynchronous while several Obsidian events can ask for a scan at once, and an older read landing after a newer one used to leave the panel showing a different note's annotations.

Changes ship as pre-releases (`0.6.0-beta.1` and so on) so they can be tested through BRAT before being called a version. See `CLAUDE.md` for the architecture map and the gotchas worth knowing before changing the parser or the sidebar.

`skills/annotation-review/SKILL.md` is the syntax reference written to be handed to an AI tool as a skill or system prompt, so its output is readable by the plugin.
