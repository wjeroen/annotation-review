# TODO

## Current Sprint

### Known gaps worth deciding on
- [ ] Every unlabeled reply shows a "No author" chip, which is a bit heavy in a list of replies. A quieter affordance might read better
- [ ] A highlight-form insert nested inside another one is not detected. Accepted rather than fixed, since Obsidian does not render that case properly either. The percent mark form is the one to use for nesting

### Needs checking in Obsidian

Everything else has been confirmed working in the app. These are the changes in the current beta.

- [ ] Adding a reason to a `==++text++==` insert drops the `++`, and clearing it puts them back
- [ ] A percent mark insert keeps its marks either way, gaining and losing only the footnote
- [ ] Replies on an insert survive both rewrites
- [ ] Clicking a card selects the whole annotation in the note
- [ ] Clicking a card in reading view scrolls to the right line, since nothing can be selected there

## Future Ideas
- [ ] Periodically review upstream `obsidian-sidebar-highlights` for relevant improvements to port over
- [ ] Settings tab, if more options than the default author ever need configuring

## Completed Recently
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
