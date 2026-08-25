# Annotation Review

An Obsidian plugin that finds text annotations in a note, lists them in a sidebar, and rewrites the note when one is approved or dismissed. Distributed through BRAT rather than the community plugin store.

## Codebase map

Read this before grepping. Each file owns one job, and most questions are answered by opening the right one.

| File | Responsibility |
| --- | --- |
| `main.ts` | Plugin entry point. Event wiring, scanning the active note, reading and writing files, the editor commands, caret tracking. |
| `src/detect.ts` | Parsing. Turns note text into `Annotation` and `AdmonitionBlock` objects, and records where every editable piece sits. The grammar is described at the top of the file. |
| `src/compose.ts` | Writing. The syntax for each annotation type, used by the editor commands. |
| `src/actions.ts` | Rewriting. Works out what text changes for an approve, dismiss, edit, reply, or removal. Pure functions, no Obsidian imports. |
| `src/view.ts` | The sidebar. All rendering and interaction. |
| `src/settings.ts` | The settings tab and the settings shape. |
| `src/modals.ts` | The author prompt and the annotation type picker. |
| `src/types.ts` | Shared types. Start here to understand the data model. |
| `tests/` | Parsing and rewriting tests, plus note-switching behaviour. The two stubs stand in for Obsidian and CodeMirror. |
| `skills/annotation-review/SKILL.md` | The syntax reference for whoever writes the annotations, human or AI. Maintained by the repo owner, from a master copy in their vault. Do not edit it here. |

`detect.ts` and `compose.ts` are two halves of the same contract: one writes the syntax, the other reads it. Change one and the round-trip tests in `tests/detect.mjs` will tell you if they no longer agree.

## Commands

```
npm install
npm run build     # type check, then bundle to main.js
npm test          # parsing, rewriting, and note-switching tests
npm run dev       # rebuild on save
```

Run `npm test` before proposing a release. It is fast and needs no Obsidian.

## Releases

Every change ships as a **pre-release** first, so nothing is labelled a real version until it has been used and found to work.

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

**A bare highlight or comment is a plain comment.** `==text==` and `%%text%%` with nothing attached are listed, flagged `isPlain`, so nothing in a note goes unseen, and the sidebar filters them out through a saved setting. The cost is that a stray `==` on the same line as a real annotation now pairs with it, since there is no way left to tell an unintended pairing from a plain highlight. A blank line between them still breaks the pairing, and delimiters inside code or links are still skipped.

**Percent marks with no operator are a comment on a spot, not on a span.** The hidden text is the remark itself, since nobody sees it, so `%%note%%` is the Obsidian-native twin of `{>>note<<}`, may start with `[Author]` the same way, and any entry after it is a reply. Treating it as a span comment showed the hidden text on the card as if it were selected text. With an operator inside, `%%--text--%%`, the percent marks are an ordinary wrapper again.

**Entries attach by adjacency, and a brace comment is two things.** `{>>...<<}` directly after a wrapper is that annotation's author and reason, or a reply. The same thing after a space, or after plain text, is a comment on that spot. The scanners claim the attached ones first and whatever is left becomes a point comment. Reordering the scans breaks this.

**Only braces nest.** Their opening and closing marks differ, so depth can be counted. `==` and `%%` cannot nest at all, and the way to insert inside a percent mark insertion is to close and reopen it, operator included: `%%++A ++%%%%++X++%%%%++B++%%`. The insert command does this through `getInsertContext`, which also reports which operator the surrounding annotation uses so the halves stay well formed. Get this wrong and the surrounding text escapes its comment and becomes visible prose.

**Percent marks do not render inside fenced blocks**, admonitions included, so they are ignored there and the commands fall back to a highlight.

**Selecting in the editor needs focus, and reading view has no editor.** A selection made while focus is still in the sidebar is not drawn, and in reading view the CodeMirror calls act on an offscreen instance and appear to do nothing. Scroll to the line there instead.

**Obsidian has no caret-moved event.** Caret tracking uses CodeMirror's update listener through `registerEditorExtension`, which fires for every editor, not just the active note. The editor is matched back to its note through the undocumented `editor.cm` on each markdown view, with a fallback to the active file if no view exposes it. After a document change the offsets are stale until the next scan, which recomputes the active card itself.

## Testing

Keep tests focused on what is cheap to check and expensive to notice by hand: parsing, the text each action produces, and the round trip between `compose.ts` and `detect.ts`. Listing what a document parses into is a good way to check a change.

Anything visual (layout, scroll, focus, clicking) is faster to check in Obsidian than to simulate, so do not build harnesses for it. The one exception already in the tree is note switching, because that failure is timing dependent and easy to miss until it is in front of a user.

When adding a test for a bug, confirm it fails against the unfixed code first. A test that passes either way is worse than none, because it looks like coverage.

## Keeping docs current

Part of finishing a change, not an afterthought:

- `README.md` for anything user facing: syntax, commands, sidebar behaviour.
- `TODO.md` for what is done, what is outstanding, and what still needs checking in Obsidian.
- This file when the architecture or the workflow changes.
- Not the skill. That is owned outside the repo and copied in on request.
