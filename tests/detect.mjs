import esbuild from "esbuild";
import { builtinModules } from "node:module";

const built = await esbuild.build({
	stdin: {
		contents: `
			export { detectAnnotations, detectAdmonitionBlocks, getInsertContext } from "./src/detect";
			export { computeMutation, computeAddReply, computeSpanReplace, computeRemoval } from "./src/actions";
			export { composeComment, composeDelete, composeReplace, composeInsert, composePointComment, openEntry } from "./src/compose";
		`,
		resolveDir: ".",
		loader: "ts"
	},
	bundle: true,
	format: "cjs",
	platform: "node",
	external: [...builtinModules],
	write: false
});
const mod = { exports: {} };
new Function("module", "exports", "require", built.outputFiles[0].text)(
	mod,
	mod.exports,
	(await import("node:module")).createRequire(import.meta.url)
);
const {
	detectAnnotations,
	detectAdmonitionBlocks,
	getInsertContext,
	computeMutation,
	computeAddReply,
	computeSpanReplace,
	computeRemoval,
	composeComment,
	composeDelete,
	composeReplace,
	composeInsert,
	composePointComment,
	openEntry
} = mod.exports;

let pass = 0, fail = 0;
function check(label, actual, expected) {
	const a = JSON.stringify(actual), e = JSON.stringify(expected);
	if (a === e) { pass++; console.log(`  ok   ${label}`); }
	else { fail++; console.log(`  FAIL ${label}\n         got:      ${a}\n         expected: ${e}`); }
}
const all = doc => detectAnnotations(doc, "t.md");
const one = doc => all(doc)[0];
/** The parts that matter, in one line: type, author, original, inserted, replacement, reason or comment. */
const shape = a => a ? [a.type, a.author ?? null, a.originalText, a.insertedText ?? null, a.replacement ?? null, a.reason ?? a.commentText ?? null] : null;
const approve = doc => computeMutation(doc, one(doc), "approve").newContent;
const dismiss = doc => computeMutation(doc, one(doc), "dismiss").newContent;
const PLAIN = { kind: "plain" };

console.log("=== Every wrapper carries every operation ===");
for (const w of ["{--is --}", "==--is --==", "%%--is --%%"]) {
	check(`delete ${w}`, shape(one(`This is ${w}a test.`)), ["delete", null, "is ", null, null, null]);
}
for (const w of ["{++is ++}", "==++is ++==", "%%++is ++%%", "%%%%++is ++%%%%"]) {
	check(`insert ${w}`, shape(one(`This ${w}a test.`)), ["insert", null, "", "is ", null, null]);
}
for (const w of [
	"{--isn't~>is++}", "{--isn't--++is++}", "{~~isn't~>is~~}",
	"==--isn't~>is++==", "==--isn't--++is++==", "==~~isn't~>is~~==",
	"%%--isn't~>is++%%", "%%--isn't--++is++%%", "%%~~isn't~>is~~%%"
]) {
	check(`replace ${w}`, shape(one(`This ${w} a test.`)), ["replace", null, "isn't", null, "is", null]);
}
check("comment, brace highlight on its own", shape(one(`{==This is a test==}`)), ["comment", null, "This is a test", null, null, null]);
check("comment, highlight with a footnote", shape(one(`==This is a test==^[What?]`)), ["comment", null, "This is a test", null, null, "What?"]);
check("a plain highlight is a comment with nothing attached", [one(`==plain==`).type, one(`==plain==`).isPlain], ["comment", true]);
check("a hidden note is a comment on a spot, its text being the comment", [one(`%%hidden%%`).type, one(`%%hidden%%`).isPoint, one(`%%hidden%%`).originalText, one(`%%hidden%%`).commentText], ["comment", true, "", "hidden"]);
check("with no author and nothing attached it is plain", one(`%%hidden%%`).isPlain, true);
check("a hidden note carries its author the way a brace comment does", shape(one(`%%[Claude] hidden%%`)), ["comment", "Claude", "", null, null, "hidden"]);
check("and is not plain then", one(`%%[Claude] hidden%%`).isPlain, false);
check("an entry after a hidden note is a reply", one(`%%What?%%^[[Joe] A test.]`).replies.map(r => [r.author, r.text]), [["Joe", "A test."]]);
check("the doubled form works the same", shape(one(`%%%%[C] hidden%%%%`)), ["comment", "C", "", null, null, "hidden"]);
check("and a brace highlight", one(`{==plain==}`).isPlain, true);
check("an attached entry makes it not plain", one(`==x==^[note]`).isPlain, false);
check("a point comment is not plain either", one(`A{>>x<<}`).isPlain, false);
check("a plain highlight before a real annotation", all(`==plain== and ==--real--==^[c]`).map(a => a.originalText), ["plain", "real"]);
check("tildes without an arrow are just strikethrough", shape(one(`==~~gone~~==^[note]`)), ["comment", null, "~~gone~~", null, null, "note"]);
check("wrapper is recorded", all(`{--a--} ==--b--==^[x] %%--c--%%^[x]`).map(a => a.wrapper), ["brace", "highlight", "percent"]);

console.log("\n=== Whitespace is kept exactly as written ===");
check("approve insert keeps its trailing space", approve(`This {++is ++}a test.`), "This is a test.");
check("approve delete removes the space with it", approve(`This is {--is --}a test.`), "This is a test.");
check("dismiss delete puts it all back", dismiss(`This is {--is --}a test.`), "This is is a test.");
check("a blank line can be inserted", one(`A.{++\n\n++}B.`).insertedText, "\n\n");
check("approving it", approve(`A.{++\n\n++}B.`), "A.\n\nB.");
check("a blank line can be deleted", approve(`A.{--\n\n--}B.`), "A.B.");
check("percent marks can span paragraphs", approve(`A.%%++\n\nNew paragraph.\n\n++%%B.`), "A.\n\nNew paragraph.\n\nB.");
check("a highlight cannot cross a blank line", all(`==--a\n\nb--==^[x]`).length, 0);

console.log("\n=== Author and reason, in either channel ===");
check("footnote, author only", shape(one(`{--is --}^[[Claude]]`)), ["delete", "Claude", "is ", null, null, null]);
check("brace comment, author only", shape(one(`{--is --}{>>[Claude]<<}`)), ["delete", "Claude", "is ", null, null, null]);
check("footnote, author and reason", shape(one(`{--is --}^[[Claude] Why.]`)), ["delete", "Claude", "is ", null, null, "Why."]);
check("brace comment, author and reason", shape(one(`{--is --}{>>[Claude] Why.<<}`)), ["delete", "Claude", "is ", null, null, "Why."]);
check("footnote, reason only", shape(one(`{--is --}^[Why.]`)), ["delete", null, "is ", null, null, "Why."]);
check("on a highlight", shape(one(`==--is --==^[[Claude] Why.]`)), ["delete", "Claude", "is ", null, null, "Why."]);
check("on percent marks", shape(one(`%%++is ++%%^[[Claude] Why.]`)), ["insert", "Claude", "", "is ", null, "Why."]);
check("an empty footnote is still an attached entry", shape(one(`{--is --}^[]`)), ["delete", null, "is ", null, null, null]);
check("author only on a comment span", shape(one(`==text==^[[Claude]]`)), ["comment", "Claude", "text", null, null, null]);
check("a space breaks the attachment", one(`{--is --} ^[[Claude] Why.]`).author, undefined);
check("and the annotation ends before it", one(`{--is --} ^[[Claude] Why.]`).fullMatch, "{--is --}");

console.log("\n=== Replies ===");
const threaded = `{--is --}^[[C] Why.]^[[A] Agreed.]^[[C] Done.]`;
check("footnote replies", one(threaded).replies.map(r => [r.author, r.text]), [["A", "Agreed."], ["C", "Done."]]);
check("brace comment replies", one(`{--is --}{>>[C] Why.<<}{>>[A] Agreed.<<}`).replies.map(r => [r.author, r.text]), [["A", "Agreed."]]);
check("channels can mix", one(`{--is --}^[[C] Why.]{>>[A] Agreed.<<}`).replies.length, 1);
check("a new reply follows the last channel used", one(`{--is --}^[[C] Why.]{>>[A] Agreed.<<}`).nextChannel, "brace");
check("author only, then a reply", shape(one(`{--is --}^[[C]]^[[A] Agreed.]`)).concat([one(`{--is --}^[[C]]^[[A] Agreed.]`).replies.length]), ["delete", "C", "is ", null, null, null, 1]);
check("the first entry is never a reply", one(`{--is --}^[[A] Agreed.]`).replies.length, 0);
check("adding a footnote reply", computeAddReply(threaded, one(threaded), "[J] ok").newContent, `${threaded}^[[J] ok]`);
const braced = `{--is --}{>>[C] Why.<<}`;
check("adding a brace reply", computeAddReply(braced, one(braced), "[J] ok").newContent, `${braced}{>>[J] ok<<}`);
const t = one(threaded);
check("dismissing one reply", computeSpanReplace(threaded, t, t.replies[0].fullSpan.start, t.replies[0].fullSpan.end, "").newContent, `{--is --}^[[C] Why.]^[[C] Done.]`);
check("approving takes the replies with it", approve(threaded), "");

console.log("\n=== Point comments ===");
const point = `This is a test{>>What?<<}.`;
check("a bare brace comment is a comment on a spot", [one(point).type, one(point).isPoint, one(point).originalText, one(point).commentText], ["comment", true, "", "What?"]);
check("with an author", one(`Text{>>[C] What?<<}`).author, "C");
check("with a reply", one(`Text{>>[C] What?<<}{>>[J] A test.<<}`).replies.map(r => r.text), ["A test."]);
check("dismissing removes it", dismiss(`A{>>x<<}B`), "AB");
check("one attached to an annotation is not a point comment", all(`{--is --}{>>[C] r<<}`).length, 1);
check("after a space it is", all(`text {>>x<<}`).map(a => a.isPoint), [true]);

console.log("\n=== Nesting ===");
check("braces nest", all(`{++outer {++inner++} rest++}`).map(a => a.insertedText), ["outer {++inner++} rest", "inner"]);
check("percent marks chain", all(`%%++A ++%%%%++X++%%%%++B++%%`).map(a => a.insertedText), ["A ", "X", "B"]);
const nested = `{++a {--b--}^[[C] why] c++}`;
check("an inner annotation keeps its own entries", all(nested).map(shape), [["insert", null, "", "a {--b--}^[[C] why] c", null, null], ["delete", "C", "b", null, null, "why"]]);
check("approving the inner one", computeMutation(nested, all(nested)[1], "approve").newContent, `{++a  c++}`);

console.log("\n=== Author editing ===");
function setAuthor(doc, target, value, ann = one(doc)) {
	const tgt = target ?? ann;
	if (tgt.authorSpan) {
		if (!value) { const c = tgt.authorClearSpan ?? tgt.authorSpan; return computeSpanReplace(doc, ann, c.start, c.end, "").newContent; }
		const trailing = ann.fullMatch.slice(tgt.authorSpan.start, tgt.authorSpan.end).replace(/^\[[^\]]*\]/, "");
		return computeSpanReplace(doc, ann, tgt.authorSpan.start, tgt.authorSpan.end, `[${value}]${trailing}`).newContent;
	}
	const p = tgt.authorInsert;
	return computeSpanReplace(doc, ann, p.at, p.at, `${p.prefix}${value}${p.suffix}`).newContent;
}
check("change", setAuthor(`==--T--==^[[C] why]`, null, "J"), `==--T--==^[[J] why]`);
check("change keeps the spacing after the label", setAuthor(`==--T--==^[[C]]`, null, "J"), `==--T--==^[[J]]`);
check("clear, leaving the reason", setAuthor(`==--T--==^[[C] why]`, null, ""), `==--T--==^[why]`);
check("clearing the only thing in an entry removes the entry", setAuthor(`==--T--==^[[C]]`, null, ""), `==--T--==`);
check("unless replies follow it", setAuthor(`==--T--==^[[C]]^[[A] r]`, null, ""), `==--T--==^[]^[[A] r]`);
check("add to an entry that has a reason", setAuthor(`==--T--==^[why]`, null, "C"), `==--T--==^[[C] why]`);
check("add to a brace entry", setAuthor(`{--T--}{>>why<<}`, null, "C"), `{--T--}{>>[C] why<<}`);
check("add where there is no entry at all", setAuthor(`==--T--==`, null, "C"), `==--T--==^[[C]]`);
check("add to a hidden note, inside it", setAuthor(`%%note%%`, null, "C"), `%%[C] note%%`);
check("clear from a hidden note", setAuthor(`%%[C] note%%`, null, ""), `%%note%%`);
const withReply = `{--T--}^[[C] why]^[r]`;
check("add to a reply", setAuthor(withReply, one(withReply).replies[0], "A"), `{--T--}^[[C] why]^[[A] r]`);

console.log("\n=== Reason editing ===");
function setReason(doc, value) {
	const ann = one(doc);
	if (value) { const p = ann.reasonInsert; return computeSpanReplace(doc, ann, p.at, p.at, `${p.prefix}${value}${p.suffix}`).newContent; }
	const c = ann.reasonClearSpan;
	return computeSpanReplace(doc, ann, c.start, c.end, "").newContent;
}
check("add after an author", setReason(`{--T--}^[[C]]`, "why"), `{--T--}^[[C] why]`);
check("add where there is no entry", setReason(`{--T--}`, "why"), `{--T--}^[why]`);
check("add to a brace entry", setReason(`{--T--}{>>[C]<<}`, "why"), `{--T--}{>>[C] why<<}`);
check("clear keeps the author", setReason(`{--T--}^[[C] why]`, ""), `{--T--}^[[C]]`);
check("clear removes an entry that was only the reason", setReason(`{--T--}^[why]`, ""), `{--T--}`);
check("unless replies follow it", setReason(`{--T--}^[why]^[[A] r]`, ""), `{--T--}^[]^[[A] r]`);
check("a comment's text works the same way", setReason(`==T==^[[C] note]`, ""), `==T==^[[C]]`);
check("a reason offers to be added when there is none", one(`{--T--}^[[C]]`).reasonInsert !== undefined, true);
check("and not when there is one", one(`{--T--}^[[C] why]`).reasonInsert, undefined);

console.log("\n=== Editing the annotated text ===");
function setSpan(doc, spanName, value) {
	const ann = one(doc);
	const s = ann[spanName];
	return computeSpanReplace(doc, ann, s.start, s.end, value).newContent;
}
check("the deleted text", setSpan(`{--Old--}^[[C]]`, "originalSpan", "New"), `{--New--}^[[C]]`);
check("the old half of a replacement", setSpan(`{--a~>b++}`, "originalSpan", "c"), `{--c~>b++}`);
check("the new half, arrow form", setSpan(`{--a~>b++}`, "replacementSpan", "c"), `{--a~>c++}`);
check("the new half, fused form", setSpan(`{--a--++b++}`, "replacementSpan", "c"), `{--a--++c++}`);
check("the new half, tilde form", setSpan(`==~~a~>b~~==`, "replacementSpan", "c"), `==~~a~>c~~==`);
check("the inserted text, spaces included", setSpan(`%%++X++%%`, "bodySpan", "Y "), `%%++Y ++%%`);
check("a point comment has no text span", one(`A{>>x<<}`).originalSpan, undefined);

console.log("\n=== Approve and dismiss ===");
check("approve replace", approve(`This ==--isn't~>is++==^[[C]] a test.`), "This is a test.");
check("dismiss replace", dismiss(`This ==--isn't~>is++==^[[C]] a test.`), "This isn't a test.");
check("approve fused replace", approve(`{--isn't--++is++}`), "is");
check("approve tilde replace", approve(`{~~isn't~>is~~}`), "is");
check("approve insert", approve(`%%++New.++%%^[[C]]`), "New.");
check("dismiss insert", dismiss(`%%++New.++%%^[[C]]`), "");
check("dismiss brace comment span", dismiss(`{==T==}{>>note<<}`), "T");
check("dismiss a hidden note removes it whole", dismiss(`A %%T%%^[note] B`), "A  B");
check("comments cannot be approved", computeMutation(`==T==^[note]`, one(`==T==^[note]`), "approve").ok, false);

console.log("\n=== Code, links and stray delimiters ===");
const fenced = "```python\n==--x--==^[[C]]\n```\n\n```ad-j\n==--y--==^[[C]]\n{++z++}\n```";
check("plain fence ignored, ad- fence scanned", all(fenced).map(a => a.originalText || a.insertedText), ["y", "z"]);
check("admonition blocks listed", detectAdmonitionBlocks(fenced, "t.md").map(b => b.adType), ["ad-j"]);
check("percent marks inside an admonition are ignored", all("```ad-j\n%%++x++%%\n```").length, 0);
check("insideAdBlock is set", all(fenced).map(a => a.insideAdBlock), [true, true]);
check("a backticked == does not desync what follows",
	all("Wrap it in `==` like so.\nFirst: ==--one--==^[[C]]\nSecond: ==--two--==^[[C]]").map(a => a.originalText), ["one", "two"]);
check("a stray == does not either",
	all("Someone writes == literally.\n\n==--Real--==^[[C]]\n\n==--Another--==^[[C]]").map(a => a.originalText), ["Real", "Another"]);
check("a backticked brace form is ignored", all("Use `{++x++}` like so. {++real++}").map(a => a.insertedText), ["real"]);
check("a backticked percent form is ignored", all("Use `%%++x++%%` like so. %%++real++%%").map(a => a.insertedText), ["real"]);
check("markers inside an entry's text are not annotations", all(`==T==^[[C] use {++x++} here]`).map(a => a.type), ["comment"]);
check("a brace highlight next to a real one", all(`{==x==} and ==y==^[c]`).map(a => a.originalText), ["x", "y"]);
check("double hyphens in prose are not a deletion", shape(one(`==a -- b==^[c]`)), ["comment", null, "a -- b", null, null, "c"]);
check("nor inside one", one(`{--a -- b--}`).originalText, "a -- b");
check("a link is not an annotation", all(`[text](==x==)`).length, 0);
check("everything comes back in note order", all(`{++a++} ==--b--==^[x] %%++c++%% d{>>e<<}`).map(a => a.type), ["insert", "delete", "insert", "comment"]);

console.log("\n=== Insert context ===");
const ctx = "Plain.\n\n```ad-j\nfenced\n```\n\nBefore %%++an insert++%% %%--gone--%% %%--old~>new++%% after.";
check("plain", getInsertContext(ctx, ctx.indexOf("Plain")), PLAIN);
check("fenced", getInsertContext(ctx, ctx.indexOf("fenced")), { kind: "fenced" });
check("inside an insert", getInsertContext(ctx, ctx.indexOf("an insert")), { kind: "nested", marker: "++" });
check("inside a deletion", getInsertContext(ctx, ctx.indexOf("gone")), { kind: "nested", marker: "--" });
check("inside the old half of a replacement", getInsertContext(ctx, ctx.indexOf("old")), { kind: "nested", marker: "--" });
check("inside the new half", getInsertContext(ctx, ctx.indexOf("new")), { kind: "nested", marker: "++" });

console.log("\n=== What the editor commands write is read back correctly ===");
/** Types `typed` at the caret position the command would have left. */
function fill(composed, typed) {
	return composed.text.slice(0, composed.cursor) + typed + composed.text.slice(composed.cursor);
}
const FENCED = { kind: "fenced" };
check("comment, CriticMarkup throughout", composeComment("Sel.", "C", "brace", "brace").text, `{==Sel.==}{>>[C] <<}`);
check("and it reads back", shape(one(fill(composeComment("Sel.", "C", "brace", "brace"), "My note."))), ["comment", "C", "Sel.", null, null, "My note."]);
check("comment, highlight and footnote", shape(one(fill(composeComment("Sel.", "C", "highlight", "footnote"), "My note."))), ["comment", "C", "Sel.", null, null, "My note."]);
check("comment cannot hide its span, so percent marks become a highlight", composeComment("Sel.", "C", "percent", "footnote").text, `==Sel.==^[[C] ]`);
check("a comment on a spot, CriticMarkup", composePointComment("C", "brace"), { text: "{>>[C] <<}", cursor: 7 });
check("a comment on a spot, Obsidian style", composePointComment("C", "footnote"), { text: "%%[C] %%", cursor: 6 });
check("and without an author", composePointComment("", "footnote"), { text: "%%%%", cursor: 2 });
check("both read back as the same thing", [one(fill(composePointComment("C", "brace"), "hm")).commentText, one(fill(composePointComment("C", "footnote"), "hm")).commentText], ["hm", "hm"]);
check("a comment opens an entry even without an author", shape(one(fill(composeComment("Sel.", "", "brace", "brace"), "note"))), ["comment", null, "Sel.", null, null, "note"]);
check("delete writes nothing after the wrapper without an author", composeDelete("Sel.", "", "brace", "brace").text, `{--Sel.--}`);
check("delete names the author when there is one", composeDelete("Sel.", "C", "brace", "brace").text, `{--Sel.--}{>>[C]<<}`);
check("delete, highlight and footnote", composeDelete("Sel.", "C", "highlight", "footnote").text, `==--Sel.--==^[[C]]`);
check("delete reads back", shape(one(composeDelete("Sel.", "C", "brace", "brace").text)), ["delete", "C", "Sel.", null, null, null]);
check("replace writes", composeReplace("Sel.", "C", "brace", "brace").text, `{--Sel.~>++}{>>[C]<<}`);
check("replace reads back", shape(one(fill(composeReplace("Sel.", "C", "brace", "brace"), "New."))), ["replace", "C", "Sel.", null, "New.", null]);
check("replace, highlight and footnote", shape(one(fill(composeReplace("Sel.", "C", "highlight", "footnote"), "New."))), ["replace", "C", "Sel.", null, "New.", null]);
check("replace without an author", shape(one(fill(composeReplace("Sel.", "", "highlight", "footnote"), "New."))), ["replace", null, "Sel.", null, "New.", null]);
check("insert, braces", composeInsert("Sel.", "C", PLAIN, "brace", "brace", "brace").text, `{++Sel.++}{>>[C]<<}`);
check("insert, percent marks and a footnote", composeInsert("Sel.", "C", PLAIN, "percent", "highlight", "footnote").text, `%%++Sel.++%%^[[C]]`);
check("insert reads back", shape(one(composeInsert("Sel.", "C", PLAIN, "percent", "highlight", "footnote").text)), ["insert", "C", "", "Sel.", null, null]);
check("percent marks fall back in a fence, to braces", composeInsert("Sel.", "C", FENCED, "percent", "brace", "footnote").text, `{++Sel.++}^[[C]]`);
check("or to a highlight", composeInsert("Sel.", "C", FENCED, "percent", "highlight", "footnote").text, `==++Sel.++==^[[C]]`);
check("braces stay braces in a fence", composeInsert("Sel.", "C", FENCED, "brace", "highlight", "footnote").text, `{++Sel.++}^[[C]]`);
check("highlights stay highlights in a fence", composeInsert("Sel.", "C", FENCED, "highlight", "brace", "footnote").text, `==++Sel.++==^[[C]]`);
check("an open entry for a reason", openEntry("C", "brace"), { text: "{>>[C] <<}", cursor: 7 });
check("an open footnote without an author", openEntry("", "footnote"), { text: "^[]", cursor: 2 });
// A nested insert only makes sense written into a surrounding one, so check
// that the whole thing still reads as three separate inserts afterwards.
const surrounding = `%%++Before. After.++%%^[[C]]`;
const splitPoint = surrounding.indexOf("After.");
const context = getInsertContext(surrounding, splitPoint);
const combined = surrounding.slice(0, splitPoint) + composeInsert("Mine.", "G", context, "percent", "highlight", "footnote").text + surrounding.slice(splitPoint);
check("nesting keeps all three inserts", all(combined).map(a => [a.author ?? null, a.insertedText]), [[null, "Before. "], ["G", "Mine."], ["C", "After."]]);

console.log("\n=== The channel option decides how a first entry is written ===");
const bare = `{--T--}`;
const asBrace = detectAnnotations(bare, "t.md", { channel: "brace" })[0];
const ins = (ann, p, text) => computeSpanReplace(bare, ann, p.at, p.at, `${p.prefix}${text}${p.suffix}`).newContent;
check("a reason goes in a brace comment", ins(asBrace, asBrace.reasonInsert, "why"), `{--T--}{>>why<<}`);
check("so does an author", ins(asBrace, asBrace.authorInsert, "C"), `{--T--}{>>[C]<<}`);
check("and a reply", computeAddReply(bare, asBrace, "[A] ok").newContent, `{--T--}{>>[A] ok<<}`);
check("footnotes without the option", ins(one(bare), one(bare).reasonInsert, "why"), `{--T--}^[why]`);
const chained = `{--T--}^[[C] why]`;
check("an existing chain is followed whatever the option says", computeAddReply(chained, detectAnnotations(chained, "t.md", { channel: "brace" })[0], "[A] ok").newContent, `{--T--}^[[C] why]^[[A] ok]`);

console.log("\n=== Deleting an admonition tidies the blank lines ===");
const block = "```ad-c\nNote.\n```";
const doc = `Before.\n\n${block}\n\nAfter.`;
check("collapses to one blank line", computeRemoval(doc, doc.indexOf(block), block).newContent, "Before.\n\nAfter.");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
