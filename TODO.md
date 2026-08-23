# TODO

## Current Sprint

### Testing
- [ ] Confirm the sidebar now updates while typing in a note, without waiting for Obsidian to save
- [ ] Confirm replies can be added to `%%...%%` inserts, not just highlight annotations
- [ ] Confirm the reply and reason fields appear above the buttons with full width
- [ ] Confirm clicking an author chip lets you set, change, and clear the author, on annotations and on replies
- [ ] Confirm the plus button appears only when an annotation has no reason yet, and disappears once it has one
- [ ] Confirm the replace layout reads well: original text in orange, arrow on its own line, replacement left aligned under it
- [ ] Try each editor command on a selection, including inside an `ad-` block and inside an existing `%%...%%` insert
- [ ] Confirm the Admonitions tab still renders your Admonition colours and icons on desktop and mobile

## Future Ideas
- [ ] Periodically review upstream `obsidian-sidebar-highlights` for relevant improvements to port over
- [ ] Settings tab, if more options than the default author ever need configuring
- [ ] Editing the highlighted source text itself from the sidebar (currently read only, only the annotation's own fields are editable)
- [ ] Adding a reason to a `%%...%%` insert writes an `^[insert, reason]` footnote. Worth checking that reads well in practice, since the reason is invisible in the note itself

## Completed Recently
- [x] Sidebar now reads from the open editor instead of from disk, so it updates while you type instead of waiting for Obsidian's autosave. Writes go through the editor too, so they join the undo history and never overwrite unsaved typing (2026-08-23)
- [x] Replies work on `%%...%%` inserts, previously only on highlight annotations (2026-08-23)
- [x] Reply and reason fields moved above the action buttons, where their result appears, so they get the full card width (2026-08-23)
- [x] Author chips are editable on annotations and replies, including setting one where there was none and clearing an existing one (2026-08-23)
- [x] Plus button to add a reason to an annotation that has none, since there was previously no field to click (2026-08-23)
- [x] Replace layout: arrow on its own line with the original and replacement left aligned under each other, and the replaced text tinted orange to match its badge instead of green (2026-08-23)
- [x] Editor commands for creating annotations: one per type, plus a type picker, plus a default author command. Insert syntax is chosen automatically for fenced blocks and for nesting inside an existing insert (2026-08-23)
- [x] Editing now targets exact character ranges recorded during detection rather than searching for matching text, so repeated text in an annotation can no longer be edited in the wrong place (2026-08-23)
- [x] Fix: a single stray literal `==` anywhere in a note used to desync every real annotation after it in the whole file. Now the detector recovers immediately (2026-08-23)
- [x] Editing annotations, replacements, inserted text, and replies directly from the sidebar by clicking the text (2026-08-23)
- [x] Expand/collapse-all toggle for replies in the Annotations tab (2026-08-23)
- [x] Deleting an admonition block now also collapses the blank line below it (or above it, if only that one's empty) instead of leaving three blank lines behind (2026-08-23)
- [x] Fix: approve/dismiss/reply/delete now relocate an annotation's text if an earlier action shifted its position (2026-08-23)
- [x] Core plugin: detection, approve/dismiss, sidebar, install via BRAT (2026-08-23)
- [x] Author filter, colored author badges, Admonitions tab, Refresh button, reason-field fixes (2026-08-23)
- [x] Redesigned sidebar: tabs with underline indicator, Menu-based filter buttons, live-rendered admonitions, per-block delete (2026-08-23)
