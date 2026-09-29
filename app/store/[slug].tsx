import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Canonical store page lives at /stores/[slug] inside the (main) group.
 * This alias keeps `luxe://store/<slug>` deep links and older in-app
 * pushes resolving instead of landing on Unmatched Route.
 */
export default function StoreSingularRedirect() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  return <Redirect href={`/stores/${Array.isArray(slug) ? slug[0] : slug}`} />;
}
