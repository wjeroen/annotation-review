# TODO

## Current Sprint

### Testing
- [ ] Open Obsidian, confirm the plugin loads without console errors (Ctrl+Shift+I to see the console)
- [ ] Create a test note with one of each annotation type (comment, delete, replace, insert outside code, insert inside `ad-j`) and confirm the sidebar shows all of them correctly
- [ ] Click Approve and Dismiss on each type and confirm the note text updates correctly
- [ ] Confirm annotations inside `ad-c`/`ad-j` blocks show up, and plain code blocks (` ```python `) stay ignored
- [ ] Confirm the sidebar text size matches the rest of Obsidian, not a custom smaller size
- [ ] Test on mobile (Android/iOS)

### Known limitations to revisit later (see README)
- [ ] `%%...%%` used for unrelated hidden notes (not annotations) will currently show up as false "insert" items
- [ ] `- [ ] ==Option==^[[Author] select this]` doesn't toggle the checkbox on approve
- [ ] Vault-wide scanning (currently active-note only)

## Future Ideas
- [ ] Periodically review upstream `obsidian-sidebar-highlights` for relevant improvements to port over
- [ ] Settings tab, if any of the above limitations need to become configurable
