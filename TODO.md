# TODO

## Current Sprint

### Known gaps worth deciding on
- [ ] A reason can be added but not removed. Editing it to empty is rejected, and clearing it would need to take the preceding comma with it, so it needs its own dismiss button like replies have
- [ ] Every unlabeled reply shows a "No author" chip, which is a bit heavy in a list of replies. A quieter affordance might read better

### Needs checking in Obsidian

Nothing below has been confirmed working in the app. Parsing and text rewriting are covered by `npm test`, so the risk is concentrated in the interface and in the editor commands. Roughly highest risk first.

**Never used at all, built but never run in Obsidian**
- [ ] Each editor command on a selection: comment, delete, replace, insert, insert (highlight form)
- [ ] The type picker command, which asks which of the above you want
- [ ] Set default author, and whether it then prefills the modals and new annotations
- [ ] Insert inside an `ad-` block should produce `==++text++==`, not percent marks
- [ ] Insert inside an existing `%%...%%` should produce the doubled form and leave three separate inserts, with none of the surrounding text becoming visible
- [ ] The comment and replace modals write to an explicit range now, so check the original text is replaced rather than left behind alongside the annotation

**Recently broken, fixed, not yet confirmed**
- [ ] Switching notes shows the right note's annotations, both ways, including switching quickly
- [ ] Clicking an author chip opens a field that stays open long enough to type in, on annotations and on replies
- [ ] The list keeps its scroll position instead of jumping to the top
- [ ] Clicking a card opens the note in the main area, never on top of the sidebar

**New, never confirmed**
- [ ] Reply field is prefilled with brackets, cursor inside them, and no doubled author label
- [ ] Each reply's own dismiss button removes just that reply
- [ ] Adding a reply expands the replies list
- [ ] A reply sits beside its author on one line and moves below it when it needs two
- [ ] The plus button appears only when there is no reason yet, and adding one works
- [ ] Editing comment, reason, replacement, inserted text and reply text in place
- [ ] The sidebar updates while typing, without waiting for Obsidian to save
- [ ] Deleting an admonition leaves one blank line, not three

**Cosmetic, unconfirmed**
- [ ] Tabs span the full width with the underline splitting it in half
- [ ] Approve, Dismiss and the filter buttons look shorter than a standard button
- [ ] Replace layout reads well: original in orange, arrow on its own line, replacement left aligned under it
- [ ] Admonitions tab still renders the Admonition plugin's own colours and icons, on desktop and mobile

## Future Ideas
- [ ] Periodically review upstream `obsidian-sidebar-highlights` for relevant improvements to port over
- [ ] Settings tab, if more options than the default author ever need configuring
- [ ] Editing the highlighted source text itself from the sidebar (currently read only, only the annotation's own fields are editable)
- [ ] Adding a reason to a `%%...%%` insert writes an `^[insert, reason]` footnote. Worth checking that reads well in practice, since the reason is invisible in the note itself

## Completed Recently
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
