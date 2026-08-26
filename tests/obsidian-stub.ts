/* Minimal stand-ins for the Obsidian API, so the plugin class can be loaded
   and exercised outside Obsidian. Only what the plugin actually touches. */
export class Plugin {
	app: any;
	constructor(app?: any) {
		this.app = app;
	}
	registerView() {}
	addRibbonIcon() {}
	addCommand() {}
	addSettingTab() {}
	registerEvent() {}
	registerEditorExtension() {}
	registerMarkdownPostProcessor() {}
	async loadData() {
		return {};
	}
	async saveData() {}
}
export class PluginSettingTab {
	app: any;
	containerEl: any = { empty() {} };
	constructor(app: any, _plugin: any) {
		this.app = app;
	}
}
export class ItemView {
	leaf: any;
	containerEl: any = { children: [null, { empty() {}, addClass() {} }] };
	constructor(leaf: any) {
		this.leaf = leaf;
	}
}
export class Modal {
	app: any;
	contentEl: any;
	scope: any = { register() {} };
	constructor(app: any) {
		this.app = app;
	}
	open() {}
	close() {}
}
export class FuzzySuggestModal {
	app: any;
	constructor(app: any) {
		this.app = app;
	}
	setPlaceholder() {}
	open() {}
}
export class Setting {
	constructor(_el: any) {}
	setName() {
		return this;
	}
	setDesc() {
		return this;
	}
	addText() {
		return this;
	}
	addTextArea() {
		return this;
	}
	addDropdown() {
		return this;
	}
	addButton() {
		return this;
	}
}
export class ColorComponent {
	constructor(_el: any) {}
	setValue() {
		return this;
	}
	onChange() {
		return this;
	}
}
export class Notice {
	constructor(_msg: string) {}
}
export class TFile {
	path = "";
	extension = "md";
}
export class MarkdownView {}
export class WorkspaceLeaf {}
export class Menu {}
export const MarkdownRenderer = {
	async render() {}
};
export const editorLivePreviewField = {};
export const Platform = { isMobile: false, isPhone: false, isTablet: false };
export function setIcon() {}
export function setTooltip() {}
export function debounce(cb: any) {
	return cb;
}
export type Editor = any;
export type EditorPosition = any;
export type App = any;
export type FuzzyMatch<T> = { item: T };
export type TextAreaComponent = any;
