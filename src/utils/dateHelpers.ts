import { formatDistanceToNow, format, parseISO, startOfDay, subDays } from 'date-fns';

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

// Generates an array of the last N days for the activity heatmap.
export function generateHeatmapDates(days = 365): string[] {
  return Array.from({ length: days }, (_, i) =>
    format(startOfDay(subDays(new Date(), days - 1 - i)), 'yyyy-MM-dd'),
  );
}
