import esbuild from "esbuild";
import { builtinModules } from "node:module";

const built = await esbuild.build({
	stdin: {
		contents: `
			export { detectAnnotations, detectAdmonitionBlocks, getInsertContext } from "./src/detect";
			export { computeMutation, computeAddReply, computeSpanReplace, computeRemoval } from "./src/actions";
			export { composeComment, composeDelete, composeReplace, composeInsert, composePointComment, openReply, replyEntry } from "./src/compose";
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
	openReply,
	replyEntry
} = mod.exports;

let pass = 0, fail = 0;
function check(label, actual, expected) {
	const a = JSON.stringify(actual), e = JSON.stringify(expected);
	if (a === e) { pass++; console.log(`  ok   ${label}`); }
	else { fail++; console.log(`  FAIL ${label}\n         got:      ${a}\n         expected: ${e}`); }
}
const all = doc => detectAnnotations(doc, "t.md");
const one = doc => all(doc)[0];
/** The parts that matter, in one line: type, author, original, inserted, replacement, replies as [author, text]. */
const shape = a => a ? [a.type, a.author ?? null, a.originalText, a.insertedText ?? null, a.replacement ?? null, a.replies.map(r => [r.author ?? null, r.text])] : null;
const approve = doc => computeMutation(doc, one(doc), "approve").newContent;
const dismiss = doc => computeMutation(doc, one(doc), "dismiss").newContent;
const PLAIN = { kind: "plain" };
const FENCED = { kind: "fenced" };
const C = '{"author":"Claude"}@@';

console.log("=== Every wrapper carries every operation ===");
for (const w of ["{--is --}", "==--is --==", "%%--is --%%"]) {
	check(`delete ${w}`, shape(one(`This is ${w}a test.`)), ["delete", null, "is ", null, null, []]);
}
for (const w of ["{++is ++}", "==++is ++==", "%%++is ++%%", "%%%%++is ++%%%%"]) {
	check(`insert ${w}`, shape(one(`This ${w}a test.`)), ["insert", null, "", "is ", null, []]);
}
for (const w of ["{~~isn't~>is~~}", "==--isn't~>is++==", "==--isn't--++is++==", "==~~isn't~>is~~==", "%%--isn't~>is++%%", "%%--isn't--++is++%%", "%%~~isn't~>is~~%%"]) {
	check(`replace ${w}`, shape(one(`This ${w} a test.`)), ["replace", null, "isn't", null, "is", []]);
}
check("braces take only the CriticMarkup replacement form", all(`{--isn't~>is++} and {--isn't--++is++}`).length, 0);
check("comment, brace highlight on its own", shape(one(`{==This is a test==}`)), ["comment", null, "This is a test", null, null, []]);
check("comment, highlight with a reply", shape(one(`==This is a test==^[What?]`)), ["comment", null, "This is a test", null, null, [[null, "What?"]]]);
check("a plain highlight is a comment with nothing attached", [one(`==plain==`).type, one(`==plain==`).isPlain], ["comment", true]);
check("tildes without an arrow are just strikethrough", shape(one(`==~~gone~~==^[note]`)), ["comment", null, "~~gone~~", null, null, [[null, "note"]]]);
check("wrapper is recorded", all(`{--a--} ==--b--==^[x] %%--c--%%^[x]`).map(a => a.wrapper), ["brace", "highlight", "percent"]);

console.log("\n=== The author sits inside the wrapper, in either spelling ===");
check("metadata in braces", shape(one(`This is {--${C}is --}a test.`)), ["delete", "Claude", "is ", null, null, []]);
check("light form in a highlight", shape(one(`This is ==--[Claude]@@is --==a test.`)), ["delete", "Claude", "is ", null, null, []]);
check("light form in percent marks", shape(one(`This is %%--[Claude]@@is --%%a test.`)), ["delete", "Claude", "is ", null, null, []]);
check("metadata in a highlight is accepted too", shape(one(`==++${C}is ++==`)), ["insert", "Claude", "", "is ", null, []]);
check("light form in braces is accepted too", shape(one(`{++[Claude]@@is ++}`)), ["insert", "Claude", "", "is ", null, []]);
check("on a replacement, at the start of the old text", shape(one(`{~~${C}isn't~>is~~}`)), ["replace", "Claude", "isn't", null, "is", []]);
check("on a highlight replacement", shape(one(`==--[Claude]@@isn't~>is++==`)), ["replace", "Claude", "isn't", null, "is", []]);
check("on a span comment", shape(one(`==[Claude]@@This is a test==`)), ["comment", "Claude", "This is a test", null, null, []]);
check("the short key works", one(`{--{"a":"Claude"}@@is --}`).author, "Claude");
check("other metadata fields are kept, not read", one(`{--{"author":"Claude","time":1755000000}@@is --}`).authorMeta, { time: 1755000000 });
check("the text after @@ keeps its spaces", approve(`This {++[Claude]@@is ++}a test.`), "This is a test.");
check("approving drops the author with the markers", approve(`This is {--${C}is --}a test.`), "This is a test.");
check("dismissing a replacement restores only the old text", dismiss(`This {~~${C}isn't~>is~~} a test.`), "This isn't a test.");
check("a label without @@ is not an author, it is text", shape(one(`{++[Claude] is ++}`)), ["insert", null, "", "[Claude] is ", null, []]);
check("a bracket at the start of deleted text is not an author", one(`{--[link](url) --}`).originalText, "[link](url) ");

console.log("\n=== Every entry is a reply ===");
check("a signed reply on an authored change", shape(one(`{--${C}is --}{>>{"author":"Alex"}@@Agreed.<<}`)), ["delete", "Claude", "is ", null, null, [["Alex", "Agreed."]]]);
check("a label works in a brace comment too", one(`{--is --}{>>[Alex] Agreed.<<}`).replies, one(`{--is --}{>>[Alex] Agreed.<<}`).replies);
check("labels in footnotes", shape(one(`==--[Claude]@@is --==^[[Claude] The word is repeated.]^[[Alex] Agreed.]`)), ["delete", "Claude", "is ", null, null, [["Claude", "The word is repeated."], ["Alex", "Agreed."]]]);
check("metadata in a footnote is read as well", one(`{--is --}^[${C}why]`).replies.map(r => [r.author, r.text]), [["Claude", "why"]]);
check("an author-only entry is an empty signed reply, not the author", shape(one(`{--is --}^[[Claude]]`)), ["delete", null, "is ", null, null, [["Claude", ""]]]);
check("nothing says who did an unauthored operation with a signed reply", shape(one(`{--is --}^[[Claude] why]`)), ["delete", null, "is ", null, null, [["Claude", "why"]]]);
check("unsigned reply", one(`{--is --}^[why]`).replies.map(r => [r.author ?? null, r.text]), [[null, "why"]]);
check("channels can mix", one(`{--is --}^[[C] Why.]{>>[A] Agreed.<<}`).replies.length, 2);
check("a new reply follows the last channel used", one(`{--is --}^[[C] Why.]{>>[A] Agreed.<<}`).nextChannel, "brace");
check("a space breaks the attachment", one(`{--is --} ^[[Claude] Why.]`).replies.length, 0);
check("and the annotation ends before it", one(`{--is --} ^[[Claude] Why.]`).fullMatch, "{--is --}");
const threaded = `{--${C}is --}^[[Claude] Why.]^[[Alex] Agreed.]`;
check("adding a footnote reply", computeAddReply(threaded, one(threaded), "Joe", "ok").newContent, `${threaded}^[[Joe] ok]`);
const braced = `{--${C}is --}{>>${C}Why.<<}`;
check("adding a brace reply writes metadata", computeAddReply(braced, one(braced), "Joe", "ok").newContent, `${braced}{>>{"author":"Joe"}@@ok<<}`);
check("adding an unsigned reply", computeAddReply(braced, one(braced), "", "ok").newContent, `${braced}{>>ok<<}`);
const t = one(threaded);
check("dismissing one reply", computeSpanReplace(threaded, t, t.replies[0].fullSpan.start, t.replies[0].fullSpan.end, "").newContent, `{--${C}is --}^[[Alex] Agreed.]`);
check("approving takes the replies with it", approve(threaded), "");

console.log("\n=== Comments on a spot ===");
for (const w of ["{>>What?<<}", "==>>What?<<==", "%%>>What?<<%%"]) {
	check(`>> is an operator, ${w}`, [one(`This is a test${w}.`).type, one(`This is a test${w}.`).isPoint, one(`This is a test${w}.`).commentText], ["comment", true, "What?"]);
}
check("a highlighted comment on a spot with an author", shape(one(`Text==>>[Claude]@@What?<<==`)), ["comment", "Claude", "", null, null, []]);
check("a hidden comment on a spot with an author", one(`Text%%>>[Claude]@@What?<<%%`).commentText, "What?");
check("it can carry replies", one(`Text%%>>What?<<%%^[[Joe] A test.]`).replies.length, 1);
check("dismissing removes it whole", dismiss(`A ==>>x<<== B`), "A  B");
check("the wrapper is still recorded", all(`{>>a<<} ==>>b<<== %%>>c<<%%`).map(a => a.wrapper), ["brace", "highlight", "percent"]);
const point = `This is a test{>>What?<<}.`;
check("a bare brace comment is a comment on a spot", [one(point).type, one(point).isPoint, one(point).originalText, one(point).commentText], ["comment", true, "", "What?"]);
check("with a label", one(`Text{>>[C] What?<<}`).author, "C");
check("with metadata", one(`Text{>>${C}What?<<}`).author, "Claude");
check("a hidden span with nothing attached is a plain comment on it", [one(`%%hidden%%`).type, one(`%%hidden%%`).isPoint, one(`%%hidden%%`).originalText, one(`%%hidden%%`).isPlain], ["comment", false, "hidden", true]);
check("a label without @@ inside percent marks is just text", shape(one(`%%[Claude] hidden%%`)), ["comment", null, "[Claude] hidden", null, null, []]);
check("the light form names the author", shape(one(`%%[Claude]@@hidden%%`)), ["comment", "Claude", "hidden", null, null, []]);
check("and is not plain then", one(`%%[Claude]@@hidden%%`).isPlain, false);
check("a reply on a hidden span shows, the accepted cost", one(`%%What?%%^[[Joe] A test.]`).replies.map(r => [r.author, r.text]), [["Joe", "A test."]]);
check("the doubled form works the same", shape(one(`%%%%[C]@@hidden%%%%`)), ["comment", "C", "hidden", null, null, []]);
check("dismissing a hidden commented span restores it", dismiss(`A %%T%%^[note] B`), "A T B");
check("one attached to an annotation is not a point comment", all(`{--is --}{>>[C] r<<}`).length, 1);
check("after a space it is", all(`text {>>x<<}`).map(a => a.isPoint), [true]);

console.log("\n=== Whitespace is kept exactly as written ===");
check("approve insert keeps its trailing space", approve(`This {++is ++}a test.`), "This is a test.");
check("approve delete removes the space with it", approve(`This is {--is --}a test.`), "This is a test.");
check("dismiss delete puts it all back", dismiss(`This is {--is --}a test.`), "This is is a test.");
check("a blank line can be inserted", one(`A.{++\n\n++}B.`).insertedText, "\n\n");
check("approving it", approve(`A.{++\n\n++}B.`), "A.\n\nB.");
check("a blank line can be deleted", approve(`A.{--\n\n--}B.`), "A.B.");
check("percent marks can span paragraphs", approve(`A.%%++\n\nNew paragraph.\n\n++%%B.`), "A.\n\nNew paragraph.\n\nB.");
check("a highlight cannot cross a blank line", all(`==--a\n\nb--==^[x]`).length, 0);

console.log("\n=== Nesting ===");
check("braces nest", all(`{++outer {++inner++} rest++}`).map(a => a.insertedText), ["outer {++inner++} rest", "inner"]);
check("with authors", all(`{++${C}outer {++{"author":"GPT"}@@inner++} rest++}`).map(a => a.author), ["Claude", "GPT"]);
check("percent marks chain", all(`%%++A ++%%%%++[GPT]@@X++%%%%++B++%%`).map(a => [a.author ?? null, a.insertedText]), [[null, "A "], ["GPT", "X"], [null, "B"]]);
const nested = `{++a {--${C}b--}^[[Claude] why] c++}`;
check("an inner annotation keeps its own replies", all(nested).map(shape), [["insert", null, "", `a {--${C}b--}^[[Claude] why] c`, null, []], ["delete", "Claude", "b", null, null, [["Claude", "why"]]]]);
check("approving the inner one", computeMutation(nested, all(nested)[1], "approve").newContent, `{++a  c++}`);

console.log("\n=== Author editing ===");
const rewrite = (current, author, meta) => {
	if (current.startsWith("{")) {
		const fields = author ? { author, ...(meta ?? {}) } : { ...(meta ?? {}) };
		return Object.keys(fields).length ? JSON.stringify(fields) + "@@" : "";
	}
	if (!author) return "";
	if (current.endsWith("@@")) return `[${author}]@@`;
	return `[${author}]` + current.replace(/^\[[^\]]*\]/, "");
};
function setAuthor(doc, value, target) {
	const ann = one(doc);
	const tgt = target ? target(ann) : ann;
	if (tgt.authorSpan) {
		const current = ann.fullMatch.slice(tgt.authorSpan.start, tgt.authorSpan.end);
		return computeSpanReplace(doc, ann, tgt.authorSpan.start, tgt.authorSpan.end, rewrite(current, value, tgt.authorMeta)).newContent;
	}
	const p = tgt.authorInsert;
	return computeSpanReplace(doc, ann, p.at, p.at, `${p.prefix}${value}${p.suffix}`).newContent;
}
check("change, metadata", setAuthor(`{--${C}T--}`, "Joe"), `{--{"author":"Joe"}@@T--}`);
check("change keeps other metadata fields", setAuthor(`{--{"author":"Claude","time":5}@@T--}`, "Joe"), `{--{"author":"Joe","time":5}@@T--}`);
check("change, light form", setAuthor(`==--[Claude]@@T--==`, "Joe"), `==--[Joe]@@T--==`);
check("clear", setAuthor(`==--[Claude]@@T--==`, ""), `==--T--==`);
check("clearing keeps other metadata fields", setAuthor(`{--{"author":"Claude","time":5}@@T--}`, ""), `{--{"time":5}@@T--}`);
check("add in braces writes metadata", setAuthor(`{--T--}`, "Claude"), `{--${C}T--}`);
check("add in a highlight writes the light form", setAuthor(`==--T--==`, "Claude"), `==--[Claude]@@T--==`);
check("add on a replacement, before the old text", setAuthor(`==--old~>new++==`, "Claude"), `==--[Claude]@@old~>new++==`);
check("add on a span comment", setAuthor(`==T==^[note]`, "Claude"), `==[Claude]@@T==^[note]`);
check("add on a hidden span, the light form", setAuthor(`%%note%%`, "Claude"), `%%[Claude]@@note%%`);
check("add on a brace point comment, as metadata", setAuthor(`A{>>note<<}`, "Claude"), `A{>>${C}note<<}`);
check("clear it again", setAuthor(`%%[Claude]@@note%%`, ""), `%%note%%`);
const withReply = `{--T--}^[why]`;
check("add to a footnote reply, as a label", setAuthor(withReply, "Alex", a => a.replies[0]), `{--T--}^[[Alex] why]`);
const withBraceReply = `{--T--}{>>why<<}`;
check("add to a brace reply, as metadata", setAuthor(withBraceReply, "Alex", a => a.replies[0]), `{--T--}{>>{"author":"Alex"}@@why<<}`);
check("change a reply's label", setAuthor(`{--T--}^[[Alex] why]`, "Joe", a => a.replies[0]), `{--T--}^[[Joe] why]`);
check("clear a reply's label", setAuthor(`{--T--}^[[Alex] why]`, "", a => a.replies[0]), `{--T--}^[why]`);

console.log("\n=== Editing the annotated text ===");
function setSpan(doc, spanName, value) {
	const ann = one(doc);
	const s = ann[spanName];
	return computeSpanReplace(doc, ann, s.start, s.end, value).newContent;
}
check("the deleted text, after its author", setSpan(`{--${C}Old--}`, "originalSpan", "New"), `{--${C}New--}`);
check("the old half of a replacement", setSpan(`{~~a~>b~~}`, "originalSpan", "c"), `{~~c~>b~~}`);
check("the new half, arrow form", setSpan(`==--a~>b++==`, "replacementSpan", "c"), `==--a~>c++==`);
check("the new half, fused form", setSpan(`==--a--++b++==`, "replacementSpan", "c"), `==--a--++c++==`);
check("the new half, tilde form", setSpan(`{~~a~>b~~}`, "replacementSpan", "c"), `{~~a~>c~~}`);
check("the inserted text, spaces included", setSpan(`%%++[C]@@X++%%`, "bodySpan", "Y "), `%%++[C]@@Y ++%%`);
check("a hidden span's text", setSpan(`%%[C]@@note%%`, "originalSpan", "other"), `%%[C]@@other%%`);
check("a reply's text", (() => { const d = `{--T--}^[[A] why]`; const r = one(d).replies[0]; return computeSpanReplace(d, one(d), r.textSpan.start, r.textSpan.end, "because").newContent; })(), `{--T--}^[[A] because]`);
check("a point comment has no text span", one(`A{>>x<<}`).originalSpan, undefined);

console.log("\n=== Approve and dismiss ===");
check("approve replace", approve(`This ==--[Claude]@@isn't~>is++== a test.`), "This is a test.");
check("dismiss replace", dismiss(`This ==--[Claude]@@isn't~>is++== a test.`), "This isn't a test.");
check("approve fused replace", approve(`==--isn't--++is++==`), "is");
check("approve tilde replace", approve(`{~~isn't~>is~~}`), "is");
check("approve insert", approve(`%%++[C]@@New.++%%`), "New.");
check("dismiss insert", dismiss(`%%++[C]@@New.++%%`), "");
check("dismiss brace comment span", dismiss(`{==T==}{>>note<<}`), "T");
check("comments cannot be approved", computeMutation(`==T==^[note]`, one(`==T==^[note]`), "approve").ok, false);

console.log("\n=== Code, links and stray delimiters ===");
const fenced = "```python\n==--x--==^[[C]]\n```\n\n```ad-j\n==--[C]@@y--==\n{++z++}\n```";
check("plain fence ignored, ad- fence scanned", all(fenced).map(a => a.originalText || a.insertedText), ["y", "z"]);
check("admonition blocks listed", detectAdmonitionBlocks(fenced, "t.md").map(b => b.adType), ["ad-j"]);
check("percent marks inside an admonition are ignored", all("```ad-j\n%%++x++%%\n```").length, 0);
check("insideAdBlock is set", all(fenced).map(a => a.insideAdBlock), [true, true]);
check("a backticked == does not desync what follows",
	all("Wrap it in `==` like so.\nFirst: ==--one--==^[[C]]\nSecond: ==--two--==^[[C]]").map(a => a.originalText), ["one", "two"]);
check("a stray == does not either",
	all("Someone writes == literally.\n\n==--Real--==\n\n==--Another--==").map(a => a.originalText), ["Real", "Another"]);
check("a plain highlight before a real annotation", all(`==plain== and ==--real--==^[c]`).map(a => a.originalText), ["plain", "real"]);
check("a backticked brace form is ignored", all("Use `{++x++}` like so. {++real++}").map(a => a.insertedText), ["real"]);
check("a backticked percent form is ignored", all("Use `%%++x++%%` like so. %%++real++%%").map(a => a.insertedText), ["real"]);
check("markers inside a reply's text are not annotations", all(`==T==^[[C] use {++x++} here]`).map(a => a.type), ["comment"]);
check("a brace highlight next to a real one", all(`{==x==} and ==y==^[c]`).map(a => a.originalText), ["x", "y"]);
check("double hyphens in prose are not a deletion", shape(one(`==a -- b==^[c]`)), ["comment", null, "a -- b", null, null, [[null, "c"]]]);
check("nor inside one", one(`{--a -- b--}`).originalText, "a -- b");
check("a link is not an annotation", all(`[text](==x==)`).length, 0);
check("everything comes back in note order", all(`{++a++} ==--b--==^[x] %%++c++%% d{>>e<<}`).map(a => a.type), ["insert", "delete", "insert", "comment"]);

console.log("\n=== Insert context ===");
const ctx = "Plain.\n\n```ad-j\nfenced\n```\n\nBefore %%++an insert++%% %%--gone--%% %%--old~>new++%% after.";
check("plain", getInsertContext(ctx, ctx.indexOf("Plain")), PLAIN);
check("fenced", getInsertContext(ctx, ctx.indexOf("fenced")), FENCED);
check("inside an insert", getInsertContext(ctx, ctx.indexOf("an insert")), { kind: "nested", marker: "++" });
check("inside a deletion", getInsertContext(ctx, ctx.indexOf("gone")), { kind: "nested", marker: "--" });
check("inside the old half of a replacement", getInsertContext(ctx, ctx.indexOf("old")), { kind: "nested", marker: "--" });
check("inside the new half", getInsertContext(ctx, ctx.indexOf("new")), { kind: "nested", marker: "++" });

console.log("\n=== What the editor commands write is read back correctly ===");
/** Types `typed` at the caret position the command would have left. */
function fill(composed, typed) {
	return composed.text.slice(0, composed.cursor) + typed + composed.text.slice(composed.cursor);
}
check("comment, CriticMarkup throughout", composeComment("Sel.", "Claude", "brace", "brace").text, `{==Sel.==}{>>${C}<<}`);
check("and it reads back", shape(one(fill(composeComment("Sel.", "Claude", "brace", "brace"), "My note."))), ["comment", null, "Sel.", null, null, [["Claude", "My note."]]]);
check("comment, highlight and footnote", shape(one(fill(composeComment("Sel.", "C", "highlight", "footnote"), "My note."))), ["comment", null, "Sel.", null, null, [["C", "My note."]]]);
check("comment with percent marks hides the span and shows the reply", composeComment("Sel.", "C", "percent", "footnote").text, `%%Sel.%%^[[C] ]`);
check("and it reads back as a comment on that span", shape(one(fill(composeComment("Sel.", "C", "percent", "footnote"), "hm"))), ["comment", null, "Sel.", null, null, [["C", "hm"]]]);
check("a comment opens a reply even without an author", shape(one(fill(composeComment("Sel.", "", "brace", "brace"), "note"))), ["comment", null, "Sel.", null, null, [[null, "note"]]]);
check("delete writes the author inside, metadata in braces", composeDelete("Sel.", "Claude", "brace").text, `{--${C}Sel.--}`);
check("delete, light form in a highlight", composeDelete("Sel.", "Claude", "highlight").text, `==--[Claude]@@Sel.--==`);
check("delete without an author", composeDelete("Sel.", "", "brace").text, `{--Sel.--}`);
check("delete reads back", shape(one(composeDelete("Sel.", "Claude", "brace").text)), ["delete", "Claude", "Sel.", null, null, []]);
check("replace in braces is the CriticMarkup form", composeReplace("Sel.", "Claude", "brace").text, `{~~${C}Sel.~>~~}`);
check("replace in a highlight is the arrow form", composeReplace("Sel.", "Claude", "highlight").text, `==--[Claude]@@Sel.~>++==`);
check("replace reads back", shape(one(fill(composeReplace("Sel.", "Claude", "brace"), "New."))), ["replace", "Claude", "Sel.", null, "New.", []]);
check("replace, highlight, reads back", shape(one(fill(composeReplace("Sel.", "Claude", "highlight"), "New."))), ["replace", "Claude", "Sel.", null, "New.", []]);
check("replace without an author", shape(one(fill(composeReplace("Sel.", "", "percent"), "New."))), ["replace", null, "Sel.", null, "New.", []]);
check("insert, braces", composeInsert("Sel.", "Claude", PLAIN, "brace", "brace").text, `{++${C}Sel.++}`);
check("insert, percent marks", composeInsert("Sel.", "Claude", PLAIN, "percent", "highlight").text, `%%++[Claude]@@Sel.++%%`);
check("insert reads back", shape(one(composeInsert("Sel.", "Claude", PLAIN, "percent", "highlight").text)), ["insert", "Claude", "", "Sel.", null, []]);
check("percent marks fall back in a fence, to braces", composeInsert("Sel.", "Claude", FENCED, "percent", "brace").text, `{++${C}Sel.++}`);
check("or to a highlight", composeInsert("Sel.", "Claude", FENCED, "percent", "highlight").text, `==++[Claude]@@Sel.++==`);
check("braces stay braces in a fence", composeInsert("Sel.", "Claude", FENCED, "brace", "highlight").text, `{++${C}Sel.++}`);
check("an open reply, brace", openReply("Claude", "brace"), { text: `{>>${C}<<}`, cursor: 3 + C.length });
check("an open reply, footnote", openReply("C", "footnote"), { text: "^[[C] ]", cursor: 6 });
check("an open reply without an author", openReply("", "footnote"), { text: "^[]", cursor: 2 });
check("a finished reply", replyEntry("Claude", "ok", "brace"), `{>>${C}ok<<}`);
check("a comment on a spot, braces", composePointComment("Claude", "brace"), { text: `{>>${C}<<}`, cursor: 3 + C.length });
check("a comment on a spot, highlight", composePointComment("Claude", "highlight"), { text: "==>>[Claude]@@<<==", cursor: 14 });
check("a comment on a spot, percent marks", composePointComment("", "percent"), { text: "%%>><<%%", cursor: 4 });
check("all three read back the same", ["brace", "highlight", "percent"].map(w => one(fill(composePointComment("Claude", w), "hm")).commentText), ["hm", "hm", "hm"]);
// A nested insert only makes sense written into a surrounding one, so check
// that the whole thing still reads as three separate inserts afterwards.
const surrounding = `%%++[C]@@Before. After.++%%`;
const splitPoint = surrounding.indexOf("After.");
const context = getInsertContext(surrounding, splitPoint);
const combined = surrounding.slice(0, splitPoint) + composeInsert("Mine.", "G", context, "percent", "highlight").text + surrounding.slice(splitPoint);
check("nesting keeps all three inserts", all(combined).map(a => [a.author ?? null, a.insertedText]), [["C", "Before. "], ["G", "Mine."], [null, "After."]]);

console.log("\n=== The channel option decides where a first reply goes ===");
const bare = `{--T--}`;
const asBrace = detectAnnotations(bare, "t.md", { channel: "brace" })[0];
check("a first reply in a brace comment", computeAddReply(bare, asBrace, "A", "ok").newContent, `{--T--}{>>{"author":"A"}@@ok<<}`);
check("a footnote without the option", computeAddReply(bare, one(bare), "A", "ok").newContent, `{--T--}^[[A] ok]`);
const chained = `{--T--}^[[C] why]`;
check("an existing chain is followed whatever the option says", computeAddReply(chained, detectAnnotations(chained, "t.md", { channel: "brace" })[0], "A", "ok").newContent, `{--T--}^[[C] why]^[[A] ok]`);

console.log("\n=== Deleting an admonition tidies the blank lines ===");
const block = "```ad-c\nNote.\n```";
const doc = `Before.\n\n${block}\n\nAfter.`;
check("collapses to one blank line", computeRemoval(doc, doc.indexOf(block), block).newContent, "Before.\n\nAfter.");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
