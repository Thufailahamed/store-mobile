import React from "react";
import { KycVerifyScreen } from "@/components/kyc/KycVerifyScreen";

export default function SellerVerifyIdentity() {
  return <KycVerifyScreen fallbackHref="/(seller)/payouts" />;
}
