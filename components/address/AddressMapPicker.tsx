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

// Default to Sri Lanka (Colombo) when no pin yet.
const FALLBACK_REGION: Region = {
  latitude: 6.9271,
  longitude: 79.8612,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

/**
 * Map with a single draggable Marker. Dragging the pin calls
 * `onLocationChange` so the parent can reverse-geocode the new
 * coordinates. A "Use my location" FAB sits on the top-right.
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
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(
    latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null
  );
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Keep internal pin in sync if parent resets it.
  useEffect(() => {
    if (latitude != null && longitude != null) {
      setPin({ lat: latitude, lng: longitude });
    }
  }, [latitude, longitude]);

  // Animate to the pin when it first appears.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!mapRef.current || !pin) return;
    mapRef.current.animateToRegion(
      {
        latitude: pin.lat,
        longitude: pin.lng,
        latitudeDelta: initialDelta.latitudeDelta,
        longitudeDelta: initialDelta.longitudeDelta,
      },
      400
    );
  }, [pin?.lat, pin?.lng]);

  const handleDragEnd = (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    setPin({ lat, lng });
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
        accuracy: Location.Accuracy.Balanced,
      });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setPin({ lat, lng });
      onLocationChange(lat, lng);
    } catch {
      onUseMyLocation?.();
    } finally {
      setLoadingLocation(false);
    }
  };

  const initialRegion: Region = pin
    ? {
        latitude: pin.lat,
        longitude: pin.lng,
        latitudeDelta: initialDelta.latitudeDelta,
        longitudeDelta: initialDelta.longitudeDelta,
      }
    : FALLBACK_REGION;

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        onPress={(e) => {
          if (disabled) return;
          const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
          setPin({ lat, lng });
          onLocationChange(lat, lng);
        }}
        pointerEvents={disabled ? "none" : undefined}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        {pin && (
          <Marker
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            draggable={!disabled}
            onDragEnd={handleDragEnd}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
          >
            <View style={styles.pinWrap}>
              <View style={styles.pinShadow} />
              <View style={styles.pinDot} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Crosshair hint when no pin yet */}
      {!pin && !loadingLocation && (
        <View pointerEvents="none" style={styles.hint}>
          <Ionicons name="hand-left-outline" size={14} color={colors.light.primaryForeground} />
          <Text style={styles.hintText}>Tap map to drop a pin</Text>
        </View>
      )}

      {/* Use my location FAB */}
      <Pressable
        accessibilityRole="button"
        onPress={handleUseMyLocation}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        disabled={loadingLocation}
      >
        {loadingLocation ? (
          <ActivityIndicator size="small" color={colors.light.primary} />
        ) : (
          <Ionicons name="navigate" size={18} color={colors.light.primary} />
        )}
      </Pressable>

      {/* Bottom gradient + coordinates */}
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
  pinWrap: {
    alignItems: "center",
    justifyContent: "flex-end",
  },
  pinShadow: {
    position: "absolute",
    bottom: -2,
    width: 12,
    height: 4,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  pinDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.light.primary,
    borderWidth: 3,
    borderColor: colors.paper.cream,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
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
