import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { areCommentsOpen, commentsCloseAt, isCommunityPost } from "@/lib/club-tags";
import { normalizeLinkUrl } from "@/lib/photo-aspect-ratios";
import { fileToUpload, pickWebFiles, uriToBase64 } from "@/lib/admin-photo-upload";
import { PhotoViewer } from "@/components/photo-viewer";
import { COMMENT_CHAR_LIMIT, commentCountLabel } from "@/lib/comment-count-label";

const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const OLIVE = "#6B7B5E";

interface ClubCommentsProps {
  postId: number;
  tags: string[];
  createdAt: string | Date | null;
  commentCount?: number;
}

type MenuAction = "edit" | "delete" | "report";

function authorInitial(name: string | null | undefined): string {
  const trimmed = (name || "У").trim();
  return trimmed.slice(0, 1).toUpperCase();
}

function CommentAvatar({ name, avatarUrl }: { name: string | null; avatarUrl: string | null }) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />;
  }
  return (
    <View style={styles.avatarFallback}>
      <Text style={styles.avatarInitial}>{authorInitial(name)}</Text>
    </View>
  );
}

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/gi);
  return parts.map((part, index) => {
    if (/^(https?:\/\/|www\.)/i.test(part)) {
      const url = normalizeLinkUrl(part);
      return (
        <Text
          key={`${index}-${part}`}
          style={styles.link}
          onPress={() => void Linking.openURL(url)}
        >
          {part}
        </Text>
      );
    }
    return <Text key={`${index}-t`}>{part}</Text>;
  });
}

function confirmDelete(onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm("Удалить комментарий?")) onConfirm();
    return;
  }
  Alert.alert("Удалить комментарий?", undefined, [
    { text: "Нет", style: "cancel" },
    { text: "Да", style: "destructive", onPress: onConfirm },
  ]);
}

function CommentMenu({
  visible,
  showEdit,
  showDelete,
  showReport,
  onClose,
  onSelect,
}: {
  visible: boolean;
  showEdit: boolean;
  showDelete: boolean;
  showReport: boolean;
  onClose: () => void;
  onSelect: (action: MenuAction) => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.menuOverlay} onPress={onClose}>
        <View style={styles.menuSheet}>
          {showEdit ? (
            <Pressable onPress={() => onSelect("edit")} style={styles.menuItem}>
              <MaterialIcons name="edit" size={20} color={OLIVE} />
              <Text style={styles.menuItemText}>Редактировать</Text>
            </Pressable>
          ) : null}
          {showEdit && showDelete ? <View style={styles.menuDivider} /> : null}
          {showDelete ? (
            <Pressable onPress={() => onSelect("delete")} style={styles.menuItem}>
              <MaterialIcons name="delete-outline" size={20} color="#A85C5C" />
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>Удалить</Text>
            </Pressable>
          ) : null}
          {showReport ? (
            <Pressable onPress={() => onSelect("report")} style={styles.menuItem}>
              <MaterialIcons name="flag" size={20} color={BROWN_MUTED} />
              <Text style={styles.menuItemText}>Пожаловаться</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} style={styles.menuCancel}>
            <Text style={styles.menuCancelText}>Отмена</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

export function ClubComments({ postId, tags, createdAt, commentCount: commentCountProp }: ClubCommentsProps) {
  const { isAuthenticated, user } = useAuth();
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [menuCommentId, setMenuCommentId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const utils = trpc.useUtils();
  const community = isCommunityPost(tags);
  const open = areCommentsOpen(tags, createdAt);
  const until = commentsCloseAt(createdAt);
  const comments = trpc.club.comments.useQuery({ postId }, { enabled: community });
  const uploadPhoto = trpc.club.uploadCommentPhoto.useMutation();
  const add = trpc.club.addComment.useMutation({
    onSuccess: () => {
      setText("");
      setPhotos([]);
      setReplyTo(null);
      void utils.club.comments.invalidate({ postId });
    },
  });
  const update = trpc.club.updateComment.useMutation({
    onSuccess: () => {
      setEditingId(null);
      setEditText("");
      void utils.club.comments.invalidate({ postId });
    },
  });
  const remove = trpc.club.deleteComment.useMutation({
    onSuccess: () => {
      void utils.club.comments.invalidate({ postId });
    },
  });
  const report = trpc.club.reportComment.useMutation({
    onSuccess: () => {
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.alert("Жалоба отправлена. Спасибо!");
      }
    },
  });
  const toggleLike = trpc.club.toggleCommentLike.useMutation({
    onSuccess: () => {
      void utils.club.comments.invalidate({ postId });
    },
  });

  const tree = useMemo(() => {
    const rows = comments.data || [];
    const roots = rows.filter((c) => !c.parentId);
    const byParent = new Map<number, typeof rows>();
    for (const row of rows) {
      if (!row.parentId) continue;
      const list = byParent.get(row.parentId) || [];
      list.push(row);
      byParent.set(row.parentId, list);
    }
    return { roots, byParent };
  }, [comments.data]);

  if (!community) return null;

  const loadedCount = comments.data?.length ?? 0;
  const commentCount = commentCountProp ?? loadedCount;
  const untilLabel = until
    ? until.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
    : "";
  const staff = user?.role === "admin" || user?.role === "moderator";
  const menuComment = comments.data?.find((row) => row.id === menuCommentId) ?? null;
  const menuIsOwner = !!menuComment && user?.id === menuComment.userId;
  const menuIsStaffOther = !!menuComment && staff && user?.id !== menuComment.userId;

  const openPhotoViewer = (photoList: string[], index: number) => {
    setViewerPhotos(photoList);
    setViewerInitialIndex(index);
    setViewerVisible(true);
  };

  const handleMenuSelect = (action: MenuAction) => {
    const id = menuCommentId;
    setMenuCommentId(null);
    if (!id) return;
    if (action === "edit") {
      const row = comments.data?.find((c) => c.id === id);
      if (row) {
        setEditingId(id);
        setEditText(row.text);
      }
      return;
    }
    if (action === "delete") {
      confirmDelete(() => remove.mutate({ id }));
      return;
    }
    if (action === "report") {
      report.mutate({ id, reason: "Нарушение правил клуба" });
    }
  };

  const pickPhotos = async () => {
    if (photos.length >= 2) return;
    try {
      setUploading(true);
      const slots = 2 - photos.length;
      const uploaded: string[] = [];

      if (Platform.OS === "web") {
        const files = await pickWebFiles("image/jpeg,image/png,image/webp,image/*", slots > 1);
        for (const file of files.slice(0, slots)) {
          const payload = await fileToUpload(file);
          const result = await uploadPhoto.mutateAsync(payload);
          uploaded.push(result.url);
        }
      } else {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: slots > 1,
          selectionLimit: slots,
          quality: 0.75,
        });
        if (result.canceled || !result.assets?.length) return;
        for (const asset of result.assets.slice(0, slots)) {
          const base64 = await uriToBase64(asset.uri);
          const filename = asset.fileName || `comment_${Date.now()}.jpg`;
          const mimeType = asset.mimeType || "image/jpeg";
          const uploadResult = await uploadPhoto.mutateAsync({ base64, filename, mimeType });
          uploaded.push(uploadResult.url);
        }
      }

      if (uploaded.length) {
        setPhotos((prev) => [...prev, ...uploaded].slice(0, 2));
      }
    } finally {
      setUploading(false);
    }
  };

  const renderComment = (item: (typeof tree.roots)[number], depth = 0) => {
    const isEditing = editingId === item.id;
    const canOpenMenu =
      isAuthenticated && (user?.id === item.userId || staff || user?.id !== item.userId);

    return (
      <View key={item.id} style={depth > 0 ? styles.replyWrap : undefined}>
        <View style={styles.commentBlock}>
          <View style={styles.commentHeader}>
            <CommentAvatar name={item.authorName} avatarUrl={item.authorAvatarUrl ?? null} />
            <Text style={styles.author}>{item.authorName || "Участница"}</Text>
            {canOpenMenu ? (
              <Pressable onPress={() => setMenuCommentId(item.id)} hitSlop={8} style={styles.menuBtn}>
                <MaterialIcons name="more-vert" size={20} color={BROWN_MUTED} />
              </Pressable>
            ) : (
              <View style={styles.menuBtnPlaceholder} />
            )}
          </View>

          {isEditing ? (
            <View style={styles.editBlock}>
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                multiline
                maxLength={COMMENT_CHAR_LIMIT}
              />
              <Text style={[styles.charCount, editText.length > COMMENT_CHAR_LIMIT * 0.9 && styles.charCountWarn]}>
                {editText.length}/{COMMENT_CHAR_LIMIT}
              </Text>
              <View style={styles.editActions}>
                <Pressable onPress={() => { setEditingId(null); setEditText(""); }}>
                  <Text style={styles.editCancel}>Отмена</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    const value = editText.trim();
                    if (!value || update.isPending) return;
                    update.mutate({ id: item.id, text: value });
                  }}
                  disabled={update.isPending || !editText.trim()}
                  style={styles.editSave}
                >
                  {update.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.editSaveText}>Сохранить</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={styles.body} selectable={false}>
              {linkify(item.text)}
            </Text>
          )}

          {Array.isArray(item.photos) && item.photos.length > 0 ? (
            <View style={styles.photoRow}>
              {item.photos.slice(0, 2).map((uri, photoIndex, arr) => (
                <Pressable
                  key={uri}
                  onPress={() => openPhotoViewer(arr, photoIndex)}
                  style={styles.photoPressable}
                  accessibilityRole="button"
                  accessibilityLabel="Открыть фото"
                >
                  <Image source={{ uri }} style={styles.photo} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.footerRow}>
            <Pressable
              onPress={() => {
                if (!isAuthenticated) return;
                toggleLike.mutate({ commentId: item.id });
              }}
              style={styles.likeBtn}
              disabled={!isAuthenticated || toggleLike.isPending}
            >
              <MaterialIcons
                name={item.likedByMe ? "favorite" : "favorite-border"}
                size={18}
                color={item.likedByMe ? "#A85C5C" : BROWN_MUTED}
              />
              {item.likeCount > 0 ? <Text style={styles.likeCount}>{item.likeCount}</Text> : null}
            </Pressable>
            {open && isAuthenticated ? (
              <Pressable onPress={() => setReplyTo(item.id)}>
                <Text style={styles.replyBtn}>Ответить</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
        {(tree.byParent.get(item.id) || []).map((child) => renderComment(child, depth + 1))}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      {commentCount > 0 ? <Text style={styles.countHeading}>{commentCountLabel(commentCount)}</Text> : null}
      {open ? (
        <Text style={styles.meta}>Комментарии открыты до {untilLabel}</Text>
      ) : null}
      <View style={styles.commentList}>
        {tree.roots.map((item) => renderComment(item))}
      </View>
      {open && isAuthenticated ? (
        <View style={[styles.commentBlock, styles.composer]}>
          {replyTo ? (
            <Pressable onPress={() => setReplyTo(null)}>
              <Text style={styles.cancelReply}>Отмена ответа</Text>
            </Pressable>
          ) : null}
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={replyTo ? "Ваш ответ..." : "Написать комментарий..."}
            placeholderTextColor={BROWN_MUTED}
            maxLength={COMMENT_CHAR_LIMIT}
            multiline
          />
          <Text style={[styles.charCount, text.length > COMMENT_CHAR_LIMIT * 0.9 && styles.charCountWarn]}>
            {text.length}/{COMMENT_CHAR_LIMIT}
          </Text>
          {photos.length > 0 ? (
            <View style={styles.photoRow}>
              {photos.map((uri) => (
                <View key={uri} style={styles.draftPhotoWrap}>
                  <Image source={{ uri }} style={styles.photo} contentFit="cover" />
                  <Pressable onPress={() => setPhotos((prev) => prev.filter((p) => p !== uri))} style={styles.removePhoto}>
                    <Text style={styles.removePhotoText}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.composerActions}>
            <Pressable onPress={() => void pickPhotos()} disabled={uploading || photos.length >= 2} style={styles.attachBtn}>
              {uploading ? (
                <ActivityIndicator size="small" color={OLIVE} />
              ) : (
                <Text style={styles.attachBtnText}>Фото ({photos.length}/2)</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                const value = text.trim();
                if (!value || add.isPending) return;
                add.mutate({
                  postId,
                  text: value,
                  parentId: replyTo ?? undefined,
                  photos: photos.length ? photos : undefined,
                });
              }}
              disabled={add.isPending || !text.trim()}
              style={styles.send}
            >
              {add.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendText}>Отправить</Text>}
            </Pressable>
          </View>
        </View>
      ) : null}
      {open && !isAuthenticated ? (
        <Text style={styles.meta}>Войдите, чтобы оставить комментарий</Text>
      ) : null}
      {add.error ? <Text style={styles.error}>{add.error.message}</Text> : null}
      <CommentMenu
        visible={menuCommentId != null}
        showEdit={menuIsOwner}
        showDelete={menuIsOwner || menuIsStaffOther}
        showReport={!!menuComment && !menuIsOwner && !menuIsStaffOther}
        onClose={() => setMenuCommentId(null)}
        onSelect={handleMenuSelect}
      />
      <PhotoViewer
        visible={viewerVisible}
        photos={viewerPhotos}
        initialIndex={viewerInitialIndex}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, gap: 8 },
  countHeading: { fontSize: 15, fontFamily: "EBGaramond-SemiBold", color: BROWN },
  meta: { fontSize: 11, fontFamily: "EBGaramond-Italic", color: BROWN_MUTED },
  commentList: { gap: 10 },
  commentBlock: {
    backgroundColor: "#F5F0E6",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    overflow: "hidden",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 1px 4px rgba(92,64,51,0.07)" } as object)
      : {
          shadowColor: "#5C4033",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.07,
          shadowRadius: 3,
          elevation: 1,
        }),
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EDE6DA",
  },
  avatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8E2D8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 14,
    fontFamily: "EBGaramond-SemiBold",
    color: BROWN,
  },
  menuBtn: { padding: 2, marginLeft: "auto" },
  menuBtnPlaceholder: { width: 24, marginLeft: "auto" },
  replyWrap: { marginLeft: 14, marginTop: 8, gap: 8 },
  author: { fontSize: 14, fontFamily: "EBGaramond-SemiBold", color: BROWN, flex: 1 },
  body: { fontSize: 16, fontFamily: "EBGaramond-Regular", color: BROWN, lineHeight: 24 },
  link: { color: OLIVE, textDecorationLine: "underline" },
  photoRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  photoPressable: Platform.OS === "web" ? ({ cursor: "pointer" } as object) : {},
  photo: { width: 72, height: 72, borderRadius: 6, backgroundColor: "#EDE6DA" },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  likeCount: { fontSize: 12, fontFamily: "EBGaramond-SemiBold", color: BROWN_MUTED },
  replyBtn: { fontSize: 12, color: OLIVE, fontFamily: "EBGaramond-SemiBold" },
  composer: { gap: 6 },
  composerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  attachBtn: {
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  attachBtnText: { fontSize: 12, color: OLIVE, fontFamily: "EBGaramond-SemiBold" },
  draftPhotoWrap: { position: "relative" },
  removePhoto: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#A85C5C",
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoText: { color: "#fff", fontSize: 14, lineHeight: 16 },
  cancelReply: { fontSize: 11, color: BROWN_MUTED, fontFamily: "EBGaramond-Italic" },
  charCount: {
    alignSelf: "flex-end",
    fontSize: 11,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
  },
  charCountWarn: { color: "#A85C5C" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "web" ? 8 : 6,
    fontSize: 16,
    lineHeight: 22,
    color: BROWN,
    backgroundColor: "#fff",
    minHeight: 44,
  },
  editBlock: { gap: 6 },
  editInput: {
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    lineHeight: 22,
    color: BROWN,
    backgroundColor: "#fff",
    minHeight: 64,
  },
  editActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  editCancel: { fontSize: 12, color: BROWN_MUTED, fontFamily: "EBGaramond-SemiBold" },
  editSave: {
    backgroundColor: OLIVE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editSaveText: { color: "#fff", fontSize: 12, fontFamily: "EBGaramond-SemiBold" },
  send: {
    alignSelf: "flex-start",
    backgroundColor: OLIVE,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sendText: { color: "#fff", fontSize: 12, fontFamily: "EBGaramond-SemiBold" },
  error: { fontSize: 12, color: "#A85C5C" },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: "#FDF8F0",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "web" ? 16 : 28,
    gap: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  menuItemText: { fontSize: 16, fontFamily: "EBGaramond-Regular", color: BROWN },
  menuItemDanger: { color: "#A85C5C" },
  menuDivider: { height: 1, backgroundColor: "#E8E2D8" },
  menuCancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#E8E2D8",
  },
  menuCancelText: { fontSize: 16, fontFamily: "EBGaramond-SemiBold", color: BROWN_MUTED },
});
