import { hexToHsl, hslToHex } from "./authors";

/**
 * A color picker for mobile, where the native <input type="color"> is a poor
 * thing. Three sliders, hue, saturation and lightness, each drawn as a
 * gradient of what it would give with the other two as they are, with a
 * swatch that opens and closes the panel and a hex field for an exact
 * value. Desktop keeps the native picker, which is good there.
 */
export class MobileColorPicker {
	private h = 0;
	private s = 0;
	private l = 0;
	private readonly swatch: HTMLElement;
	private readonly panel: HTMLElement;
	private readonly hex: HTMLInputElement;
	private readonly sliders: Record<"h" | "s" | "l", HTMLInputElement>;

	/**
	 * The swatch goes into `controlEl`, the row's control area, and the panel
	 * is appended to `below`, so it lands under the row it belongs to.
	 */
	constructor(
		controlEl: HTMLElement,
		below: HTMLElement,
		value: string,
		private readonly onChange: (hex: string) => void
	) {
		[this.h, this.s, this.l] = hexToHsl(value);
		this.swatch = controlEl.createEl("button", { cls: "arv-color-swatch", attr: { "aria-label": "Pick a color" } });
		this.panel = below.createDiv({ cls: "arv-color-panel is-hidden" });
		this.swatch.addEventListener("click", evt => {
			evt.preventDefault();
			this.panel.toggleClass("is-hidden", !this.panel.hasClass("is-hidden"));
		});
		this.sliders = { h: this.slider("h", 360), s: this.slider("s", 100), l: this.slider("l", 100) };
		const row = this.panel.createDiv({ cls: "arv-color-hex-row" });
		this.hex = row.createEl("input", { cls: "arv-color-hex", attr: { type: "text", maxlength: "7", spellcheck: "false" } });
		this.hex.addEventListener("change", () => {
			const typed = this.hex.value.trim();
			if (/^#[0-9a-f]{6}$/i.test(typed)) [this.h, this.s, this.l] = hexToHsl(typed.toLowerCase());
			this.update(true);
		});
		this.update(false);
	}

	/** Shows a color chosen elsewhere, such as the one a freshly typed name gets. */
	setValue(hex: string) {
		[this.h, this.s, this.l] = hexToHsl(hex);
		this.update(false);
	}

	private slider(key: "h" | "s" | "l", max: number): HTMLInputElement {
		const input = this.panel.createEl("input", {
			cls: `arv-color-slider arv-color-slider-${key}`,
			attr: { type: "range", min: "0", max: String(max), step: "1" }
		});
		input.addEventListener("input", () => {
			this[key] = Number(input.value);
			this.update(true);
		});
		return input;
	}

	private update(emit: boolean) {
		const hex = hslToHex(this.h, this.s, this.l);
		this.swatch.style.backgroundColor = hex;
		this.hex.value = hex;
		this.sliders.h.value = String(this.h);
		this.sliders.s.value = String(this.s);
		this.sliders.l.value = String(this.l);
		// Each track shows what moving that slider would give.
		const hues = Array.from({ length: 13 }, (_, i) => `hsl(${i * 30}, ${this.s}%, ${this.l}%)`).join(", ");
		this.sliders.h.style.background = `linear-gradient(to right, ${hues})`;
		this.sliders.s.style.background = `linear-gradient(to right, hsl(${this.h}, 0%, ${this.l}%), hsl(${this.h}, 100%, ${this.l}%))`;
		this.sliders.l.style.background = `linear-gradient(to right, hsl(${this.h}, ${this.s}%, 0%), hsl(${this.h}, ${this.s}%, 50%), hsl(${this.h}, ${this.s}%, 100%))`;
		if (emit) this.onChange(hex);
	}
}
