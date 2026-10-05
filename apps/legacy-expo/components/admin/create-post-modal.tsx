import { useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  Pressable,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { trpc } from "@/lib/trpc";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { schedulePostReminder } from "@/lib/notifications";
import { uploadAdminVideoBlob, uploadAdminVideoFromUri } from "@/lib/admin-video-upload";
import { fileToUpload, pickWebFiles, uriToBase64 } from "@/lib/admin-photo-upload";
import { PhotoEditor } from "@/components/admin/photo-editor";
import { ScheduleDatetime } from "@/components/admin/schedule-datetime";
import { tagsForTarget } from "@/lib/post-tags";
import { RichTextField, type RichTextFieldHandle } from "@/components/admin/rich-text-field";
import type { RichTextBlock } from "@/components/rich-text-renderer";
import { preparePostRichTextForSave } from "@shared/rich-text-save";

// ── Media types ──
interface MediaAttachment {
  type: "video" | "audio" | "document";
  uri: string;
  name: string;
  mimeType: string;
  uploadedUrl?: string;
}

// ── Colors ──
const CREAM_BG = "#FDF8F0";
const BROWN_DARK = "#4A3728";
const BROWN_LIGHT = "#7A6B5E";
const ACCENT = "#8B7355";
const OLIVE = "#6B7B5E";

type PostTarget = "feed" | "club" | "both";
type PostStatus = "draft" | "scheduled" | "published";

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  defaultTarget: PostTarget;
  editingPost?: {
    id: number;
    text: string;
    photos: string[];
    tags: string[];
    status: PostStatus;
    target: PostTarget;
    richText?: RichTextBlock[] | null;
    scheduledAt: string | null;
    publishedAt?: string | null;
    createdAt?: string | null;
    media?: { id: number; type: string; url: string }[];
  } | null;
}

export function CreatePostModal({ visible, onClose, defaultTarget, editingPost }: CreatePostModalProps) {
  const [text, setText] = useState(editingPost?.text || "");
  const [photos, setPhotos] = useState<string[]>(editingPost?.photos || []);
  const [tags, setTags] = useState<string[]>(editingPost?.tags || []);
  const [target, setTarget] = useState<PostTarget>(editingPost?.target || defaultTarget);
  const [status, setStatus] = useState<PostStatus>(editingPost?.status || "published");
  const [scheduledAt, setScheduledAt] = useState<Date | null>(
    editingPost?.scheduledAt ? new Date(editingPost.scheduledAt) : null
  );
  const [publishedAt, setPublishedAt] = useState<Date>(() => new Date());
  const [uploading, setUploading] = useState(false);
  const [videos, setVideos] = useState<string[]>([]);
  const [mediaAttachments, setMediaAttachments] = useState<MediaAttachment[]>([]);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [richText, setRichText] = useState<RichTextBlock[] | undefined>();
  const [richTextSeed, setRichTextSeed] = useState<RichTextBlock[] | null | undefined>(null);
  const [draftKey, setDraftKey] = useState(0);
  const richTextFieldRef = useRef<RichTextFieldHandle>(null);

  const utils = trpc.useUtils();
  const uploadMutation = trpc.admin.uploadPhoto.useMutation();

  useEffect(() => {
    if (!visible) return;
    setText(editingPost?.text || "");
    setPhotos(editingPost?.photos || []);
    setTags(editingPost?.tags || []);
    setTarget(editingPost?.target || defaultTarget);
    setStatus(editingPost?.status || "published");
    setScheduledAt(editingPost?.scheduledAt ? new Date(editingPost.scheduledAt) : null);
    const initialDate = editingPost?.publishedAt
      ? new Date(editingPost.publishedAt)
      : editingPost?.createdAt
        ? new Date(editingPost.createdAt)
        : new Date();
    setPublishedAt(Number.isNaN(initialDate.getTime()) ? new Date() : initialDate);
    setRichTextSeed(editingPost?.richText ?? null);
    setRichText(editingPost?.richText ?? undefined);
    setVideos(
      editingPost?.media
        ?.filter((m) => m.type === "video")
        .map((m) => m.url) ?? [],
    );
    setMediaAttachments([]);
  }, [visible, editingPost, defaultTarget]);

  const notifyError = (message: string) => {
    if (Platform.OS === "web") {
      window.alert(message);
      return;
    }
    Alert.alert("Ошибка", message);
  };

  const createMutation = trpc.admin.createPost.useMutation({
    onSuccess: (postId) => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Schedule notification reminder if post is scheduled
      if (status === "scheduled" && scheduledAt) {
        const preview = text.trim().split("\n")[0] || "Запланированная публикация";
        schedulePostReminder(postId ?? 0, scheduledAt, preview);
      }
      utils.admin.posts.invalidate();
      utils.admin.scheduledPosts.invalidate();
      utils.feed.list.invalidate();
      utils.feed.listPaginated.invalidate();
      utils.club.list.invalidate();
      handleClose();
    },
    onError: (err) => Alert.alert("Ошибка", err.message),
  });

  const updateMutation = trpc.admin.updatePost.useMutation({
    onSuccess: () => {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Schedule notification reminder if post is scheduled
      if (status === "scheduled" && scheduledAt && editingPost) {
        const preview = text.trim().split("\n")[0] || "Запланированная публикация";
        schedulePostReminder(editingPost.id, scheduledAt, preview);
      }
      utils.admin.posts.invalidate();
      utils.admin.scheduledPosts.invalidate();
      utils.feed.list.invalidate();
      utils.feed.listPaginated.invalidate();
      utils.club.list.invalidate();
      handleClose();
    },
    onError: (err) => Alert.alert("Ошибка", err.message),
  });

  const handleClose = () => {
    setText("");
    setPhotos([]);
    setTags([]);
    setTarget(defaultTarget);
    setStatus("published");
    setScheduledAt(null);
    setVideos([]);
    setMediaAttachments([]);
    setRichText(undefined);
    setRichTextSeed(null);
    if (!editingPost) setDraftKey((key) => key + 1);
    onClose();
  };

  // ── Media pickers ──
  const addVideoUrl = (url: string) => {
    setVideos((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setTags((prev) => (prev.includes("video") ? prev : [...prev, "video"]));
  };

  const pickVideo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        quality: 1,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setMediaUploading(true);
      const url = await uploadAdminVideoFromUri(
        asset.uri,
        asset.fileName || "video.mp4",
        asset.mimeType || "video/mp4",
      );
      addVideoUrl(url);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Не удалось загрузить видео");
    } finally {
      setMediaUploading(false);
    }
  };

  const onWebVideoPicked = async (event: any) => {
    const file = event?.target?.files?.[0] as File | undefined;
    if (event?.target) event.target.value = "";
    if (!file) return;
    setMediaUploading(true);
    try {
      const url = await uploadAdminVideoBlob(file, file.name || "video.mp4");
      addVideoUrl(url);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Не удалось загрузить видео");
    } finally {
      setMediaUploading(false);
    }
  };

  const pickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setMediaAttachments((prev) => [
        ...prev,
        { type: "audio", uri: asset.uri, name: asset.name, mimeType: asset.mimeType || "audio/mpeg" },
      ]);
    } catch (err) {
      Alert.alert("Ошибка", "Не удалось выбрать аудио");
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setMediaAttachments((prev) => [
        ...prev,
        { type: "document", uri: asset.uri, name: asset.name, mimeType: asset.mimeType || "application/pdf" },
      ]);
    } catch (err) {
      Alert.alert("Ошибка", "Не удалось выбрать документ");
    }
  };

  const removeMedia = (index: number) => {
    setMediaAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const replacePhoto = async (index: number) => {
    try {
      let base64 = "";
      let filename = `photo_${Date.now()}.jpg`;
      let mimeType = "image/jpeg";
      if (Platform.OS === "web") {
        const files = await pickWebFiles("image/jpeg,image/png,image/webp,image/*", false);
        if (!files.length) return;
        const uploaded = await fileToUpload(files[0]);
        base64 = uploaded.base64;
        filename = uploaded.filename;
        mimeType = uploaded.mimeType;
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
        if (result.canceled || !result.assets?.length) return;
        const asset = result.assets[0];
        filename = asset.fileName || filename;
        mimeType = asset.mimeType || mimeType;
        base64 = await uriToBase64(asset.uri);
      }
      setUploading(true);
      const uploadResult = await uploadMutation.mutateAsync({ base64, filename, mimeType });
      setPhotos((prev) => {
        const arr = [...prev];
        arr[index] = uploadResult.url;
        return arr;
      });
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Не удалось заменить фото");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!text.trim() && photos.length === 0 && videos.length === 0) {
      notifyError("Добавьте текст, фото или видео");
      return;
    }
    if (status === "scheduled" && (!scheduledAt || Number.isNaN(scheduledAt.getTime()))) {
      notifyError("Выберите дату и время публикации");
      return;
    }
    if (status !== "scheduled" && Number.isNaN(publishedAt.getTime())) {
      notifyError("Выберите дату публикации");
      return;
    }

    const prepared = preparePostRichTextForSave(
      text || " ",
      richTextFieldRef.current?.getRichTextBlocksForSubmit() ??
        richTextFieldRef.current?.getRichTextBlocks() ??
        richText ??
        null,
    );
    const payload = {
      text: prepared.text || " ",
      photos,
      videos,
      tags,
      status,
      target,
      scheduledAt: status === "scheduled" && scheduledAt ? scheduledAt.toISOString() : null,
      publishedAt: status !== "scheduled" ? publishedAt.toISOString() : null,
      sortOrder: 0,
      richText: prepared.richText,
    };

    if (editingPost) {
      updateMutation.mutate({ id: editingPost.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const pickPhotos = async () => {
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
            const uploadResult = await uploadMutation.mutateAsync({ base64, filename, mimeType });
            uploadedUrls.push(uploadResult.url);
          } catch (err) {
            console.warn("Failed to upload photo:", err);
            lastError = err instanceof Error ? err.message : "ошибка загрузки";
            failed.push(asset.fileName || "фото");
          }
        }
      }

      if (uploadedUrls.length > 0) {
        setPhotos((prev) => [...prev, ...uploadedUrls]);
      }
      if (failed.length > 0 || uploadedUrls.length === 0) {
        notifyError(
          uploadedUrls.length === 0
            ? lastError
              ? `Не удалось загрузить фото: ${lastError}`
              : "Не удалось загрузить фото. Попробуйте другое изображение (jpg/png)."
            : `Загружено ${uploadedUrls.length}, не вышло: ${failed.length}`,
        );
      }
    } catch (err) {
      notifyError(err instanceof Error ? err.message : "Не удалось выбрать фото");
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const movePhoto = (fromIndex: number, direction: "left" | "right") => {
    setPhotos((prev) => {
      const arr = [...prev];
      const toIndex = direction === "left" ? fromIndex - 1 : fromIndex + 1;
      if (toIndex < 0 || toIndex >= arr.length) return prev;
      [arr[fromIndex], arr[toIndex]] = [arr[toIndex], arr[fromIndex]];
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return arr;
    });
  };

  const reorderPhotos = (fromIndex: number, toIndex: number) => {
    setPhotos((prev) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return prev;
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
      const arr = [...prev];
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      return arr;
    });
  };

  const toggleTag = (slug: string) => {
    setTags((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]
    );
  };

  const availableTags = tagsForTarget(target);

  const isPending = createMutation.isPending || updateMutation.isPending || mediaUploading;

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <MaterialIcons name="close" size={24} color={BROWN_DARK} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {editingPost ? "Редактировать" : "Новый пост"}
          </Text>
          <Pressable
            onPress={handleSubmit}
            disabled={isPending}
            style={({ pressed }) => [styles.submitBtn, { opacity: pressed || isPending ? 0.6 : 1 }]}
          >
            {isPending ? (
              <ActivityIndicator size="small" color={CREAM_BG} />
            ) : (
              <Text style={styles.submitBtnText}>
                {editingPost
                  ? "Сохранить"
                  : status === "scheduled"
                    ? "Запланировать"
                    : status === "draft"
                      ? "Черновик"
                      : "Опубликовать"}
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Target selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Куда публикуем</Text>
            <View style={styles.targetRow}>
              {(["feed", "club", "both"] as PostTarget[]).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTarget(t)}
                  style={[styles.targetChip, target === t && styles.targetChipActive]}
                >
                  <MaterialIcons
                    name={t === "feed" ? "dynamic-feed" : t === "club" ? "groups" : "public"}
                    size={16}
                    color={target === t ? CREAM_BG : BROWN_LIGHT}
                  />
                  <Text style={[styles.targetChipText, target === t && styles.targetChipTextActive]}>
                    {t === "feed" ? "Лента" : t === "club" ? "Клуб" : "Везде"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Status selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Статус</Text>
            <View style={styles.targetRow}>
              {(["published", "scheduled", "draft"] as PostStatus[]).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => {
                    setStatus(s);
                    if (s === "scheduled" && !scheduledAt) {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      tomorrow.setHours(10, 0, 0, 0);
                      setScheduledAt(tomorrow);
                    }
                  }}
                  style={[styles.targetChip, status === s && styles.targetChipActive]}
                >
                  <MaterialIcons
                    name={s === "published" ? "visibility" : s === "scheduled" ? "schedule" : "edit-note"}
                    size={16}
                    color={status === s ? CREAM_BG : BROWN_LIGHT}
                  />
                  <Text style={[styles.targetChipText, status === s && styles.targetChipTextActive]}>
                    {s === "published" ? "Опубликовать" : s === "scheduled" ? "Отложить" : "Черновик"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Scheduled date picker */}
          {status === "scheduled" && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Дата и время публикации</Text>
              <ScheduleDatetime value={scheduledAt} onChange={setScheduledAt} />
              <Text style={styles.hint}>Пост выйдет сам в выбранное время, открывать админку не нужно.</Text>
            </View>
          )}

          {status !== "scheduled" && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Дата публикации</Text>
              <ScheduleDatetime value={publishedAt} onChange={setPublishedAt} allowPast />
              <Text style={styles.hint}>Пост встанет в ленте по этой дате, можно выбрать прошлую.</Text>
            </View>
          )}

          {/* Text input with formatting toolbar */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Текст</Text>
            <RichTextField
              ref={richTextFieldRef}
              key={editingPost?.id ?? `draft-${draftKey}`}
              value={text}
              onChangeText={setText}
              richTextSeed={richTextSeed}
              onRichTextChange={setRichText}
              textAreaStyle={styles.textArea}
            />
          </View>

          {/* Photos */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Фото ({photos.length})</Text>
            {(videos.length > 0 || mediaAttachments.some((m) => m.type === "video")) && photos.length > 0 ? (
              <Text style={styles.sectionHint}>Первое фото — обложка видео</Text>
            ) : null}
            <Pressable
              onPress={pickPhotos}
              disabled={uploading}
              style={({ pressed }) => [styles.uploadBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={CREAM_BG} />
              ) : (
                <MaterialIcons name="photo-library" size={18} color={CREAM_BG} />
              )}
              <Text style={styles.uploadBtnText}>
                {uploading ? "Загрузка..." : "Выбрать из галереи"}
              </Text>
            </Pressable>

            <PhotoEditor
              photos={photos}
              onRemove={removePhoto}
              onMove={movePhoto}
              onReorder={reorderPhotos}
              onReplace={(i) => { void replacePhoto(i); }}
            />
          </View>

          {/* Videos */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Видео ({videos.length})</Text>
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
                void pickVideo();
              }}
              disabled={mediaUploading}
              style={({ pressed }) => [styles.mediaBtn, { opacity: pressed ? 0.7 : 1, flex: 0 }]}
            >
              {mediaUploading ? (
                <ActivityIndicator size="small" color={CREAM_BG} />
              ) : (
                <MaterialIcons name="videocam" size={18} color={CREAM_BG} />
              )}
              <Text style={styles.mediaBtnText}>
                {mediaUploading ? "Загрузка..." : "Выбрать видеофайл"}
              </Text>
            </Pressable>
            {videos.length > 0 && (
              <Text style={styles.hint}>Видео загружено — нажмите «Опубликовать»</Text>
            )}
            {videos.length > 0 && (
              <View style={styles.mediaList}>
                {videos.map((uri, i) => (
                  <View key={`${uri}-${i}`} style={styles.mediaItem}>
                    <MaterialIcons name="videocam" size={16} color={ACCENT} />
                    <Text style={styles.mediaItemName} numberOfLines={1}>Видео {i + 1}</Text>
                    <Pressable
                      onPress={() => setVideos((prev) => prev.filter((_, idx) => idx !== i))}
                      style={styles.mediaRemoveBtn}
                    >
                      <MaterialIcons name="close" size={14} color="#A85C5C" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Other attachments */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Аудио и документы ({mediaAttachments.length})</Text>
            <View style={styles.mediaButtonsRow}>
              <Pressable onPress={pickAudio} style={({ pressed }) => [styles.mediaBtn, { opacity: pressed ? 0.7 : 1 }]}>
                <MaterialIcons name="headphones" size={18} color={CREAM_BG} />
                <Text style={styles.mediaBtnText}>Аудио</Text>
              </Pressable>
              <Pressable onPress={pickDocument} style={({ pressed }) => [styles.mediaBtn, { opacity: pressed ? 0.7 : 1 }]}>
                <MaterialIcons name="description" size={18} color={CREAM_BG} />
                <Text style={styles.mediaBtnText}>Документ</Text>
              </Pressable>
            </View>
            {mediaAttachments.length > 0 && (
              <View style={styles.mediaList}>
                {mediaAttachments.map((media, i) => (
                  <View key={`${media.type}-${i}`} style={styles.mediaItem}>
                    <MaterialIcons
                      name={media.type === "audio" ? "headphones" : "description"}
                      size={16}
                      color={ACCENT}
                    />
                    <Text style={styles.mediaItemName} numberOfLines={1}>{media.name}</Text>
                    <Pressable onPress={() => removeMedia(i)} style={styles.mediaRemoveBtn}>
                      <MaterialIcons name="close" size={14} color="#A85C5C" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Метки</Text>
            <View style={styles.tagsGrid}>
              {availableTags.map((tag) => {
                const isSelected = tags.includes(tag.slug);
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
                    <Text
                      style={[
                        styles.tagChipText,
                        tag.rubric && styles.tagChipRubricText,
                        isSelected && styles.tagChipTextSelected,
                      ]}
                    >
                      {tag.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CREAM_BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E2D8",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "EBGaramond-SemiBold",
    color: BROWN_DARK,
  },
  submitBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  submitBtnText: { fontSize: 13, fontWeight: "600", color: CREAM_BG },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 20, paddingBottom: 40 },
  section: { gap: 8 },
  sectionLabel: { fontSize: 14, fontWeight: "600", color: BROWN_DARK },
  sectionHint: { fontSize: 12, color: BROWN_LIGHT, marginTop: 4, marginBottom: 8 },
  hint: { fontSize: 11, color: BROWN_LIGHT, marginTop: 2 },

  // Target/Status chips
  targetRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  targetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#EEE9E0",
    borderWidth: 1,
    borderColor: "#D8D2C6",
  },
  targetChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  targetChipText: { fontSize: 13, fontWeight: "500", color: BROWN_DARK },
  targetChipTextActive: { color: CREAM_BG },

  // Date picker
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E2D8",
  },
  dateBtnText: { fontSize: 14, color: BROWN_DARK },

  // Format toolbar
  formatToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  formatBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#EEE9E0",
    justifyContent: "center",
    alignItems: "center",
  },
  formatBtnText: { fontSize: 16, color: BROWN_DARK },
  formatBtnActive: { backgroundColor: ACCENT },
  formatBtnTextActive: { color: CREAM_BG },
  selectionHint: { fontSize: 11, color: BROWN_LIGHT, alignSelf: "center", marginLeft: 8 },

  // Text area
  textArea: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: BROWN_DARK,
    minHeight: 200,
    lineHeight: 22,
  },
  formatPreviewBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    backgroundColor: "#fff",
    gap: 6,
  },
  formatPreviewLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: BROWN_LIGHT,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  linkModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(74,55,40,0.35)",
    justifyContent: "center",
    padding: 24,
  },
  linkModalCard: {
    backgroundColor: CREAM_BG,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  linkModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: BROWN_DARK,
  },
  linkModalInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: BROWN_DARK,
  },
  linkModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  linkModalCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkModalCancelText: {
    fontSize: 14,
    color: BROWN_LIGHT,
  },
  linkModalApply: {
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  linkModalApplyText: {
    fontSize: 14,
    fontWeight: "600",
    color: CREAM_BG,
  },

  // Upload
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 10,
    borderRadius: 10,
  },
  uploadBtnText: { fontSize: 14, fontWeight: "600", color: CREAM_BG },

  // URL input
  urlRow: { flexDirection: "row", gap: 8 },
  urlInput: {
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
  urlAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: ACCENT,
    justifyContent: "center",
    alignItems: "center",
  },

  // Photo previews
  photoScroll: { marginTop: 8 },
  photoItem: { width: 64, height: 64, marginRight: 8, position: "relative" },
  photoThumb: { width: 64, height: 64, borderRadius: 6 },
  photoRemoveBtn: {
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
  photoIndexBadge: {
    position: "absolute",
    bottom: 2,
    left: 2,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  photoIndexText: { fontSize: 9, color: "#fff", fontWeight: "600" },
  photoReorderRow: {
    position: "absolute",
    bottom: 2,
    right: 2,
    flexDirection: "row",
    gap: 2,
  },
  photoReorderBtn: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Photo replace button
  photoReplaceBtn: {
    position: "absolute",
    top: -4,
    left: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(74,55,40,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },

  // Media attachments
  mediaButtonsRow: { flexDirection: "row", gap: 8 },
  mediaBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: ACCENT,
    paddingVertical: 10,
    borderRadius: 10,
  },
  mediaBtnText: { fontSize: 12, fontWeight: "600", color: CREAM_BG },
  mediaList: { gap: 6, marginTop: 8 },
  mediaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mediaItemName: { flex: 1, fontSize: 13, color: BROWN_DARK },
  mediaRemoveBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  // Tags
  tagsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#F3EEE4",
    borderWidth: 1,
    borderColor: "#E8E2D8",
  },
  tagChipRubric: {
    backgroundColor: "#E4D9C8",
    borderColor: "#6B5344",
    borderWidth: 1.5,
  },
  tagChipSelected: { backgroundColor: OLIVE, borderColor: OLIVE },
  tagChipRubricSelected: { backgroundColor: "#4A3728", borderColor: "#4A3728" },
  tagChipText: { fontSize: 12, fontFamily: "EBGaramond-Regular", fontWeight: "400", color: BROWN_DARK },
  tagChipRubricText: { fontFamily: "EBGaramond-Regular", fontWeight: "400", fontSize: 12 },
  tagChipTextSelected: { color: CREAM_BG },
});
