/**
 * Reels: full-screen shoppable reels from every boutique.
 * `?start=<postId>` opens on that reel; `?demo=1` (dev builds only) adds sample reels.
 */
import { Stack, useLocalSearchParams } from "expo-router";
import { ReelsFeed } from "@/components/posts/ReelsFeed";

export default function ReelsScreen() {
  const { start, demo } = useLocalSearchParams<{ start?: string; demo?: string }>();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ReelsFeed startId={start ? String(start) : undefined} demo={__DEV__ && demo === "1"} />
    </>
  );
}
