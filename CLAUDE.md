# Annotation Review

An Obsidian plugin that finds text annotations in a note, lists them in a sidebar, and rewrites the note when one is approved or dismissed. Distributed through BRAT.

`ARCHITECTURE.md` has the codebase map, the design reasons, and under Pitfalls the bugs that shaped the code. Read it before grepping, and read the pitfalls for any part you change.

## Commands

```
npm install
npm run build     # type check, then bundle to main.js
npm test          # parsing, rewriting, and note-switching tests
npm run dev       # rebuild on save
```

## Rules

These protect the user's notes, settings and releases. Everything else is explained under Pitfalls in `ARCHITECTURE.md`, and most of it is guarded by the tests.

- Read and write a note through its open editor when there is one (`readContent`, `applyMutation`).
- Never trim text between operator marks, in the parser or in the sidebar's edit fields.
- Sidebar state that changes with a click goes through `saveLocalState`, never into `data.json`.
- The skill in `skills/annotation-review/SKILL.md` is maintained outside this repo. Do not edit it here.
- Check the build's own exit status, never through a pipe. A patch script that writes code through a raw template must never escape a `${`, so read the diff of generated code, not only the exit status.

## Releases

- Every finished change ships as a pre-release: `0.8.0-beta.5`, `0.8.0-beta.6`, and so on. A pre-release needs no approval. Bump the version, commit, push and publish it without asking. This overrides any general habit of asking before a push or a version bump.
- A stable version is never a side effect of finishing code. It needs explicit approval from the maintainer. Ask first whether the skill describes the shipped syntax.
- Run `npm test` before every release.
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
