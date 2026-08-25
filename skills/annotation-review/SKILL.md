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

An annotation is a wrapper, an operator, an optional author, and any number of replies:

```
<wrapper> <operator> <author>@@? text <operator> </wrapper> <reply>*
```

- The wrapper decides how the note shows the text: `{...}` shows it as it is, which is plain CriticMarkup, `==...==` highlights it, `%%...%%` hides it until approved.
- The operator decides the operation: `--text--` deletes, `++text++` inserts, `~~old~>new~~` replaces, `>>note<<` is a comment on that spot. No operator means a comment on the text inside the wrapper.
- The author goes right after the opening operator marks, ended by `@@`. Inside braces write `{"author":"Claude"}@@`, so other CriticMarkup tools read it too. Inside highlights and percent marks write `[Claude]@@`. Everything after `@@` is the text, spaces included.
- Replies are footnotes `^[...]` or CriticMarkup comments `{>>...<<}` placed directly after the wrapper, with no space in between. Sign a footnote with `[Claude]` followed by a space at its start, and a CriticMarkup comment with `{"author":"Claude"}@@`.

An annotation is authored by the author inside its wrapper, or by nobody. Every entry after the wrapper is a reply, whoever wrote it, and the reason for a change is simply its first reply. An author-only reply such as `^[[Claude]]` is an empty reply by Claude and nothing more.

Before you start, ask the user which wrapper they want and whether you should label yourself. Without an answer, use plain CriticMarkup, braces with `{>>...<<}` replies, since that is what other CriticMarkup tools read, and label yourself.

# Annotation examples

Each group shows the same thing in all three wrappers.

## Comments

A comment on a span is a wrapper around the text with no operator inside. What you want to say goes in a signed reply after it. The wrapper itself carries no author, because the text inside it is the user's, not yours.

No author, nothing said. The same as an ordinary highlight or hidden text:
{==This is a test==}
==This is a test==
%%This is a test%%

With the comment as a signed reply:
{==This is a test==}{>>{"author":"Claude"}@@What is it a test of?<<}
==This is a test==^[[ChatGPT] What is it a test of?]
%%This is a test%%^[[Gemini] What is it a test of?]

Unsigned:
{==This is a test==}{>>What is it a test of?<<}
==This is a test==^[What is it a test of?]

A comment on a spot rather than a span uses the `>>` operator, the author goes inside like any other operation:
This is a test.{>>{"author":"Claude"}@@Consider a transition here.<<}
This is a test.==>>[ChatGPT]@@Consider a transition here.<<==
This is a test.%%>>[Gemini]@@Consider a transition here.<<%%

An unsigned comment on a spot:
This is a test.{>>Consider a transition here.<<}
This is a test.==>>Consider a transition here.<<==
This is a test.%%>>Consider a transition here.<<%%

## Delete text

No author, no reply:
This is {--is --}a test.
This is ==--is --==a test.
This is %%--is --%%a test.

With author:
This is {--{"author":"Claude"}@@is --}a test.
This is ==--[ChatGPT]@@is --==a test.
This is %%--[Gemini]@@is --%%a test.

With author and a reply giving the reason:
This is {--{"author":"Claude"}@@is --}{>>{"author":"Claude"}@@The word is repeated.<<}a test.
This is ==--[ChatGPT]@@is --==^[[ChatGPT] The word is repeated.]a test.
This is %%--[Gemini]@@is --%%^[[Gemini] The word is repeated.]a test.

No author, signed reply. Nothing says who did the operation:
This is {--is --}{>>{"author":"Joe"}@@The word is repeated.<<}a test.
This is ==--is --==^[[Joe] The word is repeated.]a test.

## Replace text

Known in CriticMarkup as substitutions. The old text, the arrow, then the new text, in every wrapper.

No author, no reply:
This {~~isn't~>is~~} a test.
This ==~~isn't~>is~~== a test.
This %%~~isn't~>is~~%% a test.

With author:
This {~~{"author":"Claude"}@@isn't~>is~~} a test.
This ==~~[ChatGPT]@@isn't~>is~~== a test.
This %%~~[Gemini]@@isn't~>is~~%% a test.

With author and a reply:
This {~~{"author":"Claude"}@@isn't~>is~~}{>>{"author":"Claude"}@@Wrong, this is in fact a test.<<} a test.
This ==~~[ChatGPT]@@isn't~>is~~==^[[ChatGPT] Wrong, this is in fact a test.] a test.

## Insert text

Known in CriticMarkup as additions. Percent marks hide the insertion until it is approved, and an insertion can span several paragraphs.

No author, no reply:
This {++is ++}a test.
This ==++is ++==a test.
This %%++is ++%%a test.

With author:
This {++{"author":"Claude"}@@is ++}a test.
This ==++[ChatGPT]@@is ++==a test.
This %%++[Gemini]@@is ++%%a test.

With author and a reply:
This {++{"author":"Claude"}@@is ++}{>>{"author":"Claude"}@@The word was missing.<<}a test.
This ==++[ChatGPT]@@is ++==^[[ChatGPT] The word was missing.]a test.
This %%++[Gemini]@@is ++%%^[[Gemini] The word was missing.]a test.

Braces nest, so an insertion inside an insertion works there:
{++{"author":"Claude"}@@I went to my grandma's house. {++{"author":"ChatGPT"}@@She has been living there for over 5 decades.++} She's been thinking of moving out.++}

Highlights and percent marks cannot nest. To insert inside text that is already inside percent marks, close and reopen them, operator included. This reads as three insertions in a row:
%%++I went to my grandma's house.++%%%%++[ChatGPT]@@ She has been living there for over 5 decades.++%%%%++ She's been thinking of moving out.++%%

## Replies

Replies follow one another with no space in between, and there can be any number of them:

The old plan was ==--[Claude]@@to launch in Q1--==^[[Claude] Timeline slipped.]^[[Alex] Q1 still works if we cut scope.]^[[Claude] Fair, restoring the reasoning below.] and that's final.

Plain CriticMarkup:
{--{"author":"Gemini"}@@Drop this.--}{>>{"author":"Gemini"}@@It repeats the intro.<<}{>>{"author":"Joe"}@@Agreed.<<}

Approving or dismissing takes the replies with it, since they belong to the annotation rather than standing on their own. Replies always sit outside the wrapper: a footnote inside a percent or highlight wrapper breaks rendering.

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
==Hello, this is a comment.==^[[Alex M] On text inside an admonition.]
```

An annotation inside any other fenced block, a python one for instance, is ignored completely by the plugin, and so is anything between backticks.

## Formatting remarks

Whitespace inside the operator marks is kept exactly as written: `{++is ++}` inserts the word and the space after it, `{--is --}` deletes both. Take that into account so nothing is left with a dangling space, comma or connector, and flag it when it is.

The author must end with `@@`. `{++[Claude] is ++}` without it inserts the literal text "[Claude] is ".

Annotate only the exact span being changed or commented on, nothing wider.

A footnote ends at its first closing square bracket, so a reply in a footnote cannot contain one. Use parentheses, or a `{>>...<<}` reply instead.

Highlighted text cannot start or end with a space in Obsidian. The operator marks take care of that: `==++is ++==` is fine, since the space sits inside the marks.

A highlight cannot cross a blank line, so a highlighted annotation has to stay inside one paragraph. Braces and percent marks can cross one, which is the only way to insert or delete a paragraph break: `{++` on one line, a blank line, `++}` on the next.

When writing about this syntax rather than using it, put the examples in backticks or a code block that is not an admonition. Two bare equals signs in running prose read as a delimiter.
