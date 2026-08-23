# TODO

## Current Sprint

### Testing
- [ ] Confirm the Admonitions tab renders your actual Admonition colors/icons/titles (ad-c orange bot icon, ad-j grey message icon) on desktop and mobile
- [ ] Confirm the delete button on an admonition card removes the whole block cleanly
- [ ] Confirm the expand/collapse-all toggle works on the Admonitions tab
- [ ] Confirm the filter buttons open an Obsidian-native menu, not an OS popup, especially on mobile
- [ ] Confirm the author badge is clearly visible but still reads as secondary to the type badge
- [ ] Confirm tabs and refresh icon look right against both light and dark themes

### Known limitations to revisit later (see README)
- [ ] `%%...%%` used for unrelated hidden notes (not annotations) will currently show up as false "insert" items
- [ ] `- [ ] ==Option==^[[Author] select this]` doesn't toggle the checkbox on approve
- [ ] Vault-wide scanning (currently active-note only)

## Future Ideas
- [ ] Periodically review upstream `obsidian-sidebar-highlights` for relevant improvements to port over
- [ ] Settings tab, if any of the above limitations need to become configurable
- [ ] "Add comment" from within the sidebar (create new annotations, not just review existing ones) — options with pros/cons proposed, not yet decided
- [ ] Replies/threaded comments on a single annotation — options with pros/cons proposed, not yet decided
- [ ] Expand/collapse-all pattern on the Annotations tab too, once replies exist to expand

## Completed Recently
- [x] Admonitions now render full width with no wrapping box, Approve/Dismiss got check/x icons and less rounded corners (2026-08-23)
- [x] Fix: reverted unrequested annotation card restyle (colored left border), moved refresh next to expand in the filter row, made tabs+filter row sticky with only the list scrolling, tabs now show full text labels again (2026-08-23)
- [x] Core plugin: detection, approve/dismiss, sidebar, install via BRAT (2026-08-23)
- [x] Author filter, colored author badges, Admonitions tab, Refresh button, reason-field fixes, corrected insert-footnote syntax (2026-08-23)
- [x] Redesigned sidebar: icon-only tabs with underline indicator, Menu-based filter buttons, live-rendered admonitions matching the user's Admonition styling, per-block delete, expand/collapse toggle, clearer author badge (2026-08-23)
