# Annotation Review

An Obsidian plugin that finds text annotations in a note (comments, inserts, deletes, replaces) and lets you approve or dismiss each one from a sidebar, rewriting the note automatically. Annotations can be written by anyone, the syntax is just designed to be easy for AI tools to produce. Inspired by [trevware/obsidian-sidebar-highlights](https://github.com/trevware/obsidian-sidebar-highlights).

## Annotation syntax it recognizes

- **Comment on specific text**: `==Text==^[[Author] Comment text.]`. Dismiss only, restores the plain text.
- **Delete**: `==Text==^[[Author] delete]` or `==Text==^[[Author] delete, reason]`. Approve removes the text, dismiss restores it.
- **Replace**: `==Text==^[[Author] → "New text."]`, optionally with a reason after the quotes. Approve swaps in the quoted replacement, dismiss restores the original.
- **Insert (outside code blocks)**: `%%[Author] New text.%%`. Approve keeps the text, dismiss removes it entirely. Also supports the `%%%%...%%%%` form for inserting next to an existing `%%...%%` span.
- **Insert (inside `ad-*` blocks, no reason)**: `==++[Author] New text.++==`.
- **Insert with a reason (inside or outside code blocks)**: `==New text.==^[[Author] insert, reason]`. No `++` needed when there's a footnote.

The `[Author]` label is optional, annotations left by the vault owner usually omit it.

### Replies

A highlight can carry more than one footnote in a row, `==Text==^[[Claude] delete]^[[Jeroen] disagree, keep it]`. The first footnote sets the type and drives Approve/Dismiss, every footnote after that is a reply, shown stacked under the main annotation. This also works for native `%%...%%` inserts, a trailing footnote right after the closing `%%` is a reply too. Replies have no approve/dismiss of their own, they're just remarks. Approving or dismissing the parent removes the whole thing, replies included.

## Sidebar features

- **Annotations tab**: lists every detected annotation with Approve/Dismiss buttons, filterable by author via an Obsidian-native menu, not a native `<select>`, which renders as an ugly OS popup on mobile. Each author gets a consistent, hashed color badge, grey if unlabeled, distinct even for similar names. Each annotation can carry a reply, added right from its card next to Approve/Dismiss. Replies collapse to a count by default, an expand/collapse-all toggle appears in the filter row once any annotation has one.
- **Editing in place**: click the comment/reason text, the replacement text, the inserted text, or a reply's text to edit it inline. Saves straight back to the note.
- **Admonitions tab**: lists every `ad-*` block in the note (`ad-info`, `ad-c`, `ad-j`, anything), filterable by type. Each block is rendered live through Obsidian's own markdown pipeline, so if you have the Admonition plugin installed, it looks exactly like it does in your note, your custom colors, icons, and titles included. Without Admonition installed, it falls back to a plain rendered code block. A trash icon per block deletes that entire block in one action, also collapsing the blank line left behind so you don't end up with three blank lines where there should be one. An expand/collapse-all toggle sits in the filter row for reading full content instead of the clipped preview.
- **Refresh button**: an icon-only button in the filter row forces a rescan of the active note if the list ever looks stale.

## Code block handling

- Fenced blocks whose info string starts with `ad-` (`ad-c`, `ad-j`, any future letter) are scanned for the inline markers above, since [Admonition](https://github.com/ebullient/obsidian-admonition) renders their contents as real markdown.
- Any other fenced block (plain code, no info string, etc.) is left alone entirely, since code blocks don't render markdown and shouldn't be treated as annotations.
- A bare, undecorated general comment (a plain paragraph inside an `ad-c` block with no highlight) is intentionally **not** picked up. It's meant to stay a purely visual note rendered by Admonition, not something tracked here.

## Development

```
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/annotation-review/`, then enable the plugin from Obsidian's Community Plugins settings.
