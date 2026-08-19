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
  useTrackImpression,
  useTrackViewableItems,
  type ViewableItem,
} from "./hooks-mobile";

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

export {
  fetchRecommendations,
  fetchTrending,
  fetchSimilarById,
  type FetchRecommendationsOptions,
  type FetchRecommendationsResponse,
  type FetchTrendingOptions,
  type RecommendationContext,
  type Result as IntelligenceResult,
} from "./intelligence-client";

export {
  readAnonSidCookie,
  writeAnonSidCookie,
  clearAnonSidCookie,
  mergeAnonSessionOnLogin,
  ANON_SID_STORAGE_KEY,
} from "./anon-session-client";

export {
  CategoryViewTracker,
  CollectionViewTracker,
  StoreViewTracker,
  useTrackSearch,
  useTrackCheckoutStarted,
} from "./view-trackers-mobile";
