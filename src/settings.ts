import { App, PluginSettingTab, Setting } from "obsidian";
import type AnnotationReviewPlugin from "../main";
import { Wrapper } from "./types";

export interface AnnotationReviewSettings {
	/** Prefilled author label for new annotations. Blank means no label. */
	defaultAuthor: string;
	/** Expanded state carries across notes, and is tracked per tab. */
	repliesExpanded: boolean;
	admonitionsExpanded: boolean;
	/** Wrapper the commands use for comments, deletions and replacements. */
	wrapper: Wrapper;
	/** Wrapper for insertions, outside fenced blocks where percent marks do not render. */
	insertWrapper: Wrapper;
}

export const DEFAULT_SETTINGS: AnnotationReviewSettings = {
	defaultAuthor: "",
	repliesExpanded: false,
	admonitionsExpanded: false,
	wrapper: "highlight",
	insertWrapper: "percent"
};

const WRAPPER_LABELS: Record<Wrapper, string> = {
	highlight: "Highlight, ==text==",
	brace: "Braces, {text}",
	percent: "Percent marks, %%text%%"
};

function addWrapperDropdown(setting: Setting, value: Wrapper, onChange: (value: Wrapper) => Promise<void>) {
	setting.addDropdown(dropdown => {
		for (const key of Object.keys(WRAPPER_LABELS) as Wrapper[]) dropdown.addOption(key, WRAPPER_LABELS[key]);
		dropdown.setValue(value).onChange(v => onChange(v as Wrapper));
	});
}

export class AnnotationReviewSettingTab extends PluginSettingTab {
	plugin: AnnotationReviewPlugin;

	constructor(app: App, plugin: AnnotationReviewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Author")
			.setDesc("Written into every new annotation as its [Author] label. Leave blank for no label.")
			.addText(text =>
				text
					.setPlaceholder("e.g. Claude")
					.setValue(this.plugin.settings.defaultAuthor)
					.onChange(async value => {
						this.plugin.settings.defaultAuthor = value.trim();
						await this.plugin.saveSettings();
					})
			);

		addWrapperDropdown(
			new Setting(containerEl)
				.setName("Wrapper for comments, deletions and replacements")
				.setDesc("How the note shows the annotated text. A highlight shows it highlighted, braces show it as it is, percent marks hide it."),
			this.plugin.settings.wrapper,
			async value => {
				this.plugin.settings.wrapper = value;
				await this.plugin.saveSettings();
			}
		);

		addWrapperDropdown(
			new Setting(containerEl)
				.setName("Wrapper for insertions")
				.setDesc("Percent marks hide the inserted text until it is approved. Inside a fenced block they do not render, so a highlight is used there whatever this says."),
			this.plugin.settings.insertWrapper,
			async value => {
				this.plugin.settings.insertWrapper = value;
				await this.plugin.saveSettings();
			}
		);
	}
}
