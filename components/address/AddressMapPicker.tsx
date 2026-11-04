import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Path, Rect, Circle as SvgCircle } from "react-native-svg";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { Ionicons } from "@/components/ui/Icon";
import { getDevicePosition } from "@/lib/location";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";
import { C } from "@/components/orders/parcel-track";

interface AddressMapPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  onUseMyLocation?: () => void;
  height?: number;
  initialDelta?: { latitudeDelta: number; longitudeDelta: number };
  disabled?: boolean;
  /** Show the raw lat/lng strip along the bottom (useful for staff tools, noise for shoppers). */
  showCoords?: boolean;
  /** Show the round "locate me" button in the corner. */
  showLocateButton?: boolean;
  /** Extra content layered over the bottom of the map (e.g. a CTA pill). */
  overlay?: React.ReactNode;
  /** Notifies parent when the user starts/stops touching the map to avoid ScrollView conflicts. */
  onInteractionChange?: (interacting: boolean) => void;
}

/** If tiles haven't rendered by now the Maps SDK key is almost certainly rejected. */
const TILE_TIMEOUT_MS = 9000;

const FALLBACK_REGION: Region = {
  latitude: 6.9271,
  longitude: 79.8612,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function regionForPin(
  lat: number,
  lng: number,
  delta: { latitudeDelta: number; longitudeDelta: number }
): Region {
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: delta.latitudeDelta,
    longitudeDelta: delta.longitudeDelta,
  };
}

function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)}|${lng.toFixed(6)}`;
}

/**
 * Map with a draggable pin. Parent receives coordinate updates for reverse-geocoding.
 * Supports pin dragging, map panning to adjust pin, tapping anywhere, and gesture isolation.
 */
export function AddressMapPicker({
  latitude,
  longitude,
  onLocationChange,
  onUseMyLocation,
  height = 240,
  initialDelta = { latitudeDelta: 0.008, longitudeDelta: 0.008 },
  disabled = false,
  showCoords = true,
  showLocateButton = true,
  overlay,
  onInteractionChange,
}: AddressMapPickerProps) {
  const mapRef = useRef<MapView | null>(null);
  const lastPropKey = useRef<string | null>(null);
  // Coordinates that arrived before the map was ready still need a camera move.
  const pendingAnimate = useRef(false);
  const isProgrammaticMove = useRef(false);
  const isUserInteracting = useRef(false);
  const userInteractionTimeout = useRef<NodeJS.Timeout | null>(null);

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null
  );
  const [initialRegion] = useState<Region>(() =>
    latitude != null && longitude != null
      ? regionForPin(latitude, longitude, initialDelta)
      : FALLBACK_REGION
  );
  const [mapReady, setMapReady] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [tilesLoaded, setTilesLoaded] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    if (tilesLoaded || mapReady) return;
    const t = setTimeout(() => {
      if (!mapReady && !tilesLoaded) {
        setTilesFailed(true);
      }
    }, TILE_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [tilesLoaded, mapReady]);

  const animateTo = (lat: number, lng: number) => {
    if (!mapRef.current || !mapReady) return;
    isProgrammaticMove.current = true;
    mapRef.current.animateToRegion(regionForPin(lat, lng, initialDelta), 350);
    setTimeout(() => {
      isProgrammaticMove.current = false;
    }, 450);
  };

  const setPinCoords = (lat: number, lng: number, animate: boolean) => {
    const key = coordKey(lat, lng);
    lastPropKey.current = key;
    setPin({ lat, lng });
    if (animate) animateTo(lat, lng);
  };

  // Sync when parent pushes new coordinates (e.g. auto-detect). If they land
  // before the map is ready, remember to move the camera once it is — otherwise
  // the pin sits off-screen while the map still shows the fallback region.
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    const key = coordKey(latitude, longitude);
    if (key !== lastPropKey.current) {
      lastPropKey.current = key;
      setPin({ lat: latitude, lng: longitude });
      pendingAnimate.current = true;
    }
    if (pendingAnimate.current && mapReady) {
      pendingAnimate.current = false;
      animateTo(latitude, longitude);
    }
  }, [latitude, longitude, mapReady]);

  const handleTouchStart = () => {
    if (userInteractionTimeout.current) {
      clearTimeout(userInteractionTimeout.current);
      userInteractionTimeout.current = null;
    }
    isUserInteracting.current = true;
    onInteractionChange?.(true);
  };

  const handleTouchEnd = () => {
    onInteractionChange?.(false);
    userInteractionTimeout.current = setTimeout(() => {
      isUserInteracting.current = false;
    }, 400);
  };

  const handleDragEnd = (e: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setPinCoords(lat, lng, false);
    onLocationChange(lat, lng);
  };

  const handleMapPress = (e: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    if (disabled) return;
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setPinCoords(lat, lng, true);
    onLocationChange(lat, lng);
  };

  const handlePoiClick = (e: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    if (disabled) return;
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setPinCoords(lat, lng, true);
    onLocationChange(lat, lng);
  };

  const handleRegionChangeComplete = (
    region: Region,
    details?: { isGesture?: boolean }
  ) => {
    if (disabled || isProgrammaticMove.current) return;
    const wasUserGesture = details?.isGesture || isUserInteracting.current;
    if (wasUserGesture) {
      const lat = region.latitude;
      const lng = region.longitude;
      const key = coordKey(lat, lng);
      if (lastPropKey.current !== key) {
        lastPropKey.current = key;
        setPin({ lat, lng });
        onLocationChange(lat, lng);
      }
    }
  };

  const handleUseMyLocation = async () => {
    if (loadingLocation) return;
    setLoadingLocation(true);
    try {
      const { lat, lng } = await getDevicePosition();
      setPinCoords(lat, lng, true);
      onLocationChange(lat, lng);
    } catch {
      onUseMyLocation?.();
    } finally {
      setLoadingLocation(false);
    }
  };

  return (
    <View
      style={[styles.container, { height }]}
      collapsable={false}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        onPress={handleMapPress}
        onPoiClick={handlePoiClick}
        onRegionChangeComplete={handleRegionChangeComplete}
        onMapReady={() => {
          setMapReady(true);
          setTilesLoaded(true);
          setTilesFailed(false);
        }}
        onMapLoaded={() => {
          setTilesLoaded(true);
          setTilesFailed(false);
        }}
        scrollEnabled={!disabled}
        zoomEnabled={!disabled}
        rotateEnabled={false}
        pitchEnabled={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        loadingEnabled={false}
        moveOnMarkerPress={false}
      >
        {pin ? (
          <Marker
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            draggable={!disabled}
            onDragStart={handleTouchStart}
            onDragEnd={(e) => {
              handleTouchEnd();
              handleDragEnd(e);
            }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.markerContainer}>
              <View style={styles.markerBadge}>
                <Ionicons name="location" size={20} color={C.lime} />
              </View>
              <View style={styles.markerPoint} />
            </View>
          </Marker>
        ) : null}
      </MapView>

      {tilesFailed && !mapReady && !tilesLoaded ? (
        <MapPlaceholder
          pinned={Boolean(pin)}
          title={pin ? "Location pinned" : "Map preview unavailable"}
          sub={
            pin
              ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
              : "Use your current location to pin it exactly"
          }
        />
      ) : null}

      {!pin && !loadingLocation && (mapReady || tilesLoaded) ? (
        <View pointerEvents="none" style={styles.hint}>
          <Ionicons name="hand-left-outline" size={14} color={colors.light.primaryForeground} />
          <Text style={styles.hintText}>Tap map or drag to place pin</Text>
        </View>
      ) : pin && (mapReady || tilesLoaded) ? (
        <View pointerEvents="none" style={styles.hintPinned}>
          <Ionicons name="move-outline" size={13} color={C.lime} />
          <Text style={styles.hintPinnedText}>Tap map or drag pin to adjust</Text>
        </View>
      ) : null}

      {showLocateButton ? (
        <Pressable
          accessibilityRole="button"
          onPress={handleUseMyLocation}
          style={({ pressed }) => [styles.fab, !showCoords && styles.fabLow, pressed && styles.fabPressed]}
          accessibilityLabel="Use my location"
          disabled={loadingLocation || disabled}
        >
          {loadingLocation ? (
            <ActivityIndicator size="small" color={colors.light.primary} />
          ) : (
            <Ionicons name="navigate" size={18} color={colors.light.primary} />
          )}
        </Pressable>
      ) : null}

      {overlay ? <View style={styles.overlay}>{overlay}</View> : null}

      {showCoords ? (
        <View pointerEvents="none" style={styles.coordsBar}>
          <Ionicons name="pin" size={11} color={colors.light.primaryForeground} />
          <Text style={styles.coordsText} numberOfLines={1}>
            {pin
              ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
              : "Drop pin to set delivery location"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Illustrated, softly animated stand-in shown while tiles load or fail. */
function MapPlaceholder({ pinned, title, sub }: { pinned: boolean; title: string; sub?: string }) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1);
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.5 * (1 - pulse.value),
    transform: [{ scale: 0.6 + pulse.value * 1.4 }],
  }));

  return (
    <View pointerEvents="none" style={styles.placeholder}>
      <Svg width="100%" height="100%" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={400} height={220} fill="#ecebdd" />
        {/* city blocks */}
        <Rect x={18} y={16} width={96} height={58} rx={10} fill="#e2e2cf" />
        <Rect x={134} y={22} width={70} height={46} rx={10} fill="#e4e5d2" />
        <Rect x={286} y={14} width={98} height={66} rx={10} fill="#e2e2cf" />
        <Rect x={22} y={140} width={80} height={64} rx={10} fill="#e4e5d2" />
        <Rect x={250} y={150} width={128} height={56} rx={10} fill="#e2e2cf" />
        {/* park + water */}
        <Rect x={124} y={150} width={92} height={56} rx={14} fill="#d7dcbc" />
        <Path d="M300 96 C330 92 360 110 400 104 L400 136 C362 142 330 126 300 132 Z" fill="#dfe3d6" />
        {/* roads */}
        <Path d="M-10 112 C90 96 170 130 260 110 S360 86 420 98" stroke="#faf8f1" strokeWidth={12} fill="none" strokeLinecap="round" />
        <Path d="M232 -10 C224 60 246 140 230 240" stroke="#faf8f1" strokeWidth={9} fill="none" strokeLinecap="round" />
        <Path d="M-10 112 C90 96 170 130 260 110 S360 86 420 98" stroke="#d9d5bf" strokeWidth={1} strokeDasharray="6 7" fill="none" />
        <Path d="M120 -10 C126 40 112 80 120 240" stroke="#faf8f1" strokeWidth={6} fill="none" />
        <SvgCircle cx={200} cy={108} r={3} fill="#c8a44a" opacity={0.6} />
      </Svg>

      <View style={styles.placeholderContent}>
      <View style={styles.placeholderPinWrap}>
        {!pinned && <Animated.View style={[styles.placeholderRing, ring]} />}
        <View style={styles.placeholderPin}>
          <Ionicons name={pinned ? "location" : "location-outline"} size={20} color="#E8CF8F" />
        </View>
      </View>

      <View style={styles.placeholderLabel}>
        <Text style={styles.placeholderTitle}>{title}</Text>
        {sub ? (
          <Text style={styles.placeholderSub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecebdd",
  },
  placeholderContent: {
    alignItems: "center",
    marginBottom: spacing[12],
  },
  placeholderPinWrap: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: colors.accent2.ochre,
  },
  placeholderPin: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#16170f",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.paper.cream,
    ...shadows.editorial,
  },
  placeholderLabel: {
    marginTop: spacing[2],
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: "rgba(250,248,241,0.86)",
  },
  placeholderTitle: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 14,
    color: colors.ink.DEFAULT,
  },
  placeholderSub: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
    color: colors.ink.mute,
    marginTop: 1,
  },
  container: {
    borderRadius: 20,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: "#f0ede2",
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: "absolute",
    left: spacing[3],
    right: spacing[3],
    bottom: spacing[3],
    zIndex: 3,
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  markerBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: C.card,
    ...shadows.editorial,
  },
  markerPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.ink,
    borderWidth: 1.5,
    borderColor: C.card,
    marginTop: 2,
  },
  hintPinned: {
    position: "absolute",
    top: spacing[3],
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: "rgba(22, 23, 15, 0.86)",
  },
  hintPinnedText: {
    color: C.cream,
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
  },
  hint: {
    position: "absolute",
    top: spacing[3],
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: "rgba(22, 23, 15, 0.78)",
  },
  hintText: {
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.sans.medium,
    fontSize: typography.fontSizes.xs,
  },
  fab: {
    position: "absolute",
    right: 10,
    bottom: 36,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper.cream,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    ...shadows.soft,
  },
  fabLow: { bottom: 10 },
  fabPressed: { opacity: 0.8 },
  coordsBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    backgroundColor: "rgba(22, 23, 15, 0.78)",
  },
  coordsText: {
    flex: 1,
    color: colors.light.primaryForeground,
    fontFamily: fontFamilies.mono.regular,
    fontSize: 10,
  },
});
