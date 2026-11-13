import AsyncStorage from "@react-native-async-storage/async-storage";

/** Quick AI upload result, handed from the photo screen to the product editor. */
export const QUICK_AI_DRAFT_STORAGE_KEY = "luxe:mobile-quick-ai-draft";

/** Autosaved unsaved product (manual add). */
export const productDraftKey = (userId: string) => `luxe:mobile-product-draft:${userId}`;

/** Removes every unsaved new-product draft this device holds. */
export async function clearProductDrafts(userId?: string): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(QUICK_AI_DRAFT_STORAGE_KEY),
    userId ? AsyncStorage.removeItem(productDraftKey(userId)) : Promise.resolve(),
  ]);
}
