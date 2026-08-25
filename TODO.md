# TODO

## Current Sprint

### Known gaps, accepted
- [ ] A highlight form insert nested inside another one is not detected. Highlights cannot nest. Braces do, and percent marks chain by closing and reopening, so those are the forms to use
- [ ] Anything in square brackets followed by a space at the start of a reply is read as the author, so `^[[1] see the appendix]` gets the author "1"

### Rendering, known limits
- [ ] Reading view leaves an annotation alone when its text carries inline formatting of its own, since Obsidian splits that across elements. Handling that means reassembling text across siblings
- [ ] `C:\dev\obsidian-criticmarkup` is a clone of Fevol's plugin for reference on the decorations and gutter

### Needs checking in Obsidian

The checklist with fixtures lives in the vault's Annotation Review Test note rather than here, since it changes with every release. 0.6.0 went stable with part of the editor and reading view rendering still unchecked; whatever fails there is a bug fix on the stable line.

## Future Ideas

### Agreed for a next version

- [ ] P2 **Document-end footnotes as annotations**, the `[^1]` in the text with `[^1]: content` at the bottom, which the upstream highlights plugin also accepts. Worth doing, but note it is the first annotation type whose text lives somewhere else in the file, so approve and dismiss have to edit two places at once and the definition has to be removed without disturbing the numbering of the others. Expect this to be the most invasive of the four.
- [ ] **Timestamps**, as `[Author][T1755000000]@@` and `[T1755000000]` on its own. A `T` followed by digits is always a timestamp, never an author. The CriticMarkup plugin's `time` field maps to the same thing. Read it, show it on cards, sort replies by it. Decided in format, not built.
- [ ] Reading view: reassemble text across sibling elements so an annotation with bold or a link inside it is styled rather than left raw.

## Completed Recently
- [x] A `%%>>comment<<%%` is toned down like everything else inside percent marks, text and blue background both, so it is no longer the darkest text on the loudest background in the wrapper (2026-08-25)
- [x] Text inside percent marks is no fainter than Obsidian already makes it. An extra opacity from beta.6 sat on top of Obsidian's grey, which the blue background had been masking. Red and green inside percent marks are mixed toward that grey instead. A plain `{==highlight==}` or `%%note%%` is drawn like an annotated one, marks hidden and a gutter line, rather than left raw (2026-08-25)
- [x] The span a comment is about is no longer blue, in live preview or reading view. In braces the blue sat on Obsidian's yellow and came out green, and in percent marks the fainter text already shows the span. Only the comment text is blue (2026-08-25)
- [x] One replacement form, `~~old~>new~~`, in every wrapper. The arrow and fused variants are gone, since the rendering removes Obsidian's strikethrough anyway. An unsigned `>>` comment is no longer mistaken for a plain highlight, which had kept it from rendering (2026-08-25)
- [x] `>>` is an operator, so a comment on a spot exists in every wrapper: `{>>note<<}`, `==>>note<<==`, `%%>>note<<%%`. A wrapper with no operator is always a comment on its span. That is what makes `%%note%%` unambiguous (2026-08-25)
- [x] Percent marks are an ordinary comment wrapper again: `%%span%%^[reply]` is a comment on the hidden span, the reply showing being the accepted cost. A comment on a spot is only ever `{>>note<<}`. The strikethrough on a braced replacement and the yellow under a braced comment span are removed through `:has()` on the parent span, which is where Obsidian puts those classes (2026-08-25)
- [x] Fix: braced replacements still had Obsidian's strikethrough in live preview, since Obsidian sets it from a more specific selector. Footnote replies no longer get the blue background, so a genuine footnote is never touched; being a footnote already reads as a remark, and an author underline shows when there is one (2026-08-25)
- [x] Reading view styled through a post processor with the same classes as live preview: brace syntax in text nodes, operator marks inside a highlight, braced replacements Obsidian rendered as strikethrough, and footnote labels at the bottom (2026-08-25)
- [x] Rendering reworked after the first look: comments and replies on a blue background rather than blue text or underline, a commented highlight keeps its yellow, the author as a colored line under the text or as a chip or not at all (a setting), no arrow between old and new text, percent marks hidden with fainter text, no strikethrough on a braced replacement, the theme's own red and green, a two-tone gutter for a replacement (2026-08-25)
- [x] Live preview rendering: syntax hidden and text colored like a diff, red for what goes, green for what arrives, blue for comments, with everything revealed while the caret is inside. Highlights keep their background, percent marks stay visible with fainter text, braces vanish, `~>` becomes an arrow. Brace replies show inline in blue with an author chip in front, footnote replies stay Obsidian footnotes with a blue underline and their label as a chip. Author chips after changes. A diff gutter in live preview and source mode. Three settings, one per part (2026-08-25)
- [x] No author chip on a card unless the annotation names one. Only unsigned replies say No author (2026-08-25)
- [x] The author lives inside the wrapper now, `{--{"author":"Claude"}@@text--}` in braces (the CriticMarkup plugin's metadata, so that plugin agrees on every author) and `==--[Claude]@@text--==` elsewhere, terminated by `@@` so the text keeps every space. Every entry after the wrapper is a reply; there is no reason concept anymore, the first reply is shown prominently instead. An author-only footnote is an empty reply. Other metadata fields are kept and ignored (2026-08-25)
- [x] Braces take only `{~~old~>new~~}` for a replacement, since the CriticMarkup plugin rejects the rest. Highlights and percent marks write `--old~>new++` and also read `--old--++new++` (2026-08-25)
- [x] Comment inside an annotation always adds a reply. The plus button and reason field are gone. Comment cards show no author chip unless they have one, operations show No author, replies show it when unsigned (2026-08-25)
- [x] Softer red and green on cards, mixed toward the text color. The PauseAI note and the test note fixtures were converted to the author-inside form (2026-08-25)
- [x] Fix: a hidden `%%note%%` was modeled as a comment on the hidden text, so the card showed the note as if it were selected text with no comment. It is now a comment on that spot, the Obsidian-native twin of `{>>note<<}`, with an optional `[Author]` inside and any entry after it read as a reply. Percent marks are no longer offered as the comment wrapper, since a comment cannot hide its span (2026-08-25)
- [x] Add reason folded into Comment. A comment, a reason and a reply are the same thing in different places, so one command decides by context: wrap a selection, add the reason inside an annotation, add a reply once there is one, or leave a comment on the spot with nothing selected. Selecting an annotation whole counts as being inside it (2026-08-25)
- [x] Defaults are plain CriticMarkup now, braces everywhere and `{>>...<<}` for entries, since that is the standard people arrive with. Wrappers are chosen per operation, a fallback for fenced blocks appears whenever percent marks are in use, and the channel for reasons and replies is a setting. Settings saved by the first two betas carry over as they were (2026-08-25)
- [x] Delete, Replace and Insert no longer open an empty entry. They name the author when one is set and otherwise stop at the wrapper. A reason is added with the new Add reason command, also on the right click menu whenever the caret is inside an annotation, which replaces the "Insert with a reason" and "Insert (highlight form)" commands (2026-08-25)
- [x] Diff colors on cards: deleted and replaced text in red, no strikethrough, inserted and replacement text in green. Type badge before the author chip, since the type is what varies from card to card and the louder chip should lead (2026-08-25)
- [x] Plain highlights and hidden comments, ones with nothing attached, are listed as comments with no author rather than ignored, so nothing in a note goes unseen. A filter button between the author menu and the expand toggle turns each type, No author, and plain ones on or off, and those choices are saved. The author filter is not, since it only means something within one note (2026-08-25)
- [x] Cards read top to bottom: the text, then the author chip and type badge with the line number at the far end, then the reason or comment on its own line, always below and always muted (2026-08-25)
- [x] The parser reads the CriticMarkup based grammar and nothing else: three wrappers, four operations, footnotes or brace comments for author, reason and replies, point comments, brace nesting, whitespace kept exactly as written. The old keyword syntax is gone (2026-08-25)
- [x] The commands write the new grammar, with the wrapper per operation chosen in a new settings tab. Insertions fall back to a highlight in fenced blocks and to the close and reopen form inside an existing percent mark insertion, operator included (2026-08-25)
- [x] Author chip sits at the start of the reason or comment text, not italic, and moves onto its own line when the text wraps, the way replies already did. It stays in the header when there is no reason (2026-08-25)
- [x] A line along the top of each card shows the wrapper: yellow for a highlight, gray for percent marks, purple for braces (2026-08-25)
- [x] The card under the caret is marked and scrolled into view, through CodeMirror's update listener since Obsidian has no caret event. Recomputed after every scan so it survives typing (2026-08-25)
- [x] Whitespace-only text, such as an inserted paragraph break, is described on the card rather than shown as an empty box (2026-08-25)
- [x] Replies are written in the channel of the last existing entry, so a brace comment chain stays a brace comment chain (2026-08-25)
- [x] An insertion now changes shape with its reason. The `++` markers only mark inserted text when no footnote says so, so adding a reason drops them and clearing it brings them back. Percent mark inserts keep their marks either way, since those hide the text rather than label it, and converting one would reveal hidden text and not survive a round trip (2026-08-24)
- [x] Fix: clicking a card did not select the annotation. Selecting needs the editor focused afterwards, and reading view has no visible editor at all, so it now scrolls to the line there instead (2026-08-24)
- [x] Fix: text that merely mentions the syntax, such as a backticked `==` inside a sentence explaining it, swallowed the next real annotation's opening delimiter and shifted every pairing after it. Rejecting a pairing now consumes only its opening delimiter, whatever the reason for rejecting it (2026-08-24)
- [x] Editor commands no longer open a dialog. Each writes the annotation straight into the note and leaves the caret where text is still needed (2026-08-24)
- [x] The same actions on the editor right click menu, grouped under their own divider (2026-08-24)
- [x] Command names lost the "Annotate:" prefix, and the picker is now "Choose type of annotation" (2026-08-24)
- [x] New "Insert with a reason" command, the footnote form that was missing (2026-08-24)
- [x] The default author is no longer set behind your back after using a command. Only the "Set default author" command changes it (2026-08-24)
- [x] Expanded state for replies and for admonitions is remembered across notes, tracked separately (2026-08-24)
- [x] A reason can be removed by clearing its field, taking the comma before it with it, or the whole footnote when that is all it carried (2026-08-24)
- [x] The highlighted source text is editable from the sidebar too (2026-08-24)
- [x] Clicking a card selects the whole annotation in the note rather than placing a caret (2026-08-24)
- [x] The reason and reply fields close when submitted empty, including when left at just their prefilled brackets (2026-08-24)
- [x] The replacement arrow is no longer dimmer than the comment text (2026-08-24)
- [x] Fix: switching notes could show the previous note's annotations, and the other way round. Reading a note is asynchronous and several events ask for a scan at once, so an older read could land after a newer one and overwrite it. The guard added in 0.4.6 made it worse by starting a second scan whenever a first one was still in flight. Only the newest scan can publish now, and a scan that finishes to find the note has moved on rescans by itself (2026-08-23)
- [x] Added `npm test`, covering the parsing and rewriting rules plus the note-switching races. Verified the race tests actually fail against the broken version, so they are worth something (2026-08-23)
- [x] Fix: the panel jumped to the top constantly and swallowed clicks on author chips. It rebuilt itself on every rescan, including when clicking into the sidebar counted as switching panes, which destroyed the field the click had just opened. Refreshes are now skipped when nothing changed and while a field has focus, scroll position survives the rebuilds that do happen, and switching panes only refreshes on landing on a different note (2026-08-23)
- [x] Fix: jumping to an annotation used the active leaf, which is the sidebar itself once you click a card, so the note could open on top of the panel. It now targets the main area explicitly (2026-08-23)
- [x] Fix: the comment and replace commands wrote their result with `replaceSelection` after a modal had taken focus, which risked inserting the annotation while leaving the original text in place. They now replace an explicit range captured before the modal opened (2026-08-23)
- [x] Reply field is prefilled with an author bracket, and no longer double-labels when a default author is set (2026-08-23)
- [x] Each reply has its own dismiss button, and adding a reply expands the replies list (2026-08-23)
- [x] A reply moves below its author name when it needs more than one line, and stays beside it when it fits (2026-08-23)
- [x] Tabs span the full panel width so the active underline splits it exactly in half. Obsidian's own view padding was insetting them (2026-08-23)
- [x] Approve, Dismiss and the filter buttons are genuinely shorter now. Obsidian gives buttons a fixed height, so the earlier padding change had no visible effect (2026-08-23)
- [x] Sidebar now reads from the open editor instead of from disk, so it updates while you type instead of waiting for Obsidian's autosave. Writes go through the editor too, so they join the undo history and never overwrite unsaved typing (2026-08-23)
- [x] Core plugin: detection, approve/dismiss, sidebar, install via BRAT (2026-08-23)
