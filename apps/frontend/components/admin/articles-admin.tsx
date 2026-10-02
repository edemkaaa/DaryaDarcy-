import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import { ArticleContent } from "@/components/article-content";
import { fileToUpload, pickWebFiles, uriToBase64 } from "@/lib/admin-photo-upload";
import { emptyBlock, normalizeArticleBlocks, type ArticleBlock } from "@shared/article-blocks";
import * as ImagePicker from "expo-image-picker";

const BROWN = "#4A3728";
const BROWN_LIGHT = "#7A6B5E";
const CREAM = "#FDF8F0";
const ACCENT = "#8B7355";

type Access = "public" | "club";

const ADD_BLOCKS: { type: ArticleBlock["type"]; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { type: "text", label: "Текст", icon: "notes" },
  { type: "heading", label: "Заголовок", icon: "title" },
  { type: "photo", label: "Фото / GIF", icon: "photo" },
  { type: "png", label: "PNG", icon: "image" },
  { type: "carousel", label: "Карусель", icon: "view-carousel" },
  { type: "link", label: "Ссылка", icon: "link" },
];

const BLOCK_LABELS: Record<ArticleBlock["type"], string> = {
  heading: "Заголовок",
  text: "Текст",
  photo: "Фото или GIF",
  png: "PNG без фона",
  link: "Ссылка",
  carousel: "Карусель",
};

export function ArticlesAdmin() {
  const utils = trpc.useUtils();
  const list = trpc.admin.articles.useQuery();
  const create = trpc.admin.createArticle.useMutation({
    onSuccess: () => {
      void utils.admin.articles.invalidate();
      void utils.articles.list.invalidate();
      void utils.club.list.invalidate();
      reset();
    },
    onError: (err) => notify(err.message),
  });
  const update = trpc.admin.updateArticle.useMutation({
    onSuccess: () => {
      void utils.admin.articles.invalidate();
      void utils.articles.list.invalidate();
      void utils.club.list.invalidate();
      reset();
    },
    onError: (err) => notify(err.message),
  });
  const remove = trpc.admin.deleteArticle.useMutation({
    onSuccess: () => {
      void utils.admin.articles.invalidate();
      void utils.articles.list.invalidate();
      void utils.club.list.invalidate();
    },
    onError: (err) => notify(err.message),
  });
  const upload = trpc.admin.uploadPhoto.useMutation();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [access, setAccess] = useState<Access>("club");
  const [previewing, setPreviewing] = useState(false);
  const [blocks, setBlocks] = useState<ArticleBlock[]>([emptyBlock("text")]);
  const [uploading, setUploading] = useState(false);

  const notify = (message: string) => {
    if (Platform.OS === "web") window.alert(message);
    else Alert.alert("Ошибка", message);
  };

  const reset = () => {
    setEditingId(null);
    setShowForm(false);
    setTitle("");
    setCoverUrl("");
    setAccess("club");
    setPreviewing(false);
    setBlocks([emptyBlock("text")]);
  };

  const pickImages = async (preserveAlpha: boolean, multiple: boolean): Promise<string[]> => {
    try {
      setUploading(true);
      const urls: string[] = [];
      if (Platform.OS === "web") {
        const accept = preserveAlpha ? "image/png,image/webp,image/png" : "image/jpeg,image/png,image/webp,image/gif,image/*";
        const files = await pickWebFiles(accept, multiple);
        for (const file of files) {
          const uploaded = await fileToUpload(file, { preserveAlpha });
          const result = await upload.mutateAsync(uploaded);
          urls.push(result.url);
        }
        return urls;
      }
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: multiple,
        quality: preserveAlpha ? 1 : 0.8,
      });
      if (picked.canceled || !picked.assets?.length) return [];
      for (const asset of picked.assets) {
        const result = await upload.mutateAsync({
          base64: await uriToBase64(asset.uri, { preserveAlpha }),
          filename: asset.fileName || `photo_${Date.now()}.${preserveAlpha ? "png" : "jpg"}`,
          mimeType: preserveAlpha ? (asset.mimeType || "image/png") : (asset.mimeType || "image/jpeg"),
        });
        urls.push(result.url);
      }
      return urls;
    } catch (err) {
      notify(err instanceof Error ? err.message : "Не удалось загрузить файл");
      return [];
    } finally {
      setUploading(false);
    }
  };

  const insertBlock = (index: number, type: ArticleBlock["type"]) => {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, emptyBlock(type));
      return next;
    });
  };

  const updateBlock = (index: number, patch: Partial<ArticleBlock>) => {
    setBlocks((prev) => prev.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    setBlocks((prev) => {
      const to = index + direction;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  const save = () => {
    if (!title.trim()) {
      notify("Напишите название статьи");
      return;
    }
    const payload = {
      title: title.trim(),
      coverUrl: coverUrl || null,
      access,
      published: true,
      sections: blocks,
    };
    if (editingId) update.mutate({ id: editingId, ...payload });
    else create.mutate(payload);
  };

  const startEdit = (item: {
    id: number;
    title: string;
    coverUrl: string | null;
    access: Access;
    published: boolean;
    sections: unknown;
  }) => {
    setEditingId(item.id);
    setTitle(item.title);
    setCoverUrl(item.coverUrl || "");
    setAccess(item.access);
    setPreviewing(false);
    setBlocks(normalizeArticleBlocks(item.sections));
    setShowForm(true);
  };

  const confirmDelete = (id: number) => {
    const run = () => remove.mutate({ id });
    if (Platform.OS === "web") {
      if (window.confirm("Удалить статью?")) run();
      return;
    }
    Alert.alert("Удалить статью?", "Её больше не будет в библиотеке.", [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: run },
    ]);
  };

  if (showForm) {
    const busy = create.isPending || update.isPending || uploading;
    return (
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={styles.formTitle}>{editingId ? "Редактировать статью" : "Новая статья"}</Text>
        <Text style={styles.label}>Куда уйдёт статья</Text>
        <View style={styles.row}>
          <Pressable onPress={() => { setAccess("club"); setPreviewing(false); }} style={[styles.chip, access === "club" && !previewing && styles.chipOn]}>
            <Text style={[styles.chipText, access === "club" && !previewing && styles.chipTextOn]}>Клуб / эксклюзив</Text>
          </Pressable>
          <Pressable onPress={() => { setAccess("public"); setPreviewing(false); }} style={[styles.chip, access === "public" && !previewing && styles.chipOn]}>
            <MaterialIcons name="lock" size={13} color={access === "public" && !previewing ? CREAM : BROWN} />
            <Text style={[styles.chipText, access === "public" && !previewing && styles.chipTextOn]}>Клуб + библиотека</Text>
          </Pressable>
          <Pressable onPress={() => setPreviewing(true)} style={[styles.chip, previewing && styles.chipOn]}>
            <Text style={[styles.chipText, previewing && styles.chipTextOn]}>Предпросмотр</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {access === "public"
            ? "Появится в Эксклюзиве клуба и в библиотеке с замочком — только по подписке. В общую ленту статьи не попадают."
            : "Только во вкладке Эксклюзив клуба, без библиотеки и без общей ленты."}
        </Text>

        {previewing ? (
          <ImageBackground
            source={{ uri: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg" }}
            style={styles.previewPaper}
            imageStyle={{ borderRadius: 12 }}
          >
            <ArticleContent title={title} coverUrl={coverUrl || null} blocks={blocks} />
          </ImageBackground>
        ) : (
          <>
        <Text style={styles.label}>Баннер (узкий, широкий)</Text>
        <Pressable
          onPress={async () => {
            const urls = await pickImages(false, false);
            if (urls[0]) setCoverUrl(urls[0]);
          }}
          style={styles.btn}
        >
          <MaterialIcons name="photo-size-select-actual" size={16} color={CREAM} />
          <Text style={styles.btnText}>{uploading ? "Загрузка..." : coverUrl ? "Сменить баннер" : "Выбрать баннер"}</Text>
        </Pressable>
        {coverUrl ? <Image source={{ uri: coverUrl }} style={styles.banner} contentFit="cover" /> : null}

        <Text style={styles.label}>Заголовок</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="Что посмотреть осенью..."
          placeholderTextColor="#A89880"
          multiline
        />

        {blocks.map((block, index) => (
          <View key={`${block.type}-${index}`} style={styles.blockCard}>
            <View style={styles.blockHead}>
              <Text style={styles.blockLabel}>{BLOCK_LABELS[block.type]}</Text>
              <View style={styles.row}>
                <Pressable onPress={() => moveBlock(index, -1)} hitSlop={8}>
                  <MaterialIcons name="keyboard-arrow-up" size={20} color={BROWN_LIGHT} />
                </Pressable>
                <Pressable onPress={() => moveBlock(index, 1)} hitSlop={8}>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color={BROWN_LIGHT} />
                </Pressable>
                {blocks.length > 1 ? (
                  <Pressable onPress={() => setBlocks((prev) => prev.filter((_, i) => i !== index))} hitSlop={8}>
                    <MaterialIcons name="close" size={18} color="#A85C5C" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {block.type === "heading" || block.type === "text" ? (
              <TextInput
                style={block.type === "heading" ? styles.headingInput : styles.textarea}
                value={block.text || ""}
                onChangeText={(value) => updateBlock(index, { text: value })}
                placeholder={block.type === "heading" ? "• Уютные 90-е •" : "Абзац. Пустая строка — новый абзац. Ссылка: [название](https://...)"}
                placeholderTextColor="#A89880"
                multiline
                textAlignVertical="top"
              />
            ) : null}

            {block.type === "link" ? (
              <>
                <TextInput
                  style={styles.input}
                  value={block.label || ""}
                  onChangeText={(value) => updateBlock(index, { label: value })}
                  placeholder="Текст ссылки, например Смотреть трейлер"
                  placeholderTextColor="#A89880"
                />
                <TextInput
                  style={styles.input}
                  value={block.url || ""}
                  onChangeText={(value) => updateBlock(index, { url: value })}
                  placeholder="https://"
                  placeholderTextColor="#A89880"
                  autoCapitalize="none"
                />
              </>
            ) : null}

            {block.type === "carousel" ? (
              <>
                <Pressable
                  onPress={async () => {
                    const urls = await pickImages(false, true);
                    if (!urls.length) return;
                    updateBlock(index, { urls: [...(block.urls || []), ...urls] });
                  }}
                  style={styles.btnSecondary}
                >
                  <MaterialIcons name="view-carousel" size={16} color={ACCENT} />
                  <Text style={styles.btnSecondaryText}>
                    {uploading ? "Загрузка..." : block.urls?.length ? "Добавить кадры" : "Выбрать фото для карусели"}
                  </Text>
                </Pressable>
                {block.urls?.length ? (
                  <View style={styles.carouselPreview}>
                    {block.urls.map((url, photoIndex) => (
                      <Pressable
                        key={`${url}-${photoIndex}`}
                        onPress={() =>
                          updateBlock(index, {
                            urls: (block.urls || []).filter((_, i) => i !== photoIndex),
                          })
                        }
                      >
                        <Image source={{ uri: url }} style={styles.carouselThumb} contentFit="cover" />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.hint}>Нажмите на миниатюру, чтобы убрать кадр. Скруглённая карусель появится в тексте статьи.</Text>
                <TextInput
                  style={styles.input}
                  value={block.caption || ""}
                  onChangeText={(value) => updateBlock(index, { caption: value })}
                  placeholder="Подпись под каруселью: источник..."
                  placeholderTextColor="#A89880"
                />
              </>
            ) : null}

            {block.type === "photo" || block.type === "png" ? (
              <>
                <Pressable
                  onPress={async () => {
                    const urls = await pickImages(block.type === "png", true);
                    if (!urls.length) return;
                    setBlocks((prev) => {
                      const next = [...prev];
                      next[index] = { type: block.type, url: urls[0], caption: block.caption || "" };
                      const extra = urls.slice(1).map((url) => ({ type: block.type, url, caption: "" } as ArticleBlock));
                      next.splice(index + 1, 0, ...extra);
                      return next;
                    });
                  }}
                  style={styles.btnSecondary}
                >
                  <MaterialIcons name={block.type === "png" ? "image" : "photo"} size={16} color={ACCENT} />
                  <Text style={styles.btnSecondaryText}>
                    {uploading ? "Загрузка..." : block.url ? "Заменить" : block.type === "png" ? "Выбрать PNG без фона" : "Выбрать фото или GIF"}
                  </Text>
                </Pressable>
                {block.url ? (
                  <Image
                    source={{ uri: block.url }}
                    style={block.type === "png" ? styles.pngPreview : styles.photoPreview}
                    contentFit={block.type === "png" ? "contain" : "cover"}
                  />
                ) : null}
                <TextInput
                  style={styles.input}
                  value={block.caption || ""}
                  onChangeText={(value) => updateBlock(index, { caption: value })}
                  placeholder="Подпись под фото: источник, автор..."
                  placeholderTextColor="#A89880"
                />
              </>
            ) : null}

            <View style={styles.addRow}>
              {ADD_BLOCKS.map((item) => (
                <Pressable key={item.type} onPress={() => insertBlock(index, item.type)} style={styles.addChip}>
                  <MaterialIcons name={item.icon} size={14} color={ACCENT} />
                  <Text style={styles.addChipText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
          </>
        )}

        <View style={styles.formActions}>
          <Pressable onPress={reset} style={styles.btnGhost}>
            <Text style={styles.btnGhostText}>Отмена</Text>
          </Pressable>
          <Pressable onPress={save} disabled={busy} style={styles.btn}>
            {busy ? <ActivityIndicator color={CREAM} /> : <Text style={styles.btnText}>Опубликовать</Text>}
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <Pressable onPress={() => setShowForm(true)} style={styles.btn}>
        <MaterialIcons name="menu-book" size={16} color={CREAM} />
        <Text style={styles.btnText}>Написать статью</Text>
      </Pressable>
      <Text style={styles.hint}>
        Два места: только Эксклюзив клуба или Эксклюзив + библиотека с замочком. В общую ленту статьи не попадают.
      </Text>
      {(list.data || []).map((item) => (
        <View key={item.id} style={styles.card}>
          {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.cardCover} contentFit="cover" /> : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardMeta}>
              {item.access === "public" ? "Клуб + библиотека" : "Эксклюзив"}
              {item.published ? "" : " · черновик"} · {(item.sections || []).length} бл.
            </Text>
            <View style={styles.row}>
              <Pressable onPress={() => startEdit(item)} style={styles.linkBtn}>
                <Text style={styles.linkBtnText}>Править</Text>
              </Pressable>
              <Pressable onPress={() => confirmDelete(item.id)} style={styles.linkBtn}>
                <Text style={[styles.linkBtnText, { color: "#A85C5C" }]}>Удалить</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ))}
      {list.isLoading ? <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} /> : null}
      {!list.isLoading && !(list.data || []).length ? (
        <Text style={styles.hint}>Пока нет статей — напишите подборку, гид или «обо мне».</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40, gap: 12 },
  form: { padding: 16, paddingBottom: 60, gap: 10 },
  formTitle: { fontSize: 20, fontFamily: "EBGaramond-Bold", color: BROWN, marginBottom: 6 },
  label: { fontSize: 13, color: BROWN_LIGHT, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    color: BROWN,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#fff",
    color: BROWN,
    fontSize: 22,
    fontFamily: "EBGaramond-Bold",
    minHeight: 64,
  },
  headingInput: {
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    color: BROWN,
    fontSize: 18,
    fontFamily: "EBGaramond-Bold",
    textAlign: "center",
  },
  textarea: {
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    color: BROWN,
    minHeight: 120,
  },
  banner: { width: "100%", aspectRatio: 3, borderRadius: 8, backgroundColor: "#EEE9E0" },
  photoPreview: { width: "100%", aspectRatio: 1.6, borderRadius: 8, backgroundColor: "#EEE9E0" },
  pngPreview: { width: "100%", height: 160, backgroundColor: "transparent" },
  carouselPreview: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  carouselThumb: { width: 72, height: 90, borderRadius: 10, backgroundColor: "#EEE9E0" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#F3EEE4" },
  chipOn: { backgroundColor: ACCENT },
  chipText: { fontSize: 13, color: BROWN },
  chipTextOn: { color: CREAM },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  btnText: { color: CREAM, fontWeight: "600" },
  btnSecondary: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  btnSecondaryText: { color: ACCENT, fontWeight: "600" },
  btnGhost: { paddingVertical: 12, paddingHorizontal: 14 },
  btnGhostText: { color: BROWN_LIGHT },
  formActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 8 },
  hint: { fontSize: 13, color: BROWN_LIGHT, lineHeight: 18 },
  previewPaper: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: CREAM,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: "#E8E2D8",
  },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E8E2D8",
  },
  cardCover: { width: 96, height: 56, borderRadius: 8, backgroundColor: "#EEE9E0" },
  cardTitle: { fontSize: 16, fontFamily: "EBGaramond-SemiBold", color: BROWN },
  cardMeta: { fontSize: 12, color: BROWN_LIGHT, marginTop: 4 },
  linkBtn: { paddingVertical: 6, paddingRight: 12 },
  linkBtnText: { color: ACCENT, fontWeight: "600" },
  blockCard: {
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFFcf7",
    gap: 8,
  },
  blockHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  blockLabel: { fontSize: 13, fontWeight: "700", color: BROWN },
  addRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  addChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#F3EEE4",
  },
  addChipText: { fontSize: 12, color: ACCENT, fontWeight: "600" },
});
