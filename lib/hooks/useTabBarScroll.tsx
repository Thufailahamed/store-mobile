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

interface TabBarVisibilityContextValue {
  translateY: SharedValue<number>;
  lastOffset: SharedValue<number>;
  hideDistance: number;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityContextValue | null>(null);

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const hideDistance = expandableTabBarInset(insets.bottom);
  const translateY = useSharedValue(0);
  const lastOffset = useSharedValue(0);

  const value = useMemo(
    () => ({ translateY, lastOffset, hideDistance }),
    [translateY, lastOffset, hideDistance],
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
 * it on scroll-up, Facebook-style.
 */
export function useHideTabBarOnScroll() {
  const { translateY, lastOffset, hideDistance } = useTabBarVisibility();

  return useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentOffset = Math.max(0, event.contentOffset.y);
      const diff = currentOffset - lastOffset.value;

      if (currentOffset <= TOP_REVEAL_THRESHOLD) {
        translateY.value = withTiming(0, { duration: ANIM_DURATION });
      } else if (diff > DIRECTION_THRESHOLD) {
        translateY.value = withTiming(hideDistance, { duration: ANIM_DURATION });
      } else if (diff < -DIRECTION_THRESHOLD) {
        translateY.value = withTiming(0, { duration: ANIM_DURATION });
      }

      lastOffset.value = currentOffset;
    },
  });
}

export const AnimatedScrollView = Animated.ScrollView;
export const AnimatedFlatList = Animated.FlatList;
