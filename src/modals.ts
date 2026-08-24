import { App, FuzzyMatch, FuzzySuggestModal, Modal, Setting } from "obsidian";

/**
 * Setting the author label used for new annotations. The annotation commands
 * themselves never open a dialog, they write straight into the note and leave
 * the caret where text is needed, so this is the only prompt left.
 */
export class AuthorModal extends Modal {
	private author: string;
	private onSubmit: (author: string) => void;

	constructor(app: App, initialAuthor: string, onSubmit: (author: string) => void) {
		super(app);
		this.author = initialAuthor;
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("annotation-review-modal");
		contentEl.createEl("h3", { text: "Author for new annotations" });

		new Setting(contentEl)
			.setName("Author")
			.setDesc("Leave blank to write annotations without a label.")
			.addText(text => {
				text.setPlaceholder("e.g. Claude")
					.setValue(this.author)
					.onChange(value => (this.author = value));
				text.inputEl.addEventListener("keydown", evt => {
					if (evt.key === "Enter") {
						evt.preventDefault();
						this.submit();
					}
				});
				window.setTimeout(() => text.inputEl.focus(), 0);
			});

		new Setting(contentEl).addButton(button =>
			button
				.setButtonText("Save")
				.setCta()
				.onClick(() => this.submit())
		);
	}

	private submit() {
		this.close();
		this.onSubmit(this.author.trim());
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
 * The type picker behind the single "choose type of annotation" command. A
 * suggest modal rather than a context menu, since a command has no click
 * position to anchor a menu to, and this stays keyboard and touch friendly.
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
