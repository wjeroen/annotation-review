# TODO

## Current Sprint

### Bug Fixes
- [ ] On the phone, the edit box of the last card still ends up behind the keyboard (0.8.0-beta.2 shows a readout to find the cause, then remove it)

### Known gaps, accepted
- [ ] A highlight form insert nested inside another one is not detected. Highlights cannot nest. Braces do, and percent marks chain by closing and reopening, so those are the forms to use
- [ ] Anything in square brackets followed by a space at the start of a reply is read as the author, so `^[[1] see the appendix]` gets the author "1"

### Rendering, known limits
- [ ] With underlines, an empty insertion or an empty comment has no text to underline and is invisible in the editor until the caret touches it. It still shows in the sidebar. Accepted as the cost of underlines
- [ ] Reading view leaves an annotation alone when its text carries inline formatting of its own, since Obsidian splits that across elements. Handling that means reassembling text across siblings
- [ ] `C:\dev\obsidian-criticmarkup` is a clone of Fevol's plugin for reference on the decorations and gutter

### Needs checking in Obsidian

The checklist with fixtures lives in the vault's Annotation Review Test note rather than here, since it changes with every release. 0.6.0 went stable with part of the editor and reading view rendering still unchecked. Whatever fails there is a bug fix on the stable line.

## Future Ideas

### Agreed for a next version

- [ ] P2 **Document-end footnotes as annotations**, the `[^1]` in the text with `[^1]: content` at the bottom, which the upstream highlights plugin also accepts. Worth doing, but note it is the first annotation type whose text lives somewhere else in the file, so approve and dismiss have to edit two places at once and the definition has to be removed without disturbing the numbering of the others. Expect this to be the most invasive of the four.
- [ ] **Timestamps**, as a marker behind a colon, `[Author:T1755000000]@@`, beside a link when there is one, `[Author:L3:T1755000000]@@`. The CriticMarkup plugin's `time` field maps to the same thing. Read it, show it on cards, sort replies by it. Decided in format, not built. A bracket holding only a marker is that marker with nobody signing it, and the parser already keeps `T` and digits out of the name.
- [ ] Reading view: reassemble text across sibling elements so an annotation with bold or a link inside it is styled rather than left raw.

## Completed Recently
- [x] On the desktop, a note picked from the list of notes that is already open in another tab is brought to the front there. Open Tab Settings had sent the open to that tab without showing it (2026-10-08)
- [x] The list of notes sorts by most annotations, or by most recently changed, through a sort button right of the filter button that is only there in the list. The choice stays on the device (2026-10-08)
- [x] The notes button sits at the right end of the filter row next to Refresh, so it no longer moves with the author label (2026-10-08)
- [x] On the phone, a change brought on screen after an approve or a dismiss lands a third of the way down instead of at the edge (2026-10-08)
- [x] A button right of the filter button lists every note in the vault that holds annotations, newest first, with a count per type and the authors on each, under the same filters as the cards (2026-10-07)
- [x] An HTML comment is listed as a bare comment, its text being the note. Nothing inside it is read, it takes no comments, and dismissing it removes it whole (2026-10-07)
- [x] Doc comments that sat above the wrong function or described old syntax are fixed (2026-10-07)
- [x] An annotation may hold backticks, and an annotation written inside backticks is text. The closing `==` or `%%` and the `~>` of a replacement are found by walking forward past code, links, HTML comments and entry text, the way braces always did, so a replacement whose old and new text are backticked strings holding `%%` is read as one replacement rather than nothing. A highlight may hold a brace comment, and the insert command sees the same annotation ends as the sidebar (2026-09-07)
- [x] The defaults a fresh install starts with: braces everywhere with footnote replies, authors underlined on changes and chipped on comments, gutter in the margin with 4 pixel bands, 2 between them and 5 beside the line, author chips at 85 percent (2026-08-30)
- [x] The gutter line only reaches into the next line when that line draws the same colors, so a line with three bands no longer leaves its leftmost band hanging over the line below it (2026-08-29)
- [x] A link is written inside the author bracket behind a colon, `[Claude:L3]@@` or `[:L3]@@`, since a second bracket is a reference link in markdown and Obsidian draws it as one, and a colon never appears in a name. Links are numbers, only changes carry them, the set header names the link, and the thread stops with the last card (2026-08-29)
- [x] The author filter and the author list count the author of every comment as well as the annotation's own, so a comment on a selection is filed under whoever wrote it instead of under No author (2026-08-29)
- [x] Annotations can be linked, `[X][Lname]@@` or a `link` field in the metadata, and a linked set is drawn together in the sidebar on a thread, with a header that approves or dismisses all of it. Each member keeps its own card and buttons (2026-08-29)
- [x] A line with several kinds of annotation shows a color for each, side by side in the order they appear, never above each other. The line grows with the number of colors and stays right aligned. Two settings in pixels: the thickness of one band, 1 to 10, and the space between two bands, 0 to 5 (2026-08-29)
- [x] The gutter line runs unbroken through a block of annotated lines, instead of breaking at every paragraph. The space beside the line now means the same in the margin and in the text column, since Obsidian's 24px is dropped in both, and the slider reaches 40 so the old 29 is available (2026-08-29)
