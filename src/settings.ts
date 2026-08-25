import { App, Platform, PluginSettingTab, Setting } from "obsidian";
import type AnnotationReviewPlugin from "../main";
import { AnnotationType, MetaChannel, Wrapper } from "./types";
import { AuthorColors, defaultColorHex } from "./authors";
import { MobileColorPicker } from "./colorpicker";

/** A colored line under the text, the name as a chip, or nothing at all. */
export type AuthorStyle = "underline" | "chip" | "none";

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
	/**
	 * Expanded state carries across notes, and is tracked per tab. It is kept
	 * on this device rather than in data.json, as are the filters, since it
	 * changes with every click. See saveLocalState in main.ts.
	 */
	repliesExpanded: boolean;
	admonitionsExpanded: boolean;
	/** The wrapper the commands write, per operation. */
	wrappers: Record<AnnotationType, Wrapper>;
	/** Stands in for percent marks inside fenced blocks, where they do not render. */
	fencedFallback: "brace" | "highlight";
	/** How replies are written when an annotation has none yet. */
	channel: MetaChannel;
	filters: AnnotationFilters;
	/** Hide the syntax and color the text in live preview. */
	renderInEditor: boolean;
	/**
	 * How an author is shown in live preview and reading view, on changes
	 * and on comments separately. A comment on a spot counts as a change:
	 * it sits among the operators, so its author is shown like theirs.
	 * Comments on a span and replies are the other group. A line under text
	 * that is already red or green gets busy, while it stays compact under a
	 * comment, hence the two defaults.
	 */
	changeAuthorStyle: AuthorStyle;
	commentAuthorStyle: AuthorStyle;
	/** A colored line down the left edge of every annotated line, in live preview and source mode. */
	showGutter: boolean;
	/** Colors chosen per author, winning over the one computed from the name. */
	authorColors: AuthorColors;
}

/** Plain CriticMarkup out of the box, since that is the standard. */
export const DEFAULT_SETTINGS: AnnotationReviewSettings = {
	defaultAuthor: "",
	repliesExpanded: false,
	admonitionsExpanded: false,
	wrappers: { comment: "brace", delete: "brace", replace: "brace", insert: "brace" },
	fencedFallback: "brace",
	channel: "brace",
	filters: { comment: true, delete: true, insert: true, replace: true, noAuthor: true, plain: true },
	renderInEditor: true,
	changeAuthorStyle: "chip",
	commentAuthorStyle: "underline",
	showGutter: true,
	authorColors: {}
};

const WRAPPER_LABELS: Record<Wrapper, string> = {
	brace: "Braces",
	highlight: "Highlight",
	percent: "Percent marks"
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
			.setDesc("Written into every new annotation and reply. Leave blank for none.")
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
			.setDesc("How the annotated text shows in the note. Braces show it as it is, a highlight highlights it, percent marks hide it.")
			.setHeading();

		// The fallback only matters while some operation uses percent marks.
		// It is greyed out rather than removed, so changing a wrapper does not
		// rebuild the page and lose the scroll position.
		let fenced: Setting | null = null;
		const anyPercent = () => Object.values(settings.wrappers).includes("percent");

		for (const type of Object.keys(OPERATION_LABELS) as AnnotationType[]) {
			const setting = new Setting(containerEl).setName(OPERATION_LABELS[type]);
			addDropdown(setting, WRAPPER_LABELS, settings.wrappers[type], async value => {
				settings.wrappers[type] = value as Wrapper;
				await this.plugin.saveSettings();
				fenced?.setDisabled(!anyPercent());
			});
		}

		fenced = new Setting(containerEl)
			.setName("Inside fenced blocks")
			.setDesc("Percent marks do not render there, so this stands in for them.")
			.setDisabled(!anyPercent());
		addDropdown(fenced, { brace: WRAPPER_LABELS.brace, highlight: WRAPPER_LABELS.highlight }, settings.fencedFallback, async value => {
			settings.fencedFallback = value as "brace" | "highlight";
			await this.plugin.saveSettings();
		});

		addDropdown(
			new Setting(containerEl).setName("Replies").setDesc("An annotation that already has replies keeps their style."),
			{ footnote: "Footnote", brace: "CriticMarkup" },
			settings.channel,
			async value => {
				settings.channel = value as MetaChannel;
				await this.plugin.saveSettings();
			}
		);

		new Setting(containerEl).setName("Editor").setHeading();

		const toggle = (name: string, desc: string, key: "renderInEditor" | "showGutter") =>
			new Setting(containerEl)
				.setName(name)
				.setDesc(desc)
				.addToggle(t =>
					t.setValue(settings[key]).onChange(async value => {
						settings[key] = value;
						await this.plugin.saveSettings();
						this.plugin.applyEditorSettings();
					})
				);

		toggle("Style annotations in live preview", "Hide the syntax and color the text. It comes back while the caret is inside an annotation.", "renderInEditor");
		const authorStyle = (name: string, desc: string, key: "changeAuthorStyle" | "commentAuthorStyle") =>
			addDropdown(new Setting(containerEl).setName(name).setDesc(desc), { underline: "Colored underline", chip: "Chip", none: "Not shown" }, settings[key], async value => {
				settings[key] = value as AuthorStyle;
				await this.plugin.saveSettings();
				this.plugin.applyEditorSettings();
			});
		authorStyle("Authors on changes", "Deletions, insertions, replacements and comments on a spot, in live preview and reading view.", "changeAuthorStyle");
		authorStyle("Authors on comments", "Comments on a span, and replies.", "commentAuthorStyle");
		toggle("Show the diff gutter", "A colored line down the left edge of every annotated line, in live preview and source mode.", "showGutter");

		new Setting(containerEl)
			.setName("Author colors")
			.setDesc("Each author gets a color from their name. Pick one here to use instead, in the sidebar and the editor alike.")
			.setHeading();

		// Rows are edited in place and written back as a whole, so a name can
		// be retyped without losing its color. A new row's picker follows the
		// name until the color is touched, so it starts where the name would
		// land on its own and adjusting is a nudge rather than a search.
		const rows = Object.entries(settings.authorColors).map(([name, color]) => ({ name, color, touched: true }));
		const list = containerEl.createDiv();
		const save = async () => {
			settings.authorColors = {};
			for (const row of rows) if (row.name) settings.authorColors[row.name] = row.color;
			await this.plugin.saveSettings();
			this.plugin.applyEditorSettings();
			this.plugin.refreshViews();
		};
		const draw = () => {
			list.empty();
			for (const row of rows) {
				let picker: { setValue(hex: string): unknown } | null = null;
				const pick = async (value: string) => {
					row.color = value;
					row.touched = true;
					await save();
				};
				const setting = new Setting(list).addText(text =>
					text
						.setPlaceholder("Author")
						.setValue(row.name)
						.onChange(async value => {
							row.name = value.trim();
							if (!row.touched && row.name) {
								row.color = defaultColorHex(row.name);
								picker?.setValue(row.color);
							}
							await save();
						})
				);
				// The native picker is a good dialog on desktop and a poor one
				// on mobile, so mobile gets the plugin's own sliders.
				if (Platform.isMobile) picker = new MobileColorPicker(this.app, setting.controlEl, () => row.name, row.color, pick);
				else setting.addColorPicker(component => (picker = component.setValue(row.color).onChange(pick)));
				setting.addExtraButton(button =>
					button
						.setIcon("trash")
						.setTooltip("Remove")
						.onClick(async () => {
							rows.splice(rows.indexOf(row), 1);
							draw();
							await save();
						})
				);
			}
		};
		draw();
		new Setting(containerEl).addButton(button =>
			button.setButtonText("Add author").onClick(() => {
				rows.push({ name: "", color: "#888888", touched: false });
				draw();
			})
		);
	}
}
