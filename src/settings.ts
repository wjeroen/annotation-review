import { App, PluginSettingTab, Setting } from "obsidian";
import type AnnotationReviewPlugin from "../main";
import { AnnotationType, MetaChannel, Wrapper } from "./types";

/**
 * What the Annotations tab shows. Each one is on by default, and they carry
 * across notes, unlike the author filter, which only means something within
 * one note.
 */
export interface AnnotationFilters {
	comment: boolean;
	delete: boolean;
	insert: boolean;
	replace: boolean;
	/** Annotations with no author label. */
	noAuthor: boolean;
	/** Ordinary highlights and hidden comments with nothing attached. */
	plain: boolean;
}

export interface AnnotationReviewSettings {
	/** Prefilled author label for new annotations. Blank means no label. */
	defaultAuthor: string;
	/** Expanded state carries across notes, and is tracked per tab. */
	repliesExpanded: boolean;
	admonitionsExpanded: boolean;
	/** The wrapper the commands write, per operation. */
	wrappers: Record<AnnotationType, Wrapper>;
	/** Stands in for percent marks inside fenced blocks, where they do not render. */
	fencedFallback: "brace" | "highlight";
	/**
	 * Where a new author, reason or reply goes when the annotation has no
	 * entries yet. One that already has some keeps using what it has.
	 */
	channel: MetaChannel;
	filters: AnnotationFilters;
}

/** Plain CriticMarkup out of the box, since that is the standard. */
export const DEFAULT_SETTINGS: AnnotationReviewSettings = {
	defaultAuthor: "",
	repliesExpanded: false,
	admonitionsExpanded: false,
	wrappers: { comment: "brace", delete: "brace", replace: "brace", insert: "brace" },
	fencedFallback: "brace",
	channel: "brace",
	filters: { comment: true, delete: true, insert: true, replace: true, noAuthor: true, plain: true }
};

const WRAPPER_LABELS: Record<Wrapper, string> = {
	brace: "Braces, {text}",
	highlight: "Highlight, ==text==",
	percent: "Percent marks, %%text%%"
};

const OPERATION_LABELS: Record<AnnotationType, string> = {
	comment: "Comments",
	delete: "Deletions",
	replace: "Replacements",
	insert: "Insertions"
};

function addDropdown(setting: Setting, options: Record<string, string>, value: string, onChange: (value: string) => Promise<void>) {
	setting.addDropdown(dropdown => {
		for (const key of Object.keys(options)) dropdown.addOption(key, options[key]);
		dropdown.setValue(value).onChange(v => onChange(v));
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
		const settings = this.plugin.settings;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Author")
			.setDesc("Written into every new annotation as its [Author] label. Leave blank for no label.")
			.addText(text =>
				text
					.setPlaceholder("e.g. Claude")
					.setValue(settings.defaultAuthor)
					.onChange(async value => {
						settings.defaultAuthor = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Wrappers")
			.setDesc("How the note shows the annotated text. Braces show it as it is, which is standard CriticMarkup. A highlight shows it highlighted. Percent marks hide it.")
			.setHeading();

		// A comment cannot hide its span, so percent marks are not on offer there.
		const spanOnly = { brace: WRAPPER_LABELS.brace, highlight: WRAPPER_LABELS.highlight };
		for (const type of Object.keys(OPERATION_LABELS) as AnnotationType[]) {
			const setting = new Setting(containerEl).setName(OPERATION_LABELS[type]);
			if (type === "comment") setting.setDesc("A comment on a spot rather than a span follows the Reasons and replies setting below.");
			addDropdown(setting, type === "comment" ? spanOnly : WRAPPER_LABELS, settings.wrappers[type], async value => {
				settings.wrappers[type] = value as Wrapper;
				await this.plugin.saveSettings();
				// The fallback setting only applies while percent marks are in use.
				this.display();
			});
		}

		if (Object.values(settings.wrappers).includes("percent")) {
			addDropdown(
				new Setting(containerEl)
					.setName("Inside fenced blocks")
					.setDesc("Percent marks do not render inside a fenced block, admonitions included, so this stands in for them there."),
				{ brace: WRAPPER_LABELS.brace, highlight: WRAPPER_LABELS.highlight },
				settings.fencedFallback,
				async value => {
					settings.fencedFallback = value as "brace" | "highlight";
					await this.plugin.saveSettings();
				}
			);
		}

		addDropdown(
			new Setting(containerEl)
				.setName("Reasons and replies")
				.setDesc("Where the author, reason and replies are written. An annotation that already has some keeps using whatever it has. A comment on a spot is written as {>>note<<} with the first, and as an Obsidian %%note%% with the second."),
			{ brace: "CriticMarkup comment, {>>text<<}", footnote: "Footnote, ^[text]" },
			settings.channel,
			async value => {
				settings.channel = value as MetaChannel;
				await this.plugin.saveSettings();
			}
		);
	}
}
