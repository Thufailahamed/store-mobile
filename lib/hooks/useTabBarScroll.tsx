import React, { createContext, useContext, useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { expandableTabBarInset } from "@/components/layout/ExpandableTabBar";

/** Ignore scroll jitter smaller than this before reacting to direction. */
const DIRECTION_THRESHOLD = 8;
/** Always keep the tab bar visible near the top of the list. */
const TOP_REVEAL_THRESHOLD = 24;
const ANIM_DURATION = 220;
/**
 * Stop feeding `scrollY` this close to the end of the list. Folding or
 * unfolding AppHeader resizes the list viewport, which shifts the max offset
 * by the header's height — iOS then reports that clamp (and the bottom
 * bounce-back) as a scroll in the opposite direction, so the header flips
 * back, resizes again, and appears stuck/jittering at the bottom.
 */
const END_FREEZE_ZONE = 160;

interface TabBarVisibilityContextValue {
  translateY: SharedValue<number>;
  scrollAnchor: SharedValue<number>;
  hideDistance: number;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | null>(null);

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const hideDistance = expandableTabBarInset(insets.bottom);
  const translateY = useSharedValue(0);
  const scrollAnchor = useSharedValue(0);

  const value = useMemo(
    () => ({ translateY, scrollAnchor, hideDistance }),
    [translateY, scrollAnchor, hideDistance],
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>
  );
}

/** Internal — consumed by ExpandableTabBar to read the animated offset. */
export function useTabBarVisibility() {
  const ctx = useContext(TabBarVisibilityContext);
  if (!ctx) {
    throw new Error("useTabBarVisibility must be used within a TabBarVisibilityProvider");
  }
  return ctx;
}

/**
 * Attach to a tab screen's primary scroll container (Animated.ScrollView /
 * Animated.FlatList) to hide the floating tab bar on scroll-down and reveal
 * it on scroll-up, Facebook-style. Pass `scrollY` to also receive the raw
 * offset (e.g. for AppHeader's collapse-on-scroll).
 */
export function useHideTabBarOnScroll(scrollY?: SharedValue<number>) {
  const { translateY, scrollAnchor, hideDistance } = useTabBarVisibility();

  return useAnimatedScrollHandler({
    onScroll: (event) => {
      const maxOffset = Math.max(
        0,
        event.contentSize.height - event.layoutMeasurement.height,
      );
      // Clamp both ends so rubber-band overscroll never reads as a direction change.
      const currentOffset = Math.min(Math.max(0, event.contentOffset.y), maxOffset);
      // Optional mirror of the offset for scroll-linked UI (e.g. AppHeader
      // collapse). Frozen near the end — see END_FREEZE_ZONE.
      if (scrollY && currentOffset < maxOffset - END_FREEZE_ZONE) {
        scrollY.value = currentOffset;
      }

      if (currentOffset <= TOP_REVEAL_THRESHOLD) {
        scrollAnchor.value = currentOffset;
        translateY.value = withTiming(0, { duration: ANIM_DURATION });
        return;
      }

      // Direction is judged by drift from an anchor, not per-event deltas:
      // Android emits many small scroll events whose individual deltas never
      // reach the threshold, which left the bar stuck hidden.
      const drift = currentOffset - scrollAnchor.value;
      if (drift > DIRECTION_THRESHOLD) {
        scrollAnchor.value = currentOffset;
        translateY.value = withTiming(hideDistance, { duration: ANIM_DURATION });
      } else if (drift < -DIRECTION_THRESHOLD) {
        scrollAnchor.value = currentOffset;
        translateY.value = withTiming(0, { duration: ANIM_DURATION });
      }
    },
  });
}

export const AnimatedScrollView = Animated.ScrollView;
export const AnimatedFlatList = Animated.FlatList;
