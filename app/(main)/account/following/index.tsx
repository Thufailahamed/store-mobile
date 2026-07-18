import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader, PaperBackground } from "@/components/layout";
import { Body } from "@/components/ui/Typography";
import { ProductStoreCard } from "@/components/product/ProductStoreCard";
import { FollowingEmptyState } from "@/components/account/FollowingEmptyState";
import { useAuth } from "@/lib/supabase/auth";
import { useToast } from "@/components/ui";
import { getFollowedStores as getFollowedStoresFromDb } from "@/lib/api";
import { getLocallyFollowedStoreIds } from "@/lib/api/stores";
import { mapStore } from "@/lib/api/product-mapper";
import { getStoresBackend } from "@/lib/api/backend";
import { colors, spacing } from "@/lib/theme/tokens";
import type { Store } from "@/lib/types";

export default function FollowingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStores = useCallback(async () => {
    if (user?.id) {
      const res = await getFollowedStoresFromDb(user.id);
      if (res.ok) {
        setStores(res.data.map((row) => row.store).filter(Boolean));
        return;
      }
      // Signed-in user: a failed fetch must not silently fall through to the
      // guest/local fallback below — that would show stale/wrong data with
      // no indication anything went wrong.
      toast(res.error || "Couldn't load your following list", "error");
      setStores([]);
      return;
    }

    const localIds = await getLocallyFollowedStoreIds();
    if (localIds.length === 0) {
      setStores([]);
      return;
    }

    const res = await getStoresBackend({ limit: 100 });
    if (!res.ok || !res.data) {
      setStores([]);
      return;
    }

    const byId = new Map(
      (res.data.stores as Store[]).map((s) => [s.id, mapStore(s) as Store])
    );
    setStores(localIds.map((id) => byId.get(id)).filter((s): s is Store => !!s));
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await fetchStores();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchStores]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStores();
    setRefreshing(false);
  }, [fetchStores]);

  return (
    <PaperBackground>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Following" onBack={() => router.back()} />

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.olive[600]} />
            <Body muted size="sm" style={{ marginTop: spacing[3] }}>
              Loading boutiques…
            </Body>
          </View>
        ) : stores.length === 0 ? (
          <FollowingEmptyState />
        ) : (
          <FlatList
            data={stores}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <ProductStoreCard store={item} />
              </View>
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.olive[600]}
              />
            }
            ListHeaderComponent={
              <Body muted size="sm" style={styles.count}>
                {stores.length} {stores.length === 1 ? "boutique" : "boutiques"}
              </Body>
            }
          />
        )}
      </SafeAreaView>
    </PaperBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingTop: spacing[2],
    paddingBottom: spacing[10],
    gap: spacing[3],
  },
  row: {
    marginBottom: spacing[1],
  },
  count: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
});
