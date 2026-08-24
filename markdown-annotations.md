---
name: markdown-annotations
description: Always read this skill when leaving comments and suggestions on something the user wrote in a Markdown file, built for the Annotation Review Obsidian plugin.
---
# How it works

Every annotation appears in a sidebar through an Obsidian plugin called Annotation Review. Each one is either dismissed or approved. Regular comments can only be dismissed.

Dismissing always returns the text to how it was before the annotation: dismissing a comment/deletion/replacement leaves the original text in place without highlights or footnotes, dismissing an insertion removes the inserted text, footnote, and percentage symbols or highlights.

Approving a replacement swaps the highlighted text for the proposed text after the arrow and between the quotation marks and removes the highlight and footnote. Approving a deletion removes the highlighted text along with its highlight and footnote. Approving an insertion keeps the inserted text while removing the author label, footnote, and percentage symbols or highlight.

# Annotation examples

## Comments

By Claude: 
==This sentence has a comment attached.==^[[Claude] This could be phrased more directly.]

By ChatGPT: 
==This other sentence also has a comment.==^[[ChatGPT] Consider adding a source here.]

No author, so a grey chip: 
==A third sentence, commented without an author label.==^[Just a note to self.]

## Delete text

Without a reason: 
The weather today is nice and sunny ==and also quite pleasant==^[[Gemini] delete] outside.

With a reason: 
This paragraph has a redundant clause that repeats itself==, which is a repetitive statement that says the same twice==^[[Alex M] delete, Redundant with the first half of the sentence.].

## Replace text

Without a reason: 
==Tekst frum teh usr.==^[[Claude] → "Text from the user."]

With a reason: 
==The quick brown fox jumped over.==^[[Joe] → "The fox jumped over.", Trimmed unnecessary adjectives.]

Quotes around the replacement text are essential.

The replacement itself cannot contain a double quote, since the first one closes it. Use single quotes inside, or rephrase around it.

The arrow has to be the single character →, not a hyphen and a greater than sign typed as two characters.

## Insert text

### With percentage symbols

Using percentage symbols for insertions allows you to insert multiple paragraphs without the annotation breaking.

Plain, by Claude: 
Here is a sentence. %%[Claude] Here is an inserted sentence.%% And the paragraph continues.

With a reason, by Alex: 
Here is a sentence. %%[Alex] Here is an inserted sentence.%%^[insert, I really wanted to add a second sentence.] And the paragraph continues.

No author label: 
Another sentence. %%This one has no author label.%% More text follows.

When inserting text in a section that's already marked with percentage symbols (nested), insert using `%%%%[Author] text%%%%` because with just two percentage symbols on each side you will break the original text in two comments leaving your text as regular text instead of a suggested insertion. Only percentage symbols nest like this. A highlight insertion inside another highlight insertion is not picked up, and Obsidian does not render it nicely either.

Nested, by ChatGPT inside one from Claude, which is what the doubled form is for: 
%%[Claude] I went to my grandma's house.%%%%[ChatGPT] She has been living there for over 5 decades.%%%%[Claude] She's been thinking of moving out.%%

### With highlights

Self-contained form, by Claude:
==++[Claude] This line was inserted directly.++==

Footnote form with a reason, by Gemini, no plus signs needed:
==This line was inserted with a stated reason.==^[[Gemini] insert, Matches the tone of the rest of the form]

Drop the plus signs as soon as an insertion carries a footnote. They exist only to mark text as inserted when nothing else says so, so the footnote form replaces them rather than joining them.

Percentage symbols aren't allowed in admonitions, since they hide the text in live preview mode. Use the highlight variant instead:

```ad-info
Subject: %%Greeting%% 

==++[Claude] Hello, this is inserted text.++==

==And this one has a reason!==^[[Claude] insert, Because I want to.]
```

Outside of admonitions and when no reason needs to be given, percentage symbols are preferred for inserts. 

## Replies

You can add replies, for example:

The old plan was ==to launch in Q1==^[[Claude] delete, timeline slipped]^[[Alex] Q1 still works if we cut scope]^[[Claude] fair, restoring the reasoning below] and that's final. 

The first footnote decides the type and drives approve and dismiss. Every footnote after it is a reply, and they have to follow one another with no space in between. Approving or dismissing takes the replies with it, since they belong to the annotation rather than standing on their own. So a whole exchange disappears along with the decision it was about.

Self-contained highlight inserts, ones without a reason, can also have replies. There, the first footnote is already a reply: ==++[ChatGPT] Inserted text.++==^[[Joe] Reply]

## General comments and admonitions

The plugin has a sidebar that displays all the annotations. It also has a second tab that displays admonitions. Admonitions are fenced blocks starting with `ad-`. With the admonition plugin, users can create their own types of admonitions per author. This is a great way to leave general comments in a document not specific to a single line or paragraph, for example: 

```ad-author
General comments.
```

[Author] labels aren't needed, since using `ad-author` will let the admonition plugin display the author's name nicely. 

Admonitions are the only type of fenced blocks that display annotations, because those are the ones that render as real markdown through the Admonition plugin. But you can't insert using percentage symbols in them, meaning you will have to use highlight annotations for inserts. 

An annotation inside any other fenced block, a python one for instance, is ignored completely by the plugin.

## Formatting remarks

A footnote ends at its first closing square bracket, so a comment cannot contain one. Anything you write after it spills out into the document as visible text. Use parentheses instead, or rephrase.

The [Author] label goes at the very start of the footnote, or immediately inside the markers for the percentage and plus forms. Empty brackets are not a label, so write no brackets at all rather than an empty pair.

Highlight only the exact span being edited or commented on, nothing wider. Take into account remaining spaces or punctuation when highlighting text and flag when a deletion/insertion/replacement leaves a dangling space, comma, or connector nearby.

Highlighted text can't start or end with a space. `==This works.==`, `== this doesn't.==`, `==and neither does this. ==`. The plugin accepts it, but Obsidian won't display it well.

When writing about this syntax rather than using it, put the examples in backticks or a code block that isn't an admonition. Two bare equals signs in running prose read as a delimiter and pair up with the next real annotation, which quietly changes what that annotation covers.

A highlight cannot cross a blank line, so a comment, deletion or replacement has to stay inside one paragraph. They also can't cross multiple bullet points. To act on several paragraphs or bullet points at once, annotate each one separately. This is also why multi paragraph insertions need percentage symbols.
