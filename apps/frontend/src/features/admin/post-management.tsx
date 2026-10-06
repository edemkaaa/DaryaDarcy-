"use client";
import classes from "./post-management.module.scss";
import { Dialog, Action, Typography, ScrollArea } from "@/shared/ui/elements";
import { useState, useCallback, useEffect } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { trpc } from "@/shared/api/trpc";
import dynamic from "next/dynamic";
const CreatePostModal = dynamic(
  () => import("./create-post-modal").then((m) => m.CreatePostModal),
  { ssr: false },
);
import type { RichTextBlock } from "@/domain/content/types";
import { BROWN_DARK, GREEN_ACCENT, ALL_TAGS } from "./post-management.content";
interface PostData {
  id: number;
  text: string;
  photos: string[];
  tags: string[];
  richText?: RichTextBlock[] | null;
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
  target?: "feed" | "club" | "both";
  media?: {
    id: number;
    type: string;
    url: string;
    filename?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
    duration?: number | null;
  }[];
}
type MenuAction = "edit" | "tags" | "delete";
function ActionSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: MenuAction) => void;
}) {
  if (!visible) return null;
  return (
    <Dialog
      label="Действия с публикацией"
      open={visible}
      motion="fade"
      onClose={onClose}
    >
      <div
        onClick={onClose}
        className={["ui-stack ", classes.actionSheetOverlay]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className={["ui-stack ", classes.actionSheetContainer]
            .filter(Boolean)
            .join(" ")}
        >
          <div
            className={["ui-stack ", classes.actionSheetContent]
              .filter(Boolean)
              .join(" ")}
          >
            <Action
              onClick={() => onSelect("edit")}
              className={({ pressed }) =>
                [
                  classes.actionSheetItemPressed,
                  pressed ? classes.backgroundColorState : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <MaterialIcons name="edit" size={20} color={GREEN_ACCENT} />
              <Typography className={classes.actionSheetText}>
                Редактировать пост
              </Typography>
            </Action>
            <div
              className={["ui-stack ", classes.actionSheetDivider]
                .filter(Boolean)
                .join(" ")}
            />
            <Action
              onClick={() => onSelect("tags")}
              className={({ pressed }) =>
                [
                  classes.actionSheetItemPressed,
                  pressed ? classes.backgroundColorState2 : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <MaterialIcons name="label" size={20} color={GREEN_ACCENT} />
              <Typography className={classes.actionSheetText}>
                Выбрать хештеги
              </Typography>
            </Action>
            <div
              className={["ui-stack ", classes.actionSheetDivider]
                .filter(Boolean)
                .join(" ")}
            />
            <Action
              onClick={() => onSelect("delete")}
              className={({ pressed }) =>
                [
                  classes.actionSheetItemPressed,
                  pressed ? classes.backgroundColorState3 : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <MaterialIcons name="delete-outline" size={20} color="#A85C5C" />
              <Typography className={classes.typography}>
                Удалить пост
              </Typography>
            </Action>
          </div>
          <Action
            onClick={onClose}
            className={({ pressed }) =>
              [
                classes.actionSheetItemPressed2,
                pressed
                  ? classes.backgroundColorState4
                  : classes.backgroundColorState5,
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            <Typography className={classes.actionSheetCancelText}>
              Отмена
            </Typography>
          </Action>
        </div>
      </div>
    </Dialog>
  );
}
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
  const [selectedTags, setSelectedTags] = useState<string[]>(post?.tags || []);
  // Reset when post changes
  useEffect(() => {
    if (post) {
      setSelectedTags([...post.tags]);
    }
  }, [post]);
  const toggleTag = (slug: string) => {
    setSelectedTags((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug],
    );
  };
  const handleSave = () => {
    onSave(selectedTags);
  };
  if (!visible || !post) return null;
  return (
    <Dialog label="Теги публикации" open motion="slide" onClose={onClose}>
      <div
        className={["ui-stack ", classes.modalContainer]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className={["ui-stack ", classes.modalHeader]
            .filter(Boolean)
            .join(" ")}
        >
          <Action
            aria-label="Закрыть редактор тегов"
            onClick={onClose}
            className={({ pressed }) =>
              pressed ? classes.opacityState : classes.opacityState2
            }
          >
            <MaterialIcons name="close" size={24} color={BROWN_DARK} />
          </Action>
          <Typography className={classes.modalTitle}>Хештеги</Typography>
          <Action
            onClick={handleSave}
            className={({ pressed }) =>
              [
                classes.action,
                pressed ? classes.opacityState3 : classes.opacityState4,
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            <Typography className={classes.saveBtnText}>Сохранить</Typography>
          </Action>
        </div>

        <ScrollArea
          className={classes.formScroll}
          contentClassName={classes.formContent}
        >
          <Typography className={classes.tagHint}>
            Выберите подходящие хештеги для поста
          </Typography>
          <div
            className={["ui-stack ", classes.tagsGrid]
              .filter(Boolean)
              .join(" ")}
          >
            {ALL_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag.slug);
              return (
                <Action
                  key={tag.slug}
                  onClick={() => toggleTag(tag.slug)}
                  className={[
                    classes.tagChipRubricSelected,
                    tag.rubric && isSelected
                      ? classes.appearanceState
                      : isSelected
                        ? classes.appearanceState2
                        : tag.rubric
                          ? classes.appearanceState3
                          : classes.appearanceState4,
                    tag.rubric
                      ? classes.borderWidthState
                      : classes.borderWidthState2,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <Typography
                    className={[
                      classes.tagChipTextSelected,
                      tag.rubric ? classes.fontWeightState : "",
                      tag.rubric
                        ? classes.fontFamilyState
                        : classes.fontFamilyState2,
                      isSelected ? classes.colorState : classes.colorState2,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {tag.label}
                  </Typography>
                </Action>
              );
            })}
          </div>
          {selectedTags.length > 0 && (
            <Typography className={classes.tagCount}>
              Выбрано: {selectedTags.length}
            </Typography>
          )}
        </ScrollArea>
      </div>
    </Dialog>
  );
}
export function usePostManagement(onRefresh: () => void) {
  const utils = trpc.useUtils();
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [activePost, setActivePost] = useState<PostData | null>(null);
  const updateMutation = trpc.admin.updatePost.useMutation({
    onSuccess: () => {
      onRefresh();
      setEditModalVisible(false);
      setTagModalVisible(false);
    },
    onError: (err) => {
      const message = err.message || "Не удалось сохранить изменения";
      window.alert(message);
    },
  });
  const deleteMutation = trpc.admin.deletePost.useMutation({
    onSuccess: async () => {
      setActivePost(null);
      setEditModalVisible(false);
      setTagModalVisible(false);
      setActionSheetVisible(false);
      await utils.feed.listPaginated.invalidate();
      onRefresh();
    },
    onError: (err) => {
      const message = err.message || "Не удалось удалить пост";
      window.alert(message);
    },
  });
  const openMenu = useCallback((post: PostData) => {
    setActivePost(post);
    setActionSheetVisible(true);
  }, []);
  const closeMenu = useCallback(() => {
    setActionSheetVisible(false);
  }, []);
  const handleAction = useCallback(
    (action: MenuAction) => {
      setActionSheetVisible(false);
      if (action === "edit") {
        setEditModalVisible(true);
      } else if (action === "tags") {
        setTagModalVisible(true);
      } else if (action === "delete") {
        {
          if (confirm("Удалить этот пост? Это действие нельзя отменить.")) {
            if (activePost) {
              deleteMutation.mutate({ id: activePost.id });
            }
          }
        }
      }
    },
    [activePost, deleteMutation],
  );
  const handleTagsSave = useCallback(
    (tags: string[]) => {
      if (activePost) {
        updateMutation.mutate({ id: activePost.id, tags });
      }
    },
    [activePost, updateMutation],
  );
  const ManagementModals = useCallback(
    () => (
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
            editingPost={
              activePost
                ? {
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
                    createdAt: activePost.createdAt
                      ? new Date(activePost.createdAt).toISOString()
                      : null,
                    richText: activePost.richText ?? null,
                    media: activePost.media ?? [],
                  }
                : null
            }
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
    [
      actionSheetVisible,
      editModalVisible,
      tagModalVisible,
      activePost,
      closeMenu,
      handleAction,
      handleTagsSave,
    ],
  );
  return {
    openMenu,
    ManagementModals,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
