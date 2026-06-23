import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import { Ionicons } from "@/components/ui/Icon";
import * as Location from "expo-location";
import { colors, radii, shadows, spacing, typography } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface AddressMapPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  onUseMyLocation?: () => void;
  height?: number;
  initialDelta?: { latitudeDelta: number; longitudeDelta: number };
  disabled?: boolean;
}

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
 * Kept outside ScrollView parents when possible — nested scroll steals map gestures on Android.
 */
export function AddressMapPicker({
  latitude,
  longitude,
  onLocationChange,
  onUseMyLocation,
  height = 240,
  initialDelta = { latitudeDelta: 0.008, longitudeDelta: 0.008 },
  disabled = false,
}: AddressMapPickerProps) {
  const mapRef = useRef<MapView | null>(null);
  const lastPropKey = useRef<string | null>(null);
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

  const animateTo = (lat: number, lng: number) => {
    if (!mapRef.current || !mapReady) return;
    mapRef.current.animateToRegion(regionForPin(lat, lng, initialDelta), 350);
  };

  const setPinCoords = (lat: number, lng: number, animate: boolean) => {
    const key = coordKey(lat, lng);
    lastPropKey.current = key;
    setPin({ lat, lng });
    if (animate) animateTo(lat, lng);
  };

  // Sync when parent pushes new coordinates (e.g. auto-detect).
  useEffect(() => {
    if (latitude == null || longitude == null) return;
    const key = coordKey(latitude, longitude);
    if (key === lastPropKey.current) return;
    lastPropKey.current = key;
    setPin({ lat: latitude, lng: longitude });
    animateTo(latitude, longitude);
  }, [latitude, longitude, mapReady]);

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
    setPinCoords(lat, lng, false);
    onLocationChange(lat, lng);
  };

  const handleUseMyLocation = async () => {
    if (loadingLocation) return;
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        onUseMyLocation?.();
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setPinCoords(lat, lng, true);
      onLocationChange(lat, lng);
    } catch {
      onUseMyLocation?.();
    } finally {
      setLoadingLocation(false);
    }
  };

  return (
    <View style={[styles.container, { height }]} collapsable={false}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        onPress={handleMapPress}
        onMapReady={() => setMapReady(true)}
        scrollEnabled={!disabled}
        zoomEnabled={!disabled}
        rotateEnabled={false}
        pitchEnabled={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        loadingEnabled
        moveOnMarkerPress={false}
      >
        {pin ? (
          <Marker
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            draggable={!disabled}
            onDragEnd={handleDragEnd}
            anchor={{ x: 0.5, y: 1 }}
            pinColor={colors.light.primary}
          />
        ) : null}
      </MapView>

      {!mapReady ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.light.primary} />
          <Text style={styles.loadingText}>Loading map…</Text>
        </View>
      ) : null}

      {!pin && !loadingLocation && mapReady ? (
        <View pointerEvents="none" style={styles.hint}>
          <Ionicons name="hand-left-outline" size={14} color={colors.light.primaryForeground} />
          <Text style={styles.hintText}>Tap map to drop a pin</Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={handleUseMyLocation}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        disabled={loadingLocation || disabled}
      >
        {loadingLocation ? (
          <ActivityIndicator size="small" color={colors.light.primary} />
        ) : (
          <Ionicons name="navigate" size={18} color={colors.light.primary} />
        )}
      </Pressable>

      <View pointerEvents="none" style={styles.coordsBar}>
        <Ionicons name="pin" size={11} color={colors.light.primaryForeground} />
        <Text style={styles.coordsText} numberOfLines={1}>
          {pin
            ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
            : "Drop pin to set delivery location"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.light.border,
    backgroundColor: colors.olive[50],
    position: "relative",
    ...shadows.soft,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    backgroundColor: colors.olive[50],
  },
  loadingText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.fontSizes.xs,
    color: colors.light.mutedForeground,
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
    fontFamily: fontFamilies.mono.medium,
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
