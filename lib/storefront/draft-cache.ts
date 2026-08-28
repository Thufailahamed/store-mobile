import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StorefrontChannel, StorefrontConfig } from "../api/backend";
import { saveStorefrontDraftBackend } from "../api/backend";

const PREFIX = "storefront-draft";
const k = (storeId: string, channel: StorefrontChannel) => `${PREFIX}:${storeId}:${channel}`;

export async function loadDraft(
  storeId: string,
  channel: StorefrontChannel,
): Promise<StorefrontConfig | null> {
  const raw = await AsyncStorage.getItem(k(storeId, channel));
  return raw ? (JSON.parse(raw) as StorefrontConfig) : null;
}

export async function saveDraft(
  storeId: string,
  channel: StorefrontChannel,
  config: StorefrontConfig,
): Promise<void> {
  await AsyncStorage.setItem(k(storeId, channel), JSON.stringify(config));
}

export async function clearDraft(storeId: string, channel: StorefrontChannel): Promise<void> {
  await AsyncStorage.removeItem(k(storeId, channel));
}

export async function flushAllOnOnline(): Promise<{ flushed: number; errors: number }> {
  const keys = (await AsyncStorage.getAllKeys()).filter((x) => x.startsWith(`${PREFIX}:`));
  let flushed = 0;
  let errors = 0;
  for (const key of keys) {
    const [, storeId, channel] = key.split(":") as [string, string, StorefrontChannel];
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;
    try {
      const config = JSON.parse(raw) as StorefrontConfig;
      const res = await saveStorefrontDraftBackend(channel, config);
      if (res.ok) {
        flushed++;
      } else {
        errors++;
      }
    } catch {
      errors++;
    }
  }
  return { flushed, errors };
}
