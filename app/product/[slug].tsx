import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Canonical product page lives at /products/[slug] inside the (main)
 * group. This alias keeps `luxe://product/<slug>` share links resolving
 * instead of landing on Unmatched Route.
 */
export default function ProductSingularRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <Redirect href={`/products/${Array.isArray(slug) ? slug[0] : slug}`} />;
}
