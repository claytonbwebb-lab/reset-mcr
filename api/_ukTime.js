/**
 * UK Time Helpers for Reset MCR
 * Frontend sends datetime strings as UK local time (Europe/London) without timezone suffix.
 * These helpers convert to/from UTC for storage and queries.
 */

// Get BST offset in milliseconds for a given UTC Date (0 or +1 hour)
function getBstOffsetMs(date) {
  const year = date.getUTCFullYear();

  // BST starts: last Sunday of March at 1:00 UTC
  const march31 = new Date(Date.UTC(year, 2, 31));
  const bstStart = new Date(Date.UTC(year, 2, 31 - march31.getUTCDay(), 1, 0, 0));

  // BST ends: last Sunday of October at 1:00 UTC
  const oct31 = new Date(Date.UTC(year, 9, 31));
  const bstEnd = new Date(Date.UTC(year, 9, 31 - oct31.getUTCDay(), 1, 0, 0));

  return (date >= bstStart && date < bstEnd) ? 3600000 : 0;
}

/**
 * Convert a UK-local datetime string (YYYY-MM-DDTHH:mm:ss) to a UTC Date.
 * The server currently treats it as UTC (wrong). This subtracts BST offset.
 */
export function ukLocalToUtc(dateStr) {
  const asUtc = new Date(dateStr);
  const offsetMs = getBstOffsetMs(asUtc);
  return new Date(asUtc.getTime() - offsetMs);
}

/**
 * Convert a UK-local datetime string to a UTC ISO string for storage.
 */
export function ukLocalToUtcIso(dateStr) {
  return ukLocalToUtc(dateStr).toISOString();
}

/**
 * Get UTC datetime for the start of a UK date (midnight UK time).
 * During BST: returns previous day 23:00 UTC.
 * During GMT: returns same day 00:00 UTC.
 */
export function ukDateStartUtc(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const offsetMs = getBstOffsetMs(d);
  return new Date(d.getTime() - offsetMs).toISOString();
}

/**
 * Get UTC datetime for the end of a UK date (just before next midnight UK time).
 */
export function ukDateEndUtc(dateStr) {
  const d = new Date(dateStr + 'T23:59:59.999');
  const offsetMs = getBstOffsetMs(d);
  return new Date(d.getTime() - offsetMs).toISOString();
}

/**
 * Get today's date in UK timezone (YYYY-MM-DD).
 */
export function ukToday() {
  return new Date().toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).split('/').reverse().join('-');
}
