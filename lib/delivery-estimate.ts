/**
 * Estimated delivery dates shown on the product page.
 *
 * - Standard products: 3 delivery days after today. Sundays are not delivery
 *   days, so they are skipped while counting (the result is never a Sunday).
 * - WhatsApp-sourced products (ordered from a partner boutique abroad):
 *   a 12–14 calendar-day window from today.
 */

const STANDARD_DAYS = 3;
const WHATSAPP_MIN_DAYS = 12;
const WHATSAPP_MAX_DAYS = 14;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Add `days` delivery days to `from`, not counting Sundays. */
export function addDaysSkippingSundays(from: Date, days: number): Date {
  const d = startOfDay(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) added += 1;
  }
  return d;
}

export function addCalendarDays(from: Date, days: number): Date {
  const d = startOfDay(from);
  d.setDate(d.getDate() + days);
  return d;
}

/** "Thu, 21 Nov" */
export function formatDeliveryDate(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export interface DeliveryEstimate {
  /** Earliest date (equals `to` for a single-day estimate). */
  from: Date;
  to: Date;
  /** Display text, e.g. "Thu, 21 Nov" or "Mon, 30 Nov – Wed, 2 Dec". */
  label: string;
}

export function estimateDelivery(opts: { whatsapp: boolean; now?: Date }): DeliveryEstimate {
  const now = opts.now ?? new Date();
  if (opts.whatsapp) {
    const from = addCalendarDays(now, WHATSAPP_MIN_DAYS);
    const to = addCalendarDays(now, WHATSAPP_MAX_DAYS);
    return { from, to, label: `${formatDeliveryDate(from)} – ${formatDeliveryDate(to)}` };
  }
  const date = addDaysSkippingSundays(now, STANDARD_DAYS);
  return { from: date, to: date, label: formatDeliveryDate(date) };
}
