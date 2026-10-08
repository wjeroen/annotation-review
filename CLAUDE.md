# Annotation Review

An Obsidian plugin that finds text annotations in a note, lists them in a sidebar, and rewrites the note when one is approved or dismissed. Distributed through BRAT.

`ARCHITECTURE.md` has the codebase map, the design reasons, and under Pitfalls the bugs behind the rules below. Read it before grepping.

## Commands

```
npm install
npm run build     # type check, then bundle to main.js
npm test          # parsing, rewriting, and note-switching tests
npm run dev       # rebuild on save
```

## Rules

- `detect.ts` reads the syntax and `compose.ts` writes it. The round-trip tests in `tests/detect.mjs` must keep passing.
- Read and write a note through its open editor when there is one (`readContent`, `applyMutation`).
- Only the newest scan may publish (`rescanActiveFile`). Do not try to predict which events matter.
- Spans are relative to the annotation's own text, never absolute file offsets.
- Never trim text between operator marks, in the parser or in the sidebar's edit fields.
- Never force a sidebar redraw on every event. Mark the active card without a redraw.
- A rejected pairing consumes only its opening delimiter, never both.
- Find a closing mark or a `~>` by walking forward past code, links, HTML comments and entry text, never by the nearest match. `getInsertContext` steps over the same ranges.
- Claim attached entries before point comments. Do not reorder the scans.
- One replacement form, `~~old~>new~~`. Do not add forms other CriticMarkup tools reject.
- A comment on a spot is braces or percent marks, never a highlight starting with `>`.
- Insert inside a percent mark insertion by closing and reopening it, operator included.
- Never hide syntax under the caret. Decorations that hide text live in a `StateField`.
- Style Obsidian's strikethrough and highlight through their parent with `:has()`. Do not recolor a commented span.
- Sidebar state that changes with a click goes through `saveLocalState`, never into `data.json`.
- On a phone, a card tap never focuses the editor and never closes the drawer.
- Open notes through `openNote`, which handles tab plugins.
- A patch script that writes code through a raw template must never escape a `${`. Read the diff of generated code, not only the exit status.
- Check the build's own exit status, never through a pipe.
- The skill in `skills/annotation-review/SKILL.md` is maintained outside this repo. Do not edit it here.

## Releases

- Every change ships as a pre-release first: `0.6.0-beta.1`, `0.6.0-beta.2`, and so on. No approval needed for these.
- Promoting to stable needs explicit approval from the maintainer. Ask first whether the skill describes the shipped syntax.
- Never bump a version or push a release as a side effect of finishing code.
- Run `npm test` before proposing a release.
- Attach `main.js`, `manifest.json` and `styles.css` to each release. Keep the version in `manifest.json`, `package.json` and `package-lock.json` in step.

## Testing

- Test what is cheap to check and expensive to notice by hand: parsing, the text each action produces, and the compose and detect round trip.
- No harnesses for visual behavior. Note switching is the one exception.
- A test for a bug must fail on the unfixed code first.

## Keeping docs current

- `README.md` for anything user facing.
- `TODO.md` for tasks only, one line each.
- `ARCHITECTURE.md` for structure, design decisions and pitfalls. This file holds rules only.
- Not the skill.
