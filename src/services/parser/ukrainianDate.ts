const UKRAINIAN_MONTHS: Record<string, number> = {
  січня: 0,
  лютого: 1,
  березня: 2,
  квітня: 3,
  травня: 4,
  червня: 5,
  липня: 6,
  серпня: 7,
  вересня: 8,
  жовтня: 9,
  листопада: 10,
  грудня: 11,
};

/**
 * Parses Ukrainian dates like "24 липня" (no year — assumes current year, rolling
 * back one if the result lands implausibly far in the future) or "18 липня 2026"
 * (explicit year).
 */
export function parseUkrainianDate(text: string): Date | undefined {
  const match = text.trim().match(/(\d{1,2})\s+(\S+?)(?:\s+(\d{4}))?$/u);
  if (!match) {
    return undefined;
  }

  const day = Number(match[1]);
  const month = UKRAINIAN_MONTHS[match[2].toLowerCase()];
  if (month === undefined) {
    return undefined;
  }

  if (match[3]) {
    return new Date(Number(match[3]), month, day);
  }

  const now = new Date();
  let year = now.getFullYear();
  const candidate = new Date(year, month, day);

  // If the parsed date lands more than a month in the future, the post is from last year
  // (e.g. scraping a "грудня" listing in January).
  if (candidate.getTime() - now.getTime() > 30 * 24 * 60 * 60 * 1000) {
    year -= 1;
  }

  return new Date(year, month, day);
}
