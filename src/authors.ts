/** Colors chosen in settings, by author name. Anyone not listed gets a computed one. */
export type AuthorColors = Record<string, string>;

/**
 * A stable hue per author name. Two hashes running in opposite directions get
 * mixed so that names sharing a prefix, like "Jeroen W" and "Jeroen B", land
 * far apart on the color wheel instead of next to each other. Shared by the
 * sidebar chips and the underline drawn in the editor, so an author looks the
 * same in both.
 */
export function authorHue(name: string): number {
	let h1 = 0;
	for (let i = 0; i < name.length; i++) {
		h1 = (h1 * 31 + name.charCodeAt(i)) | 0;
	}
	let h2 = 0;
	for (let i = name.length - 1; i >= 0; i--) {
		h2 = (h2 * 37 + name.charCodeAt(i)) | 0;
	}
	return ((h1 ^ h2) >>> 0) % 360;
}

/** The color a name gets on its own, as hex, which is what the settings picker speaks. */
export function defaultColorHex(name: string): string {
	return hslToHex(authorHue(name), 55, 50);
}

/** The translucent fill behind a chip. */
export function authorBackground(name: string, colors?: AuthorColors): string {
	const chosen = colors?.[name];
	if (chosen) {
		const [r, g, b] = hexToRgb(chosen);
		return `rgba(${r}, ${g}, ${b}, 0.45)`;
	}
	return `hsla(${authorHue(name)}, 55%, 45%, 0.45)`;
}

/** The solid color of the underline in the editor. */
export function authorColor(name: string, colors?: AuthorColors): string {
	return colors?.[name] ?? `hsl(${authorHue(name)}, 55%, 50%)`;
}

function hexToRgb(hex: string): [number, number, number] {
	let h = hex.replace("#", "");
	if (h.length === 3) h = h.split("").map(c => c + c).join("");
	const n = parseInt(h, 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Hue, saturation and lightness of a hex color, for the slider picker. */
export function hexToHsl(hex: string): [number, number, number] {
	const [r, g, b] = hexToRgb(hex).map(v => v / 255);
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, Math.round(l * 100)];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	let h: number;
	if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
	else if (max === g) h = ((b - r) / d + 2) * 60;
	else h = ((r - g) / d + 4) * 60;
	return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

export function hslToHex(h: number, s: number, l: number): string {
	const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
	const f = (n: number) => {
		const k = (n + h / 30) % 12;
		const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
		return Math.round(255 * c).toString(16).padStart(2, "0");
	};
	return `#${f(0)}${f(8)}${f(4)}`;
}
