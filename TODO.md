# TODO

## Current Sprint

### Testing
- [ ] Confirm the resync fix on a real note that has annotations, including one with a stray literal `==` somewhere in the prose
- [ ] Confirm replies show up correctly under a parent annotation, and disappear along with it on approve/dismiss, for both highlight-based and native `%%...%%` inserts
- [ ] Confirm the expand/collapse-all toggle for replies appears once any annotation has a reply, and works
- [ ] Confirm clicking comment/reason/replacement/inserted text/reply text lets you edit it in place and saves correctly
- [ ] Confirm the reply button sits on the Approve/Dismiss row, aligned right
- [ ] Confirm deleting an admonition collapses down to exactly one blank line left behind, not three
- [ ] Confirm the Admonitions tab renders your actual Admonition colors/icons/titles (ad-c orange bot icon, ad-j grey message icon) on desktop and mobile
- [ ] Confirm the filter buttons open an Obsidian-native menu, not an OS popup, especially on mobile

## Future Ideas
- [ ] Periodically review upstream `obsidian-sidebar-highlights` for relevant improvements to port over
- [ ] Settings tab, if any future option needs to become configurable
- [ ] "Add comment" from within the editor, not the sidebar. Proposal in progress: command structure, type-then-select flow, how to differentiate insert forms

## Completed Recently
- [x] Fix: a single stray literal `==` anywhere in a note (e.g. text describing the syntax itself) used to desync every real annotation after it in the whole file. Now the detector recovers immediately instead of staying desynced. Verified against a real onboarding form where this silently hid every annotation (2026-08-23)
- [x] Editing annotations, replacements, inserted text, and replies directly from the sidebar by clicking the text (2026-08-23)
- [x] Expand/collapse-all toggle for replies in the Annotations tab, reply button moved onto the Approve/Dismiss row, aligned right (2026-08-23)
- [x] Native `%%...%%` inserts now support reply footnotes too, previously only highlight-based annotations did (2026-08-23)
- [x] Deleting an admonition block now also collapses the blank line below it (or above it, if only that one's empty) instead of leaving three blank lines behind (2026-08-23)
- [x] Test file expanded with a replies section and a dedicated stray-`==` regression test, plus corrected wording so the `%%...%%`-means-insert behavior is described as intentional, not a limitation (2026-08-23)
- [x] Fix: approve/dismiss/reply/delete now relocate an annotation's text if an earlier action shifted its position, instead of failing when acting on two things in a row. Also shortened the typing-triggered rescan delay (2026-08-23)
- [x] Core plugin: detection, approve/dismiss, sidebar, install via BRAT (2026-08-23)
- [x] Author filter, colored author badges, Admonitions tab, Refresh button, reason-field fixes, corrected insert-footnote syntax (2026-08-23)
- [x] Redesigned sidebar: icon-only tabs with underline indicator, Menu-based filter buttons, live-rendered admonitions matching the user's Admonition styling, per-block delete, expand/collapse toggle, clearer author badge (2026-08-23)
- [x] Fix: reverted unrequested annotation card restyle, moved refresh next to expand in the filter row, made tabs and filter row sticky with only the list scrolling, tabs show full text labels again (2026-08-23)
- [x] Admonition header now sits attached to the top of the content as a title bar, fade-on-collapse restored, tab underline is a full-width 50/50 split, Approve/Dismiss and filter row buttons thinned slightly (2026-08-23)
- [x] Replies: a highlight can carry multiple stacked footnotes, the first sets the type, the rest are replies shown under the card and addable from the sidebar. Removed the "known limitations" section from the README since those are intended behavior, not limitations. Fixed the Admonition plugin link. Removed em dashes from all repo prose (2026-08-23)
