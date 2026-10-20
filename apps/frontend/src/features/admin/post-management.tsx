"use client";
import classes from "./post-management.module.scss";
import { Dialog, Action, Typography, ScrollArea } from "@/shared/ui/elements";
import { useState, useCallback, useEffect, type ReactNode } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { trpc } from "@/shared/api/trpc";
import { useConfirmedAction } from "@/domain/session/use-confirmed-action";
import { useAuth } from "@/domain/session/session-context";
import { invalidResponse } from "@/shared/api/errors";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { useScreenActive } from "@/shared/navigation/screen-activity";
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
  blocked,
  status,
}: {
  visible: boolean;
  post: PostData | null;
  onClose: () => void;
  onSave: (tags: string[]) => void;
  blocked: boolean;
  status: ReactNode;
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
    if (!blocked) onSave(selectedTags);
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
            disabled={blocked}
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
            disabled={blocked}
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

        {status}
        <ScrollArea
          inert={blocked}
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
  const { isOwner, user } = useAuth();
  const active = useScreenActive();
  const actions = useConfirmedAction(isOwner && active && !editModalVisible);
  const assertReadCurrent = (signal: AbortSignal) => {
    signal.throwIfAborted();
    if (!user?.id || !isPersonalDataOwner(user.id))
      throw new DOMException("Операция отменена", "AbortError");
  };
  const readPost = async (id: number, signal: AbortSignal) => {
    assertReadCurrent(signal);
    const post = await utils.client.admin.postDetail.query({ id }, { signal });
    assertReadCurrent(signal);
    if (
      post !== null &&
      (!post ||
        post.id !== id ||
        !Array.isArray(post.tags) ||
        post.tags.some((tag) => typeof tag !== "string"))
    )
      throw invalidResponse();
    return post;
  };
  const refreshPosts = (id: number) => {
    void utils.admin.postDetail.invalidate({ id });
    void utils.admin.postsPage.invalidate();
    void utils.admin.postCounts.invalidate();
    void utils.admin.postCalendar.invalidate();
    void utils.admin.stats.invalidate();
    void utils.feed.getById.invalidate({ id });
    void utils.feed.list.invalidate();
    void utils.feed.listPaginated.invalidate();
    void utils.club.list.invalidate();
    onRefresh();
  };
  const closePost = () => {
    setActivePost(null);
    setEditModalVisible(false);
    setTagModalVisible(false);
    setActionSheetVisible(false);
  };
  const inspectTags = async (id: number, signal: AbortSignal) => {
    const post = await readPost(id, signal);
    assertReadCurrent(signal);
    if (post === null) closePost();
    else
      setActivePost((current) =>
        current?.id === id &&
        (current.tags.length !== post.tags.length ||
          current.tags.some((tag, index) => tag !== post.tags[index]))
          ? { ...current, tags: post.tags }
          : current,
      );
    refreshPosts(id);
  };
  const inspectDeletion = async (id: number, signal: AbortSignal) => {
    if ((await readPost(id, signal)) !== null) throw invalidResponse();
    assertReadCurrent(signal);
    closePost();
    refreshPosts(id);
  };
  const updateMutation = {
    isPending: actions.blocked,
    mutate: (input: { id: number; tags: string[] }) =>
      void actions.run({
        kind: "tags",
        label: "Сохранить теги",
        read: (signal) => inspectTags(input.id, signal),
        perform: (signal) =>
          utils.client.admin.updatePost.mutate(input, { signal }),
        validate: (result) => {
          if (result?.success !== true) throw invalidResponse();
        },
        commit: () => {
          setActivePost((current) =>
            current?.id === input.id
              ? { ...current, tags: input.tags }
              : current,
          );
          refreshPosts(input.id);
          setTagModalVisible(false);
        },
      }),
  };
  const deleteMutation = {
    isPending: actions.blocked,
    mutate: (input: { id: number }) =>
      void actions.run({
        kind: "delete",
        label: "Удалить пост",
        read: (signal) => inspectDeletion(input.id, signal),
        perform: async (signal) => {
          await utils.client.admin.deletePost.mutate(input, { signal });
          if ((await readPost(input.id, signal)) !== null)
            throw invalidResponse();
        },
        validate: () => {},
        commit: () => {
          closePost();
          refreshPosts(input.id);
        },
      }),
  };
  const openMenu = useCallback(
    (post: PostData) => {
      if (actions.blocked) return;
      setActivePost(post);
      setActionSheetVisible(true);
    },
    [actions.blocked],
  );
  const closeMenu = useCallback(() => {
    setActionSheetVisible(false);
  }, []);
  const handleAction = (action: MenuAction) => {
    if (actions.blocked) return;
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
  };
  const handleTagsSave = (tags: string[]) => {
    if (activePost) {
      updateMutation.mutate({ id: activePost.id, tags });
    }
  };
  const status = (
    <>
      {actions.operation.busy ? (
        <Typography role="status">
          {actions.operation.kind === "check"
            ? "Проверяем публикации…"
            : "Сохраняем изменения…"}
        </Typography>
      ) : null}
      {actions.error ? (
        <Typography role="alert">{actions.error}</Typography>
      ) : null}
      {actions.unknown && !actions.operation.busy ? (
        <Action onClick={() => void actions.check()}>
          Обновить публикации
        </Action>
      ) : null}
    </>
  );
  // Render stable component types: action-state changes must not remount the editor.
  const ManagementModals = (
    <>
      {!tagModalVisible && (actions.error || actions.unknown) ? (
        <Dialog
          label="Результат действия с публикацией"
          open
          onClose={() => {
            if (!actions.unknown) actions.setError(null);
          }}
        >
          <div className={classes.modalContainer}>
            {status}
            {!actions.unknown ? (
              <Action onClick={() => actions.setError(null)}>Закрыть</Action>
            ) : null}
          </div>
        </Dialog>
      ) : null}
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
                  media: activePost.media,
                }
              : null
          }
        />
      ) : null}
      <TagSelectionModal
        visible={tagModalVisible}
        post={activePost}
        onClose={() => {
          if (!actions.blocked) setTagModalVisible(false);
        }}
        onSave={handleTagsSave}
        blocked={actions.blocked}
        status={status}
      />
    </>
  );
  return {
    openMenu,
    ManagementModals,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
