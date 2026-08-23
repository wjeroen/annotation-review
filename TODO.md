# TODO

## Current Sprint

### Testing
- [ ] Confirm author filter and colored author badges look right, including two similar names getting distinct colors
- [ ] Confirm the Admonitions tab lists all `ad-*` blocks and the type filter works
- [ ] Confirm the Refresh button updates a stale list
- [ ] Confirm the reason field no longer duplicates the type keyword ("delete", "insert", the replacement text)
- [ ] Confirm the footnote-variant insert works without a `++` wrapper

### Known limitations to revisit later (see README)
- [ ] `%%...%%` used for unrelated hidden notes (not annotations) will currently show up as false "insert" items
- [ ] `- [ ] ==Option==^[[Author] select this]` doesn't toggle the checkbox on approve
- [ ] Vault-wide scanning (currently active-note only)

## Future Ideas
- [ ] Periodically review upstream `obsidian-sidebar-highlights` for relevant improvements to port over
- [ ] Settings tab, if any of the above limitations need to become configurable
- [ ] "Add comment" from within the sidebar (create new annotations, not just review existing ones) — options with pros/cons proposed, not yet decided
- [ ] Replies/threaded comments on a single annotation — options with pros/cons proposed, not yet decided

## Completed Recently
- [x] Core plugin: detection, approve/dismiss, sidebar, install via BRAT (2026-08-23)
- [x] Author filter, colored author badges, Admonitions tab, Refresh button, reason-field fixes, corrected insert-footnote syntax (2026-08-23)
