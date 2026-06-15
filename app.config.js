const path = require("path");
const fs = require("fs");

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
    process.env.EXPO_PUBLIC_STORE_API_URL || "https://store-three-xi-58.vercel.app";

  return {
    ...config,
    extra: {
      ...config.extra,
      storeApiUrl,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
    },
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
