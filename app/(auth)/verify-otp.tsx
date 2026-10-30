import React from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { authStyles } from "@/components/auth/auth-ui";
import { VerifyOtpSheet } from "@/components/auth/VerifyOtpSheet";

/**
 * Legacy route: sign-in and sign-up now open the OTP step as a sheet in
 * place. Anything still linking here gets the same sheet over a blank page.
 */
export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; phone?: string; referral?: string; invite?: string }>();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"));

  return (
    <View style={authStyles.root}>
      <StatusBar style="dark" />
      <VerifyOtpSheet
        visible
        phone={params.phone || ""}
        email={params.email || ""}
        referral={params.referral}
        invite={params.invite}
        onClose={goBack}
      />
    </View>
  );
}
