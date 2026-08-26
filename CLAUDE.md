# Annotation Review

An Obsidian plugin that finds text annotations in a note, lists them in a sidebar, and rewrites the note when one is approved or dismissed. Distributed through BRAT rather than the community plugin store.

## Where things are

`ARCHITECTURE.md` has the codebase map, how the pieces fit, the reasoning behind the syntax, and how the rendering works. Read it before grepping. The one contract to keep in mind: `detect.ts` reads the syntax and `compose.ts` writes it, and the round-trip tests in `tests/detect.mjs` fail if they disagree. The skill in `skills/annotation-review/SKILL.md` is maintained outside this repo and copied in. Do not edit it here.

## Commands

```
npm install
npm run build     # type check, then bundle to main.js
npm test          # parsing, rewriting, and note-switching tests
npm run dev       # rebuild on save
```

Run `npm test` before proposing a release. It is fast and needs no Obsidian. Check the build's own exit status, never through a pipe: `npm run build | tail` reports tail's status, and a failed build then ships the previous `main.js` under a new version, which happened once.

## Releases

Every change ships as a **pre-release** first, so nothing is labeled a real version until it has been used and found to work.

- Bump the beta suffix for each change: `0.6.0-beta.1`, `0.6.0-beta.2`, and so on. No approval needed for these.
- Promoting a version to stable (dropping the `-beta.N` suffix) **requires explicit approval from the maintainer.** Do not do it because a change looks finished or because the tests pass.
- **Before a stable release, the skill has to describe the shipped syntax.** The skill is maintained outside this repo and copied in, so when asking for approval, ask whether it has been updated first.
- Never bump a version or push a release as a side effect of finishing some code. Publishing is a separate decision, and asking costs nothing.

Pre-releases sort below their own stable version and above the previous one, so `0.5.0` then `0.6.0-beta.1` then `0.6.0` is the expected sequence. BRAT picks the highest semantic version it finds, whether or not it is flagged as a pre-release, so a pre-release does reach installed devices.

Publishing a release means attaching `main.js`, `manifest.json` and `styles.css` as assets, since that is what BRAT downloads. Keep the version in `manifest.json` and `package.json` in step.

## Things that will bite you

These are all real bugs that shipped once, or rules that were easy to get wrong. The comments in the code explain the fixes, but the short version:

**A note being edited does not match the file on disk.** Obsidian holds keystrokes in memory and writes them out a second or two later, so `vault.read()` returns stale text for any note that is open. Read through the open editor when there is one, and write through it too, which also keeps changes in the undo history and avoids overwriting unsaved typing. `main.ts` has `readContent` and `applyMutation` for this.

**Scanning is asynchronous and several events request it at once.** Switching notes fires more than one event, and an older read finishing after a newer one used to leave the panel showing a different note's annotations. Only the newest scan may publish its result, which is what the scan token in `rescanActiveFile` is for. Do not add cleverness that tries to predict which events are worth reacting to. A scan that finds nothing new does not redraw anything, so redundant scans are cheap.

**Spans are relative to an annotation's own text, never absolute file offsets.** Typing anywhere earlier in the note shifts every offset after it. Editing works by locating the annotation's text first, then applying the span to wherever it actually landed. Absolute offsets recorded at scan time are stale almost immediately.

**Whitespace inside the markers is significant.** `{++is ++}` inserts the word and its trailing space, which is the whole CriticMarkup idiom. Nothing between the operator markers may be trimmed, in the parser or in the sidebar's edit fields. The author, reason and reply texts are prose and are trimmed, which is fine because they never enter the document.

**Rebuilding the sidebar destroys state.** A redraw resets the scroll position and removes any field the user has open, including one they are typing into. Redraws are skipped when the data has not changed and while a field inside the panel has focus, and scroll position is restored across the redraws that do happen. Anything that forces a redraw on every event will feel broken. Marking the active card is done without a redraw for the same reason.

**Two equals signs in ordinary prose are indistinguishable from a delimiter.** Text that merely mentions the syntax, including a backticked one inside a sentence explaining it, used to pair with the next real annotation's opening delimiter and shift every pairing after it for the rest of the file. Whenever a pairing is rejected, for any reason, only the opening delimiter counts as consumed, so the other one gets a fresh chance to pair correctly. Rejecting a match must never consume both. The same rule now covers an ordinary highlight with nothing attached, which is rejected as not being an annotation.

**A bare highlight or comment is a plain comment.** `==text==` and `%%text%%` with nothing attached are listed, flagged `isPlain`, so nothing in a note goes unseen, and the sidebar filters them out through a saved setting. The cost is that a stray `==` on the same line as a real annotation now pairs with it, since there is no way left to tell an unintended pairing from a plain highlight. A blank line between them still breaks the pairing, and delimiters inside code or links are still skipped. In live preview they are drawn like any other comment on a span, marks hidden and a line in the gutter, so a `{==highlight==}` with nothing attached never looks different from one with a reply.

**Obsidian's strikethrough and highlight classes sit on a parent span.** A text decoration or background on a parent cannot be undone from a child span, so the rule that removes the line from a `{~~replacement~~}` targets the parent with `:has()`. A rule on our own span, however specific, never reaches it. Do not try to recolor a `{==commented span==}` either: blue on Obsidian's yellow came out green, which is why the span keeps the yellow. The chip for an annotation's author is a widget in front of the wrapper for the same reason. Outside the span there is nothing to undo, and an opaque chip would have sat as an island in the yellow, since a chip is shorter than the line box.

**The author lives inside the wrapper, terminated by `@@`.** `{--{"author":"X"}@@text--}` is the CriticMarkup plugin's metadata and `==--[X]@@text--==` the lighter form. Both are read everywhere, and the plugin writes the first in braces and the second elsewhere. The `@@` is what makes the text after it unambiguous, spaces included, which a plain `[X] ` label inside operator marks could never be. Every entry after the wrapper is a reply, each with its own author, and there is no reason concept in the data at all: the sidebar just shows the first reply prominently. An author-only footnote `^[[X]]` is an empty reply by X, never the author of the operation. Metadata fields other than `author` are carried in `authorMeta` and written back untouched when the author is edited.

**Entries attach by adjacency, and a brace comment is two things.** `{>>...<<}` directly after a wrapper is a reply to that annotation. The same thing after a space, or after plain text, is a comment on that spot. The scanners claim the attached ones first and whatever is left becomes a point comment. Reordering the scans breaks this.

**One replacement form, `~~old~>new~~`, in every wrapper.** The arrow and fused variants were dropped once the rendering removed Obsidian's strikethrough from replacements, so do not add forms other CriticMarkup tools reject. `>>note<<` is an operator too, a comment on a spot, and a wrapper with no operator is always a comment on its span.

**Obsidian never opens a highlight that starts with `>`.** Its live preview mode checks `/^[^\s>]/` after an opening `==`, so `==>>note<<==` is plain text to it and the closing `==` becomes an opener that runs to the end of the line. Reading view has no such rule. That is why a comment on a spot is braces or percent marks only, with its own setting, and why the parser skips the highlight form whole instead of consuming one mark.

**Only braces nest.** Their opening and closing marks differ, so depth can be counted. `==` and `%%` cannot nest at all, and the way to insert inside a percent mark insertion is to close and reopen it, operator included: `%%++A ++%%%%++X++%%%%++B++%%`. The insert command does this through `getInsertContext`, which also reports which operator the surrounding annotation uses so the halves stay well formed. Get this wrong and the surrounding text escapes its comment and becomes visible prose.

**Percent marks do not render inside fenced blocks**, admonitions included, so they are ignored there and the commands fall back to a highlight.

**Selecting in the editor needs focus, and reading view has no editor.** A selection made while focus is still in the sidebar is not drawn, and in reading view the CodeMirror calls act on an offscreen instance and appear to do nothing. Scroll to the line there instead. On mobile, focus raises the keyboard, so a card tap there scrolls without selecting or moving the caret. It does not close the drawer, that was tried and vetoed.

**Hidden syntax must come back under the caret.** The editor decorations hide wrapper marks, authors and reply markers with `Decoration.replace`, and every one of those is skipped for an annotation the selection touches, so there is never an invisible character being edited. Colors stay on while revealed, only the hiding stops. An annotation nested in a revealed one is revealed too, or the caret would sit in raw outer syntax around a still-drawn inner one. With chips, the outer author's chip is repeated after each directly nested annotation that has outer text behind it, since otherwise the inner chip reads as the author of everything after it. The decorations live in a `StateField`, not a `ViewPlugin`, because only state-field decorations may hide text that affects line layout. Percent marks are hidden like braces. The text inside stays in Obsidian's faint grey, and any red or green in it is mixed toward that grey rather than made transparent, because opacity on top of the grey was unreadable. A footnote reply is left to Obsidian's own footnote rendering with only its label swapped for a chip. Changing a rendering setting swaps the extensions in place and calls `workspace.updateOptions()`, since a registered extension array is reconfigured from, never replaced.

**Reading view has already been rendered when we see it.** Obsidian has turned `==` into `<mark>`, `~~` into `<del>`, `^[...]` into a footnote and dropped `%%...%%` entirely, and split anything with inline formatting across elements. The post processor restyles only what sits whole inside one text node or one `<mark>` or `<del>`, and leaves the rest raw rather than half styled. Percent mark annotations are simply absent there, which matches "hidden until approved".

**Sidebar state never goes into `data.json`.** Expanded toggles and the type filter change with every click, and each click used to rewrite the whole file from memory, so two devices kept overwriting each other's settings through sync. They live in `app.saveLocalStorage` through `saveLocalState`, and `saveSettings` writes everything else. Anything that changes with a click rather than in the settings tab belongs with them. A `data.json` that sync brings in is reloaded through `onExternalSettingsChange`, so a settings change on one device shows on the other without a restart. Note that `loadSettings` replaces the settings object, so nothing may hold on to the old one across that.

**Obsidian has no caret-moved event.** Caret tracking uses CodeMirror's update listener through `registerEditorExtension`, which fires for every editor, not just the active note. The editor is matched back to its note through the undocumented `editor.cm` on each markdown view, with a fallback to the active file if no view exposes it. After a document change the offsets are stale until the next scan, which recomputes the active card itself.

## Testing

Keep tests focused on what is cheap to check and expensive to notice by hand: parsing, the text each action produces, and the round trip between `compose.ts` and `detect.ts`. Listing what a document parses into is a good way to check a change.

Anything visual (layout, scroll, focus, clicking) is faster to check in Obsidian than to simulate, so do not build harnesses for it. The one exception already in the tree is note switching, because that failure is timing dependent and easy to miss until it is in front of a user.

When adding a test for a bug, confirm it fails against the unfixed code first. A test that passes either way is worse than none, because it looks like coverage.

## Keeping docs current

Part of finishing a change, not an afterthought:

- `README.md` for anything user facing: syntax, commands, sidebar behavior.
- `TODO.md` for what is done and what is outstanding. Tasks only, one line each. Explanations go in `ARCHITECTURE.md` or the README.
- `ARCHITECTURE.md` when the structure or a design decision changes, this file when the workflow does.
- Not the skill. That is owned outside the repo and copied in on request.
