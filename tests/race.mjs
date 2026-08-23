import esbuild from "esbuild";
import { builtinModules } from "node:module";

// Build main.ts with the Obsidian API swapped for the local stub.
const result = await esbuild.build({
	entryPoints: ["main.ts"],
	bundle: true,
	format: "cjs",
	platform: "node",
	external: [...builtinModules],
	alias: { obsidian: "./tests/obsidian-stub.ts" },
	write: false
});
const mod = { exports: {} };
new Function("module", "exports", "require", result.outputFiles[0].text)(
	mod,
	mod.exports,
	(await import("node:module")).createRequire(import.meta.url)
);
const AnnotationReviewPlugin = mod.exports.default;

let pass = 0, fail = 0;
function check(label, actual, expected) {
	const a = JSON.stringify(actual), e = JSON.stringify(expected);
	if (a === e) { pass++; console.log(`  ok   ${label}`); }
	else { fail++; console.log(`  FAIL ${label}\n         got:      ${a}\n         expected: ${e}`); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

const NOTES = {
	"A.md": "Note A: ==alpha text==^[[Claude] delete]",
	"B.md": "Note B: ==bravo text==^[[GPT] delete]"
};

/** Reads resolve after a per-file delay, so completion order can be controlled. */
function makeHarness(delays) {
	let activePath = "A.md";
	const app = {
		workspace: {
			getActiveFile: () => ({ path: activePath, extension: "md" }),
			getLeavesOfType: () => [],
			on: () => ({}),
			onLayoutReady: () => {}
		},
		vault: {
			read: async file => {
				await sleep(delays[file.path] ?? 0);
				return NOTES[file.path];
			},
			getAbstractFileByPath: () => null
		}
	};
	const plugin = new AnnotationReviewPlugin(app);
	plugin.app = app;
	return { plugin, setActive: p => (activePath = p) };
}

console.log("=== 1. Older read must not overwrite a newer one ===");
{
	// A is slow, B is fast. A is requested first, so without a guard A's result
	// lands last and the panel ends up showing A while B is on screen.
	const { plugin, setActive } = makeHarness({ "A.md": 60, "B.md": 5 });
	const first = plugin.rescanActiveFile();
	setActive("B.md");
	const second = plugin.rescanActiveFile();
	await Promise.all([first, second]);
	await sleep(120);
	check("scannedPath is the note on screen", plugin.scannedPath, "B.md");
	check("annotation belongs to that note", plugin.annotations.map(a => a.author), ["GPT"]);
}

console.log("\n=== 2. Note switched during a read, with no second event ===");
{
	// Nothing tells the plugin to look again, so the trailing re-check has to
	// notice the note moved on and scan the new one by itself.
	const { plugin, setActive } = makeHarness({ "A.md": 40, "B.md": 5 });
	const scan = plugin.rescanActiveFile();
	setActive("B.md");
	await scan;
	await sleep(120);
	check("catches up to the current note", plugin.scannedPath, "B.md");
	check("annotation belongs to that note", plugin.annotations.map(a => a.author), ["GPT"]);
}

console.log("\n=== 3. Rapid A -> B -> A settles on the last one ===");
{
	const { plugin, setActive } = makeHarness({ "A.md": 30, "B.md": 30 });
	const p1 = plugin.rescanActiveFile();
	setActive("B.md");
	const p2 = plugin.rescanActiveFile();
	setActive("A.md");
	const p3 = plugin.rescanActiveFile();
	await Promise.all([p1, p2, p3]);
	await sleep(150);
	check("settles on the final note", plugin.scannedPath, "A.md");
	check("annotation belongs to that note", plugin.annotations.map(a => a.author), ["Claude"]);
}

console.log("\n=== 4. A single ordinary scan still works ===");
{
	const { plugin } = makeHarness({ "A.md": 5 });
	await plugin.rescanActiveFile();
	await sleep(30);
	check("scannedPath set", plugin.scannedPath, "A.md");
	check("annotations found", plugin.annotations.length, 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
