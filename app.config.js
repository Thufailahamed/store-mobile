const path = require("path");
const fs = require("fs");

/* global __dirname */

const APP_FONTS = [
  "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf",
  "node_modules/@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf",
  "node_modules/@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf",
  "node_modules/@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf",
  "node_modules/@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf",
  "node_modules/@expo-google-fonts/fraunces/400Regular/Fraunces_400Regular.ttf",
  "node_modules/@expo-google-fonts/fraunces/400Regular_Italic/Fraunces_400Regular_Italic.ttf",
  "node_modules/@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf",
  "node_modules/@expo-google-fonts/jetbrains-mono/400Regular/JetBrainsMono_400Regular.ttf",
  "node_modules/@expo-google-fonts/jetbrains-mono/500Medium/JetBrainsMono_500Medium.ttf",
  "node_modules/@expo-google-fonts/jetbrains-mono/600SemiBold/JetBrainsMono_600SemiBold.ttf",
];

// Ensure Metro embeds EXPO_PUBLIC_* even when only .env.local exists.
for (const file of [".env.local", ".env"]) {
  const envPath = path.join(__dirname, file);
  if (!fs.existsSync(envPath)) continue;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

module.exports = ({ config }) => {
  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "GOOGLE_MAPS_API_KEY_PLACEHOLDER";
  const storeApiUrl =
    process.env.EXPO_PUBLIC_STORE_API_URL || "https://store-backend.thufailahamed627.workers.dev";
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

  const plugins = (config.plugins ?? []).map((plugin) => {
    if (plugin === "expo-font") return ["expo-font", { fonts: APP_FONTS }];
    if (Array.isArray(plugin) && plugin[0] === "expo-font") {
      return ["expo-font", { ...plugin[1], fonts: APP_FONTS }];
    }
    return plugin;
  });

  // Wire @sentry/react-native build-time plugin only when a DSN is set,
  // so dev builds (no DSN) skip the native module and stay small.
  if (sentryDsn && !plugins.some((p) => Array.isArray(p) && p[0] === "@sentry/react-native")) {
    plugins.push([
      "@sentry/react-native",
      { url: sentryDsn, organization: "luxe", project: "luxe-mobile" },
    ]);
  }

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      storeApiUrl,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
      googleMapsApiKey: googleMapsApiKey,
      sentryDsn,
    },
    // Hermes is the JS engine on SDK 52 by default for both iOS and
    // Android — makes `expo start` boots ~30% faster and shrinks the
    // install bundle. Declared here so any future downgrade is loud.
    jsEngine: "hermes",
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: googleMapsApiKey,
      },
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          ...config.android?.config?.googleMaps,
          apiKey: googleMapsApiKey,
        },
      },
    },
  };
};
