import React from "react";
import { Stack, useRouter } from "expo-router";
import { CourierManagedExternally } from "@/components/courier/courier-managed-externally";
import { isInternalDeliveryVisibleMobile } from "@/lib/feature-flags";

/**
 * /admin/delivery — internal rider/DC admin pipeline. Replaced with a
 * notice once `INTERNAL_DELIVERY_PORTAL_VISIBLE` is off; admins manage
 * the external flow via /admin/courier.
 */
export default function AdminDeliveryLayout() {
  const router = useRouter();

  if (!isInternalDeliveryVisibleMobile()) {
    return (
      <CourierManagedExternally
        role="admin"
        onClose={() => router.replace("/(admin)/index" as never)}
      />
    );
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}