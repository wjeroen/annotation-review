# Annotation Review

An Obsidian plugin that finds text annotations in a note (comments, inserts, deletes, replaces) and lets you approve or dismiss each one from a sidebar, rewriting the note automatically. Annotations can be written by anyone, the syntax is just designed to be easy for AI tools to produce. Inspired by [trevware/obsidian-sidebar-highlights](https://github.com/trevware/obsidian-sidebar-highlights).

## Annotation syntax it recognizes

- **Comment on specific text**: `==Text==^[[Author] Comment text.]`. Dismiss only, restores the plain text.
- **Delete**: `==Text==^[[Author] delete]` or `==Text==^[[Author] delete, reason]`. Approve removes the text, dismiss restores it.
- **Replace**: `==Text==^[[Author] → "New text."]`, optionally with a reason after the quotes. Approve swaps in the quoted replacement, dismiss restores the original.
- **Insert**: `%%[Author] New text.%%`. Approve keeps the text, dismiss removes it entirely.
- **Insert, highlight form**: `==++[Author] New text.++==`. Required inside fenced blocks, where percent marks don't render, and allowed anywhere else too if you prefer it.
- **Insert with a reason**: `==New text.==^[[Author] insert, reason]`. No `++` needed when there's a footnote.

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

### Replies

An annotation can carry more than one footnote in a row, `==Text==^[[Claude] delete]^[[Jeroen] disagree, keep it]`. The first footnote sets the type and drives Approve/Dismiss, every footnote after that is a reply, shown stacked under the main annotation. This works for `%%...%%` inserts too, where a trailing footnote right after the closing `%%` is a reply. Replies have no approve/dismiss of their own, they're just remarks. Approving or dismissing the parent removes the whole thing, replies included.

## Creating annotations from the editor

Select the text you want to annotate, then run one of these commands. None of them are bound to a hotkey by default, bind whichever you use most in Settings, Hotkeys.

| Command | What it does |
| --- | --- |
| Annotate: comment on selection | Asks for the comment text |
| Annotate: mark selection for deletion | Immediate, no prompt. Add a reason later from the sidebar if you want one |
| Annotate: replace selection | Asks for the replacement text |
| Annotate: mark selection as an insertion | Immediate. Type the new text, select it, run this |
| Annotate: mark selection as an insertion (highlight form) | Same, but always uses `==++text++==` |
| Annotate: choose type for selection | One command that asks which of the above you want |
| Annotate: set default author | Sets the `[Author]` label used for new annotations |

For an insertion the syntax is picked for you: `==++text++==` inside a fenced block, the doubled `%%%%text%%%%` inside an existing insert, and plain `%%text%%` everywhere else.

## Sidebar features

- **Annotations tab**: lists every detected annotation with Approve/Dismiss buttons, filterable by author via an Obsidian-native menu, not a native `<select>`, which renders as an ugly OS popup on mobile. Each author gets a consistent, hashed color badge, grey if unlabeled, distinct even for similar names.
- **Editing in place**: click the comment or reason text, the replacement text, the inserted text, or a reply's text to edit it inline. Click an author chip to set, change, or clear the author, on the annotation itself or on any reply. Everything saves straight back to the note.
- **Adding a reason**: annotations without a reason get a plus button next to the reply button, since there would otherwise be no field to click. It disappears once a reason exists.
- **Replies**: the reply button opens a field above the buttons, where the reply itself will appear. The field is prefilled with an author bracket, since a reply's author is part of its own text, and the cursor lands inside the brackets when there's no default author to fill in. Each reply has its own dismiss button. Replies collapse to a count by default, with an expand/collapse-all toggle in the filter row once any annotation has one, and adding one expands them automatically. A reply sits beside its author when it fits on one line, and moves below the author name when it needs more.
- **Admonitions tab**: lists every `ad-*` block in the note (`ad-info`, `ad-c`, `ad-j`, anything), filterable by type. Each block is rendered live through Obsidian's own markdown pipeline, so if you have the Admonition plugin installed, it looks exactly like it does in your note, your custom colors, icons, and titles included. Without Admonition installed, it falls back to a plain rendered code block. A trash icon per block deletes that entire block in one action, also collapsing the blank line left behind so you don't end up with three blank lines where there should be one. An expand/collapse-all toggle sits in the filter row for reading full content instead of the clipped preview.
- **Refresh button**: an icon-only button in the filter row forces a rescan of the active note if the list ever looks stale.

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
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/annotation-review/`, then enable the plugin from Obsidian's Community Plugins settings.
