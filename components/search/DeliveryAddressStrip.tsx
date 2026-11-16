import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@/components/ui/Icon";
import { fontFamilies } from "@/lib/theme/fonts";
import { useAuth } from "@/lib/supabase/auth";
import { useDeliveryAddressPicker } from "@/components/address/DeliveryAddressPicker";
import type { Address } from "@/lib/types";

const ACCENT = "#414a23"; // brand dark olive
const LINE = "#ece9e3";
/** Map pins save plus codes ("7JWV+4C"); show "Pinned location" instead. */
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3}$/i;

function fullAddress(a: Address): string {
  const line1 = (a.line1 ?? "").trim();
  const first = PLUS_CODE.test(line1.split(/[\s,]/)[0] ?? "") ? "Pinned location" : line1;
  const cityLine = [a.city, a.state].filter((p) => p && String(p).trim()).join(", ");
  return [first, a.line2, cityLine && a.postal_code ? `${cityLine} ${a.postal_code}` : cityLine || a.postal_code]
    .filter((p) => p && String(p).trim())
    .join(", ");
}

/**
 * One-line delivery strip above search results: name · full address
 * (truncated) and a Change link that opens the shared "Deliver to" picker
 * sheet (or sign-in when logged out).
 */
export function DeliveryAddressStrip() {
  const { user } = useAuth();
  const { currentAddress: addr, openPicker, sheet } = useDeliveryAddressPicker();

  const cta = !user ? "Sign in" : addr ? "Change" : "Add";
  const name = addr?.full_name?.trim();

  return (
    <>
      <TouchableOpacity
        style={styles.strip}
        activeOpacity={0.8}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={
          addr ? `Delivering to ${name ?? ""}, ${fullAddress(addr)}. Change address` : "Set delivery address"
        }
      >
        <Ionicons name="location" size={16} color={ACCENT} />
        <Text style={styles.text} numberOfLines={1}>
          {addr ? (
            <>
              {name ? <Text style={styles.name}>{name}</Text> : null}
              {`${name ? " · " : ""}${fullAddress(addr)}`}
            </>
          ) : (
            <Text style={styles.name}>{user ? "No delivery address yet" : "Sign in to see delivery options"}</Text>
          )}
        </Text>
        <Text style={styles.cta}>{cta}</Text>
      </TouchableOpacity>
      {sheet}
    </>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    paddingHorizontal: 16,
    backgroundColor: "#f3f3ea", // light olive
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LINE,
  },
  // Typography mirrors SearchResultTile's metadata: small, tracked uppercase.
  text: {
    flex: 1,
    minWidth: 0,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "rgba(20,20,20,0.45)",
  },
  name: { fontFamily: fontFamilies.sans.medium, letterSpacing: 1.6, color: "rgba(20,20,20,0.9)" },
  cta: {
    fontFamily: fontFamilies.sans.medium,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: ACCENT,
  },
});
