# TODO

## Current Sprint

### Before 0.6.0 goes stable
- [ ] **Update the skill to the new grammar.** The vault copy of `markdown-annotations.md` still describes the old keyword syntax, which the parser no longer reads. Jeroen updates it first, then it gets copied into `skills/annotation-review/SKILL.md` minus the personal preferences section. The stable release waits for this.
- [ ] Decide what to do about braces in reading view. They show as literal braces without a CriticMarkup plugin. Try one, or style them from this plugin.

### Known gaps worth deciding on
- [ ] Every unlabeled reply shows a "No author" chip, which is a bit heavy in a list of replies. A quieter affordance might read better
- [ ] A highlight form insert nested inside another one is not detected. Highlights cannot nest. Braces do, and percent marks chain by closing and reopening, so those are the forms to use
- [ ] Anything in square brackets at the start of an entry is read as the author, so `^[[1] see the appendix]` gets the author "1". Accepted when square brackets were chosen over `{Author}`
- [ ] Clearing the only author or reason on an entry that has replies after it leaves an empty `^[]` behind, since removing the entry would turn the first reply into the reason. Rare, and it parses, but it is ugly

### Needs checking in Obsidian

The changes in `0.6.0-beta.2` and `beta.1`. The checklist with fixtures is in the vault's Annotation Review Test note.

- [ ] Card layout: text, then author chip and type badge with the line number at the far end, then the reason on its own line in grey
- [ ] The filter button and its menu, and that the choices survive switching notes and restarting
- [ ] Plain highlights and hidden comments listed as comments with no author, hidden by the filter
- [ ] The coloured line along the top of each card: yellow highlight, grey percent marks, purple braces
- [ ] The card under the caret gets an accent border and scrolls into view, and clears when the caret leaves
- [ ] Approving `{++is ++}` keeps the space
- [ ] The settings tab, and the commands honouring the wrapper choices
- [ ] Insert command inside an existing percent mark insertion writes the close and reopen form
- [ ] Replies follow the channel of the last entry, footnote or brace comment
- [ ] Point comments show as comment cards and dismiss cleanly

## Future Ideas

### Agreed for a next version

- [ ] P2 **Document-end footnotes as annotations**, the `[^1]` in the text with `[^1]: content` at the bottom, which the upstream highlights plugin also accepts. Worth doing, but note it is the first annotation type whose text lives somewhere else in the file, so approve and dismiss have to edit two places at once and the definition has to be removed without disturbing the numbering of the others. Expect this to be the most invasive of the four.
- [ ] **A setting for the metadata channel**, footnote or brace comment, for people who want fully portable CriticMarkup. Today the commands always write footnotes and only replies follow an existing brace comment.
- [ ] **Style brace annotations in the editor**, so `{--text--}` reads as a deletion without a separate CriticMarkup plugin.

### Rethinking the syntax: done in 0.6.0

Kept because the reasoning is still useful. The full proposal, with an exhaustive example list per annotation type, lives in the Future ideas section of the vault's Annotation Review Test note.

The grammar is three independent choices instead of one English keyword in a footnote:

```
<wrapper> <op> content <op> </wrapper> <entry>*
```

The wrapper picks visibility (`{...}` literal, `==...==` highlighted, `%%...%%` hidden), the operator picks the operation (`--` delete, `++` insert, `~>` substitute, none means comment), and each entry, a footnote or a `{>>...<<}`, carries only `[Author]` and free prose. This settled the comma separator, the quoted replacement and the arrow at once, because none of them survive. It also matches an existing standard rather than being one more private dialect.

Decisions taken along the way:

- Author labels stay in the entries, never inside the operator markers. Once whitespace inside the markers is significant, `{++[Claude] is ++}` cannot say whether the space after the label belongs to the inserted text.
- Whitespace inside the markers is significant. `{++is ++}` carries its own trailing space.
- Square brackets for the author. Rendering and the graph were both checked, neither produces a phantom link.
- Brace comments are a second metadata channel, read exactly like footnotes. The commands write footnotes by default.
- The footnote no longer decides an annotation's type, so the rule that a self-contained insert's first footnote is a reply disappeared. First entry is author and reason, every later one is a reply, no exceptions.
- Braces are the only wrapper that nests. `==` and `%%` cannot, and percent marks chain by closing and reopening instead.
- A footnote inside a percent wrapper was tried as a way to keep hidden annotations silent, and does not work: live preview breaks, reader view still lists the footnote, and the highlight equivalent swallows the rest of the line.
- Migration was not a goal. The old forms were deleted from the parser rather than converted.
- Recommended forms: highlights with footnotes for everything, `==--old~>new++==` for replacements, percent marks for insertions outside fenced blocks. All of it is a setting.

## Completed Recently
- [x] Plain highlights and hidden comments, ones with nothing attached, are listed as comments with no author rather than ignored, so nothing in a note goes unseen. A filter button between the author menu and the expand toggle turns each type, No author, and plain ones on or off, and those choices are saved. The author filter is not, since it only means something within one note (2026-08-25)
- [x] Cards read top to bottom: the text, then the author chip and type badge with the line number at the far end, then the reason or comment on its own line, always below and always muted (2026-08-25)
- [x] The parser reads the CriticMarkup based grammar and nothing else: three wrappers, four operations, footnotes or brace comments for author, reason and replies, point comments, brace nesting, whitespace kept exactly as written. The old keyword syntax is gone (2026-08-25)
- [x] The commands write the new grammar, with the wrapper per operation chosen in a new settings tab. Insertions fall back to a highlight in fenced blocks and to the close and reopen form inside an existing percent mark insertion, operator included (2026-08-25)
- [x] Author chip sits at the start of the reason or comment text, not italic, and moves onto its own line when the text wraps, the way replies already did. It stays in the header when there is no reason (2026-08-25)
- [x] A line along the top of each card shows the wrapper: yellow for a highlight, grey for percent marks, purple for braces (2026-08-25)
- [x] The card under the caret is marked and scrolled into view, through CodeMirror's update listener since Obsidian has no caret event. Recomputed after every scan so it survives typing (2026-08-25)
- [x] Whitespace-only text, such as an inserted paragraph break, is described on the card rather than shown as an empty box (2026-08-25)
- [x] Replies are written in the channel of the last existing entry, so a brace comment chain stays a brace comment chain (2026-08-25)
- [x] An insertion now changes shape with its reason. The `++` markers only mark inserted text when no footnote says so, so adding a reason drops them and clearing it brings them back. Percent mark inserts keep their marks either way, since those hide the text rather than label it, and converting one would reveal hidden text and not survive a round trip (2026-08-24)
- [x] Fix: clicking a card did not select the annotation. Selecting needs the editor focused afterwards, and reading view has no visible editor at all, so it now scrolls to the line there instead (2026-08-24)
- [x] Fix: text that merely mentions the syntax, such as a backticked `==` inside a sentence explaining it, swallowed the next real annotation's opening delimiter and shifted every pairing after it. Rejecting a pairing now consumes only its opening delimiter, whatever the reason for rejecting it (2026-08-24)
- [x] Editor commands no longer open a dialog. Each writes the annotation straight into the note and leaves the caret where text is still needed (2026-08-24)
- [x] The same actions on the editor right click menu, grouped under their own divider (2026-08-24)
- [x] Command names lost the "Annotate:" prefix, and the picker is now "Choose type of annotation" (2026-08-24)
- [x] New "Insert with a reason" command, the footnote form that was missing (2026-08-24)
- [x] The default author is no longer set behind your back after using a command. Only the "Set default author" command changes it (2026-08-24)
- [x] Expanded state for replies and for admonitions is remembered across notes, tracked separately (2026-08-24)
- [x] A reason can be removed by clearing its field, taking the comma before it with it, or the whole footnote when that is all it carried (2026-08-24)
- [x] The highlighted source text is editable from the sidebar too (2026-08-24)
- [x] Clicking a card selects the whole annotation in the note rather than placing a caret (2026-08-24)
- [x] The reason and reply fields close when submitted empty, including when left at just their prefilled brackets (2026-08-24)
- [x] The replacement arrow is no longer dimmer than the comment text (2026-08-24)
- [x] Fix: switching notes could show the previous note's annotations, and the other way round. Reading a note is asynchronous and several events ask for a scan at once, so an older read could land after a newer one and overwrite it. The guard added in 0.4.6 made it worse by starting a second scan whenever a first one was still in flight. Only the newest scan can publish now, and a scan that finishes to find the note has moved on rescans by itself (2026-08-23)
- [x] Added `npm test`, covering the parsing and rewriting rules plus the note-switching races. Verified the race tests actually fail against the broken version, so they are worth something (2026-08-23)
- [x] Fix: the panel jumped to the top constantly and swallowed clicks on author chips. It rebuilt itself on every rescan, including when clicking into the sidebar counted as switching panes, which destroyed the field the click had just opened. Refreshes are now skipped when nothing changed and while a field has focus, scroll position survives the rebuilds that do happen, and switching panes only refreshes on landing on a different note (2026-08-23)
- [x] Fix: jumping to an annotation used the active leaf, which is the sidebar itself once you click a card, so the note could open on top of the panel. It now targets the main area explicitly (2026-08-23)
- [x] Fix: the comment and replace commands wrote their result with `replaceSelection` after a modal had taken focus, which risked inserting the annotation while leaving the original text in place. They now replace an explicit range captured before the modal opened (2026-08-23)
- [x] Reply field is prefilled with an author bracket, and no longer double-labels when a default author is set (2026-08-23)
- [x] Each reply has its own dismiss button, and adding a reply expands the replies list (2026-08-23)
- [x] A reply moves below its author name when it needs more than one line, and stays beside it when it fits (2026-08-23)
- [x] Tabs span the full panel width so the active underline splits it exactly in half. Obsidian's own view padding was insetting them (2026-08-23)
- [x] Approve, Dismiss and the filter buttons are genuinely shorter now. Obsidian gives buttons a fixed height, so the earlier padding change had no visible effect (2026-08-23)
- [x] Sidebar now reads from the open editor instead of from disk, so it updates while you type instead of waiting for Obsidian's autosave. Writes go through the editor too, so they join the undo history and never overwrite unsaved typing (2026-08-23)
- [x] Core plugin: detection, approve/dismiss, sidebar, install via BRAT (2026-08-23)
