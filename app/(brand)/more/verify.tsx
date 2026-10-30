import React from "react";
import { KycVerifyScreen } from "@/components/kyc/KycVerifyScreen";

export default function BrandVerifyIdentity() {
  return <KycVerifyScreen fallbackHref="/(brand)/more/payouts" />;
}
