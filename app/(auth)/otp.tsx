import React from "react";
import { Redirect } from "expo-router";

export default function OtpRedirect() {
  // Redirect to new unified login page which contains the Phone OTP tab
  return <Redirect href="/(auth)/login" />;
}
