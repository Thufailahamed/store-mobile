import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, TextInput, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAdminUsers, updateUserRole } from "@/lib/api";
import { Card, Badge, Skeleton } from "@/components/ui";
import { colors, typography, radii } from "@/lib/theme/tokens";

const ROLES = ["all", "customer", "store_owner", "brand_owner", "admin", "delivery"];

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [role, setRole] = useState("all");
  const [search, setSearch] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users", role, search],
    queryFn: async () => {
      const res = await getAdminUsers({ role, search });
      return res.ok ? res.data : { users: [], total: 0 };
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string }) =>
      updateUserRole(userId, newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const users = usersQuery.data?.users ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Users</Text>
        <Text style={styles.count}>{usersQuery.data?.total ?? 0}</Text>
      </View>

      <TextInput
        style={styles.search}
        placeholder="Search by name or email..."
        placeholderTextColor={colors.light.muted}
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.tabs}>
        {ROLES.map((tab) => (
          <Pressable
            key={tab}
            style={[styles.tab, role === tab && styles.tabActive]}
            onPress={() => setRole(tab)}
          >
            <Text style={[styles.tabText, role === tab && styles.tabTextActive]}>
              {tab === "all" ? "All" : tab.replace("_", " ")}
            </Text>
          </Pressable>
        ))}
      </View>

      {usersQuery.isLoading ? (
        <View style={styles.list}>
          {[1, 2, 3].map((i) => (
            <Card key={i} style={styles.userCard}>
              <Skeleton width="60%" height={16} />
              <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
            </Card>
          ))}
        </View>
      ) : users.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 40 }}>
          <Text style={{ fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground, marginBottom: 8 }}>No users</Text>
          <Text style={{ fontSize: typography.fontSizes.base, color: colors.light.muted, textAlign: "center" }}>No users found.</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card style={styles.userCard}>
              <View style={styles.userRow}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.full_name ?? "Unnamed"}</Text>
                  <Text style={styles.userEmail}>{item.email ?? item.phone ?? "—"}</Text>
                  <Badge variant="default">
                    {item.role}
                  </Badge>
                </View>
                <Pressable
                  style={styles.roleBtn}
                  onPress={() => {
                    const otherRoles = ROLES.filter(r => r !== "all" && r !== item.role);
                    Alert.alert("Change Role", `Change role for ${item.full_name ?? "user"}:`, [
                      ...otherRoles.map(r => ({
                        text: r.replace("_", " "),
                        onPress: () => roleMutation.mutate({ userId: item.id, newRole: r }),
                      })),
                      { text: "Cancel", style: "cancel" },
                    ]);
                  }}
                >
                  <Text style={styles.roleBtnText}>Change</Text>
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.light.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 24, paddingBottom: 0 },
  title: { fontSize: typography.fontSizes["2xl"], fontWeight: typography.fontWeights.bold, color: colors.light.foreground },
  count: { fontSize: typography.fontSizes.sm, color: colors.light.muted },
  search: { margin: 24, marginBottom: 16, padding: 16, backgroundColor: colors.light.card, borderRadius: radii.md, borderWidth: 1, borderColor: colors.light.border, fontSize: typography.fontSizes.base, color: colors.light.foreground },
  tabs: { flexDirection: "row", paddingHorizontal: 24, gap: 4, marginBottom: 16, flexWrap: "wrap" },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.full },
  tabActive: { backgroundColor: colors.light.primary },
  tabText: { fontSize: typography.fontSizes.sm, color: colors.light.muted },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  list: { padding: 24 },
  userCard: { marginBottom: 16, padding: 24 },
  userRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  userInfo: { flex: 1 },
  userName: { fontSize: typography.fontSizes.base, fontWeight: typography.fontWeights.semibold, color: colors.light.foreground },
  userEmail: { fontSize: typography.fontSizes.sm, color: colors.light.muted, marginTop: 4, marginBottom: 8 },
  roleBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.light.border },
  roleBtnText: { fontSize: typography.fontSizes.sm, color: colors.light.primary },
});
