/* Stand-in for @codemirror/view, which Obsidian provides at runtime. The
   plugin only registers an update listener, and the tests never fire one. */
export const EditorView = {
	updateListener: {
		of: (listener: unknown) => listener
	}
};
