/**
 * Friendly error mapping for review submission failures. The Supabase
 * client surfaces Postgres exception messages verbatim, which include
 * column names and RAISE EXCEPTION text. Convert them to user-facing
 * copy that explains what to do next.
 *
 * Pure function — safe to import on web, mobile, tests.
 */

export function friendlyReviewError(raw: string | null | undefined): string {
  if (!raw) return "Could not save your review.";
  if (/product_id .* does not match order_item/i.test(raw)) {
    return "That order is for a different product. Please pick a matching order.";
  }
  if (/does not belong to current user/i.test(raw)) {
    return "That order isn't yours. Please pick one of your own orders.";
  }
  if (/does not exist/i.test(raw)) {
    return "That order is no longer available. Please pick another.";
  }
  if (/user_id.*must equal auth\.uid\(\)/i.test(raw)) {
    return "Please sign in again to post a review.";
  }
  return raw;
}

export function formatReviewDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
