/**
 * "Set of N different designs included" — products.set_design_count.
 * Shown only for 2+; 0 / 1 / missing = nothing shown. Mirrored in
 * store/src/lib/set-designs.ts.
 */
export function setDesignsLabel(count: number | null | undefined): string | null {
  const n = Math.floor(Number(count) || 0);
  if (n < 2) return null;
  return `Set of ${n} different designs included`;
}
