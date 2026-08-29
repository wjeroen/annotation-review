import { App, ColorComponent, Platform, PluginSettingTab, Setting } from "obsidian";
import type AnnotationReviewPlugin from "../main";
import { AnnotationType, MetaChannel, Wrapper } from "./types";
import { AuthorColors, applyChipColor, defaultColorHex } from "./authors";
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
	/** The wrapper the commands write, per operation. For comments this is the comment on a selection. */
	wrappers: Record<AnnotationType, Wrapper>;
	/** A comment on a spot has two choices: Obsidian never opens a highlight that starts with >. */
	pointCommentWrapper: "brace" | "percent";
	/** Stands in for percent marks inside fenced blocks, where they do not render. */
	fencedFallback: "brace" | "highlight";
	/** How replies are written when an annotation has none yet. */
	channel: MetaChannel;
	filters: AnnotationFilters;
	/** Hide the syntax and color the text in live preview. */
	renderInEditor: boolean;
	/**
	 * How an author is shown in live preview and reading view, on changes
	 * and on comments and replies separately. A line under text that is
	 * already red or green gets busy, while it stays compact under a
	 * comment, hence the two defaults.
	 */
	changeAuthorStyle: AuthorStyle;
	commentAuthorStyle: AuthorStyle;
	/** A colored line down the left edge of every annotated line, in live preview and source mode. */
	showGutter: boolean;
	/**
	 * Where that line sits. In the margin it hangs beside the text and costs
	 * it nothing. In the column it stands in front of the text, as Obsidian's
	 * own gutters do, which pushes every line right and away from the title.
	 */
	gutterPosition: GutterPosition;
	/** Pixels between the gutter line and the text. */
	gutterGap: number;
	/** Thickness of one color band in pixels. */
	gutterBand: number;
	/** Pixels between two bands. */
	gutterBandGap: number;
	/** Colors chosen per author, winning over the one computed from the name. */
	authorColors: AuthorColors;
	/** Strength of the fill behind author chips and type badges, 0 to 1. */
	authorChipOpacity: number;
	typeBadgeOpacity: number;
}

/** Plain CriticMarkup out of the box, since that is the standard. */
export const DEFAULT_SETTINGS: AnnotationReviewSettings = {
	defaultAuthor: "",
	repliesExpanded: false,
	admonitionsExpanded: false,
	wrappers: { comment: "brace", delete: "brace", replace: "brace", insert: "brace" },
	pointCommentWrapper: "brace",
	fencedFallback: "brace",
	channel: "brace",
	filters: { comment: true, delete: true, insert: true, replace: true, noAuthor: true, plain: true },
	renderInEditor: true,
	changeAuthorStyle: "chip",
	commentAuthorStyle: "underline",
	showGutter: true,
	gutterPosition: "margin",
	gutterGap: 5,
	gutterBand: 6,
	gutterBandGap: 0,
	authorColors: {},
	authorChipOpacity: 0.45,
	typeBadgeOpacity: 1
};

export type GutterPosition = "margin" | "column";

const WRAPPER_LABELS: Record<Wrapper, string> = {
	brace: "Braces",
	highlight: "Highlight",
	percent: "Percent marks"
};

const OPERATION_LABELS: Record<AnnotationType, string> = {
	comment: "Comments on a selection",
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
		const anyPercent = () => Object.values(settings.wrappers).includes("percent") || settings.pointCommentWrapper === "percent";

		for (const type of Object.keys(OPERATION_LABELS) as AnnotationType[]) {
			const setting = new Setting(containerEl).setName(OPERATION_LABELS[type]);
			addDropdown(setting, WRAPPER_LABELS, settings.wrappers[type], async value => {
				settings.wrappers[type] = value as Wrapper;
				await this.plugin.saveSettings();
				fenced?.setDisabled(!anyPercent());
			});
			if (type !== "comment") continue;
			// Obsidian never opens a highlight that starts with >, so a comment
			// on a spot has two wrappers to choose from.
			addDropdown(
				new Setting(containerEl).setName("Comments on a spot"),
				{ brace: WRAPPER_LABELS.brace, percent: WRAPPER_LABELS.percent },
				settings.pointCommentWrapper,
				async value => {
					settings.pointCommentWrapper = value as "brace" | "percent";
					await this.plugin.saveSettings();
					fenced?.setDisabled(!anyPercent());
				}
			);
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
		const authorStyle = (name: string, desc: string, key: "changeAuthorStyle" | "commentAuthorStyle") => {
			const setting = new Setting(containerEl).setName(name);
			if (desc) setting.setDesc(desc);
			addDropdown(setting, { underline: "Colored underline", chip: "Chip", none: "Not shown" }, settings[key], async value => {
				settings[key] = value as AuthorStyle;
				await this.plugin.saveSettings();
				this.plugin.applyEditorSettings();
			});
		};
		authorStyle("Authors on changes", "Deletions, insertions and replacements, in live preview and reading view.", "changeAuthorStyle");
		authorStyle("Authors on comments and replies", "", "commentAuthorStyle");
		toggle("Show the diff gutter", "A colored line down the left edge of every annotated line, in live preview and source mode.", "showGutter");
		const position = new Setting(containerEl)
			.setName("Gutter position")
			.setDesc("In the margin, beside the text. In the text column, in front of it, which pushes the text right.");
		addDropdown(position, { margin: "In the margin", column: "In the text column" }, settings.gutterPosition, async value => {
			settings.gutterPosition = value as GutterPosition;
			await this.plugin.saveSettings();
			this.plugin.applyEditorSettings();
		});
		const pixels = (name: string, desc: string, key: "gutterBand" | "gutterBandGap" | "gutterGap", min: number, max: number) =>
			new Setting(containerEl)
				.setName(name)
				.setDesc(desc)
				.addSlider(slider =>
					slider
						.setLimits(min, max, 1)
						.setValue(settings[key])
						.setDynamicTooltip()
						.onChange(async value => {
							settings[key] = value;
							await this.plugin.saveSettings();
							this.plugin.applyEditorSettings();
						})
				);
		pixels(
			"Band thickness",
			"Pixels per color. A deletion, an insertion and a comment on one line each get a band, in the order they appear.",
			"gutterBand",
			1,
			10
		);
		pixels("Space between the bands", "Pixels.", "gutterBandGap", 0, 5);
		pixels("Space beside the gutter line", "Pixels between the line and the text.", "gutterGap", 0, 40);

		new Setting(containerEl).setName("Chips").setHeading();

		const opacity = (name: string, desc: string, key: "authorChipOpacity" | "typeBadgeOpacity") =>
			new Setting(containerEl)
				.setName(name)
				.setDesc(desc)
				.addSlider(slider =>
					slider
						.setLimits(10, 100, 5)
						.setValue(Math.round(settings[key] * 100))
						.setDynamicTooltip()
						.onChange(async value => {
							settings[key] = value / 100;
							await this.plugin.saveSettings();
							this.plugin.applyEditorSettings();
						})
				);
		opacity("Author chip opacity", "In the sidebar, the editor and reading view. Underlines stay solid.", "authorChipOpacity");
		opacity("Type badge opacity", "The Comment, Delete, Replace and Insert badges on the cards.", "typeBadgeOpacity");

		new Setting(containerEl)
			.setName("Author colors")
			.setDesc("Each author gets a color from their name. Pick one here to use instead, in the sidebar and the editor alike.")
			.setHeading();

		// Rows are edited in place and written back as a whole, so a name can
		// be retyped without losing its color. A new row's picker follows the
		// name until the color is touched, so it starts where the name would
		// land on its own and adjusting is a nudge rather than a search.
		const rows = Object.entries(settings.authorColors).map(([name, color]) => ({ name, color, named: true }));
		const list = containerEl.createDiv();
		const save = async () => {
			settings.authorColors = {};
			for (const row of rows) if (row.named && row.name) settings.authorColors[row.name] = row.color;
			await this.plugin.saveSettings();
			this.plugin.applyEditorSettings();
			this.plugin.refreshViews();
		};
		const draw = () => {
			list.empty();
			for (const row of rows) {
				const setting = new Setting(list).setClass("arv-author-row");
				const control = setting.controlEl;
				let preview: HTMLElement | null = null;
				let slot: HTMLElement | null = null;
				const showPreview = () => {
					if (!preview) return;
					preview.setText(row.name || "Author");
					applyChipColor(preview, row.name, { [row.name]: row.color });
				};
				const pick = async (value: string) => {
					row.color = value;
					showPreview();
					await save();
				};
				// The native picker is a good dialog on desktop and a poor one
				// on mobile, so mobile gets the plugin's own sliders.
				const mountPicker = (into: HTMLElement) => {
					if (Platform.isMobile) new MobileColorPicker(this.app, into, () => row.name, row.color, pick);
					else new ColorComponent(into).setValue(row.color).onChange(pick);
				};
				// A new row has no picker until its name is in, on Enter or on
				// leaving the field. Until then the chip follows the typed name
				// live and nothing is saved. The picker then starts at that
				// name's computed color. Setting a native picker from code fires
				// its change, which is what used to freeze the first letter's
				// color, so it is never set from code at all.
				const commitName = async () => {
					if (row.named || !row.name) return;
					row.named = true;
					row.color = defaultColorHex(row.name);
					showPreview();
					if (slot) mountPicker(slot);
					await save();
				};
				setting.addText(text => {
					text
						.setPlaceholder("Author")
						.setValue(row.name)
						.onChange(async value => {
							row.name = value.trim();
							if (!row.named) row.color = defaultColorHex(row.name);
							showPreview();
							if (row.named) await save();
						});
					text.inputEl.addEventListener("blur", () => void commitName());
					text.inputEl.addEventListener("keydown", evt => {
						if (evt.key !== "Enter") return;
						evt.preventDefault();
						void commitName();
					});
				});
				preview = control.createSpan({ cls: "arv-chip arv-settings-chip" });
				showPreview();
				slot = control.createSpan({ cls: "arv-color-slot" });
				if (row.named) mountPicker(slot);
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
				rows.push({ name: "", color: "#888888", named: false });
				draw();
			})
		);
	}
}
