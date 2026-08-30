---
name: markdown-annotations
description: Always read this skill when leaving comments and suggestions on something the user wrote in a Markdown file, built for the Annotation Review Obsidian plugin.
---
# How it works

Every annotation appears in a sidebar through an Obsidian plugin called Annotation Review. Each operation is either dismissed or approved. Comments can only be dismissed.

Dismissing always returns the text to how it was before the annotation: dismissing a comment, deletion or replacement leaves the original text in place without any markup, dismissing an insertion removes the inserted text. In every case the markup, the author and the replies disappear with it.

Approving a replacement swaps the old text for the new text. Approving a deletion removes the text. Approving an insertion keeps the inserted text. In every case the markup, the author and the replies disappear with it.

The syntax is CriticMarkup, extended in two ways: the same markers can be wrapped in Obsidian highlights or comment marks instead of braces, and every annotation can carry an author and replies.

### The grammar

An annotation is a wrapper, an operator, optional metadata (like the author), and any number of replies:

```
<wrapper> <operator> <metadata>@@ text <operator> </wrapper> <reply>*
```

- The wrapper decides how the note shows the text: `{...}` shows it as it is, which is plain CriticMarkup, `==...==` highlights it, `%%...%%` hides it until approved.
- The operator decides the operation: `--text--` deletes, `++text++` inserts, `~~old~>new~~` replaces, `>>note<<` is a comment on that spot. The latter doesn't work with `==` highlight operators.
- Metadata goes right after the opening operator marks, ended by `@@`. Everything after `@@` is the text, spaces included. With highlights and percent marks, metadata is separated using colons, and metadata other than the author uses a single letter with digits. With braces, metadata uses fields instead. So the order of the metadata does not matter and a normal name is never taken for one. Currently the plugin accepts two types of metadata: Authors and linked annotations.
	- Authors: Inside braces write `{"author":"Claude"}@@`, so other CriticMarkup tools read it too. Inside highlights and percent marks write `[Claude]@@`.
	- Linked annotations: `[Claude:L3]@@` puts the annotation in a linked set labeled "3", and `[L3]@@` does the same with nobody signing it. Inside braces: `{"author":"Claude","link":3}@@`. See Linked annotations below.
- Replies are footnotes `^[...]` or CriticMarkup comments `{>>...<<}` placed directly after the wrapper, with no space in between. Sign a footnote with `[Claude]` followed by a space at its start, and a CriticMarkup comment with `{"author":"Claude"}@@`.

An annotation is authored by the author inside its wrapper, or by nobody. Every entry after the wrapper is a reply, whoever wrote it, and the reason for a change is simply its first reply. An author-only reply such as `^[[Claude]]` is an empty reply by Claude and nothing more.

Before you start, ask the user which wrapper they want and whether you should label yourself. Without an answer, use plain CriticMarkup, braces with `{>>...<<}` replies, since that is what other CriticMarkup tools read, and label yourself.

# Annotations

## Comments

A comment is on a selection or on a spot.

### On a selection

Wrap the selected text with no operator inside. That only marks the selection, so what you want to say goes in a signed reply right after it. Sign the reply, not the selected text's wrapper. An author inside the wrapper only records who made the selection, and says nothing.

With author:

- {==This is a test==}{>>{"author":"Claude"}@@What is it a test of?<<}
- ==This is a test==^[[ChatGPT] What is it a test of?]
- %%This is a test%%^[[Gemini] What is it a test of?]

No author:

- {==This is a test==}{>>What is it a test of?<<}
- ==This is a test==^[What is it a test of?]

### On a spot

Nothing selected. The `>>` operator, with the author inside like any other operation:

- This is a test. {>>{"author":"Claude"}@@Consider a transition here.<<}
- This is a test. %%>>[Gemini]@@Consider a transition here.<<%%

No author:

- This is a test. {>>Consider a transition here.<<}
- This is a test. %%>>Consider a transition here.<<%%

Obsidian never opens a highlight that starts with `>`, so comments on a spot can't be written with `==` highlights. Check whether the user prefers to use percent marks or braces instead.

### Bare selections

A selection with nothing attached. Nothing is known beyond the selection itself. It may be a highlight the user made for themselves, hidden text, or a comment nobody finished. The plugin lists it so it is not overlooked. Leave it alone unless the user asks about it:

- {==This is a test==}
- ==This is a test==
- %%This is a test%%

## Delete text

No author, no reply:

- This is {--is --}a test.
- This is ==--is --==a test.
- This is %%--is --%%a test.

With author:

- This is {--{"author":"Claude"}@@is --}a test.
- This is ==--[ChatGPT]@@is --==a test.
- This is %%--[Gemini]@@is --%%a test.

With author and a reply giving the reason:

- This is {--{"author":"Claude"}@@is --}{>>{"author":"Claude"}@@The word is repeated.<<}a test.
- This is ==--[ChatGPT]@@is --==^[[ChatGPT] The word is repeated.]a test.
- This is %%--[Gemini]@@is --%%^[[Gemini] The word is repeated.]a test.

No author, signed reply. Nothing says who did the operation:

- This is {--is --}{>>{"author":"Joe"}@@The word is repeated.<<}a test.
- This is ==--is --==^[[Joe] The word is repeated.]a test.
- This is %%--is --%%^[[Gemini] The word is repeated.]a test.

## Replace text

Known in CriticMarkup as substitutions. The old text, the arrow, then the new text, in every wrapper.

No author, no reply:

- This {~~isn't~>is~~} a test.
- This ==~~isn't~>is~~== a test.
- This %%~~isn't~>is~~%% a test.

With author:

- This {~~{"author":"Claude"}@@isn't~>is~~} a test.
- This ==~~[ChatGPT]@@isn't~>is~~== a test.
- This %%~~[Gemini]@@isn't~>is~~%% a test.

With author and a reply giving the reason:

- This {~~{"author":"Claude"}@@isn't~>is~~}{>>{"author":"Claude"}@@Wrong, this is in fact a test.<<} a test.
- This ==~~[ChatGPT]@@isn't~>is~~==^[[ChatGPT] Wrong, this is in fact a test.] a test.
- This %%~~[Gemini]@@isn't~>is~~%%^[[Gemini] Wrong, this is in fact a test.] a test.

## Insert text

Known in CriticMarkup as additions. Percent marks hide the insertion until it is approved, and an insertion can span several paragraphs.

No author, no reply:

- This {++is ++}a test.
- This ==++is ++==a test.
- This %%++is ++%%a test.

With author:

- This {++{"author":"Claude"}@@is ++}a test.
- This ==++[ChatGPT]@@is ++==a test.
- This %%++[Gemini]@@is ++%%a test.

With author and a reply giving the reason:

- This {++{"author":"Claude"}@@is ++}{>>{"author":"Claude"}@@The word was missing.<<}a test.
- This ==++[ChatGPT]@@is ++==^[[ChatGPT] The word was missing.]a test.
- This %%++[Gemini]@@is ++%%^[[Gemini] The word was missing.]a test.

Braces nest, so an insertion inside an insertion works there:

- {++{"author":"Claude"}@@I went to my grandma's house. {++{"author":"ChatGPT"}@@She has been living there for over 5 decades. ++}She's been thinking of moving out.++}

Highlights and percent marks cannot nest. To insert inside text that is already inside percent marks, close and reopen them, operator included. This reads as three insertions in a row:

- %%++[Claude]@@I went to my grandma's house. ++%%%%++[ChatGPT]@@She has been living there for over 5 decades. ++%%%%++[Claude]@@She's been thinking of moving out.++%%

With highlights, two pairs of equal signs touching each other do not render properly in Obsidian. So pay special attention to spaces. Here, the spacing renders exactly as the above two examples:

- ==++[Claude]@@I went to my grandma's house.++== ==++[ChatGPT]@@She has been living there for over 5 decades.++== ==++[Claude]@@She's been thinking of moving out.++==

## Replies

Replies follow one another with no space in between, and there can be any number of them:

- The old plan was ==--[Claude]@@to launch in Q1--==^[[Claude] Timeline slipped.]^[[Alex] Q1 still works if we cut scope.]^[[Claude] Fair, restoring the reasoning below.] and that's final.
- This is a test. %%>>[Alex]@@Consider a transition here.<<%%^[[Jack] Seems like a poor moment for a transition.]^[[Alex] You're right.]

Plain CriticMarkup:

- {--{"author":"Gemini"}@@Drop this.--}{>>{"author":"Gemini"}@@It repeats the intro.<<}{>>{"author":"Joe"}@@Agreed.<<}

CriticMarkup with footnote replies is also allowed:

- {--{"author":"Gemini"}@@Drop this.--}^[[Gemini] It repeats the intro.]^[[Joe] Agreed.]

Approving or dismissing takes the replies with it, since they belong to the annotation rather than standing on their own. Replies always sit outside the wrapper: a footnote inside a percent or highlight wrapper breaks rendering.

## Linked annotations

Two or more changes that only make sense together carry the same link. The sidebar then shows them side by side, however far apart they sit in the note, under one header that approves or dismisses all of them at once.

**Use a link only when approving one of the changes on its own would leave the text wrong.** If each change can stand by itself, never link them. A reader can still take a linked set apart on purpose, so a link is a statement about the text, not a lock.

Cases where a link is right:

- **Moving text.** A deletion in one place and an insertion in another. Keeping only one either loses the text or says it twice.
- **A heading added in several places.** One new heading without the others leaves the document half restructured.
- **Renumbering.** Changing 3 into 4 only works if 4 becomes 5 as well.
- **Renaming a word everywhere in the document.** Accepting only some leaves the document inconsistent.
- Anything else where one change without the other(s) is worse than neither.

Write the link as a number, counted per note, on every change in the set:

- {--{"author":"ChatGPT","link":1}@@She said yes. --}^[[ChatGPT] Moved, otherwise it implies he bought the ring after she said yes.]He bought the ring.{++{"author":"ChatGPT","link":1}@@ She said yes.++}
- Store the token in the {~~{"author":"Alex","link":2}@@cache~>buffer~~}^[[Alex] Sounds better, should be replaced everywhere.]. Clear the {~~{"author":"Alex","link":2}@@cache~>buffer~~} on logout.

In highlights and percent marks it goes in the author bracket instead:

- ==++[Gemini:L3]@@This project needs Node 18 or newer. ++==Run `npm install`. Run `npm build`.==--[Gemini:L3]@@ This project needs Node 18 or newer.--==
- Step 1: Mix the ingredients. %%~~[Jack:L4]@@Step 2:~>Step 2: Preheat the oven. Step 3:~~%% Place dough on the pan. Step %%~~[Joe:L4]@@3~>4~~%%^[[Joe] This step needs to be updated too!]: Bake for ten minutes.

Only changes carry links: deletions, insertions and replacements. A comment is never approved, so a link on one says nothing and is ignored. Give every set in a note its own number. A set of one is pointless, it shows as an ordinary annotation.

Say in a reply why the parts belong together, so the reader knows what they are deciding on.

## Admonitions and fenced blocks

The plugin has a sidebar that displays all the annotations. It also has a second tab that displays admonitions. Admonitions are fenced blocks starting with `ad-`. With the Admonition plugin, users can create their own types of admonitions per author. This is a great way to leave general comments in a document not specific to a single line or paragraph, for example this general comment by Gemini:

```ad-gemini
General comments.
```

`[Author]` or `{"author":"Author"}@@` labels aren't needed, since using `ad-author` will let the admonition plugin display the author's name nicely.

Admonitions are the only fenced blocks the plugin scans for annotations, because they render as real markdown through the Admonition plugin. Braces and highlights work inside them. Percent marks do not render there, so use one of the other two inside an admonition:

```ad-info
Subject: Greeting

This is {--{"author":"Claude"}@@is --}{>>{"author":"Claude"}@@The word is repeated.<<}a test.
This ==++[ChatGPT]@@is ++==a test.
==Hello, this is highlighted text.==^[[Alex] This is a comment.]
This {~~{"author":"Claude"}@@isn't~>is~~}^[[Claude] Wrong, this is in fact a test.] a test.
```

An annotation inside any other fenced block, a python one for instance, is ignored completely by the plugin, and so is anything between backticks.

## Formatting remarks

Whitespace inside the operator marks is kept exactly as written: `{++is ++}` inserts the word and the space after it, `{--is --}` deletes both. Take that into account so nothing is left with a dangling space, comma or connector, and flag it when it is.

The author must end with `@@`. `{++[Claude] is ++}` without it inserts the literal text "[Claude] is ".

Annotate only the exact span being changed or commented on, nothing wider.

A footnote ends at the first closing square bracket that has no opening bracket to match it, so balanced pairs are fine and the author tag `^[[Claude] like this]` works. A lone closing bracket, as in `^[[Claude] press the ] key]`, ends the footnote early and drops the rest into the note as ordinary text. Use a `{>>...<<}` reply instead.

Highlighted text cannot start or end with a space in Obsidian. The operator marks take care of that: `==++is ++==` is fine, since the space sits inside the marks.

A highlight cannot cross a blank line, so a highlighted annotation has to stay inside one paragraph. Braces and percent marks can cross one, which is the only way to insert or delete a paragraph break: `{++` on one line, a blank line, `++}` on the next.

When writing about this syntax rather than using it, put the examples in backticks or a code block that is not an admonition. Two bare equals signs in running prose read as a delimiter.
