/**
 * Relative / calendar publish labels for reports:
 * - under 24h: 30s / 53m / 1hr / 23hr
 * - 24h–48h: Yesterday at 10:30am
 * - older: July 10 at 10:30am (year only if not the current year)
 */
export function formatPublishedAt(
  iso: string,
  now: Date = new Date(),
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  const ageMs = Math.max(0, now.getTime() - date.getTime());
  const ageSeconds = Math.floor(ageMs / 1000);
  const ageMinutes = Math.floor(ageSeconds / 60);
  const ageHours = Math.floor(ageMinutes / 60);

  if (ageHours < 24) {
    if (ageSeconds < 60) return `${Math.max(ageSeconds, 1)}s`;
    if (ageMinutes < 60) return `${ageMinutes}m`;
    return `${Math.max(ageHours, 1)}hr`;
  }

  const timeLabel = formatClockAmPm(date);

  if (ageHours < 48) {
    return `Yesterday at ${timeLabel}`;
  }

  const monthDay = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  });
  const includeYear = date.getFullYear() !== now.getFullYear();
  const dateLabel = includeYear
    ? `${monthDay}, ${date.getFullYear()}`
    : monthDay;

  return `${dateLabel} at ${timeLabel}`;
}

/** e.g. 10:30am — no space before am/pm. */
function formatClockAmPm(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  const minuteText = minutes.toString().padStart(2, '0');
  return `${hours}:${minuteText}${suffix}`;
}
