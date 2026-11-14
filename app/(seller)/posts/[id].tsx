import { useCallback, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { PostComposer } from "@/components/seller/posts/PostComposer";
import { SellerStateView } from "@/components/seller/chrome";
import { P } from "@/components/seller/posts/palette";
import { POSTS_ENABLED, sellerPostsApi } from "@/lib/posts/api";
import type { SellerPostDetail } from "@/lib/posts/types";

export default function EditPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<SellerPostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refetch on every visit: tab screens stay mounted and the post may have changed.
  useFocusEffect(useCallback(() => {
    if (!id) return;
    setPost(null);
    setError(null);
    sellerPostsApi.get(String(id)).then(setPost).catch((e) => setError((e as Error).message));
  }, [id]));

  if (!POSTS_ENABLED) return <SellerStateView variant="empty" title="Posts are coming soon" icon="film-outline" />;
  if (error) {
    return <SellerStateView variant="error" title="Couldn't open this post" description={error} actionLabel="Back to posts" onAction={() => router.replace("/(seller)/posts")} />;
  }
  if (!post) {
    return <View style={{ flex: 1, backgroundColor: P.paper, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={P.ink} /></View>;
  }
  return <PostComposer key={`${post.id}:${post.updated_at}`} initial={post} />;
}
