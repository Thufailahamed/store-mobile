/**
 * Recommendation engine — public entry point.
 */

export {
  getForYouRail,
  refreshForYouRail,
  getSimilarProducts,
  getYouMayAlsoLike,
  getPairsWellWithRail,
  getRecentlyViewedRail,
  getFromWishlistRail,
  getPersonalizedSearch,
  getFallbackRecs,
  debugRankSample,
  getCurrentWishlistIds,
  type RailContext,
  type ForYouResult,
  type WishlistRail,
} from "./engine";

export { useTrackView, useTrackEvent } from "./hooks";

export {
  trackEvent,
  readEvents,
  readNotInterestedIds,
  appendEvent,
  clearEvents,
  clearNotInterested,
  snapshotProduct,
  extractGarmentToken,
  type RecommendationEvent,
  type EventType,
  type TrackedProduct,
} from "./events";

export {
  loadProfile,
  buildProfile,
  decayedWeight,
  profilePriceCenter,
  EMPTY_PROFILE,
  type UserProfile,
  type AffinityMap,
} from "./profile";

export {
  rankProducts,
  rankSimilarTo,
  personalizeResults,
  productAffinity,
  humanReason,
  type RankedProduct,
  type RankOptions,
} from "./rank";

export { isProductInStock, inStockVariantCount, minVariantStock } from "./inventory";

export { fetchRecentlyViewed, recordRecentlyViewed } from "./recently-viewed";
export { fetchColdStartProducts, fetchColdStartSimilar, fetchSimilarToAnchor } from "./cold-start";
export { getPairsWellWith } from "./cooccurrence";
export { pullPersonalizedCandidates, POOL_LIMITS } from "./personalized-candidates";

export { cacheGet, cacheSet, cacheDelete, cacheClear, cacheBustPrefix, cacheKey } from "./cache";
