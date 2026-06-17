import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/lib/theme/provider";
import { hasStoreApi } from "@/lib/api/delivery-api";
import {
  getDeliveryCompanyRoute,
  type DcRoute,
  type DcRouteStop,
} from "@/lib/api/delivery-company-api";
import { EmptyState } from "@/components/ui";
import { typography, radii } from "@/lib/theme/tokens";

export default function RouteMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { routeId } = useLocalSearchParams<{ routeId?: string }>();
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors);
  const [route, setRoute] = useState<DcRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routeId) {
      setError("No route id");
      setLoading(false);
      return;
    }
    if (!hasStoreApi()) {
      setError("Store API not configured");
      setLoading(false);
      return;
    }
    (async () => {
      const res = await getDeliveryCompanyRoute(routeId);
      if (res.ok) setRoute(res.data.route);
      else setError(res.error);
      setLoading(false);
    })();
  }, [routeId]);

  const stops = useMemo(
    () =>
      (route?.stops ?? [])
        .slice()
        .sort((a, b) => a.sequence - b.sequence),
    [route],
  );

  const coords = useMemo(() => {
    const out: { latitude: number; longitude: number }[] = [];
    for (const s of stops) {
      const lat = (s.address_snapshot as { latitude?: number } | null)?.latitude;
      const lng = (s.address_snapshot as { longitude?: number } | null)?.longitude;
      if (typeof lat === "number" && typeof lng === "number") {
        out.push({ latitude: lat, longitude: lng });
      }
    }
    return out;
  }, [stops]);

  const region = useMemo(() => {
    if (coords.length === 0) {
      return { latitude: 6.9271, longitude: 79.8612, latitudeDelta: 0.5, longitudeDelta: 0.5 };
    }
    const lats = coords.map((c) => c.latitude);
    const lngs = coords.map((c) => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.02, (maxLat - minLat) * 1.5),
      longitudeDelta: Math.max(0.02, (maxLng - minLng) * 1.5),
    };
  }, [coords]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !route) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <EmptyState icon="map-outline" title="Route unavailable" description={error ?? "Not found"} />
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={[styles.backLinkText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLinkText, { color: colors.primary }]}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.title}>Route #{route.id.slice(0, 6)}</Text>
          <Text style={styles.sub}>
            {route.route_kind ?? "delivery"} · {stops.length} stops · {route.status}
          </Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      {/* Map */}
      {coords.length > 0 ? (
        <MapView
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={region}
          customMapStyle={isDark ? DARK_MAP_STYLE : undefined}
        >
          {stops.map((s) => {
            const lat = (s.address_snapshot as { latitude?: number } | null)?.latitude;
            const lng = (s.address_snapshot as { longitude?: number } | null)?.longitude;
            if (typeof lat !== "number" || typeof lng !== "number") return null;
            return (
              <Marker
                key={s.id}
                coordinate={{ latitude: lat, longitude: lng }}
                title={`#${s.sequence} ${s.order?.order_number ?? ""}`}
                description={s.status}
              >
                <View style={[styles.marker, { backgroundColor: colors.primary, borderColor: colors.card }]}>
                  <Text style={styles.markerText}>{s.sequence}</Text>
                </View>
              </Marker>
            );
          })}
          {coords.length >= 2 ? (
            <Polyline
              coordinates={coords}
              strokeColor={colors.primary}
              strokeWidth={3}
            />
          ) : null}
        </MapView>
      ) : (
        <View style={[styles.noMap, { backgroundColor: colors.card }]}>
          <Ionicons name="location-outline" size={36} color={colors.mutedForeground} />
          <Text style={styles.muted}>Stops don't have coordinates yet</Text>
        </View>
      )}

      {/* Bottom sheet of stops */}
      <View style={[styles.sheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <View style={styles.handle} />
        <Text style={styles.sheetTitle}>Stops</Text>
        <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ paddingBottom: 12 }}>
          {stops.map((s) => (
            <StopRow key={s.id} stop={s} onOpen={() => s.order?.id && router.push(`/(delivery)/orders/${s.order.id}` as any)} colors={colors} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function StopRow({
  stop,
  onOpen,
  colors,
}: {
  stop: DcRouteStop;
  onOpen: () => void;
  colors: ReturnType<typeof useTheme>["colors"];
}) {
  const addr = stop.address_snapshot as { line1?: string; city?: string; latitude?: number; longitude?: number } | null;
  const mapsLink =
    addr?.latitude && addr?.longitude
      ? `https://www.google.com/maps/dir/?api=1&destination=${addr.latitude},${addr.longitude}`
      : addr
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
          [addr.line1, addr.city].filter(Boolean).join(", "),
        )}`
      : null;

  return (
    <View style={[stopRowStyles.row, { borderBottomColor: colors.border }]}>
      <View style={[stopRowStyles.bubble, { backgroundColor: colors.primary }]}>
        <Text style={stopRowStyles.bubbleText}>{stop.sequence}</Text>
      </View>
      <TouchableOpacity onPress={onOpen} style={{ flex: 1 }}>
        <Text style={[stopRowStyles.orderNum, { color: colors.foreground }]}>
          {stop.order?.order_number ?? "—"}
        </Text>
        <Text style={[stopRowStyles.address, { color: colors.mutedForeground }]} numberOfLines={1}>
          {addr?.line1 ?? "—"}, {addr?.city ?? ""}
        </Text>
        <Text style={[stopRowStyles.status, { color: stopColor(stop.status) }]}>{stop.status.replace(/_/g, " ")}</Text>
      </TouchableOpacity>
      {mapsLink ? (
        <TouchableOpacity onPress={() => Linking.openURL(mapsLink)} style={[stopRowStyles.navBtn, { borderColor: colors.border }]}>
          <Ionicons name="navigate-outline" size={16} color={colors.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function stopColor(status: string): string {
  if (status === "delivered") return "#16a34a";
  if (status === "failed") return "#dc2626";
  if (status === "arrived") return "#d97706";
  return "#65684d";
}

const stopRowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bubble: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bubbleText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  orderNum: { fontSize: 13, fontWeight: "600", fontFamily: "monospace" },
  address: { fontSize: 11, marginTop: 2 },
  status: { fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "600" },
  navBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});

const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ec3b9" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a3646" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4b6878" }] },
  { featureType: "land", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#283d6a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#304a7d" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
];

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    topBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      zIndex: 10,
      flexDirection: "row",
      alignItems: "center",
    },
    backLink: { paddingVertical: 8, paddingRight: 8 },
    backLinkText: { fontSize: 14, fontWeight: "500" },
    title: { fontSize: 14, fontWeight: "700", color: colors.foreground },
    sub: { fontSize: 10, color: colors.mutedForeground, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.5 },
    noMap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    muted: { color: colors.mutedForeground, fontSize: 13 },
    marker: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
    },
    markerText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    sheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 24,
      borderTopWidth: StyleSheet.hairlineWidth,
      maxHeight: "60%",
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: "center",
      marginBottom: 8,
    },
    sheetTitle: { fontSize: 14, fontWeight: "700", color: colors.foreground, marginBottom: 8 },
  });
}
