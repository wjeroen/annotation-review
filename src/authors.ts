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

/** The translucent fill behind a sidebar chip. */
export function authorBackground(name: string): string {
	return `hsla(${authorHue(name)}, 55%, 45%, 0.45)`;
}

/** The solid color of the underline in the editor. */
export function authorColor(name: string): string {
	return `hsl(${authorHue(name)}, 55%, 50%)`;
}
