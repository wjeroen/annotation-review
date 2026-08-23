import { App, FuzzyMatch, FuzzySuggestModal, Modal, Setting, TextAreaComponent } from "obsidian";

export interface InputModalOptions {
	title: string;
	/** Label for the main text field, or null for an author-only prompt. */
	textLabel: string | null;
	placeholder?: string;
	initialText?: string;
	initialAuthor: string;
	submitLabel: string;
	onSubmit: (text: string, author: string) => void;
}

export class AnnotationInputModal extends Modal {
	private text: string;
	private author: string;
	private opts: InputModalOptions;

	constructor(app: App, opts: InputModalOptions) {
		super(app);
		this.opts = opts;
		this.text = opts.initialText ?? "";
		this.author = opts.initialAuthor;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("annotation-review-modal");
		contentEl.createEl("h3", { text: this.opts.title });

		let textArea: TextAreaComponent | null = null;
		if (this.opts.textLabel !== null) {
			new Setting(contentEl).setName(this.opts.textLabel).addTextArea(t => {
				textArea = t;
				t.setPlaceholder(this.opts.placeholder ?? "")
					.setValue(this.text)
					.onChange(v => (this.text = v));
				t.inputEl.addClass("annotation-review-modal-textarea");
			});
		}

		new Setting(contentEl)
			.setName("Author")
			.setDesc("Optional. Leave blank for your own annotations.")
			.addText(t => {
				t.setPlaceholder("e.g. Claude")
					.setValue(this.author)
					.onChange(v => (this.author = v));
				if (this.opts.textLabel === null) {
					window.setTimeout(() => t.inputEl.focus(), 0);
				}
			});

		new Setting(contentEl).addButton(b =>
			b
				.setButtonText(this.opts.submitLabel)
				.setCta()
				.onClick(() => this.submit())
		);

		if (textArea) {
			window.setTimeout(() => textArea?.inputEl.focus(), 0);
		}

		this.scope.register(["Mod"], "Enter", () => {
			this.submit();
			return false;
		});
	}

	private submit() {
		const text = this.text.trim();
		if (this.opts.textLabel !== null && !text) return;
		this.close();
		this.opts.onSubmit(text, this.author.trim());
	}

	onClose() {
		this.contentEl.empty();
	}
}

export interface PickerItem {
	id: string;
	label: string;
	description: string;
}

/**
 * The type picker behind the single "choose type" command. A suggest modal
 * rather than a context menu, since a command has no click position to anchor
 * a menu to, and this stays keyboard and touch friendly.
 */
export class AnnotationTypePicker extends FuzzySuggestModal<PickerItem> {
	private items: PickerItem[];
	private onPick: (id: string) => void;

	constructor(app: App, items: PickerItem[], onPick: (id: string) => void) {
		super(app);
		this.items = items;
		this.onPick = onPick;
		this.setPlaceholder("Annotation type");
	}

	getItems(): PickerItem[] {
		return this.items;
	}

	getItemText(item: PickerItem): string {
		return `${item.label} ${item.description}`;
	}

	renderSuggestion(match: FuzzyMatch<PickerItem>, el: HTMLElement) {
		el.createEl("div", { text: match.item.label });
		el.createEl("small", { text: match.item.description, cls: "annotation-review-picker-desc" });
	}

	onChooseItem(item: PickerItem) {
		this.onPick(item.id);
	}
}
