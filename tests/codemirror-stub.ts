/* Stand-ins for @codemirror/view and @codemirror/state, which Obsidian
   provides at runtime. The plugin builds its extensions at load time, and the
   tests never render an editor, so these only have to exist. */
export const EditorView = {
	updateListener: { of: (listener: unknown) => listener },
	decorations: { from: (field: unknown) => field }
};
export class WidgetType {}
export class GutterMarker {}
export const Decoration = {
	mark: () => ({ range: () => ({}) }),
	replace: () => ({ range: () => ({}) }),
	widget: () => ({ range: () => ({}) }),
	set: () => ({}),
	none: {}
};
export function gutter() {
	return {};
}
export const StateField = {
	define: (spec: unknown) => spec
};
export type Extension = unknown;
export type Range<T> = T;
export type DecorationSet = unknown;
export type EditorState = unknown;
