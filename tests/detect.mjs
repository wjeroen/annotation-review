import esbuild from "esbuild";
import { builtinModules } from "node:module";

const built = await esbuild.build({
	stdin: {
		contents: `
			export { detectAnnotations, detectAdmonitionBlocks, getInsertContext } from "./src/detect";
			export { computeMutation, computeAddReply, computeSpanReplace, computeRemoval } from "./src/actions";
			export { composeComment, composeDelete, composeReplace, composeInsert } from "./src/compose";
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
	composeInsert
} = mod.exports;

let pass = 0, fail = 0;
function check(label, actual, expected) {
	const a = JSON.stringify(actual), e = JSON.stringify(expected);
	if (a === e) { pass++; console.log(`  ok   ${label}`); }
	else { fail++; console.log(`  FAIL ${label}\n         got:      ${a}\n         expected: ${e}`); }
}
const one = (doc) => detectAnnotations(doc, "t.md")[0];

console.log("=== Types ===");
check("comment", one(`==T.==^[[C] note]`).type, "comment");
check("delete", one(`==T.==^[[C] delete]`).type, "delete");
check("replace", one(`==T.==^[[C] → "N."]`).type, "replace");
check("insert, percent marks", one(`%%[C] N.%%`).type, "insert");
check("insert, highlight form", one(`==++[C] N.++==`).type, "insert");
check("insert, footnote form", one(`==N.==^[[C] insert]`).type, "insert");
check("no footnote is not an annotation", detectAnnotations(`==T.==`, "t.md").length, 0);

console.log("\n=== The type keyword is not repeated in the reason ===");
check("delete reason", one(`==T.==^[[C] delete, outdated]`).reason, "outdated");
check("replace reason", one(`==T.==^[[C] → "N.", clearer]`).reason, "clearer");
check("replace text", one(`==T.==^[[C] → "N.", clearer]`).replacement, "N.");

console.log("\n=== Code blocks ===");
const fenced = "```python\n==x==^[[C] delete]\n```\n\n```ad-j\n==y==^[[C] delete]\n```";
check("plain fence ignored, ad- fence scanned", detectAnnotations(fenced, "t.md").map(a => a.originalText), ["y"]);
check("admonition blocks listed", detectAdmonitionBlocks(fenced, "t.md").map(b => b.adType), ["ad-j"]);
check("bare ad-c paragraph is not an annotation", detectAnnotations("```ad-c\nJust a note.\n```", "t.md").length, 0);

console.log("\n=== A stray == must not desync the rest of the file ===");
const stray = `Someone writes == literally here.\n\n==Real one.==^[[C] delete]\n\n==Another.==^[[C] delete]`;
check("both real annotations survive", detectAnnotations(stray, "t.md").map(a => a.originalText), ["Real one.", "Another."]);

console.log("\n=== Nested inserts ===");
check("doubled marks give three inserts",
	detectAnnotations(`%%[C] One.%%%%[G] Two.%%%%[C] Three.%%`, "t.md").map(a => a.insertedText),
	["One.", "Two.", "Three."]);

console.log("\n=== Replies ===");
const withReplies = `==T.==^[[C] delete]^[[A] disagree]^[[C] fair]`;
const wr = one(withReplies);
check("replies parsed", wr.replies.map(r => [r.author, r.text]), [["A", "disagree"], ["C", "fair"]]);
check("replies on a percent insert", one(`%%[G] N.%%^[[A] nice]`).replies.length, 1);
check("dismissing one reply",
	computeSpanReplace(withReplies, wr, wr.replies[0].fullSpan.start, wr.replies[0].fullSpan.end, "").newContent,
	`==T.==^[[C] delete]^[[C] fair]`);
check("a reply starting with 'insert' stays a reply", one(`%%[C] N.%%^[[A] insert reads well]`).replies.length, 1);

console.log("\n=== Approve and dismiss ===");
check("approve replace", computeMutation(`==Old.==^[[C] → "New."]`, one(`==Old.==^[[C] → "New."]`), "approve").newContent, "New.");
check("dismiss replace", computeMutation(`==Old.==^[[C] → "New."]`, one(`==Old.==^[[C] → "New."]`), "dismiss").newContent, "Old.");
check("approve delete", computeMutation(`==Old.==^[[C] delete]`, one(`==Old.==^[[C] delete]`), "approve").newContent, "");
check("approve insert", computeMutation(`%%[C] New.%%`, one(`%%[C] New.%%`), "approve").newContent, "New.");
check("dismiss insert", computeMutation(`%%[C] New.%%`, one(`%%[C] New.%%`), "dismiss").newContent, "");
check("comments cannot be approved", computeMutation(`==T.==^[[C] note]`, one(`==T.==^[[C] note]`), "approve").ok, false);
check("approving takes replies with it",
	computeMutation(withReplies, wr, "approve").newContent, "");

console.log("\n=== Author editing ===");
const withAuthor = `==T.==^[[C] delete]`;
const wa = one(withAuthor);
check("change", computeSpanReplace(withAuthor, wa, wa.authorSpan.start, wa.authorSpan.end, "[J] ").newContent, `==T.==^[[J] delete]`);
check("clear", computeSpanReplace(withAuthor, wa, wa.authorSpan.start, wa.authorSpan.end, "").newContent, `==T.==^[delete]`);
const noAuthor = `==T.==^[delete]`;
const na = one(noAuthor);
check("add where there was none",
	computeSpanReplace(noAuthor, na, na.authorInsertAt, na.authorInsertAt, "[C] ").newContent, `==T.==^[[C] delete]`);

console.log("\n=== Adding a reason where there is none ===");
function addReason(doc, text) {
	const ann = one(doc);
	const r = ann.reasonInsert;
	return r ? computeSpanReplace(doc, ann, r.at, r.at, `${r.prefix}${text}${r.suffix}`).newContent : "(none)";
}
check("delete", addReason(`==T.==^[[C] delete]`, "why"), `==T.==^[[C] delete, why]`);
check("replace", addReason(`==T.==^[[C] → "N."]`, "why"), `==T.==^[[C] → "N.", why]`);
check("percent insert", addReason(`%%[C] N.%%`, "why"), `%%[C] N.%%^[insert, why]`);
check("that reason reads back as a reason", one(`%%[C] N.%%^[insert, why]`).reason, "why");
check("a comment has no reason slot", one(`==T.==^[[C] note]`).reasonInsert, undefined);

console.log("\n=== Deleting an admonition tidies the blank lines ===");
const block = "```ad-c\nNote.\n```";
const doc = `Before.\n\n${block}\n\nAfter.`;
check("collapses to one blank line", computeRemoval(doc, doc.indexOf(block), block).newContent, "Before.\n\nAfter.");

console.log("\n=== Insert context ===");
const ctx = "Plain.\n\n```ad-j\nfenced\n```\n\nBefore %%an insert%% after.";
check("plain", getInsertContext(ctx, ctx.indexOf("Plain")), "plain");
check("fenced", getInsertContext(ctx, ctx.indexOf("fenced")), "fenced");
check("inside an existing insert", getInsertContext(ctx, ctx.indexOf("an insert")), "native-comment");

console.log("\n=== Adding a reply ===");
check("author typed into the field", computeAddReply(withAuthor, wa, "[J] hmm").newContent, `==T.==^[[C] delete]^[[J] hmm]`);

console.log("\n=== What the editor commands write is read back correctly ===");
function roundTrip(written) {
	const a = one(written);
	return a ? [a.type, a.author ?? null, a.originalText || a.insertedText, a.replacement ?? null] : null;
}
check("comment", roundTrip(composeComment("Sel.", "My note.", "C")), ["comment", "C", "Sel.", null]);
check("comment without an author", roundTrip(composeComment("Sel.", "My note.", "")), ["comment", null, "Sel.", null]);
check("delete", roundTrip(composeDelete("Sel.", "C")), ["delete", "C", "Sel.", null]);
check("replace", roundTrip(composeReplace("Sel.", "New.", "C")), ["replace", "C", "Sel.", "New."]);
check("insert, plain", roundTrip(composeInsert("Sel.", "C", "plain")), ["insert", "C", "Sel.", null]);
check("insert, highlight form", roundTrip(composeInsert("Sel.", "C", "fenced")), ["insert", "C", "Sel.", null]);
check("insert, nested in another insert", roundTrip(composeInsert("Sel.", "C", "native-comment")), ["insert", "C", "Sel.", null]);
check("comment text survives the round trip", one(composeComment("Sel.", "My note.", "C")).commentText, "My note.");
// A nested insert only makes sense written into a surrounding one, so check
// that the whole thing still reads as three separate inserts afterwards.
const surrounding = `%%[C] Before. After.%%`;
const splitPoint = surrounding.indexOf(" After.");
const nested = surrounding.slice(0, splitPoint) + composeInsert("Mine.", "G", "native-comment") + surrounding.slice(splitPoint);
check("nesting keeps all three inserts",
	detectAnnotations(nested, "t.md").map(a => [a.author, a.insertedText]),
	[["C", "Before."], ["G", "Mine."], [null, "After."]]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
