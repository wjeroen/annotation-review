/**
 * Times in a note, read and shown. A note stores every time in UTC. The card
 * shows it in the computer's own time zone and date order, except a date
 * without a clock time, which is a day on the calendar and is shown as that
 * day everywhere. `locale` and `timeZone` are only passed by the tests.
 */

export type DateStyle = "date" | "datetime" | "off";

/** A time as read from a note, in seconds since 1970 in UTC. */
export interface ReadTime {
	time: number;
	/** Written as a date alone, `2026-11-13`, with no clock time. */
	dateOnly: boolean;
}

/**
 * A date, with or without a clock time and its seconds, with a T or a space
 * between the date and the clock, and with or without a T in front. A time
 * with no zone is UTC, and so is a Z at the end. An offset from UTC, as RFC
 * 3339 writes it, `+01:00` or `-08:00`, says the clock was that far ahead of
 * or behind UTC.
 */
const READABLE = /^[Tt]?(\d{4})-(\d{2})-(\d{2})(?:[Tt ](\d{1,2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?)?\s*([Zz]|([+-])(\d{2}):?(\d{2})?)?$/;

/**
 * Reads a time written either as seconds since 1970 or as a date. Seconds
 * need their T, `T1794601440`, unless `bareSeconds` says the place cannot
 * hold a name, as a metadata field cannot. In a label a bare number could be
 * a name, and `[1]` would turn into a day in 1970.
 */
export function parseTime(text: string, bareSeconds = false): ReadTime | undefined {
	const value = text.trim();
	const seconds = (bareSeconds ? /^[Tt]?(\d+)$/ : /^[Tt](\d+)$/).exec(value);
	if (seconds) return { time: Number(seconds[1]), dateOnly: false };
	const m = READABLE.exec(value);
	if (!m) return undefined;
	const [y, mo, d, h, mi, s] = m.slice(1, 7).map(part => (part === undefined ? 0 : Number(part)));
	if (h > 23 || mi > 59 || s > 59) return undefined;
	const ms = Date.UTC(y, mo - 1, d, h, mi, s);
	const day = new Date(ms);
	// Date.UTC rolls 31 February over into March, so a day that does not exist is refused here.
	if (day.getUTCFullYear() !== y || day.getUTCMonth() !== mo - 1 || day.getUTCDate() !== d) return undefined;
	const dateOnly = m[4] === undefined;
	// A date alone is a day on the calendar, so an offset after it changes nothing.
	let offset = 0;
	if (m[8] && !dateOnly) {
		const hours = Number(m[9]);
		const minutes = Number(m[10] ?? 0);
		if (hours > 14 || minutes > 59) return undefined;
		offset = (m[8] === "-" ? -1 : 1) * (hours * 60 + minutes) * 60;
	}
	return { time: Math.floor(ms / 1000) - offset, dateOnly };
}

/**
 * How the plugin writes a time into a note: the date and the clock time in
 * UTC, to the second, `2026-11-13T20:24:00`, the RFC 3339 form without its
 * zone, since a time with no zone is UTC.
 */
export function formatTime(time: number): string {
	return new Date(time * 1000).toISOString().slice(0, 19);
}

/** The time to write into a new annotation, and whether to write it as seconds since 1970 instead of a date. */
export interface Stamp {
	time: number;
	seconds?: boolean;
}

/** Short: the day and month, the year only when it is not this year, and the time when asked for. */
export function compactDate(time: number, withTime: boolean, now = Date.now(), locale?: string, timeZone?: string): string {
	const date = new Date(time * 1000);
	const year = new Intl.DateTimeFormat("en", { year: "numeric", timeZone });
	const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone };
	if (year.format(date) !== year.format(now)) options.year = "numeric";
	if (withTime) {
		options.hour = "numeric";
		options.minute = "2-digit";
	}
	return new Intl.DateTimeFormat(locale, options).format(date);
}

/** In full, for the tooltip and a tap: the weekday and the date, then the time and the time zone when there is a time. */
export function fullDate(time: number, dateOnly = false, locale?: string, timeZone?: string): string {
	const options: Intl.DateTimeFormatOptions = dateOnly ? { dateStyle: "full", timeZone } : { dateStyle: "full", timeStyle: "long", timeZone };
	return new Intl.DateTimeFormat(locale, options).format(new Date(time * 1000));
}

/** How a card writes a time: short with the full form behind it, a date alone kept on its own day. */
export function dateTexts(read: ReadTime, withTime: boolean): { short: string; full: string } {
	const zone = read.dateOnly ? "UTC" : undefined;
	return {
		short: compactDate(read.time, withTime && !read.dateOnly, Date.now(), undefined, zone),
		full: fullDate(read.time, read.dateOnly, undefined, zone)
	};
}
