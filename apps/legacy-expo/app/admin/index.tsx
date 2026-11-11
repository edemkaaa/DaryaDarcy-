// Архив Expo. Архивная монолитная админка читает полный список постов и содержит старые CRUD/uploadPhoto без operation keys и ревизий; текущий web admin вынесен в отдельные файлы.
import { useRef, useState } from "react";
import {
  Text,
  View,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { ScreenContainer } from "@/components/screen-container";
import { trpc } from "@/lib/trpc";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { CalendarTracker } from "@/components/admin/calendar-tracker";
import { StatsDashboard } from "@/components/admin/stats-dashboard";
import { ScheduleDatetime } from "@/components/admin/schedule-datetime";
import { ArticlesAdmin } from "@/components/admin/articles-admin";
import { useAuth } from "@/hooks/use-auth";
import { uploadAdminVideoBlob, uploadAdminVideoFromUri } from "@/lib/admin-video-upload";
import { blobToBase64, fileToUpload, pickWebFiles, uriToBase64 } from "@/lib/admin-photo-upload";
import { mediaBasename } from "@/lib/post-media-photos";
import { extractVideoPosterBlob } from "@/lib/video-poster.web";
import { PhotoEditor } from "@/components/admin/photo-editor";
import { RichTextField, type RichTextFieldHandle } from "@/components/admin/rich-text-field";
import { RichTextRenderer } from "@/components/rich-text-renderer";
import type { RichTextBlock } from "@/components/rich-text-renderer";
import { ALL_POST_TAGS } from "@/lib/post-tags";
import { preparePostRichTextForSave } from "@shared/rich-text-save";

const CREAM_BG = "#FDF8F0";
const BROWN_DARK = "#4A3728";
const BROWN_LIGHT = "#7A6B5E";
const GREEN_ACCENT = "#8B7355" // Brown accent (was green);

const ALL_TAGS = ALL_POST_TAGS;

interface PostFormData {
  text: string;
  photos: string[];
  videos: string[];
  tags: string[];
  published: boolean;
  status: "published" | "scheduled" | "draft";
  scheduledAt: Date | null;
  publishedAt: Date;
  sortOrder: number;
  target: "feed" | "club" | "both";
}

const EMPTY_FORM: PostFormData = {
  text: "",
  photos: [],
  videos: [],
  tags: [],
  published: true,
  status: "published",
  scheduledAt: null,
  publishedAt: new Date(),
  sortOrder: 0,
  target: "feed",
};

export default function AdminScreen() {
  // Архивная монолитная админка читает полный список постов и содержит старые CRUD/uploadPhoto без operation keys и ревизий; текущий web admin вынесен в отдельные файлы.

  const router = useRouter();
  const { isOwner, isAuthenticated, loading: authLoading } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PostFormData>(EMPTY_FORM);
  const [videoUploading, setVideoUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [richText, setRichText] = useState<RichTextBlock[] | undefined>();
  const [richTextSeed, setRichTextSeed] = useState<RichTextBlock[] | null | undefined>(null);
  const [draftKey, setDraftKey] = useState(0);
  const richTextFieldRef = useRef<RichTextFieldHandle>(null);
  const [viewTab, setViewTab] = useState<
    "posts" | "calendar" | "stats" | "members" | "payments" | "articles" | "reports"
  >("posts");

  // Fetch all posts (admin)
  const { data: posts, isLoading, refetch } = trpc.admin.posts.useQuery(undefined, {
    retry: 1,
    enabled: isOwner,
  });
  const utils = trpc.useUtils();

  const invalidatePublicFeeds = () => {
    // Перечитывает admin.posts и инвалидирует публичные списки после изменения поста.

    void refetch();
    void utils.feed.list.invalidate();
    void utils.feed.listPaginated.invalidate();
    void utils.club.list.invalidate();
  };

  const notifyAdminError = (message: string) => {
    // Выбирает web alert либо native диалог, не очищая введённую форму.

    if (Platform.OS === "web") {
      window.alert(message);
      return;
    }
    Alert.alert("Ошибка", message);
  };

  // Mutations
  const createMutation = trpc.admin.createPost.useMutation({
    onSuccess: () => {
      // После создания обновляет выдачу и сбрасывает редактор.

      invalidatePublicFeeds();
      resetForm();
    },
    onError: (err) => /* Показывает серверное пояснение конкретной неудавшейся мутации без слепого повтора. */ notifyAdminError(err.message || "Не удалось сохранить пост"),
  });

  const updateMutation = trpc.admin.updatePost.useMutation({
    onSuccess: () => {
      // После update обновляет выдачу и закрывает редактор.

      invalidatePublicFeeds();
      resetForm();
    },
    onError: (err) => /* Показывает серверное пояснение конкретной неудавшейся мутации без слепого повтора. */ notifyAdminError(err.message || "Не удалось сохранить пост"),
  });

  const deleteMutation = trpc.admin.deletePost.useMutation({
    onSuccess: () => /* После delete инвалидирует каталоги без изменения других записей. */ invalidatePublicFeeds(),
    onError: (err) => /* Показывает серверное пояснение конкретной неудавшейся мутации без слепого повтора. */ notifyAdminError(err.message || "Не удалось удалить пост"),
  });

  const membersQuery = trpc.admin.members.useQuery(undefined, {
    enabled: isOwner && (viewTab === "members" || viewTab === "payments"),
  });
  const paymentsQuery = trpc.admin.payments.useQuery(undefined, {
    enabled: isOwner && viewTab === "payments",
  });
  const grantClub = trpc.admin.grantClub.useMutation({
    onSuccess: (result) => {
      // После выдачи доступа перечитывает участников/платежи и показывает подтверждённую дату.

      void membersQuery.refetch();
      void paymentsQuery.refetch();
      const until = result?.expiresAt
        ? new Date(result.expiresAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
        : "";
      if (Platform.OS === "web") {
        window.alert(until ? `Клуб продлён до ${until}` : "Клуб продлён");
        return;
      }
      Alert.alert("Готово", until ? `Клуб продлён до ${until}` : "Клуб продлён");
    },
    onError: (err) => /* Показывает серверное пояснение конкретной неудавшейся мутации без слепого повтора. */ notifyAdminError(err.message || "Не удалось продлить клуб"),
  });
  const blockUser = trpc.moderation.blockUser.useMutation({
    onSuccess: () => /* После блокировки перечитывает участников. */ void membersQuery.refetch(),
    onError: (err) => /* Показывает серверное пояснение конкретной неудавшейся мутации без слепого повтора. */ notifyAdminError(err.message || "Не удалось заблокировать"),
  });
  const unblockUser = trpc.moderation.unblockUser.useMutation({
    onSuccess: () => /* После разблокировки перечитывает участников. */ void membersQuery.refetch(),
    onError: (err) => /* Показывает серверное пояснение конкретной неудавшейся мутации без слепого повтора. */ notifyAdminError(err.message || "Не удалось разблокировать"),
  });
  const reportsQuery = trpc.moderation.listCommentReports.useQuery(undefined, {
    enabled: isOwner && viewTab === "reports",
  });
  const dismissReport = trpc.moderation.dismissCommentReport.useMutation({
    onSuccess: () => /* После закрытия жалобы перечитывает очередь модерации. */ void reportsQuery.refetch(),
    onError: (err) => /* Показывает серверное пояснение конкретной неудавшейся мутации без слепого повтора. */ notifyAdminError(err.message || "Не удалось закрыть жалобу"),
  });
  const deleteReportedComment = trpc.moderation.deleteReportedComment.useMutation({
    onSuccess: () => /* После удаления комментария перечитывает связанные жалобы. */ void reportsQuery.refetch(),
    onError: (err) => /* Показывает серверное пояснение конкретной неудавшейся мутации без слепого повтора. */ notifyAdminError(err.message || "Не удалось удалить комментарий"),
  });

  const resetForm = () => {
    // Возвращает общий EMPTY_FORM, закрывает редактор и меняет ключ formatting-поля; дата EMPTY_FORM исторически создана при импорте.

    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setRichText(undefined);
    setRichTextSeed(null);
    setDraftKey((key) => key + 1);
  };

  const handleCreate = () => {
    // Открывает пустую форму с новым ключом richText редактора.

    setEditingId(null);
    setForm(EMPTY_FORM);
    setRichText(undefined);
    setRichTextSeed(null);
    setDraftKey((key) => key + 1);
    setShowForm(true);
  };

  const handleEdit = (post: any) => {
    // Копирует серверные поля, видео и даты в локальный снимок редактирования.

    setEditingId(post.id);
    setRichTextSeed(post.richText ?? null);
    setRichText(post.richText ?? undefined);
    setForm({
      text: post.text,
      photos: post.photos as string[],
      videos: Array.isArray(post.media)
        ? post.media.filter((item: any) => item?.type === "video" && item?.url).map((item: any) => item.url)
        : [],
      tags: post.tags as string[],
      published: post.published,
      status: post.status === "scheduled" || post.status === "draft" ? post.status : "published",
      scheduledAt: post.scheduledAt ? new Date(post.scheduledAt) : null,
      publishedAt: post.publishedAt
        ? new Date(post.publishedAt)
        : post.createdAt
          ? new Date(post.createdAt)
          : new Date(),
      sortOrder: post.sortOrder,
      target: post.target === "club" || post.target === "both" ? post.target : "feed",
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    // Отправляет удаление одного post id только после платформенного подтверждения.

    if (Platform.OS === "web") {
      if (confirm("Удалить этот пост?")) {
        deleteMutation.mutate({ id });
      }
    } else {
      Alert.alert("Удалить пост?", "Это действие нельзя отменить", [
        { text: "Отмена", style: "cancel" },
        { text: "Удалить", style: "destructive", onPress: () => /* После native подтверждения вызывает удаление выбранного id. */ deleteMutation.mutate({ id }) },
      ]);
    }
  };

  const handleGrantClub = (userId: number, label: string) => {
    // Спрашивает подтверждение ручной выдачи клуба выбранному аккаунту.

    const message = `Выдать клуб на 31 день: ${label}?`;
    if (Platform.OS === "web") {
      if (confirm(message)) grantClub.mutate({ userId });
      return;
    }
    Alert.alert("Выдать клуб", message, [
      { text: "Отмена", style: "cancel" },
      { text: "Выдать", onPress: () => /* После native подтверждения вызывает выдачу доступа одному userId. */ grantClub.mutate({ userId }) },
    ]);
  };

  const formatAdminDate = (value: Date | string | null | undefined) => {
    // Показывает русскую дату либо тире для отсутствующего/невалидного значения.

    if (!value) return "—";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  };

  const handleSubmit = () => {
    // Проверяет текст/даты, читает последний richText снимок и отправляет create/update со статусом и target.

    if (!form.text.trim()) {
      notifyAdminError("Текст поста не может быть пустым");
      return;
    }

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    if (form.status === "scheduled" && (!form.scheduledAt || Number.isNaN(form.scheduledAt.getTime()))) {
      notifyAdminError("Выберите дату и время публикации");
      return;
    }
    if (form.status !== "scheduled" && Number.isNaN(form.publishedAt.getTime())) {
      notifyAdminError("Выберите дату публикации");
      return;
    }

    const status = form.status;
    const published = status === "published";
    const scheduledAt = status === "scheduled" && form.scheduledAt ? form.scheduledAt.toISOString() : null;
    const publishedAt = status !== "scheduled" ? form.publishedAt.toISOString() : null;
    const prepared = preparePostRichTextForSave(
      form.text,
      richTextFieldRef.current?.getRichTextBlocksForSubmit() ??
        richTextFieldRef.current?.getRichTextBlocks() ??
        richText ??
        null,
    );
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        text: prepared.text,
        photos: form.photos,
        videos: form.videos,
        tags: form.tags,
        published,
        sortOrder: form.sortOrder,
        status,
        target: form.target,
        scheduledAt,
        publishedAt,
        richText: prepared.richText,
      });
    } else {
      createMutation.mutate({
        text: prepared.text,
        photos: form.photos,
        videos: form.videos,
        tags: form.tags,
        published,
        sortOrder: form.sortOrder,
        status,
        target: form.target,
        scheduledAt,
        publishedAt,
        richText: prepared.richText,
      });
    }
  };

  const [uploading, setUploading] = useState(false);

  const uploadMutation = trpc.admin.uploadPhoto.useMutation();

  const addVideoUrl = (url: string, posterUrl?: string) => {
    // Добавляет уникальный video URL, тег video и необязательный poster в форму.

    setForm((prev) => ({
      ...prev,
      videos: prev.videos.includes(url) ? prev.videos : [...prev.videos, url],
      tags: prev.tags.includes("video") ? prev.tags : [...prev.tags, "video"],
      photos: posterUrl && !prev.photos.includes(posterUrl) ? [...prev.photos, posterUrl] : prev.photos,
    }));
  };

  const uploadVideoPoster = async (videoUrl: string, source: Blob): Promise<string | null> => {
    // Извлекает JPEG-кадр Blob и загружает старым photo API под сопоставимым _thumb именем.

    const posterBlob = await extractVideoPosterBlob(source);
    if (!posterBlob) return null;
    const videoBase = mediaBasename(videoUrl).replace(/\.[^.]+$/, "");
    const result = await uploadMutation.mutateAsync({
      base64: await blobToBase64(posterBlob),
      filename: `${videoBase}_thumb.jpg`,
      mimeType: "image/jpeg",
    });
    return result.url;
  };

  const pickVideoFromLibrary = async () => {
    // Загружает native видео, опционально получает web poster и обновляет только локальную форму.

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 1,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setVideoUploading(true);
      const url = await uploadAdminVideoFromUri(
        asset.uri,
        asset.fileName || `video_${Date.now()}.mp4`,
        asset.mimeType || "video/mp4",
      );
      let posterUrl: string | null = null;
      if (Platform.OS === "web") {
        try {
          const blob = await (await fetch(asset.uri)).blob();
          posterUrl = await uploadVideoPoster(url, blob);
        } catch {
          posterUrl = null;
        }
      }
      addVideoUrl(url, posterUrl ?? undefined);
    } catch (err) {
      notifyAdminError(err instanceof Error ? err.message : "Не удалось загрузить видео");
    } finally {
      setVideoUploading(false);
    }
  };

  const onWebVideoPicked = async (event: any) => {
    // Сбрасывает file-input, загружает видео и poster последовательно; сбой poster может оставить непривязанное видео в архивном пути.

    const file = event?.target?.files?.[0] as File | undefined;
    if (event?.target) event.target.value = "";
    if (!file) return;
    setVideoUploading(true);
    try {
      const url = await uploadAdminVideoBlob(file, file.name || `video_${Date.now()}.mp4`);
      const posterUrl = await uploadVideoPoster(url, file);
      addVideoUrl(url, posterUrl ?? undefined);
    } catch (err) {
      notifyAdminError(err instanceof Error ? err.message : "Не удалось загрузить видео");
    } finally {
      setVideoUploading(false);
    }
  };

  const removeVideo = (index: number) => {
    // Убирает URL из локальной формы, не удаляя исходный объект.

    setForm((prev) => ({ ...prev, videos: prev.videos.filter((_, i) => i !== index) }));
  };

  const pickPhotosFromGallery = async () => {
    // Последовательно загружает фото, сохраняет успехи и сообщает число ошибок без удаления оригиналов.

    try {
      const uploadedUrls: string[] = [];
      const failed: string[] = [];
      let lastError: string | null = null;

      if (Platform.OS === "web") {
        const files = await pickWebFiles(
          "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,image/*",
          true,
        );
        if (!files.length) return;
        setUploading(true);
        for (const file of files) {
          try {
            const uploaded = await fileToUpload(file);
            const result = await uploadMutation.mutateAsync(uploaded);
            uploadedUrls.push(result.url);
          } catch (err) {
            console.warn("Failed to upload photo:", err);
            lastError = err instanceof Error ? err.message : "ошибка загрузки";
            failed.push(file.name || "фото");
          }
        }
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          quality: 0.8,
        });
        if (result.canceled || !result.assets?.length) return;
        setUploading(true);
        for (const asset of result.assets) {
          try {
            const base64 = await uriToBase64(asset.uri);
            const filename = asset.fileName || `photo_${Date.now()}.jpg`;
            const mimeType = asset.mimeType || "image/jpeg";
            const uploadResult = await uploadMutation.mutateAsync({
              base64,
              filename,
              mimeType,
            });
            uploadedUrls.push(uploadResult.url);
          } catch (err) {
            console.warn("Failed to upload photo:", err);
            lastError = err instanceof Error ? err.message : "ошибка загрузки";
            failed.push(asset.fileName || "фото");
          }
        }
      }

      if (uploadedUrls.length > 0) {
        setForm((prev) => ({ ...prev, photos: [...prev.photos, ...uploadedUrls] }));
      }
      if (failed.length > 0 || uploadedUrls.length === 0) {
        notifyAdminError(
          uploadedUrls.length === 0
            ? lastError
              ? `Не удалось загрузить фото: ${lastError}`
              : "Не удалось загрузить фото. Попробуйте другое изображение (jpg/png)."
            : `Загружено ${uploadedUrls.length}, не вышло: ${failed.length}`,
        );
      }
    } catch (err) {
      notifyAdminError(err instanceof Error ? err.message : "Не удалось выбрать фото");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    // Убирает только выбранный URL формы по индексу.

    setForm((prev) => ({ ...prev, photos: prev.photos.filter((_, i) => i !== index) }));
  };

  const movePhoto = (fromIndex: number, direction: "up" | "down") => {
    // Меняет соседние URL после проверки границ массива.

    setForm((prev) => {
      const newPhotos = [...prev.photos];
      const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= newPhotos.length) return prev;
      [newPhotos[fromIndex], newPhotos[toIndex]] = [newPhotos[toIndex], newPhotos[fromIndex]];
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      return { ...prev, photos: newPhotos };
    });
  };

  const reorderPhotos = (fromIndex: number, toIndex: number) => {
    // Переносит фото в допустимый индекс, сохраняя остальные URL.

    setForm((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return prev;
      if (fromIndex >= prev.photos.length || toIndex >= prev.photos.length) return prev;
      const photos = [...prev.photos];
      const [item] = photos.splice(fromIndex, 1);
      photos.splice(toIndex, 0, item);
      return { ...prev, photos };
    });
  };

  const toggleTag = (slug: string) => {
    // Переключает slug в локальном наборе тегов.

    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(slug)
        ? prev.tags.filter((t) => t !== slug)
        : [...prev.tags, slug],
    }));
  };

  // ── Post list item ──
  const renderPostItem = ({ item }: { item: any }) => /* Показывает краткий admin-снимок со статусом, целью и действиями редактирования/удаления. */ (
    <View style={styles.postItem}>
      <View style={styles.postItemHeader}>
        {item.photos && (item.photos as string[]).length > 0 && (
          <Image
            source={{ uri: (item.photos as string[])[0] }}
            style={styles.postThumb}
            contentFit="cover"
          />
        )}
        {!(item.photos && (item.photos as string[]).length > 0) &&
          Array.isArray(item.media) &&
          item.media.some((media: any) => media?.type === "video") && (
          <View style={[styles.postThumb, styles.postThumbVideo]}>
            <MaterialIcons name="videocam" size={22} color={CREAM_BG} />
          </View>
        )}
        <View style={styles.postItemInfo}>
          <Text style={styles.postItemText} numberOfLines={2}>
            {item.text}
          </Text>
          <View style={styles.postItemMeta}>
            <Text style={styles.postItemDate}>
              {new Date(item.publishedAt || item.createdAt).toLocaleDateString("ru-RU")}
            </Text>
            <View style={[styles.statusBadge, !item.published && styles.statusDraft]}>
              <Text style={[styles.statusText, !item.published && styles.statusDraftText]}>
                {item.status === "scheduled"
                  ? "Отложен"
                  : item.published
                    ? "Опубликован"
                    : "Черновик"}
              </Text>
            </View>
            <Text style={styles.postItemDate}>
              {item.target === "club" ? "Клуб" : item.target === "both" ? "Лента и клуб" : "Лента"}
            </Text>
          </View>
          <View style={styles.postItemTags}>
            {(item.tags as string[]).slice(0, 3).map((tag) => (
              <View key={tag} style={styles.miniTag}>
                <Text style={styles.miniTagText}>
                  {ALL_TAGS.find((t) => t.slug === tag)?.label || tag}
                </Text>
              </View>
            ))}
            {(item.tags as string[]).length > 3 && (
              <Text style={styles.moreTagsText}>+{(item.tags as string[]).length - 3}</Text>
            )}
          </View>
        </View>
      </View>
      <View style={styles.postItemActions}>
        <Pressable
          onPress={() => handleEdit(item)}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <MaterialIcons name="edit" size={18} color={GREEN_ACCENT} />
        </Pressable>
        <Pressable
          onPress={() => handleDelete(item.id)}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <MaterialIcons name="delete-outline" size={18} color="#A85C5C" />
        </Pressable>
      </View>
    </View>
  );

  // ── Form Modal ──
  const renderForm = () => {
    // Монтирует Modal только для открытой формы и сохраняет скрытый editor при preview, чтобы не потерять его refs.

    if (!showForm) return null;
    return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={resetForm}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable onPress={resetForm} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <MaterialIcons name="close" size={24} color={BROWN_DARK} />
          </Pressable>
          <Text style={styles.modalTitle}>
            {editingId ? "Редактировать пост" : "Новый пост"}
          </Text>
          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [styles.submitBtn, { opacity: pressed || videoUploading || uploading ? 0.7 : 1 }]}
            disabled={videoUploading || uploading || createMutation.isPending || updateMutation.isPending}
          >
            <Text style={styles.submitBtnText}>
              {videoUploading
                ? "Видео..."
                : createMutation.isPending || updateMutation.isPending
                  ? "..."
                  : "Сохранить"}
            </Text>
          </Pressable>
        </View>

        {/* Preview/Edit toggle */}
        <View style={styles.previewToggleRow}>
          <Pressable
            onPress={() => setShowPreview(false)}
            style={[styles.previewToggleBtn, !showPreview && styles.previewToggleBtnActive]}
          >
            <MaterialIcons name="edit" size={16} color={!showPreview ? CREAM_BG : BROWN_LIGHT} />
            <Text style={[styles.previewToggleText, !showPreview && styles.previewToggleTextActive]}>Редактор</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowPreview(true)}
            style={[styles.previewToggleBtn, showPreview && styles.previewToggleBtnActive]}
          >
            <MaterialIcons name="visibility" size={16} color={showPreview ? CREAM_BG : BROWN_LIGHT} />
            <Text style={[styles.previewToggleText, showPreview && styles.previewToggleTextActive]}>Предпросмотр</Text>
          </Pressable>
        </View>

        {showPreview ? (
          <ScrollView style={styles.formScroll} contentContainerStyle={styles.previewContent} key="preview">
            {/* Preview: how post will look in feed */}
            <View style={styles.previewCard}>
              {form.photos.length > 0 && (
                <View style={styles.previewPhotos}>
                  {form.photos.length === 1 ? (
                    <Image source={{ uri: form.photos[0] }} style={styles.previewSinglePhoto} contentFit="contain" />
                  ) : (
                    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                      {form.photos.map((uri, i) => (
                        <Image key={i} source={{ uri }} style={styles.previewCarouselPhoto} contentFit="contain" />
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}
              {form.videos.length > 0 && (
                <View style={styles.previewVideoNote}>
                  <MaterialIcons name="videocam" size={18} color={GREEN_ACCENT} />
                  <Text style={styles.previewVideoNoteText}>
                    {form.videos.length === 1 ? "Видео будет в ленте" : `В ленте будет ${form.videos.length} видео`}
                  </Text>
                </View>
              )}
              <View style={styles.previewTextContainer}>
                {richText?.length ? (
                  <RichTextRenderer richText={richText} plainText={form.text} />
                ) : (
                  <Text style={styles.previewPostText} numberOfLines={0}>
                    {form.text || "Текст поста..."}
                  </Text>
                )}
              </View>
              {form.tags.length > 0 && (
                <View style={styles.previewTagsRow}>
                  {form.tags.map((slug) => {
                    const tag = ALL_TAGS.find((t) => t.slug === slug);
                    return (
                      <View key={slug} style={styles.previewTag}>
                        <Text style={styles.previewTagText}>{tag?.label || slug}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={styles.previewFooter}>
                <Text style={styles.previewDate}>Сегодня</Text>
                <View style={styles.previewActions}>
                  <MaterialIcons name="favorite-border" size={20} color={BROWN_LIGHT} />
                  <MaterialIcons name="bookmark-border" size={20} color={BROWN_LIGHT} />
                </View>
              </View>
            </View>
            <Text style={styles.previewHint}>Так пост будет выглядеть в ленте</Text>
          </ScrollView>
        ) : null}
        <ScrollView
          style={[styles.formScroll, showPreview && styles.formScrollHidden]}
          contentContainerStyle={styles.formContent}
          pointerEvents={showPreview ? "none" : "auto"}
          key="editor"
        >
          {/* Text */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Текст поста</Text>
            <RichTextField
              ref={richTextFieldRef}
              key={editingId ?? `draft-${draftKey}`}
              value={form.text}
              onChangeText={(text) => setForm((prev) => ({ ...prev, text }))}
              richTextSeed={richTextSeed}
              onRichTextChange={setRichText}
              textAreaStyle={styles.textArea}
            />
          </View>

          {/* Photos */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Фотографии ({form.photos.length})</Text>
            {/* Upload from gallery button */}
            <Pressable
              onPress={pickPhotosFromGallery}
              style={({ pressed }) => [styles.galleryBtn, { opacity: pressed ? 0.7 : 1 }]}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={CREAM_BG} />
              ) : (
                <MaterialIcons name="photo-library" size={18} color={CREAM_BG} />
              )}
              <Text style={styles.galleryBtnText}>
                {uploading ? "Загрузка..." : "Выбрать из галереи"}
              </Text>
            </Pressable>
            <PhotoEditor
              photos={form.photos}
              onRemove={removePhoto}
              onMove={(index, direction) => movePhoto(index, direction === "left" ? "up" : "down")}
              onReorder={reorderPhotos}
            />
          </View>

          {/* Videos */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Видео ({form.videos.length})</Text>
            <Pressable
              onPress={() => {
                if (Platform.OS === "web") {
                  const input = (globalThis as any).document.createElement("input");
                  input.type = "file";
                  input.accept = "video/mp4,video/quicktime,video/webm,video/x-m4v,video/*";
                  input.onchange = onWebVideoPicked;
                  input.click();
                  return;
                }
                void pickVideoFromLibrary();
              }}
              style={({ pressed }) => [styles.galleryBtn, { opacity: pressed ? 0.7 : 1, marginTop: 8 }]}
              disabled={videoUploading}
            >
              {videoUploading ? (
                <ActivityIndicator size="small" color={CREAM_BG} />
              ) : (
                <MaterialIcons name="videocam" size={18} color={CREAM_BG} />
              )}
              <Text style={styles.galleryBtnText}>
                {videoUploading ? "Загрузка видео..." : "Выбрать видеофайл"}
              </Text>
            </Pressable>
            {form.videos.length > 0 && (
              <View style={styles.videoList}>
                {form.videos.map((uri, i) => (
                  <View key={`${uri}-${i}`} style={styles.videoItem}>
                    <MaterialIcons name="videocam" size={16} color={GREEN_ACCENT} />
                    <Text style={styles.videoItemName} numberOfLines={1}>
                      Видео {i + 1}
                    </Text>
                    <Pressable onPress={() => removeVideo(i)} style={styles.mediaRemoveBtn}>
                      <MaterialIcons name="close" size={14} color="#A85C5C" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Tags */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Метки</Text>
            <View style={styles.tagsGrid}>
              {ALL_TAGS.map((tag) => {
                const isSelected = form.tags.includes(tag.slug);
                return (
                  <Pressable
                    key={tag.slug}
                    onPress={() => toggleTag(tag.slug)}
                    style={[
                      styles.tagChip,
                      tag.rubric && styles.tagChipRubric,
                      isSelected && styles.tagChipSelected,
                      tag.rubric && isSelected && styles.tagChipRubricSelected,
                    ]}
                  >
                    <Text style={[
                      styles.tagChipText,
                      tag.rubric && styles.tagChipRubricText,
                      isSelected && styles.tagChipTextSelected,
                    ]}>
                      {tag.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Where to publish */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Куда публиковать</Text>
            <View style={styles.targetRow}>
              {([
                { id: "feed", label: "Лента" },
                { id: "club", label: "Клуб" },
                { id: "both", label: "Лента и клуб" },
              ] as const).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => setForm((prev) => ({ ...prev, target: item.id }))}
                  style={[styles.targetChip, form.target === item.id && styles.targetChipActive]}
                >
                  <Text style={[styles.targetChipText, form.target === item.id && styles.targetChipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Status */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Публикация</Text>
            <View style={styles.targetRow}>
              {([
                { id: "published", label: "Сейчас" },
                { id: "scheduled", label: "Отложить" },
                { id: "draft", label: "Черновик" },
              ] as const).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setForm((prev) => {
                      const next = { ...prev, status: item.id, published: item.id === "published" };
                      if (item.id === "scheduled" && !prev.scheduledAt) {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        tomorrow.setHours(10, 0, 0, 0);
                        next.scheduledAt = tomorrow;
                      }
                      return next;
                    });
                  }}
                  style={[styles.targetChip, form.status === item.id && styles.targetChipActive]}
                >
                  <Text style={[styles.targetChipText, form.status === item.id && styles.targetChipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            {form.status === "scheduled" ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.formHint}>Пост выйдет сам в выбранное время</Text>
                <ScheduleDatetime
                  value={form.scheduledAt}
                  onChange={(date) => setForm((prev) => ({ ...prev, scheduledAt: date }))}
                />
              </View>
            ) : null}
            {form.status !== "scheduled" ? (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.formHint}>Дата в ленте и клубе (можно прошлую)</Text>
                <ScheduleDatetime
                  value={form.publishedAt}
                  onChange={(date) => setForm((prev) => ({ ...prev, publishedAt: date }))}
                  allowPast
                />
              </View>
            ) : null}
          </View>

          {/* Sort order */}
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Порядок сортировки</Text>
            <TextInput
              style={styles.sortInput}
              value={form.sortOrder.toString()}
              onChangeText={(val) => setForm((prev) => ({ ...prev, sortOrder: parseInt(val) || 0 }))}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={BROWN_LIGHT}
            />
            <Text style={styles.formHint}>Чем меньше число, тем выше пост в ленте</Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
    );
  };


  if (authLoading) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={GREEN_ACCENT} />
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!isAuthenticated || !isOwner) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={styles.loadingContainer}>
          <MaterialIcons name="lock-outline" size={40} color={BROWN_LIGHT} />
          <Text style={styles.loadingText}>Админка доступна только Дарье</Text>
          <Pressable onPress={() => router.push("/login?next=/admin" as any)} style={styles.newPostBtn}>
            <Text style={styles.newPostBtnText}>Войти</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  if (isLoading && viewTab === "posts") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={GREEN_ACCENT} />
          <Text style={styles.loadingText}>Загрузка постов...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <MaterialIcons name="arrow-back" size={22} color={BROWN_DARK} />
        </Pressable>
        <Text style={styles.headerTitle}>Админка</Text>
        {viewTab === "posts" || viewTab === "calendar" ? (
        <Pressable
          onPress={handleCreate}
          style={({ pressed }) => [styles.newPostBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <MaterialIcons name="add" size={18} color={CREAM_BG} />
          <Text style={styles.newPostBtnText}>Новый</Text>
        </Pressable>
        ) : <View style={{ width: 72 }} />}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{posts?.length || 0}</Text>
          <Text style={styles.statLabel}>Всего</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{posts?.filter((p) => p.published).length || 0}</Text>
          <Text style={styles.statLabel}>Опубликовано</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{posts?.filter((p) => p.status === "scheduled").length || 0}</Text>
          <Text style={styles.statLabel}>Отложено</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{posts?.filter((p) => p.status === "draft" || (!p.published && p.status !== "scheduled")).length || 0}</Text>
          <Text style={styles.statLabel}>Черновики</Text>
        </View>
      </View>

      {/* View tabs */}
      <View style={styles.viewTabs}>
        <Pressable
          onPress={() => setViewTab("posts")}
          style={[styles.viewTab, viewTab === "posts" && styles.viewTabActive]}
        >
          <MaterialIcons name="list" size={16} color={viewTab === "posts" ? CREAM_BG : BROWN_LIGHT} />
          <Text style={[styles.viewTabText, viewTab === "posts" && styles.viewTabTextActive]}>Посты</Text>
        </Pressable>
        <Pressable
          onPress={() => setViewTab("articles")}
          style={[styles.viewTab, viewTab === "articles" && styles.viewTabActive]}
        >
          <MaterialIcons name="menu-book" size={16} color={viewTab === "articles" ? CREAM_BG : BROWN_LIGHT} />
          <Text style={[styles.viewTabText, viewTab === "articles" && styles.viewTabTextActive]}>Статьи</Text>
        </Pressable>
        <Pressable
          onPress={() => setViewTab("calendar")}
          style={[styles.viewTab, viewTab === "calendar" && styles.viewTabActive]}
        >
          <MaterialIcons name="calendar-month" size={16} color={viewTab === "calendar" ? CREAM_BG : BROWN_LIGHT} />
          <Text style={[styles.viewTabText, viewTab === "calendar" && styles.viewTabTextActive]}>Календарь</Text>
        </Pressable>
        <Pressable
          onPress={() => setViewTab("stats")}
          style={[styles.viewTab, viewTab === "stats" && styles.viewTabActive]}
        >
          <MaterialIcons name="bar-chart" size={16} color={viewTab === "stats" ? CREAM_BG : BROWN_LIGHT} />
          <Text style={[styles.viewTabText, viewTab === "stats" && styles.viewTabTextActive]}>Статистика</Text>
        </Pressable>
        <Pressable
          onPress={() => setViewTab("members")}
          style={[styles.viewTab, viewTab === "members" && styles.viewTabActive]}
        >
          <MaterialIcons name="groups" size={16} color={viewTab === "members" ? CREAM_BG : BROWN_LIGHT} />
          <Text style={[styles.viewTabText, viewTab === "members" && styles.viewTabTextActive]}>Участницы</Text>
        </Pressable>
        <Pressable
          onPress={() => setViewTab("payments")}
          style={[styles.viewTab, viewTab === "payments" && styles.viewTabActive]}
        >
          <MaterialIcons name="payments" size={16} color={viewTab === "payments" ? CREAM_BG : BROWN_LIGHT} />
          <Text style={[styles.viewTabText, viewTab === "payments" && styles.viewTabTextActive]}>Оплаты</Text>
        </Pressable>
        <Pressable
          onPress={() => setViewTab("reports")}
          style={[styles.viewTab, viewTab === "reports" && styles.viewTabActive]}
        >
          <MaterialIcons name="flag" size={16} color={viewTab === "reports" ? CREAM_BG : BROWN_LIGHT} />
          <Text style={[styles.viewTabText, viewTab === "reports" && styles.viewTabTextActive]}>Жалобы</Text>
        </Pressable>
      </View>

      {viewTab === "articles" ? (
        <ArticlesAdmin />
      ) : viewTab === "calendar" ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          <CalendarTracker
            onPostPress={(post) => {
              handleEdit(post as any);
            }}
            onDayPress={(date) => {
              setEditingId(null);
              setForm({
                ...EMPTY_FORM,
                status: "scheduled",
                published: false,
                scheduledAt: date,
                target: "club",
              });
              setShowForm(true);
            }}
          />
        </ScrollView>
      ) : viewTab === "stats" ? (
        <StatsDashboard />
      ) : viewTab === "members" ? (
        <FlatList
          style={styles.flexList}
          data={membersQuery.data || []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {membersQuery.isLoading ? (
                <ActivityIndicator color={GREEN_ACCENT} />
              ) : (
                <>
                  <MaterialIcons name="groups" size={48} color={BROWN_LIGHT} />
                  <Text style={styles.emptyText}>Пока нет участниц</Text>
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.postItem}>
              <Text style={styles.postItemText}>{item.name || "Без имени"}</Text>
              <Text style={styles.postItemDate}>{item.email || "нет email"}</Text>
              <View style={styles.postItemMeta}>
                <View style={[styles.statusBadge, !item.clubExpiresAt && styles.statusDraft]}>
                  <Text style={[styles.statusText, !item.clubExpiresAt && styles.statusDraftText]}>
                    {item.role === "admin"
                      ? "Админ"
                      : item.clubExpiresAt
                        ? `Клуб до ${formatAdminDate(item.clubExpiresAt)}`
                        : "Без клуба"}
                  </Text>
                </View>
                {item.blockedAt ? (
                  <View style={[styles.statusBadge, styles.statusBlocked]}>
                    <Text style={styles.statusBlockedText}>Заблокирована</Text>
                  </View>
                ) : null}
              </View>
              {item.blockedReason ? (
                <Text style={styles.postItemDate}>Причина: {item.blockedReason}</Text>
              ) : null}
              <View style={styles.postItemActions}>
                <Pressable
                  onPress={() => handleGrantClub(item.id, item.email || item.name || String(item.id))}
                  disabled={grantClub.isPending}
                  style={styles.actionBtn}
                >
                  <Text style={styles.grantBtnText}>
                    {item.clubExpiresAt ? "Продлить клуб" : "Выдать клуб"}
                  </Text>
                </Pressable>
                {item.blockedAt ? (
                  <Pressable
                    onPress={() => unblockUser.mutate({ userId: item.id })}
                    disabled={unblockUser.isPending}
                    style={styles.actionBtn}
                  >
                    <Text style={styles.grantBtnText}>Разблокировать</Text>
                  </Pressable>
                ) : item.role !== "admin" ? (
                  <Pressable
                    onPress={() => {
                      const reason =
                        Platform.OS === "web"
                          ? window.prompt("Причина блокировки", "Нарушение правил клуба") || ""
                          : "Нарушение правил клуба";
                      if (reason.trim().length >= 3) {
                        blockUser.mutate({ userId: item.id, reason: reason.trim() });
                      }
                    }}
                    disabled={blockUser.isPending}
                    style={styles.actionBtn}
                  >
                    <Text style={[styles.grantBtnText, { color: "#A85C5C" }]}>Заблокировать</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        />
      ) : viewTab === "reports" ? (
        <FlatList
          style={styles.flexList}
          data={reportsQuery.data || []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {reportsQuery.isLoading ? (
                <ActivityIndicator color={GREEN_ACCENT} />
              ) : (
                <>
                  <MaterialIcons name="flag" size={48} color={BROWN_LIGHT} />
                  <Text style={styles.emptyText}>Жалоб пока нет</Text>
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.postItem}>
              <Text style={styles.postItemText}>Жалоба #{item.id}</Text>
              <Text style={styles.postItemDate}>
                {new Date(item.createdAt).toLocaleString("ru-RU")} · пост #{item.postId}
              </Text>
              <Text style={styles.postItemText}>{item.commentText}</Text>
              <Text style={styles.postItemDate}>
                Автор: {item.authorName || `#${item.authorUserId}`} · Жалоба от: {item.reporterName || `#${item.reporterUserId}`}
              </Text>
              <Text style={styles.postItemDate}>Причина: {item.reason}</Text>
              <View style={styles.postItemActions}>
                <Pressable
                  onPress={() => dismissReport.mutate({ reportId: item.id })}
                  disabled={dismissReport.isPending}
                  style={styles.actionBtn}
                >
                  <Text style={styles.grantBtnText}>Закрыть</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const ok = Platform.OS === "web"
                      ? window.confirm("Удалить комментарий?")
                      : true;
                    if (!ok) return;
                    deleteReportedComment.mutate({ commentId: item.commentId, reportId: item.id });
                  }}
                  disabled={deleteReportedComment.isPending}
                  style={styles.actionBtn}
                >
                  <Text style={[styles.grantBtnText, { color: "#A85C5C" }]}>Удалить комментарий</Text>
                </Pressable>
                {item.authorUserId ? (
                  <Pressable
                    onPress={() => {
                      const reason =
                        Platform.OS === "web"
                          ? window.prompt("Причина блокировки", item.reason) || ""
                          : item.reason;
                      if (reason.trim().length >= 3) {
                        blockUser.mutate({ userId: item.authorUserId, reason: reason.trim() });
                      }
                    }}
                    disabled={blockUser.isPending}
                    style={styles.actionBtn}
                  >
                    <Text style={[styles.grantBtnText, { color: "#A85C5C" }]}>Заблокировать автора</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        />
      ) : viewTab === "payments" ? (
        <FlatList
          style={styles.flexList}
          data={paymentsQuery.data || []}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              {paymentsQuery.isLoading ? (
                <ActivityIndicator color={GREEN_ACCENT} />
              ) : (
                <>
                  <MaterialIcons name="payments" size={48} color={BROWN_LIGHT} />
                  <Text style={styles.emptyText}>Оплат пока нет</Text>
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.postItem}>
              <Text style={styles.postItemText}>{item.email || item.orderId}</Text>
              <Text style={styles.postItemDate}>
                {item.status === "paid" ? "Оплачено" : item.status} · {item.sum ? `${item.sum} ₽` : "—"} · {formatAdminDate(item.paidAt || item.createdAt)}
              </Text>
              <Text style={styles.postItemDate}>
                Доступ до {formatAdminDate(item.expiresAt)} · заказ {item.orderId}
              </Text>
            </View>
          )}
        />
      ) : (
      <FlatList
        style={styles.flexList}
        data={posts || []}
        renderItem={renderPostItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="post-add" size={48} color={BROWN_LIGHT} />
            <Text style={styles.emptyText}>Пока нет постов</Text>
            <Text style={styles.emptySubtext}>Создайте первый пост для ленты</Text>
          </View>
        }
      />
      )}

      {renderForm()}
    </ScreenContainer>
  );
}

// При preview редактор скрывается вне экрана с отключёнными жестами, сохраняя refs форматирования до явного закрытия формы.
const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { fontSize: 14, color: BROWN_LIGHT },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E2D8",
    backgroundColor: CREAM_BG,
  },
  backBtn: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontFamily: "EBGaramond-SemiBold",
    color: BROWN_DARK,
  },
  newPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: GREEN_ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  newPostBtnText: { fontSize: 13, fontWeight: "600", color: CREAM_BG },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E2D8",
    backgroundColor: "#F8F4ED",
  },
  statItem: { alignItems: "center" },
  statNumber: { fontSize: 20, fontFamily: "EBGaramond-Bold", color: BROWN_DARK },
  statLabel: { fontSize: 11, color: BROWN_LIGHT, marginTop: 2 },
  flexList: { flex: 1 },
  viewTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: "#F8F4ED",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E2D8",
    alignItems: "center",
    minHeight: 44,
  },
  viewTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#EEE9E0",
  },
  viewTabActive: { backgroundColor: BROWN_DARK },
  viewTabText: { fontSize: 13, fontWeight: "600", color: BROWN_LIGHT },
  viewTabTextActive: { color: CREAM_BG },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 },
  postItem: {
    backgroundColor: CREAM_BG,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E8E2D8",
  },
  postItemHeader: { flexDirection: "row", gap: 10 },
  postThumb: { width: 56, height: 56, borderRadius: 6 },
  postItemInfo: { flex: 1, gap: 4 },
  postItemText: { fontSize: 13, color: BROWN_DARK, lineHeight: 18 },
  postItemMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  postItemDate: { fontSize: 11, color: BROWN_LIGHT },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#D4EDDA",
  },
  statusDraft: { backgroundColor: "#FFF3CD" },
  statusBlocked: { backgroundColor: "#F8D7DA" },
  statusBlockedText: { color: "#842029", fontFamily: "EBGaramond-SemiBold", fontSize: 11 },
  statusText: { fontSize: 10, color: "#155724", fontWeight: "600" },
  statusDraftText: { color: "#856404" },
  postItemTags: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  miniTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: "#EEE9E0" },
  miniTagText: { fontSize: 10, color: BROWN_LIGHT },
  moreTagsText: { fontSize: 10, color: BROWN_LIGHT, alignSelf: "center" },
  postItemActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#E8E2D8",
  },
  actionBtn: { padding: 6 },
  grantBtnText: { fontSize: 13, fontWeight: "600", color: GREEN_ACCENT },
  emptyContainer: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyText: { fontSize: 16, color: BROWN_DARK, fontFamily: "EBGaramond-SemiBold" },
  emptySubtext: { fontSize: 13, color: BROWN_LIGHT },
  // Modal
  modalContainer: { flex: 1, backgroundColor: CREAM_BG },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E2D8",
  },
  modalTitle: { fontSize: 17, fontFamily: "EBGaramond-SemiBold", color: BROWN_DARK },
  submitBtn: {
    backgroundColor: GREEN_ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  submitBtnText: { fontSize: 13, fontWeight: "600", color: CREAM_BG },
  formScroll: { flex: 1 },
  formScrollHidden: Platform.OS === "web"
    ? ({
        position: "absolute",
        width: 1,
        height: 1,
        left: -9999,
        opacity: 0,
        overflow: "hidden",
      } as object)
    : { flex: 0, height: 0, opacity: 0, overflow: "hidden" },
  formContent: { padding: 16, gap: 20, paddingBottom: 40 },
  formGroup: { gap: 8 },
  targetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  targetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#EEE9E0",
  },
  targetChipActive: { backgroundColor: BROWN_DARK },
  targetChipText: { fontSize: 13, fontWeight: "600", color: BROWN_LIGHT },
  targetChipTextActive: { color: CREAM_BG },
  formLabel: { fontSize: 14, fontWeight: "600", color: BROWN_DARK },
  formHint: { fontSize: 11, color: BROWN_LIGHT, marginTop: 2 },
  textArea: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: BROWN_DARK,
    minHeight: 120,
    lineHeight: 20,
  },
  photoInputRow: { flexDirection: "row", gap: 8 },
  photoInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: BROWN_DARK,
  },
  addPhotoBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: GREEN_ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },
  photoPreviewScroll: { marginTop: 8 },
  photoPreviewItem: { width: 64, height: 64, marginRight: 8, position: "relative" },
  photoPreviewImage: { width: 64, height: 64, borderRadius: 6 },
  removePhotoBtn: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#A85C5C",
    justifyContent: "center",
    alignItems: "center",
  },
  photoIndex: {
    position: "absolute",
    bottom: 2,
    left: 2,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  photoIndexText: { fontSize: 9, color: "#fff", fontWeight: "600" },
  tagsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#EEE9E0",
    borderWidth: 1,
    borderColor: "#D8D2C6",
  },
  tagChipRubric: {
    backgroundColor: "#E4D9C8",
    borderColor: "#6B5344",
    borderWidth: 1.5,
  },
  tagChipSelected: { backgroundColor: GREEN_ACCENT, borderColor: GREEN_ACCENT },
  tagChipRubricSelected: { backgroundColor: "#4A3728", borderColor: "#4A3728" },
  tagChipText: { fontSize: 12, fontFamily: "EBGaramond-Regular", fontWeight: "400", color: BROWN_DARK },
  tagChipRubricText: { fontFamily: "EBGaramond-Regular", fontWeight: "400", fontSize: 12 },
  tagChipTextSelected: { color: CREAM_BG },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  toggleLabel: { fontSize: 14, color: BROWN_DARK },
  sortInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: BROWN_DARK,
    width: 80,
  },
  galleryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GREEN_ACCENT,
    paddingVertical: 10,
    borderRadius: 10,
  },
  galleryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: CREAM_BG,
  },
  videoUploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  videoList: { gap: 8, marginTop: 8 },
  videoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  videoItemName: { flex: 1, fontSize: 13, color: BROWN_DARK },
  mediaRemoveBtn: { padding: 4 },
  previewVideoNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F4EFE6",
  },
  previewVideoNoteText: { fontSize: 13, color: BROWN_DARK },
  postThumbVideo: {
    backgroundColor: GREEN_ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  reorderBtns: {
    position: "absolute",
    bottom: 2,
    right: 2,
    flexDirection: "row",
    gap: 2,
  },
  reorderBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewToggleRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E1DC",
    backgroundColor: CREAM_BG,
  },
  previewToggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  previewToggleBtnActive: {
    backgroundColor: GREEN_ACCENT,
  },
  previewToggleText: {
    fontSize: 13,
    fontWeight: "500",
    color: BROWN_LIGHT,
  },
  previewToggleTextActive: {
    color: CREAM_BG,
  },
  previewContent: {
    padding: 16,
  },
  previewCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E1DC",
  },
  previewPhotos: {
    width: "100%",
    height: 280,
  },
  previewSinglePhoto: {
    width: "100%",
    height: "100%",
  },
  previewCarouselPhoto: {
    width: Dimensions.get("window").width - 64,
    height: 280,
  },
  previewTextContainer: {
    padding: 14,
  },
  previewPostText: {
    fontSize: 14,
    lineHeight: 20,
    color: BROWN_DARK,
  },
  previewTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 6,
  },
  previewTag: {
    backgroundColor: "#F0EBE5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  previewTagText: {
    fontSize: 11,
    color: BROWN_LIGHT,
  },
  previewFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F0EBE5",
  },
  previewDate: {
    fontSize: 12,
    color: BROWN_LIGHT,
  },
  previewActions: {
    flexDirection: "row",
    gap: 12,
  },
  previewHint: {
    textAlign: "center",
    marginTop: 16,
    fontSize: 13,
    color: BROWN_LIGHT,
    fontStyle: "italic",
  },
});
