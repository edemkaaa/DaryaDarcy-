// Архив Expo. Открывает внешнее меню действий одного поста без собственной мутации.
import { useState, useCallback, useEffect } from "react";
import {
  Text,
  View,
  Pressable,
  TextInput,
  Alert,
  StyleSheet,
  ScrollView,
  Modal,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { trpc } from "@/lib/trpc";
import { ALL_POST_TAGS } from "@/lib/post-tags";
import { CreatePostModal } from "@/components/admin/create-post-modal";
import type { RichTextBlock } from "@/components/rich-text-renderer";

// ── Constants ──
const CREAM_BG = "#FDF8F0";
const BROWN_DARK = "#4A3728";
const BROWN_LIGHT = "#7A6B5E";
const GREEN_ACCENT = "#8B7355" // Brown accent (was green);

const ALL_TAGS = ALL_POST_TAGS;

// ── Types ──
interface PostData {
  id: number;
  text: string;
  photos: string[];
  tags: string[];
  richText?: RichTextBlock[] | null;
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
  target?: "feed" | "club" | "both";
  media?: { id: number; type: string; url: string; filename?: string | null; mimeType?: string | null; fileSize?: number | null; duration?: number | null }[];
}

type MenuAction = "edit" | "tags" | "delete";

// ── Three-Dot Menu Button ──
export function PostMenuButton({ onPress }: { onPress: () => void }) {
  // Открывает внешнее меню действий одного поста без собственной мутации.

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuButton, { opacity: pressed ? 0.5 : 1 }]}
    >
      <MaterialIcons name="more-vert" size={20} color={BROWN_LIGHT} />
    </Pressable>
  );
}

// ── Action Sheet (3 options) ──
function ActionSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: MenuAction) => void;
}) {
  // Монтирует модалку edit/tags/delete только при visible, чтобы закрытый overlay не перехватывал жесты.

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.actionSheetOverlay} onPress={onClose}>
        <View style={styles.actionSheetContainer}>
          <View style={styles.actionSheetContent}>
            <Pressable
              onPress={() => onSelect("edit")}
              style={({ pressed }) => [styles.actionSheetItem, pressed && styles.actionSheetItemPressed]}
            >
              <MaterialIcons name="edit" size={20} color={GREEN_ACCENT} />
              <Text style={styles.actionSheetText}>Редактировать пост</Text>
            </Pressable>
            <View style={styles.actionSheetDivider} />
            <Pressable
              onPress={() => onSelect("tags")}
              style={({ pressed }) => [styles.actionSheetItem, pressed && styles.actionSheetItemPressed]}
            >
              <MaterialIcons name="label" size={20} color={GREEN_ACCENT} />
              <Text style={styles.actionSheetText}>Выбрать хештеги</Text>
            </Pressable>
            <View style={styles.actionSheetDivider} />
            <Pressable
              onPress={() => onSelect("delete")}
              style={({ pressed }) => [styles.actionSheetItem, pressed && styles.actionSheetItemPressed]}
            >
              <MaterialIcons name="delete-outline" size={20} color="#A85C5C" />
              <Text style={[styles.actionSheetText, { color: "#A85C5C" }]}>Удалить пост</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.actionSheetCancel, pressed && styles.actionSheetItemPressed]}
          >
            <Text style={styles.actionSheetCancelText}>Отмена</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Tag Selection Modal ──
function TagSelectionModal({
  visible,
  post,
  onClose,
  onSave,
}: {
  visible: boolean;
  post: PostData | null;
  onClose: () => void;
  onSave: (tags: string[]) => void;
}) {
  // Редактирует копию тегов выбранного поста до явного сохранения.

  const [selectedTags, setSelectedTags] = useState<string[]>(post?.tags || []);

  // Reset when post changes
  useEffect(() => {
    // При смене post восстанавливает локальный набор тегов из новой записи.

    if (post) {
      setSelectedTags([...post.tags]);
    }
  }, [post]);

  const toggleTag = (slug: string) => {
    // Переключает slug в локальном наборе тегов и даёт native haptic.

    setSelectedTags((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]
    );
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleSave = () => {
    // Передаёт текущие теги владельцу модалки; серверным подтверждением занимается мутация.

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onSave(selectedTags);
  };

  if (!visible || !post) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <MaterialIcons name="close" size={24} color={BROWN_DARK} />
          </Pressable>
          <Text style={styles.modalTitle}>Хештеги</Text>
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [styles.saveBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={styles.saveBtnText}>Сохранить</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
          <Text style={styles.tagHint}>Выберите подходящие хештеги для поста</Text>
          <View style={styles.tagsGrid}>
            {ALL_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag.slug);
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
          {selectedTags.length > 0 && (
            <Text style={styles.tagCount}>
              Выбрано: {selectedTags.length}
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Main Post Management Hook ──
export function usePostManagement(onRefresh: () => void) {
  // Объединяет меню, редактор и теги для выбранного поста; использует архивные мутации без ревизий.

  const utils = trpc.useUtils();
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [activePost, setActivePost] = useState<PostData | null>(null);

  const updateMutation = trpc.admin.updatePost.useMutation({
    onSuccess: () => {
      // После обновления перечитывает контент и закрывает связанные формы.

      onRefresh();
      setEditModalVisible(false);
      setTagModalVisible(false);
    },
    onError: (err) => {
      // Показывает ошибку сохранения без автоматического повтора записи.

      const message = err.message || "Не удалось сохранить изменения";
      if (Platform.OS === "web") window.alert(message);
      else Alert.alert("Ошибка", message);
    },
  });

  const deleteMutation = trpc.admin.deletePost.useMutation({
    onSuccess: async () => {
      // После удаления сбрасывает выбранный пост/модалки и инвалидирует постраничную Ленту.

      setActivePost(null);
      setEditModalVisible(false);
      setTagModalVisible(false);
      setActionSheetVisible(false);
      await utils.feed.listPaginated.invalidate();
      onRefresh();
    },
    onError: (err) => {
      // Показывает ошибку удаления, сохраняя возможность ручного решения.

      const message = err.message || "Не удалось удалить пост";
      if (Platform.OS === "web") window.alert(message);
      else Alert.alert("Ошибка", message);
    },
  });

  const openMenu = useCallback((post: PostData) => {
    // Фиксирует выбранную запись до открытия списка действий.

    setActivePost(post);
    setActionSheetVisible(true);
  }, []);

  const closeMenu = useCallback(() => {
    // Скрывает action sheet без изменения выбранного поста.

    setActionSheetVisible(false);
  }, []);

  const handleAction = useCallback((action: MenuAction) => {
    // Переключает соответствующую форму, а delete отправляет только после платформенного подтверждения.

    setActionSheetVisible(false);

    if (action === "edit") {
      setEditModalVisible(true);
    } else if (action === "tags") {
      setTagModalVisible(true);
    } else if (action === "delete") {
      if (Platform.OS === "web") {
        if (confirm("Удалить этот пост? Это действие нельзя отменить.")) {
          if (activePost) {
            deleteMutation.mutate({ id: activePost.id });
          }
        }
      } else {
        Alert.alert("Удалить пост?", "Это действие нельзя отменить", [
          { text: "Отмена", style: "cancel" },
          {
            text: "Удалить",
            style: "destructive",
            onPress: () => {
              // После native подтверждения удаляет только всё ещё выбранный пост.

              if (activePost) {
                deleteMutation.mutate({ id: activePost.id });
              }
            },
          },
        ]);
      }
    }
  }, [activePost, deleteMutation]);

  const handleTagsSave = useCallback(
    (tags: string[]) => {
      // Отправляет patch тегов по id текущего поста.

      if (activePost) {
        updateMutation.mutate({ id: activePost.id, tags });
      }
    },
    [activePost, updateMutation]
  );

  const ManagementModals = useCallback(
    () => /* Монтирует только открытый редактор и передаёт ему снимок выбранной записи с датами/вложениями. */ (
      <>
        <ActionSheet
          visible={actionSheetVisible}
          onClose={closeMenu}
          onSelect={handleAction}
        />
        {editModalVisible ? (
        <CreatePostModal
          visible
          onClose={() => setEditModalVisible(false)}
          defaultTarget={activePost?.target || "feed"}
          editingPost={activePost ? {
            id: activePost.id,
            text: activePost.text,
            photos: activePost.photos,
            tags: activePost.tags,
            status: "published",
            target: activePost.target || "feed",
            scheduledAt: null,
            publishedAt: activePost.publishedAt
              ? new Date(activePost.publishedAt).toISOString()
              : activePost.createdAt
                ? new Date(activePost.createdAt).toISOString()
                : null,
            createdAt: activePost.createdAt ? new Date(activePost.createdAt).toISOString() : null,
            richText: activePost.richText ?? null,
            media: activePost.media ?? [],
          } : null}
        />
        ) : null}
        <TagSelectionModal
          visible={tagModalVisible}
          post={activePost}
          onClose={() => setTagModalVisible(false)}
          onSave={handleTagsSave}
        />
      </>
    ),
    [actionSheetVisible, editModalVisible, tagModalVisible, activePost, closeMenu, handleAction, handleTagsSave]
  );

  return {
    openMenu,
    ManagementModals,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

// ── Styles ──
// Связанные размеры, цвета и состояния соответствуют render-блокам этого архивного экрана; геометрию активного frontend они не задают.
const styles = StyleSheet.create({
  // Menu button
  menuButton: {
    padding: 6,
    borderRadius: 16,
  },
  // Action Sheet
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  actionSheetContainer: {
    paddingHorizontal: 12,
    paddingBottom: 34,
    gap: 8,
  },
  actionSheetContent: {
    backgroundColor: CREAM_BG,
    borderRadius: 14,
    overflow: "hidden",
  },
  actionSheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  actionSheetItemPressed: {
    backgroundColor: "rgba(139, 115, 85, 0.08)",
  },
  actionSheetDivider: {
    height: 1,
    backgroundColor: "#E8E2D8",
    marginHorizontal: 20,
  },
  actionSheetText: {
    fontSize: 16,
    color: BROWN_DARK,
    fontFamily: "EBGaramond-Regular",
  },
  actionSheetCancel: {
    backgroundColor: CREAM_BG,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionSheetCancelText: {
    fontSize: 16,
    color: GREEN_ACCENT,
    fontWeight: "600",
    fontFamily: "EBGaramond-SemiBold",
  },
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
  saveBtn: {
    backgroundColor: GREEN_ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  saveBtnText: { fontSize: 13, fontWeight: "600", color: CREAM_BG },
  formScroll: { flex: 1 },
  formContent: { padding: 16, gap: 20, paddingBottom: 40 },
  formGroup: { gap: 8 },
  formLabel: { fontSize: 14, fontWeight: "600", color: BROWN_DARK },
  textArea: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: BROWN_DARK,
    minHeight: 160,
    lineHeight: 20,
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
  galleryBtnText: { fontSize: 14, fontWeight: "600", color: CREAM_BG },
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
  // Tags
  tagHint: {
    fontSize: 14,
    color: BROWN_LIGHT,
    fontFamily: "EBGaramond-Italic",
    marginBottom: 4,
  },
  tagsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#EEE9E0",
    borderWidth: 1,
    borderColor: "#D8D2C6",
  },
  tagChipSelected: { backgroundColor: GREEN_ACCENT, borderColor: GREEN_ACCENT },
  tagChipRubric: {
    backgroundColor: "#E4D9C8",
    borderColor: "#6B5344",
    borderWidth: 1.5,
  },
  tagChipRubricSelected: { backgroundColor: "#4A3728", borderColor: "#4A3728" },
  tagChipText: { fontSize: 14, fontFamily: "EBGaramond-Regular", color: BROWN_DARK },
  tagChipRubricText: { fontFamily: "EBGaramond-Regular", fontWeight: "400" },
  tagChipTextSelected: { color: CREAM_BG },
  tagCount: {
    fontSize: 13,
    color: GREEN_ACCENT,
    fontFamily: "EBGaramond-SemiBold",
    marginTop: 12,
    textAlign: "center",
  },
});
