# TODO

## Current Sprint

### Known gaps, accepted
- [ ] A highlight form insert nested inside another one is not detected. Highlights cannot nest. Braces do, and percent marks chain by closing and reopening, so those are the forms to use
- [ ] Anything in square brackets followed by a space at the start of a reply is read as the author, so `^[[1] see the appendix]` gets the author "1"

### Rendering, known limits
- [ ] With underlines, an empty insertion or an empty comment has no text to underline and is invisible in the editor until the caret touches it. It still shows in the sidebar. Accepted as the cost of underlines
- [ ] Reading view leaves an annotation alone when its text carries inline formatting of its own, since Obsidian splits that across elements. Handling that means reassembling text across siblings
- [ ] `C:\dev\obsidian-criticmarkup` is a clone of Fevol's plugin for reference on the decorations and gutter

### Needs checking in Obsidian

The checklist with fixtures lives in the vault's Annotation Review Test note rather than here, since it changes with every release. 0.6.0 went stable with part of the editor and reading view rendering still unchecked. Whatever fails there is a bug fix on the stable line.

## Future Ideas

### Agreed for a next version

- [ ] P2 **Document-end footnotes as annotations**, the `[^1]` in the text with `[^1]: content` at the bottom, which the upstream highlights plugin also accepts. Worth doing, but note it is the first annotation type whose text lives somewhere else in the file, so approve and dismiss have to edit two places at once and the definition has to be removed without disturbing the numbering of the others. Expect this to be the most invasive of the four.
- [ ] **Timestamps**, as `[Author][T1755000000]@@` and `[T1755000000]` on its own. A `T` followed by digits is always a timestamp, never an author. The CriticMarkup plugin's `time` field maps to the same thing. Read it, show it on cards, sort replies by it. Decided in format, not built.
- [ ] Reading view: reassemble text across sibling elements so an annotation with bold or a link inside it is styled rather than left raw.

## Completed Recently
- [x] The gutter strip is back and the text still lines up with the note title. The strip keeps its width and the container is pulled into the page margin, since CodeMirror cuts off anything leaning out of a gutter and pins the container in place (2026-08-28)
- [x] A field opened in the sidebar on a phone is brought clear of the keyboard by the smallest scroll that shows it, with room added at the end of the list only when the list cannot scroll that far by itself. The move is our own scrollTop, repeated while the keyboard slides open, since Obsidian resizes the app around it and undoes a scroll made during that (2026-08-28)
- [x] The gutter takes no room at all, in any note. Obsidian puts it inside the note's own column, so any width there indented every line while the note title stayed put. The strip is drawn in the page margin instead (2026-08-28)
- [x] A field opened in the sidebar on a phone is kept clear of the on-screen keyboard, so the last card can be edited too (2026-08-28)
- [x] On a phone an approve or a dismiss brings the change on screen when it is off screen, and leaves the note alone when the change is already in view (2026-08-28)
- [x] Approving or dismissing on a phone no longer throws the note to the caret, usually the start. The change goes straight to CodeMirror there, which adds no scroll, and a card tap now sets the caret on the annotation without focusing, so the keyboard stays down. Desktop behavior is unchanged (2026-08-28)
- [x] The gutter takes room only while the note holds an annotation that draws a line, so a note with none is no longer shifted right by an empty strip. Bare selections and admonitions do not count (2026-08-27)
- [x] The gaps are 0.125em, two pixels at the default size, about half a space (2026-08-26)
- [x] Every gap around a chip or a brace comment is 0.19em of the surrounding text, three pixels at the default size, scaled on chips to match, and a spot comment with a chip in front no longer stacks its own gap on the chip (2026-08-26)
- [x] A comment on a spot gets the gap in front as well, the gaps are two pixels like the chip gap, and the mobile swatch is square (2026-08-26)
- [x] A change's own author's first comment shows under the text as the reason, with no chip. A comment by someone else, or on an unauthored change, stays a comment with a chip. A brace comment gets the small gap after it too, for text that follows directly (2026-08-26)
- [x] The black-or-white text rule is fitted by eye: black starts reading better than white on orange at 80% opacity, green 78%, red 57%, blue 55% over a light page, one rule for chips and badges (2026-08-26)
- [x] A nested annotation is left out of the outer card's text in the sidebar, since it has its own card. Editing the text shows the raw text with the nested syntax, so what is edited is what is in the note (2026-08-26)
- [x] An author color row on mobile keeps the name field, the full chip, the picker and the trash button on one line. Obsidian had stretched the name field to the full width (2026-08-26)
- [x] One black-or-white bar for chips and badges, YIQ 150, in place of the split that made the two disagree (2026-08-26)
- [x] Badge text stays white at full strength, orange included, turning black only once the badge fades toward the page. The comments line on a card is the faint text color, visible on a hovered card without reading as black (2026-08-26)
- [x] The sidebar's reply button is a Comment button beside Approve and Dismiss, in the icon-button style with the message-square-plus icon, the line number at the far end of that row. Labels drop as the card narrows, Comment first. Nothing in the sidebar is called a reply anymore (2026-08-26)
- [x] A new author color row gets its picker once the name is committed, starting at that name's computed color. Setting the native picker from code fired its change and froze the first letter's color (2026-08-26)
- [x] Black or white text on chips and badges by the YIQ brightness rule instead of LCH lightness, so a saturated green keeps white text. Bare selections get no gutter line. The comments line in a card matches the muted text (2026-08-26)
- [x] Text on author chips and type badges is black or white, whichever reads against the fill as it shows at the chosen opacity, never grey. One solid author color feeds the chip, the underline and the picker, so adding an author with the offered color changes nothing on screen (2026-08-26)
- [x] Insert with nothing selected writes an empty insertion with the caret inside, from the command and the right click menu, like a comment on a spot (2026-08-26)
- [x] An unsigned comment on a selection shows no author chip. Only a reply says No author (2026-08-26)
- [x] Nested braces: putting the caret in the outer annotation reveals the nested ones too, and with chips the outer author's chip returns after each nested annotation, so the rest of the outer text is not read as the inner author's (2026-08-26)
- [x] A comment on a spot is braces or percent marks, chosen in its own setting under Wrappers. Obsidian never opens a highlight that starts with `>`, so `==>>note<<==` cannot render, is no longer read, and is skipped whole. The Comment command falls back to braces where needed (2026-08-26)
- [x] Sidebar: a comment on a selection reads like a comment on a spot with the selected text above it, its first reply being the comment and that reply's author in the header. A bare selection shows no badge, and the filter calls them bare selections (2026-08-26)
- [x] The right click menu says Comment, not Reply, on a selection that has no comment yet (2026-08-26)
- [x] A brace reply gets a gap smaller than a space in front of its chip or text, in live preview and reading view, so it no longer touches the text it follows (2026-08-26)
- [x] Authors on comments and replies is one setting covering comments on a selection, on a spot, and replies. Authors on changes covers the three operations (2026-08-26)
- [x] Opacity settings for author chips and type badges, applied everywhere through CSS variables on the body, and a chip preview in each author color row between the name and the picker (2026-08-26)
- [x] The mobile color picker is a modal: a preview chip with the name and a square of the plain color beside it, three full-width gradient sliders with labels and a thumb showing the current color, a hex field and Done. The first version sat loose between the settings cards with sliders clamped to a third of the width (2026-08-26)
- [x] A slider color picker on mobile, hue, saturation and lightness with a swatch and a hex field, in place of the system color input there. Desktop keeps the native picker (2026-08-25)
- [x] On mobile, tapping a card scrolls the note to the annotation without selecting it or moving the caret, so the keyboard stays down. Closing the drawer as well was tried in beta.6 and dropped (2026-08-25)
- [x] The sidebar's edit box and reply field size themselves to their text and grow while typing, so a long annotation is edited in a box that shows all of it (2026-08-25)
- [x] Settings that sync brings in are reloaded and redrawn on arrival, through Obsidian's external settings change hook, rather than at the next restart (2026-08-25)
- [x] The chip for an annotation's author is a widget in front of the wrapper, outside Obsidian's highlight, strikethrough or comment span, so it gets no yellow, no line and no grey. Reading view moves the chip in front of the `<mark>` too. Reply chips stay marks on the name, so they still shrink in a footnote (2026-08-25)
- [x] The author style is two settings, one for changes and one for comments on a span and replies, a comment on a spot counting as a change. Chips inside a `~~replacement~~` no longer inherit Obsidian's strikethrough (2026-08-25)
- [x] Author colors in settings: a row per author with a color picker, winning over the computed color in the sidebar, live preview and reading view. A new row's picker follows the name until touched (2026-08-25)
- [x] Fix: settings did not survive sync between devices. Every expand toggle and filter click rewrote data.json from memory, so the last device to click overwrote the other's settings. That state is per device now, and keys left over from old versions are dropped from data.json (2026-08-25)
- [x] A `%%>>comment<<%%` keeps its text in Obsidian's hidden-text grey and only its blue background is toned down, to the same strength as the red and green inside percent marks. Lifting the text as well made it far brighter than the text around it (2026-08-25)
- [x] Text inside percent marks is no fainter than Obsidian already makes it. An extra opacity from beta.6 sat on top of Obsidian's grey, which the blue background had been masking. Red and green inside percent marks are mixed toward that grey instead. A plain `{==highlight==}` or `%%note%%` is drawn like an annotated one, marks hidden and a gutter line, rather than left raw (2026-08-25)
- [x] The span a comment is about is no longer blue, in live preview or reading view. In braces the blue sat on Obsidian's yellow and came out green, and in percent marks the fainter text already shows the span. Only the comment text is blue (2026-08-25)
- [x] One replacement form, `~~old~>new~~`, in every wrapper. The arrow and fused variants are gone, since the rendering removes Obsidian's strikethrough anyway. An unsigned `>>` comment is no longer mistaken for a plain highlight, which had kept it from rendering (2026-08-25)
- [x] `>>` is an operator, so a comment on a spot exists in every wrapper: `{>>note<<}`, `==>>note<<==`, `%%>>note<<%%`. A wrapper with no operator is always a comment on its span. That is what makes `%%note%%` unambiguous (2026-08-25)
- [x] Percent marks are an ordinary comment wrapper again: `%%span%%^[reply]` is a comment on the hidden span, the reply showing being the accepted cost. A comment on a spot is only ever `{>>note<<}`. The strikethrough on a braced replacement and the yellow under a braced comment span are removed through `:has()` on the parent span, which is where Obsidian puts those classes (2026-08-25)
- [x] Fix: braced replacements still had Obsidian's strikethrough in live preview, since Obsidian sets it from a more specific selector. Footnote replies no longer get the blue background, so a genuine footnote is never touched. Being a footnote already reads as a remark, and an author underline shows when there is one (2026-08-25)
- [x] Reading view styled through a post processor with the same classes as live preview: brace syntax in text nodes, operator marks inside a highlight, braced replacements Obsidian rendered as strikethrough, and footnote labels at the bottom (2026-08-25)
- [x] Rendering reworked after the first look: comments and replies on a blue background rather than blue text or underline, a commented highlight keeps its yellow, the author as a colored line under the text or as a chip or not at all (a setting), no arrow between old and new text, percent marks hidden with fainter text, no strikethrough on a braced replacement, the theme's own red and green, a two-tone gutter for a replacement (2026-08-25)
- [x] Live preview rendering: syntax hidden and text colored like a diff, red for what goes, green for what arrives, blue for comments, with everything revealed while the caret is inside. Highlights keep their background, percent marks stay visible with fainter text, braces vanish, `~>` becomes an arrow. Brace replies show inline in blue with an author chip in front, footnote replies stay Obsidian footnotes with a blue underline and their label as a chip. Author chips after changes. A diff gutter in live preview and source mode. Three settings, one per part (2026-08-25)
- [x] No author chip on a card unless the annotation names one. Only unsigned replies say No author (2026-08-25)
- [x] The author lives inside the wrapper now, `{--{"author":"Claude"}@@text--}` in braces (the CriticMarkup plugin's metadata, so that plugin agrees on every author) and `==--[Claude]@@text--==` elsewhere, terminated by `@@` so the text keeps every space. Every entry after the wrapper is a reply. There is no reason concept anymore, the first reply is shown prominently instead. An author-only footnote is an empty reply. Other metadata fields are kept and ignored (2026-08-25)
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
