const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
] as const;

function parseDate(value: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "16–22 Nov 2026" for the range the suggestions endpoint reports. */
export function formatWeekRange(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;

  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to) return `${start} – ${end}`;

  const fromMonth = MONTHS[from.getUTCMonth()];
  const toMonth = MONTHS[to.getUTCMonth()];
  const fromDay = from.getUTCDate();
  const toDay = to.getUTCDate();
  const fromYear = from.getUTCFullYear();
  const toYear = to.getUTCFullYear();

  if (fromYear === toYear && fromMonth === toMonth) {
    return `${fromDay}–${toDay} ${toMonth} ${toYear}`;
  }
  if (fromYear === toYear) {
    return `${fromDay} ${fromMonth} – ${toDay} ${toMonth} ${toYear}`;
  }
  return `${fromDay} ${fromMonth} ${fromYear} – ${toDay} ${toMonth} ${toYear}`;
}
