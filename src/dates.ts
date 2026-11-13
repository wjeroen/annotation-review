/**
 * How a time is written on a card. A note stores every time in UTC, as
 * seconds since 1970, and the card shows it in the computer's own time zone
 * and date order. `locale` and `timeZone` are only passed by the tests.
 */

export type DateStyle = "date" | "datetime" | "off";

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

/** In full, for the tooltip and a tap: the weekday, the date, the time and the time zone. */
export function fullDate(time: number, locale?: string, timeZone?: string): string {
	return new Intl.DateTimeFormat(locale, { dateStyle: "full", timeStyle: "long", timeZone }).format(new Date(time * 1000));
}
