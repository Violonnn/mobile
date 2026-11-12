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

/** Readable local date/time for review claims and the official audit trail. */
export function formatOperationTimestamp(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Time unavailable';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Time unavailable';
  const sameDay = date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return `Today at ${formatClockAmPm(date)}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const previousDay = date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() && date.getDate() === yesterday.getDate();
  if (previousDay) return `Yesterday at ${formatClockAmPm(date)}`;
  const dateLabel = date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
  return `${dateLabel} at ${formatClockAmPm(date)}`;
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
