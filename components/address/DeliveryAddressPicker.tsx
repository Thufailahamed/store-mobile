import React from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Modal } from "@/components/ui/Modal";
import { Ionicons } from "@/components/ui/Icon";
import { useToast } from "@/components/ui";
import { C } from "@/components/orders/parcel-track";
import { useAuth } from "@/lib/supabase/auth";
import { getAddresses, updateAddress } from "@/lib/api";
import { fontFamilies } from "@/lib/theme/fonts";
import type { Address } from "@/lib/types";

/** Open Location Codes ("7C3X+RXR") are what map pins save — not something to show a shopper. */
const PLUS_CODE_RE = /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}$/i;

export function addressLabel(a: Pick<Address, "type" | "line1" | "city">): string {
  const line1 = (a.line1 ?? "").trim();
  const type = a.type ? a.type.charAt(0).toUpperCase() + a.type.slice(1) : "";
  if (!line1 || PLUS_CODE_RE.test(line1.split(/[\s,]/)[0])) {
    return [type, a.city].filter(Boolean).join(" · ") || "Saved address";
  }
  return a.city ? `${line1}, ${a.city}` : line1;
}

function addressTypeLabel(type: Address["type"]): string {
  return type === "home" ? "Home" : type === "work" ? "Work" : "Other";
}

/** Full address for the picker, with any plus code swapped for "Pinned location". */
function addressLines(a: Address): string {
  const line1 = (a.line1 ?? "").trim();
  const first = PLUS_CODE_RE.test(line1.split(/[\s,]/)[0]) ? "Pinned location" : line1;
  return [first, a.line2, a.city, a.state].filter((p) => p && String(p).trim()).join(", ");
}

/** 0773077446 → 077 307 7446 (Sri Lankan mobile); anything else is shown as entered. */
function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("0")) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return phone;
}

/**
 * Delivery-address state + the "Deliver to" picker sheet, shared by the home
 * header and the search results address strip. Render `sheet` once; call
 * `openPicker` from whatever row shows the address.
 */
export function useDeliveryAddressPicker() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { toast } = useToast();
  const [addressText, setAddressText] = React.useState<string | null>(null);
  const [currentAddressId, setCurrentAddressId] = React.useState<string | null>(null);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [addresses, setAddresses] = React.useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = React.useState(false);

  React.useEffect(() => {
    if (user?.id) {
      getAddresses(user.id).then((res) => {
        if (res.ok && res.data && res.data.length > 0) {
          const defaultAddr = res.data.find((a) => a.is_default) || res.data[0];
          setAddressText(addressLabel(defaultAddr));
          setCurrentAddressId(defaultAddr.id);
          setAddresses(res.data);
        }
      });
    }
  }, [user?.id]);

  const handleAddressPress = async () => {
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    setModalVisible(true);
    setLoadingAddresses(true);
    try {
      const res = await getAddresses(user.id);
      if (res.ok && res.data) {
        setAddresses(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const [switchingId, setSwitchingId] = React.useState<string | null>(null);

  const handleSelectAddress = async (addr: Address) => {
    if (!user || switchingId) return;
    if (addr.id === currentAddressId) {
      setModalVisible(false);
      return;
    }
    const prev = { text: addressText, id: currentAddressId };
    setSwitchingId(addr.id);
    // Optimistic: header updates immediately, rolled back if the save fails.
    setAddressText(addressLabel(addr));
    setCurrentAddressId(addr.id);

    const unset = await Promise.all(
      addresses
        .filter((a) => a.is_default && a.id !== addr.id)
        .map((a) => updateAddress(a.id, { is_default: false })),
    );
    const set = await updateAddress(addr.id, { is_default: true });
    setSwitchingId(null);

    if (!set.ok || unset.some((r) => !r.ok)) {
      setAddressText(prev.text);
      setCurrentAddressId(prev.id);
      toast("Couldn't change delivery address. Try again.", "error");
      return;
    }
    const res = await getAddresses(user.id);
    if (res.ok && res.data) setAddresses(res.data);
    setModalVisible(false);
    toast(`Delivering to ${addressLabel(addr)}`, "success");
  };

  const goToAddresses = (query = "") => {
    setModalVisible(false);
    router.push(`/(main)/account/addresses${query}` as never);
  };

  const currentAddress = addresses.find((a) => a.id === currentAddressId) ?? null;

  const sheet = (
    <Modal
      visible={modalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setModalVisible(false)}
    >
      <View style={styles.modalOverlay}>
        {/* Backdrop is a sibling of the sheet, so taps inside the sheet never close it. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setModalVisible(false)}
          accessibilityLabel="Close"
        />
        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalKicker}>DELIVERY ADDRESS</Text>
              <Text style={styles.modalTitle}>Deliver to</Text>
              <Text style={styles.modalSub}>Choose where your order should arrive</Text>
            </View>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.modalCloseBtn}
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={C.text} />
            </TouchableOpacity>
          </View>

          {loadingAddresses && addresses.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={C.accent} />
            </View>
          ) : addresses.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons name="location-outline" size={24} color={C.text} />
              </View>
              <Text style={styles.emptyTitle}>No saved addresses yet</Text>
              <Text style={styles.emptyText}>Add one so we know where to deliver.</Text>
            </View>
          ) : (
            <ScrollView style={styles.addressList} showsVerticalScrollIndicator={false}>
              {addresses.map((a) => {
                const isCurrent = currentAddressId ? a.id === currentAddressId : a.is_default;
                const isSwitching = switchingId === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.addressOption, isCurrent && styles.addressOptionActive]}
                    onPress={() => handleSelectAddress(a)}
                    activeOpacity={0.8}
                    disabled={Boolean(switchingId)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isCurrent }}
                  >
                    <View style={[styles.addrIcon, isCurrent && styles.addrIconActive]}>
                      <Ionicons
                        name={a.type === "home" ? "home-outline" : a.type === "work" ? "briefcase-outline" : "location-outline"}
                        size={18}
                        color={isCurrent ? C.lime : C.text}
                      />
                    </View>
                    <View style={styles.addressInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.addrType}>{addressTypeLabel(a.type)}</Text>
                        {a.is_default ? (
                          <View style={styles.defaultChip}>
                            <Text style={styles.defaultChipText}>Default</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.addrDetails} numberOfLines={2}>
                        {addressLines(a)}
                      </Text>
                      <Text style={styles.addrMeta} numberOfLines={1}>
                        {a.full_name}
                        {a.phone ? ` · ${formatPhone(a.phone)}` : ""}
                      </Text>
                    </View>
                    <View style={styles.addrSide}>
                      <View style={[styles.radio, isCurrent && styles.radioActive]}>
                        {isSwitching ? (
                          <ActivityIndicator size="small" color={C.lime} />
                        ) : isCurrent ? (
                          <Ionicons name="checkmark" size={14} color={C.lime} />
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => goToAddresses(`?edit=${a.id}`)}
                        hitSlop={8}
                        accessibilityLabel={`Edit ${addressTypeLabel(a.type)} address`}
                      >
                        <Ionicons name="create-outline" size={15} color={C.muted} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity
            style={styles.addAddressBtn}
            onPress={() => goToAddresses("?action=add")}
            activeOpacity={0.85}
          >
            <View style={styles.addAddressIcon}>
              <Ionicons name="add" size={18} color={C.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addAddressBtnText}>Add a new address</Text>
              <Text style={styles.addAddressSub}>Pin it on the map or type it in</Text>
            </View>
            <Ionicons name="arrow-forward" size={17} color={C.lime} />
          </TouchableOpacity>
          {addresses.length > 0 ? (
            <TouchableOpacity style={styles.manageLink} onPress={() => goToAddresses()} hitSlop={6}>
              <Text style={styles.manageLinkText}>Manage addresses</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>  );

  return { addressText, currentAddress, openPicker: handleAddressPress, sheet };
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(22,23,15,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: C.paper,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: "80%",
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(22,23,15,0.12)",
    alignSelf: "center",
    marginBottom: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 18,
  },
  // Text mirrors SearchResultTile metadata: small, tracked uppercase.
  modalKicker: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 9.5,
    letterSpacing: 2,
    color: "rgba(20,20,20,0.45)",
  },
  modalTitle: {
    marginTop: 6,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 18,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: "rgba(20,20,20,0.9)",
  },
  modalSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    letterSpacing: 0.5,
    color: "rgba(20,20,20,0.45)",
    marginTop: 6,
  },
  modalCloseBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    shadowColor: C.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    paddingVertical: 28,
    marginBottom: 12,
    alignItems: "center",
    gap: 4,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: C.line,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(20,20,20,0.9)",
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    letterSpacing: 0.5,
    color: "rgba(20,20,20,0.45)",
  },
  addressList: {
    marginBottom: 6,
  },
  addressOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: C.line,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
    gap: 12,
  },
  addressOptionActive: {
    borderColor: C.ink,
  },
  addrIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  addrIconActive: {
    backgroundColor: C.ink,
  },
  addrSide: {
    alignItems: "center",
    gap: 10,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.faint,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: C.ink,
    backgroundColor: C.ink,
  },
  addressInfo: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addrType: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "rgba(20,20,20,0.9)",
  },
  defaultChip: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    backgroundColor: C.lime,
  },
  defaultChipText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: C.ink,
  },
  addrDetails: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    lineHeight: 17,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(20,20,20,0.7)",
  },
  addrMeta: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(20,20,20,0.45)",
  },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.accentSoft,
  },
  addAddressBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    marginTop: 4,
    borderRadius: 22,
    backgroundColor: C.ink,
  },
  addAddressIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: C.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  addAddressBtnText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: C.cream,
  },
  addAddressSub: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    letterSpacing: 0.5,
    color: "rgba(250,248,241,0.6)",
    marginTop: 3,
  },
  manageLink: {
    flexDirection: "row",
    alignSelf: "center",
    paddingVertical: 14,
  },
  manageLinkText: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: C.accent,
  },
});
