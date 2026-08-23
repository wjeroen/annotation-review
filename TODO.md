# TODO

## Current Sprint

### Testing
- [ ] Confirm replies show up correctly under a parent annotation, and disappear along with it on approve/dismiss
- [ ] Confirm adding a reply from the sidebar writes the new footnote correctly
- [ ] Confirm the Admonitions tab renders your actual Admonition colors/icons/titles (ad-c orange bot icon, ad-j grey message icon) on desktop and mobile
- [ ] Confirm the delete button on an admonition card removes the whole block cleanly
- [ ] Confirm the expand/collapse-all toggle works on the Admonitions tab
- [ ] Confirm the filter buttons open an Obsidian-native menu, not an OS popup, especially on mobile

## Future Ideas
- [ ] Periodically review upstream `obsidian-sidebar-highlights` for relevant improvements to port over
- [ ] Settings tab, if any future option needs to become configurable
- [ ] "Add comment" from within the editor, not the sidebar. Proposal in progress: command structure and how to differentiate annotation types from the editor

## Completed Recently
- [x] Fix: approve/dismiss/reply/delete now relocate an annotation's text if an earlier action shifted its position, instead of failing when acting on two things in a row. Also shortened the typing-triggered rescan delay (2026-08-23)
- [x] Core plugin: detection, approve/dismiss, sidebar, install via BRAT (2026-08-23)
- [x] Author filter, colored author badges, Admonitions tab, Refresh button, reason-field fixes, corrected insert-footnote syntax (2026-08-23)
- [x] Redesigned sidebar: icon-only tabs with underline indicator, Menu-based filter buttons, live-rendered admonitions matching the user's Admonition styling, per-block delete, expand/collapse toggle, clearer author badge (2026-08-23)
- [x] Fix: reverted unrequested annotation card restyle, moved refresh next to expand in the filter row, made tabs and filter row sticky with only the list scrolling, tabs show full text labels again (2026-08-23)
- [x] Admonition header now sits attached to the top of the content as a title bar, fade-on-collapse restored, tab underline is a full-width 50/50 split, Approve/Dismiss and filter row buttons thinned slightly (2026-08-23)
- [x] Replies: a highlight can carry multiple stacked footnotes, the first sets the type, the rest are replies shown under the card and addable from the sidebar. Removed the "known limitations" section from the README since those are intended behavior, not limitations. Fixed the Admonition plugin link. Removed em dashes from all repo prose (2026-08-23)
