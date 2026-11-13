/**
 * CrossfadeGradient — a LinearGradient whose colours fade smoothly when the
 * `colors` prop changes (the new gradient fades in over the old one).
 */
import React, { useLayoutEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type Colors = readonly [string, string, ...string[]];

export function CrossfadeGradient({
  colors,
  locations,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  duration = 380,
  style,
}: {
  colors: Colors;
  locations?: readonly [number, number, ...number[]];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const key = colors.join("|");
  const [layers, setLayers] = useState<{ base: Colors; top: Colors; key: string }>({
    base: colors,
    top: colors,
    key,
  });
  const opacity = useRef(new Animated.Value(1)).current;

  if (layers.key !== key) {
    // Previous target becomes the base; the new colours fade in on top.
    setLayers({ base: layers.top, top: colors, key });
  }

  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [layers.key, duration, opacity]);

  return (
    <View pointerEvents="none" style={style}>
      <LinearGradient colors={layers.base} locations={locations} start={start} end={end} style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
        <LinearGradient colors={layers.top} locations={locations} start={start} end={end} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}
