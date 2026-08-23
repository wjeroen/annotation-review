# Annotation Review

An Obsidian plugin that finds AI-authored text annotations in a note (comments, inserts, deletes, replaces) and lets you approve or dismiss each one from a sidebar, rewriting the note automatically. Inspired by [trevware/obsidian-sidebar-highlights](https://github.com/trevware/obsidian-sidebar-highlights).

## Annotation syntax it recognizes

- **Comment on specific text**: `==Text==^[[Author] Comment text.]` — dismiss only, restores the plain text.
- **Delete**: `==Text==^[[Author] delete]` or `==Text==^[[Author] delete, reason]` — approve removes the text, dismiss restores it.
- **Replace**: `==Text==^[[Author] → "New text."]` — approve swaps in the quoted replacement, dismiss restores the original.
- **Insert (outside code blocks)**: `%%[Author] New text.%%` — approve keeps the text, dismiss removes it entirely. Also supports the `%%%%...%%%%` form for inserting next to an existing `%%...%%` span.
- **Insert (inside `ad-*` blocks)**: `==++[Author] New text.++==`, or with a reason: `==++New text.++==^[[Author] insert, reason]`.

The `[Author]` label is optional; annotations left by the vault owner usually omit it.

## Code block handling

- Fenced blocks whose info string starts with `ad-` (`ad-c`, `ad-j`, any future letter) are scanned for the inline markers above, since [Admonition](https://github.com/javalent/admonition) renders their contents as real markdown.
- Any other fenced block (plain code, no info string, etc.) is left alone entirely, since code blocks don't render markdown and shouldn't be treated as annotations.
- A bare, undecorated general comment (a plain paragraph inside an `ad-c` block with no highlight) is intentionally **not** picked up. It's meant to stay a purely visual note rendered by Admonition, not something tracked here.

## Known limitations

- Any `%%...%%` outside a code block is treated as an insert annotation, since that is the documented convention. If you use `%%...%%` elsewhere in a note for unrelated hidden notes, those will also show up here as "insert" items. Approving one would make that hidden text visible, so double check before approving an unfamiliar-looking insert.
- A `- [ ] ==Option==^[[Author] select this]` style annotation is detected as a plain comment (dismiss only). Approving it does not currently check the box, since that behavior isn't part of the approve/dismiss rules above.
- The sidebar currently scans only the active note, not the whole vault.

## Development

```
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/annotation-review/`, then enable the plugin from Obsidian's Community Plugins settings.
