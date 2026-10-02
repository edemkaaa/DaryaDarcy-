import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { ArticleContent } from "@/components/article-content";
import { trpc } from "@/lib/trpc";
import { useClub } from "@/lib/club-context";
import { PhotoViewer } from "@/components/photo-viewer";
import { useClubContentProtection } from "@/hooks/use-club-protection";
import type { ArticleBlock } from "@shared/article-blocks";

const PAPER = "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const BROWN = "#3D3028";
const BROWN_MUTED = "#8B7355";
const CREAM = "#FDF8F0";

export default function LibraryArticleScreen() {
  const router = useRouter();
  const { isSubscribed } = useClub();
  const { id } = useLocalSearchParams<{ id: string }>();
  const articleId = Number(id);
  const { data, isLoading } = trpc.articles.getById.useQuery(
    { id: articleId },
    { enabled: Number.isFinite(articleId) && articleId > 0 },
  );
  useClubContentProtection(Boolean(data && !data.locked));
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null);

  const blocks = useMemo(() => (data?.sections || []) as ArticleBlock[], [data]);
  const photoUrls = useMemo(
    () =>
      blocks.flatMap((block) => {
        if ((block.type === "photo" || block.type === "png") && block.url) return [block.url];
        if (block.type === "carousel" && block.urls?.length) return block.urls;
        return [];
      }),
    [blocks],
  );

  if (isLoading || !data) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <ImageBackground source={{ uri: PAPER }} style={styles.bg} resizeMode="cover">
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Назад</Text>
          </Pressable>
          <View style={styles.center}>
            {isLoading ? <ActivityIndicator color={BROWN_MUTED} /> : <Text style={styles.body}>Статья не найдена</Text>}
          </View>
        </ImageBackground>
      </ScreenContainer>
    );
  }

  if (data.locked) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <ImageBackground source={{ uri: PAPER }} style={styles.bg} resizeMode="cover">
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Назад</Text>
          </Pressable>
          {data.coverUrl ? <Image source={{ uri: data.coverUrl }} style={styles.banner} contentFit="cover" /> : null}
          <View style={styles.pad}>
            <Text style={styles.title}>{data.title}</Text>
            <Text style={styles.body}>Эта статья для участниц клуба Darcy.</Text>
            <Pressable onPress={() => router.push("/(tabs)/club")} style={styles.clubBtn}>
              <Text style={styles.clubBtnText}>{isSubscribed ? "Открыть клуб" : "Вступить в клуб"}</Text>
            </Pressable>
          </View>
        </ImageBackground>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <ImageBackground source={{ uri: PAPER }} style={styles.bg} resizeMode="cover">
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Назад</Text>
          </Pressable>
          <ArticleContent
            title={data.title}
            coverUrl={data.coverUrl}
            blocks={blocks}
            onOpenImage={(url) => {
              const photos = photoUrls.length ? photoUrls : [url];
              setViewer({ photos, index: Math.max(0, photos.indexOf(url)) });
            }}
          />
        </ScrollView>
        {viewer ? (
          <PhotoViewer
            photos={viewer.photos}
            initialIndex={viewer.index}
            visible
            onClose={() => setViewer(null)}
          />
        ) : null}
      </ImageBackground>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: CREAM },
  scroll: { paddingBottom: 72 },
  pad: { paddingHorizontal: 22, paddingBottom: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  back: { alignSelf: "flex-start", paddingHorizontal: 20, paddingVertical: 12 },
  backText: { color: BROWN_MUTED, fontSize: 16, fontFamily: "EBGaramond-Italic" },
  banner: { width: "100%", aspectRatio: 3, backgroundColor: "#E8E0D4" },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: "EBGaramond-Bold",
    color: BROWN,
    textAlign: "center",
    marginTop: 22,
    marginBottom: 8,
  },
  body: {
    fontSize: 17,
    fontFamily: "EBGaramond-Regular",
    color: BROWN,
    lineHeight: 27,
    marginBottom: 16,
  },
  clubBtn: { marginTop: 16, backgroundColor: "#8B7355", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  clubBtnText: { color: CREAM, fontWeight: "700" },
});
