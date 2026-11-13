# TODO

## Current Sprint

### Bug Fixes
- [ ] Approve all on a linked set often needs several taps before it works, on the desktop and the phone (reported 2026-10-10, check whether 0.8.0-beta.5 fixed it, an error during an action now shows as a notice)
- [ ] A line of equals signs under a title is read as bare highlights, and with no blank line after it the real highlight on the next line is lost (found 2026-10-11)

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
- [ ] Reading view: reassemble text across sibling elements so an annotation with bold or a link inside it is styled rather than left raw.

## Completed Recently
- [x] Times: written in UTC into every new annotation and comment, `[Claude:T1763065440]@@` or a `time` field in braces, and shown beside the author in the device's time zone, with the full date on hover or tap. Settings for writing them, for date or date and time, and for comment dates on every card (2026-11-13)
- [x] Links on the cards are drawn as in live preview and open on a click. A click elsewhere on the text still opens the edit box with the raw text (2026-11-13)
- [x] A reply that starts with a link or a wikilink is unsigned. It was signed by the link text, and signing it with a real name replaced the link text with that name (2026-11-09)
- [x] A footnote reply holding a link, a wikilink or other brackets is read whole. It was cut at the first `]`, so its card text stopped early and a new reply landed inside it. In reading view the author's underline covers the whole footnote, and a link address may hold parentheses (2026-11-07)
- [x] Changing or clearing the author chip on a change also renames its reason, as one edit. Renaming only the change had turned the reason into a comment by the old name (2026-10-29)
- [x] A reply on a comment on a spot by the same author shows on the card. It was hidden completely (2026-10-29)
- [x] Clicking the line number or the space beside the buttons opens the annotation in the note again, as it did before 0.8.0-beta.5 (2026-10-11)
- [x] The list no longer jumps while a card or a button is clicked. It only scrolls when the caret goes into a different annotation, and two annotations that touch no longer steal each other's mark (2026-10-11)
- [x] A card that went stale no longer acts on another annotation with the same text. A repeated Approve all on a linked rename had left a reply on its own in the note. Approve all and Dismiss all are one edit with one undo, all members or none, and an error during an action shows as a notice (2026-10-11)
- [x] On the phone, the edit box of the last card is brought above the keyboard. The drawer keeps its full height under the keyboard, so the keyboard's top is now the limit (2026-10-08)
- [x] On the desktop, a note picked from the list of notes that is already open in another tab is brought to the front there. Open Tab Settings had sent the open to that tab without showing it (2026-10-08)
- [x] The list of notes sorts by most annotations, or by most recently changed, through a sort button right of the filter button that is only there in the list. The choice stays on the device (2026-10-08)
- [x] The notes button sits at the right end of the filter row next to Refresh, so it no longer moves with the author label (2026-10-08)
- [x] On the phone, a change brought on screen after an approve or a dismiss lands a third of the way down instead of at the edge (2026-10-08)
- [x] A button right of the filter button lists every note in the vault that holds annotations, newest first, with a count per type and the authors on each, under the same filters as the cards (2026-10-07)
- [x] An HTML comment is listed as a bare comment, its text being the note. Nothing inside it is read, it takes no comments, and dismissing it removes it whole (2026-10-07)
- [x] Doc comments that sat above the wrong function or described old syntax are fixed (2026-10-07)
- [x] An annotation may hold backticks, and an annotation written inside backticks is text. The closing `==` or `%%` and the `~>` of a replacement are found by walking forward past code, links, HTML comments and entry text, the way braces always did, so a replacement whose old and new text are backticked strings holding `%%` is read as one replacement rather than nothing. A highlight may hold a brace comment, and the insert command sees the same annotation ends as the sidebar (2026-09-07)
- [x] The defaults a fresh install starts with: braces everywhere with footnote replies, authors underlined on changes and chipped on comments, gutter in the margin with 4 pixel bands, 2 between them and 5 beside the line, author chips at 85 percent (2026-08-30)
