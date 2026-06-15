import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * of no further changes. Used to throttle Google Places Autocomplete
 * requests as the user types.
 */
export function useDebounce<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}
