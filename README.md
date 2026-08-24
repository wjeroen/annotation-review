# Annotation Review

An Obsidian plugin that finds text annotations in a note (comments, inserts, deletes, replaces) and lets you approve or dismiss each one from a sidebar, rewriting the note automatically. Annotations can be written by anyone, the syntax is just designed to be easy for AI tools to produce. Inspired by [trevware/obsidian-sidebar-highlights](https://github.com/trevware/obsidian-sidebar-highlights).

## Annotation syntax it recognizes

`markdown-annotations.md` in this repo is the full syntax reference, written to be handed to an AI tool as a skill or system prompt so its output is readable by the plugin. The summary below is the short version.

- **Comment on specific text**: `==Text==^[[Author] Comment text.]`. Dismiss only, restores the plain text.
- **Delete**: `==Text==^[[Author] delete]` or `==Text==^[[Author] delete, reason]`. Approve removes the text, dismiss restores it.
- **Replace**: `==Text==^[[Author] → "New text."]`, optionally with a reason after the quotes. Approve swaps in the quoted replacement, dismiss restores the original.
- **Insert**: `%%[Author] New text.%%`. Approve keeps the text, dismiss removes it entirely.
- **Insert, highlight form**: `==++[Author] New text.++==`. Required inside fenced blocks, where percent marks do not render, and allowed anywhere else too if you prefer it. The `++` markers only exist to say the highlighted text is an insertion, so they belong to this form alone.
- **Insert with a reason**: `==New text.==^[[Author] insert, reason]`. No `++` here, since the footnote already says the text is an insertion. Adding a reason to a `++` insert from the sidebar drops the markers for you, and clearing the reason puts them back. Percent mark inserts keep their own marks either way, because those hide the text rather than label it.

The `[Author]` label is optional, annotations left by the vault owner usually omit it.

### Nested inserts

To insert *inside* someone else's insert, the surrounding comment has to close and reopen around yours, which is what the doubled percent marks do:

```
%%[Claude] First.%%%%[GPT] Second.%%%%[Claude] Third.%%
```

That reads as three adjacent hidden comments and all three show up as separate inserts. Writing it with single percent marks instead would break the middle one out of its comment and leave it visible as ordinary prose:

```
%%[Claude] First.%%[GPT] Second.%%[Claude] Third.%%
```

The insert command handles this for you: when the cursor sits inside an existing `%%...%%` span it writes the doubled form automatically.

Nesting only works with percent marks. A highlight-form insert inside another highlight-form insert is not detected, and Obsidian does not render it properly either, so use the percent form when nesting.

### Replies

An annotation can carry more than one footnote in a row, `==Text==^[[Claude] delete]^[[Jeroen] disagree, keep it]`. The first footnote sets the type and drives Approve/Dismiss, every footnote after that is a reply, shown stacked under the main annotation. This works for `%%...%%` inserts too, where a trailing footnote right after the closing `%%` is a reply. Replies have no approve/dismiss of their own, they're just remarks. Approving or dismissing the parent removes the whole thing, replies included.

## Creating annotations from the editor

Select the text you want to annotate, then either right click it or run a command. None of the commands are bound to a hotkey by default, bind whichever you use most in Settings, Hotkeys.

Nothing opens a dialog. Each one writes the annotation straight into the note and leaves the caret where text is still needed, so you can type the comment or reason immediately and carry on.

| Command | Caret lands |
| --- | --- |
| Comment | Inside the empty footnote, ready for the comment |
| Delete | After the keyword, ready for an optional reason |
| Replace | Between the quotes, ready for the replacement |
| Insert | At the end, since the selection is already the inserted text |
| Insert (highlight form) | Same, but always uses `==++text++==` |
| Insert with a reason | After the keyword, using the footnote form |
| Choose type of annotation | Asks which of the above, then behaves the same |
| Set default author | Sets the `[Author]` label used for new annotations |

The same actions appear in the editor right click menu when text is selected, grouped together under their own divider.

For an insertion the syntax is picked for you: `==++text++==` inside a fenced block, the doubled `%%%%text%%%%` inside an existing insert, and plain `%%text%%` everywhere else.

## Sidebar features

- **Annotations tab**: lists every detected annotation with Approve/Dismiss buttons, filterable by author via an Obsidian-native menu, not a native `<select>`, which renders as an ugly OS popup on mobile. Each author gets a consistent, hashed color badge, grey if unlabeled, distinct even for similar names.
- **Editing in place**: click any text on a card to edit it inline, including the highlighted source text itself, the comment or reason, the replacement, the inserted text, and a reply. Click an author chip to set, change, or clear the author, on the annotation itself or on any reply. Everything saves straight back to the note.
- **Adding and removing a reason**: annotations without a reason get a plus button next to the reply button, since there would otherwise be no field to click. It disappears once a reason exists. Clearing the reason field removes the reason again, taking the comma before it with it, or the whole footnote when that is all it carried.
- **Replies**: the reply button opens a field above the buttons, where the reply itself will appear. The field is prefilled with an author bracket, since a reply's author is part of its own text, and the cursor lands inside the brackets when there's no default author to fill in. Each reply has its own dismiss button. Replies collapse to a count by default, with an expand/collapse-all toggle in the filter row once any annotation has one, and adding one expands them automatically. Whether replies are expanded is remembered across notes, separately from the admonition setting. A reply sits beside its author when it fits on one line, and moves below the author name when it needs more.
- **Admonitions tab**: lists every `ad-*` block in the note (`ad-info`, `ad-c`, `ad-j`, anything), filterable by type. Each block is rendered live through Obsidian's own markdown pipeline, so if you have the Admonition plugin installed, it looks exactly like it does in your note, your custom colors, icons, and titles included. Without Admonition installed, it falls back to a plain rendered code block. A trash icon per block deletes that entire block in one action, also collapsing the blank line left behind so you don't end up with three blank lines where there should be one. An expand/collapse-all toggle sits in the filter row for reading full content instead of the clipped preview, and that choice is remembered across notes.
- **Refresh button**: an icon-only button in the filter row forces a rescan of the active note if the list ever looks stale.
- **Finding the text**: clicking a card opens the note and selects the whole annotation, so it is obvious which one the card refers to. In reading view nothing can be selected, so it scrolls to the line instead.

## Code block handling

- Fenced blocks whose info string starts with `ad-` (`ad-c`, `ad-j`, any future letter) are scanned for the inline markers above, since [Admonition](https://github.com/ebullient/obsidian-admonition) renders their contents as real markdown.
- Any other fenced block (plain code, no info string, etc.) is left alone entirely, since code blocks don't render markdown and shouldn't be treated as annotations.
- A bare, undecorated general comment (a plain paragraph inside an `ad-c` block with no highlight) is intentionally **not** picked up. It's meant to stay a purely visual note rendered by Admonition, not something tracked here.

## How edits reach the note

While a note is open, Obsidian keeps your typing in memory and only writes it to disk a second or two later. So the plugin reads from the open editor rather than from the file on disk, which is what keeps the sidebar in step with what you are actually looking at, and it writes through the editor too, so its changes join the normal undo history and never overwrite unsaved typing.

Refreshing rebuilds the panel, which would otherwise lose your scroll position and close whatever field you had open, so a refresh is skipped entirely when the annotations haven't actually changed, and while a field inside the panel has focus. Scroll position is restored across the rebuilds that do happen.

## Development

```
npm install
npm run build
npm test
```

`npm test` covers the parsing and rewriting rules, plus the note-switching behaviour. The latter matters because scanning a note is asynchronous while several Obsidian events can ask for a scan at once, and an older read landing after a newer one used to leave the panel showing a different note's annotations.

Changes ship as pre-releases (`0.5.0-beta.1` and so on) so they can be tested through BRAT before being called a version. See `CLAUDE.md` for the architecture map and the gotchas worth knowing before changing the parser or the sidebar.

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/annotation-review/`, then enable the plugin from Obsidian's Community Plugins settings.
