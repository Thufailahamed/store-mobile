/** Deep link to one post (e.g. luxe://posts/<id> from a notification). Opens the full-screen viewer. */
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { POSTS_ENABLED, publicPostsApi } from "@/lib/posts/api";
import type { PublicPost } from "@/lib/posts/types";
import { PostViewer } from "@/components/posts/PostViewer";
import { trackPost } from "@/lib/posts/track";

export default function PostDeepLinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<PublicPost | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!POSTS_ENABLED || !id) { setMissing(true); return; }
    publicPostsApi.get(String(id))
      .then((p) => { setPost(p); trackPost({ post_id: p.id, type: "impression", surface: "share" }); })
      .catch(() => setMissing(true));
  }, [id]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
      <Stack.Screen options={{ headerShown: false }} />
      {missing ? (
        <Text style={{ color: "#fff" }} onPress={close}>This post isn't available. Tap to go back.</Text>
      ) : !post ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <PostViewer posts={[post]} startIndex={0} visible onClose={close} surface="share" />
      )}
    </View>
  );
}
