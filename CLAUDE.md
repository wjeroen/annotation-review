# Annotation Review

An Obsidian plugin that finds text annotations in a note, lists them in a sidebar, and rewrites the note when one is approved or dismissed. Distributed through BRAT rather than the community plugin store.

## Codebase map

Read this before grepping. Each file owns one job, and most questions are answered by opening the right one.

| File | Responsibility |
| --- | --- |
| `main.ts` | Plugin entry point. Event wiring, scanning the active note, reading and writing files, the editor commands, settings. |
| `src/detect.ts` | Parsing. Turns note text into `Annotation` and `AdmonitionBlock` objects, and records where every editable piece sits. |
| `src/compose.ts` | Writing. The syntax for each annotation type, used by the editor commands. |
| `src/actions.ts` | Rewriting. Works out what text changes for an approve, dismiss, edit, reply, or removal. Pure functions, no Obsidian imports. |
| `src/view.ts` | The sidebar. All rendering and interaction. |
| `src/modals.ts` | Dialogs used by the editor commands. |
| `src/types.ts` | Shared types. Start here to understand the data model. |
| `tests/` | Parsing and rewriting tests, plus note-switching behaviour. |
| `markdown-annotations.md` | The syntax reference for whoever writes the annotations, human or AI. Two halves of one contract with `detect.ts`, so changing either means checking the examples in it still parse. |

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

- Bump the beta suffix for each change: `0.5.0-beta.1`, `0.5.0-beta.2`, and so on. No approval needed for these.
- Promoting a version to stable (dropping the `-beta.N` suffix) **requires explicit approval from the maintainer.** Do not do it because a change looks finished or because the tests pass.
- Never bump a version or push a release as a side effect of finishing some code. Publishing is a separate decision, and asking costs nothing.

Pre-releases sort below their own stable version and above the previous one, so `0.4.7` then `0.5.0-beta.1` then `0.5.0` is the expected sequence. BRAT picks the highest semantic version it finds, whether or not it is flagged as a pre-release, so a pre-release does reach installed devices.

Publishing a release means attaching `main.js`, `manifest.json` and `styles.css` as assets, since that is what BRAT downloads. Keep the version in `manifest.json` and `package.json` in step.

## Things that will bite you

These are all real bugs that shipped once. The comments in the code explain the fixes, but the short version:

**A note being edited does not match the file on disk.** Obsidian holds keystrokes in memory and writes them out a second or two later, so `vault.read()` returns stale text for any note that is open. Read through the open editor when there is one, and write through it too, which also keeps changes in the undo history and avoids overwriting unsaved typing. `main.ts` has `readContent` and `applyMutation` for this.

**Scanning is asynchronous and several events request it at once.** Switching notes fires more than one event, and an older read finishing after a newer one used to leave the panel showing a different note's annotations. Only the newest scan may publish its result, which is what the scan token in `rescanActiveFile` is for. Do not add cleverness that tries to predict which events are worth reacting to. A scan that finds nothing new does not redraw anything, so redundant scans are cheap.

**Spans are relative to an annotation's own text, never absolute file offsets.** Typing anywhere earlier in the note shifts every offset after it. Editing works by locating the annotation's text first, then applying the span to wherever it actually landed. Absolute offsets recorded at scan time are stale almost immediately.

**Rebuilding the sidebar destroys state.** A redraw resets the scroll position and removes any field the user has open, including one they are typing into. Redraws are skipped when the data has not changed and while a field inside the panel has focus, and scroll position is restored across the redraws that do happen. Anything that forces a redraw on every event will feel broken.

**Two equals signs in ordinary prose are indistinguishable from a delimiter.** Text that merely mentions the syntax, including a backticked one inside a sentence explaining it, used to pair with the next real annotation's opening delimiter and shift every pairing after it for the rest of the file. Whenever a pairing is rejected, whether for spanning a blank line or for having a delimiter inside code, only the opening delimiter counts as consumed, so the other one gets a fresh chance to pair correctly. Rejecting a match must never consume both.

**The `++` markers belong only to insertions without a footnote.** They exist to say a highlight is an insertion when nothing else does, so an insertion that gains a reason drops them and one that loses its reason gets them back. Percent mark inserts are different: their marks hide the text rather than label it, so they stay either way. Rewriting one into a highlight would reveal hidden text and would not survive clearing the reason again.

**Selecting in the editor needs focus, and reading view has no editor.** A selection made while focus is still in the sidebar is not drawn, and in reading view the CodeMirror calls act on an offscreen instance and appear to do nothing. Scroll to the line there instead.

**Percent marks do not render inside fenced blocks.** Inserts use `%%text%%` normally, `==++text++==` inside a fenced block, and the doubled `%%%%text%%%%` when nesting inside an existing insert, where the surrounding comment has to close and reopen. Get this wrong and the surrounding text escapes its comment and becomes visible prose.

## Testing

Keep tests focused on what is cheap to check and expensive to notice by hand: parsing, the text each action produces, and the round trip between `compose.ts` and `detect.ts`. Listing what a document parses into is a good way to check a change.

Anything visual (layout, scroll, focus, clicking) is faster to check in Obsidian than to simulate, so do not build harnesses for it. The one exception already in the tree is note switching, because that failure is timing dependent and easy to miss until it is in front of a user.

When adding a test for a bug, confirm it fails against the unfixed code first. A test that passes either way is worse than none, because it looks like coverage.

## Keeping docs current

Part of finishing a change, not an afterthought:

- `README.md` for anything user facing: syntax, commands, sidebar behaviour.
- `TODO.md` for what is done, what is outstanding, and what still needs checking in Obsidian.
- This file when the architecture or the workflow changes.
