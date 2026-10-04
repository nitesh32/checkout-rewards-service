const formatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export function formatDateTime(isoString: string): string {
  return formatter.format(new Date(isoString));
}
