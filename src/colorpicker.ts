import { App, Modal } from "obsidian";
import { authorBackground, hexToHsl, hslToHex } from "./authors";

/**
 * A color picker for mobile, where the native <input type="color"> is a poor
 * thing. The settings row shows a swatch, and tapping it opens a modal, which
 * on a phone is a proper sheet: a preview chip with the author's name, three
 * sliders for hue, saturation and lightness, each drawn as a gradient of
 * what it would give with the other two as they are, and a hex field for an
 * exact value. Desktop keeps the native picker, which is good there.
 */
export class MobileColorPicker {
	private readonly swatch: HTMLElement;
	private color: string;

	constructor(
		private readonly app: App,
		controlEl: HTMLElement,
		private readonly name: () => string,
		value: string,
		private readonly onChange: (hex: string) => void
	) {
		this.color = value;
		this.swatch = controlEl.createEl("button", { cls: "arv-color-swatch", attr: { "aria-label": "Pick a color" } });
		this.swatch.style.backgroundColor = value;
		this.swatch.addEventListener("click", evt => {
			evt.preventDefault();
			new ColorModal(this.app, this.name(), this.color, hex => {
				this.setValue(hex);
				this.onChange(hex);
			}).open();
		});
	}

	/** Shows a color chosen elsewhere, such as the one a freshly typed name gets. */
	setValue(hex: string) {
		this.color = hex;
		this.swatch.style.backgroundColor = hex;
	}
}

class ColorModal extends Modal {
	private hex: string;

	constructor(
		app: App,
		private readonly name: string,
		private readonly initial: string,
		private readonly onDone: (hex: string) => void
	) {
		super(app);
		this.hex = initial;
	}

	onOpen() {
		this.modalEl.addClass("arv-color-modal");
		this.titleEl.setText(this.name ? `Color for ${this.name}` : "Author color");
		const { contentEl } = this;
		let [h, s, l] = hexToHsl(this.hex);

		const preview = contentEl.createDiv({ cls: "arv-color-preview" });
		const chip = preview.createSpan({ cls: "arv-chip arv-color-preview-chip", text: this.name || "Author" });

		const sliders = {} as Record<"h" | "s" | "l", HTMLInputElement>;
		const slider = (key: "h" | "s" | "l", label: string, max: number) => {
			const row = contentEl.createDiv({ cls: "arv-color-row" });
			row.createDiv({ cls: "arv-color-label", text: label });
			const input = row.createEl("input", {
				cls: `arv-color-slider arv-color-slider-${key}`,
				attr: { type: "range", min: "0", max: String(max), step: "1" }
			});
			input.addEventListener("input", () => {
				const v = Number(input.value);
				if (key === "h") h = v;
				else if (key === "s") s = v;
				else l = v;
				update();
			});
			sliders[key] = input;
		};
		slider("h", "Hue", 360);
		slider("s", "Saturation", 100);
		slider("l", "Lightness", 100);

		const hexRow = contentEl.createDiv({ cls: "arv-color-row arv-color-hex-row" });
		hexRow.createDiv({ cls: "arv-color-label", text: "Hex" });
		const hexInput = hexRow.createEl("input", {
			cls: "arv-color-hex",
			attr: { type: "text", maxlength: "7", spellcheck: "false", autocapitalize: "off", autocomplete: "off" }
		});
		hexInput.addEventListener("change", () => {
			const typed = hexInput.value.trim().toLowerCase();
			if (/^#[0-9a-f]{6}$/.test(typed)) [h, s, l] = hexToHsl(typed);
			update();
		});

		const buttons = contentEl.createDiv({ cls: "modal-button-container" });
		buttons.createEl("button", { cls: "mod-cta", text: "Done" }).addEventListener("click", () => this.close());

		// Each track shows what moving that slider would give.
		const update = () => {
			this.hex = hslToHex(h, s, l);
			chip.style.backgroundColor = authorBackground(this.name, { [this.name]: this.hex });
			hexInput.value = this.hex;
			sliders.h.value = String(h);
			sliders.s.value = String(s);
			sliders.l.value = String(l);
			const hues = Array.from({ length: 13 }, (_, i) => `hsl(${i * 30}, ${s}%, ${l}%)`).join(", ");
			sliders.h.style.background = `linear-gradient(to right, ${hues})`;
			sliders.s.style.background = `linear-gradient(to right, hsl(${h}, 0%, ${l}%), hsl(${h}, 100%, ${l}%))`;
			sliders.l.style.background = `linear-gradient(to right, hsl(${h}, ${s}%, 0%), hsl(${h}, ${s}%, 50%), hsl(${h}, ${s}%, 100%))`;
		};
		update();
	}

	/** Closing by any route keeps the color, there is nothing to cancel back to that Done would not also give. */
	onClose() {
		this.contentEl.empty();
		if (this.hex !== this.initial) this.onDone(this.hex);
	}
}
