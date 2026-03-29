import { formatDistanceToNow, format, parseISO, startOfDay, subDays, differenceInMinutes, differenceInHours } from 'date-fns';

export function relativeTime(dateString: string): string {
  return formatDistanceToNow(parseISO(dateString), { addSuffix: true });
}

export function formatDate(dateString: string): string {
  return format(parseISO(dateString), 'MMM d, yyyy');
}

export function formatTime(dateString: string): string {
  return format(parseISO(dateString), 'h:mm a');
}

export function formatDateTime(dateString: string): string {
  return format(parseISO(dateString), 'MMM d · h:mm a');
}

export function formatDuration(startDateString: string, endDateString?: string): string {
  const start = parseISO(startDateString);
  const end = endDateString ? parseISO(endDateString) : new Date();
  const mins = differenceInMinutes(end, start);
  if (mins < 60) return `${mins}m`;
  const hrs = differenceInHours(end, start);
  const rem = mins - hrs * 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

// Generates an array of the last N days for the activity heatmap.
export function generateHeatmapDates(days = 365): string[] {
  return Array.from({ length: days }, (_, i) =>
    format(startOfDay(subDays(new Date(), days - 1 - i)), 'yyyy-MM-dd'),
  );
}
