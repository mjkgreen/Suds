/** The device's IANA time zone (e.g. "America/Los_Angeles"), for stats that group by day/week. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
