import { useState } from "react";
import {
  Dimensions,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { parseArticleInlines, type ArticleBlock } from "@/lib/article-blocks";

const BROWN = "#3D3028";
const BROWN_MUTED = "#8B7355";
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CAROUSEL_ITEM_WIDTH = SCREEN_WIDTH * 0.58;
const CAROUSEL_ITEM_HEIGHT = CAROUSEL_ITEM_WIDTH * (5 / 4);

export function ArticleContent({
  title,
  coverUrl,
  blocks,
  onOpenImage,
}: {
  title: string;
  coverUrl?: string | null;
  blocks: ArticleBlock[];
  onOpenImage?: (url: string) => void;
}) {
  return (
    <View>
      {coverUrl ? (
        <Pressable onPress={() => (onOpenImage ? onOpenImage(coverUrl) : undefined)} disabled={!onOpenImage}>
          <Image source={{ uri: coverUrl }} style={styles.banner} contentFit="cover" />
        </Pressable>
      ) : null}
      <View style={styles.pad}>
        <Text style={styles.title}>{title || "Без названия"}</Text>
        <Text style={styles.byline}>· daryadarcy ·</Text>
        {blocks.map((block, index) => (
          <ArticleBlockView
            key={`${block.type}-${index}`}
            block={block}
            onOpenImage={onOpenImage}
          />
        ))}
      </View>
    </View>
  );
}

function ArticleBlockView({
  block,
  onOpenImage,
}: {
  block: ArticleBlock;
  onOpenImage?: (url: string) => void;
}) {
  const [ratio, setRatio] = useState(block.type === "png" ? 1.15 : 1.6);

  if (block.type === "heading" && block.text?.trim()) {
    return <Text style={styles.heading}>{block.text.trim()}</Text>;
  }

  if (block.type === "text" && block.text?.trim()) {
    return (
      <>
        {block.text.split(/\n{2,}/).map((paragraph, index) => (
          <Text key={index} style={styles.body}>
            {parseArticleInlines(paragraph.trim()).map((part, i) => {
              if (part.kind === "link") {
                return (
                  <Text key={i} style={styles.inlineLink} onPress={() => void Linking.openURL(part.url)}>
                    {part.text}
                  </Text>
                );
              }
              if (part.kind === "bold") {
                return (
                  <Text key={i} style={styles.bold}>
                    {part.text}
                  </Text>
                );
              }
              return <Text key={i}>{part.text}</Text>;
            })}
          </Text>
        ))}
      </>
    );
  }

  if ((block.type === "photo" || block.type === "png") && block.url) {
    const png = block.type === "png";
    const gif = /\.gif(\?|$)/i.test(block.url);
    const caption = block.caption?.trim();
    const image = (
      <Image
        source={{ uri: block.url }}
        style={[png ? styles.png : styles.photo, { aspectRatio: ratio }]}
        contentFit={png || gif ? "contain" : "cover"}
        onLoad={(event) => {
          const width = event.source?.width;
          const height = event.source?.height;
          if (width && height) setRatio(width / height);
        }}
      />
    );
    const media = onOpenImage ? (
      <Pressable onPress={() => onOpenImage(block.url!)} style={png ? styles.pngWrap : undefined}>
        {image}
      </Pressable>
    ) : png ? (
      <View style={styles.pngWrap}>{image}</View>
    ) : (
      image
    );
    return (
      <View style={styles.mediaBlock}>
        {media}
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    );
  }

  if (block.type === "link" && block.url) {
    return (
      <Pressable onPress={() => void Linking.openURL(block.url!)} style={styles.linkBtn}>
        <Text style={styles.linkBtnText}>{block.label || block.url}</Text>
      </Pressable>
    );
  }

  if (block.type === "carousel" && block.urls?.length) {
    const caption = block.caption?.trim();
    return (
      <View style={styles.mediaBlock}>
        <View style={styles.carouselWrap}>
          <FlatList
            data={block.urls}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(url, index) => `${url}-${index}`}
            contentContainerStyle={styles.carouselList}
            renderItem={({ item }) => (
              <Pressable onPress={() => onOpenImage?.(item)} style={styles.carouselItem} disabled={!onOpenImage}>
                <Image source={{ uri: item }} style={styles.carouselImage} contentFit="cover" />
              </Pressable>
            )}
          />
        </View>
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 22, paddingBottom: 20 },
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
  byline: {
    textAlign: "center",
    color: BROWN_MUTED,
    fontFamily: "EBGaramond-Italic",
    fontSize: 14,
    marginBottom: 22,
  },
  heading: {
    fontSize: 22,
    fontFamily: "EBGaramond-Bold",
    color: BROWN,
    textAlign: "center",
    marginTop: 28,
    marginBottom: 16,
  },
  body: {
    fontSize: 17,
    fontFamily: "EBGaramond-Regular",
    color: BROWN,
    lineHeight: 27,
    marginBottom: 16,
  },
  bold: { fontFamily: "EBGaramond-Bold" },
  inlineLink: {
    color: BROWN_MUTED,
    textDecorationLine: "underline",
    fontFamily: "EBGaramond-Italic",
  },
  photo: {
    width: "100%",
    borderRadius: 6,
    backgroundColor: "#E8E0D4",
  },
  mediaBlock: {
    marginBottom: 16,
  },
  caption: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "EBGaramond-Italic",
    color: "#A89880",
    textAlign: "center",
  },
  pngWrap: { alignItems: "center" },
  png: {
    width: "86%",
    backgroundColor: "transparent",
  },
  linkBtn: { alignSelf: "center", paddingVertical: 8, marginBottom: 16 },
  linkBtnText: {
    color: BROWN_MUTED,
    fontFamily: "EBGaramond-Italic",
    fontSize: 17,
    textDecorationLine: "underline",
  },
  carouselWrap: { marginHorizontal: -22 },
  carouselList: { paddingHorizontal: 22, gap: 8 },
  carouselItem: {
    width: CAROUSEL_ITEM_WIDTH,
    height: CAROUSEL_ITEM_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#EDE6DA",
  },
  carouselImage: { width: "100%", height: "100%" },
});
