"use client";
/** Действия над постом из карточки читают серверную версию и используют общий редактор, сохраняя состояние списка владельцу экрана. */
import classes from "./post-management.module.scss";
import { Dialog, Action, Typography, ScrollArea } from "@/shared/ui/elements";
import { StatusNotice, StatusNoticeAction } from "@/shared/ui/status-notice";
import { useState, useCallback, useEffect, type ReactNode } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { trpc } from "@/shared/api/trpc";
import { useConfirmedAction } from "@/domain/session/use-confirmed-action";
import { useAuth } from "@/domain/session/session-context";
import { getHttpStatus, invalidResponse } from "@/shared/api/errors";
import { isPersonalDataOwner, requiredStorage } from "@/shared/browser/storage";
import {
  readEditRevision,
  withExpectedRevision,
} from "@/domain/content/edit-revision";
import { EditComparison } from "./edit-comparison";
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
  status?: "draft" | "scheduled" | "published";
  scheduledAt?: string | Date | null;
  sortOrder?: number;
  editRevision?: string;
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
const tagDraftKey = (owner: number, post: number) =>
  /* Изолирует быстрый черновик тегов одновременно по владельцу и посту. */ `darcy:tag-draft:${owner}:${post}`;
function ActionSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (action: MenuAction) => void;
}) {
  // Меню выбирает намерение; редактирование и удаление затем проходят чтение и подтверждение у владельца hook.

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
            activeOpacity={1}
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
  acceptedRevision,
}: {
  visible: boolean;
  post: PostData | null;
  onClose: () => void;
  onSave: (tags: string[], revision?: string) => void;
  blocked: boolean;
  status: ReactNode;
  acceptedRevision?: string;
}) {
  // Хранит локальные теги вместе с исходной ревизией; ошибка storage блокирует отправку вместо потери выбранного набора.

  const { user } = useAuth();
  const key = user && post ? tagDraftKey(user.id, post.id) : "";
  const [draft, setDraft] = useState<{
    tags: string[];
    originalTags: string[];
    revision?: string;
    loadError?: string;
  }>(() => {
    try {
      const raw = key ? requiredStorage.getItem(key) : null;
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          !Array.isArray(saved.tags) ||
          !saved.tags.every((tag: unknown) => typeof tag === "string") ||
          !Array.isArray(saved.originalTags) ||
          !saved.originalTags.every(
            (tag: unknown) => typeof tag === "string",
          ) ||
          (saved.revision !== undefined &&
            (typeof saved.revision !== "string" || !saved.revision.length))
        )
          throw new Error("Повреждён черновик тегов");
        return saved as {
          tags: string[];
          originalTags: string[];
          revision?: string;
        };
      }
    } catch {
      return {
        tags: post?.tags ?? [],
        originalTags: post?.tags ?? [],
        loadError:
          "Не удалось прочитать прежний черновик тегов. Не закрывайте редактор; проверьте хранение данных сайта и перезагрузите страницу.",
      };
    }
    return {
      tags: post?.tags ?? [],
      originalTags: post?.tags ?? [],
      revision: post ? readEditRevision(post) : undefined,
    };
  });
  const [storageError, setStorageError] = useState<string | null>(null);
  useEffect(() => {
    // Только явное принятие серверной ревизии меняет базу следующего сохранения тегов.

    if (acceptedRevision)
      setDraft((current) => ({ ...current, revision: acceptedRevision }));
  }, [acceptedRevision]);
  useEffect(() => {
    // Сохраняет локальный черновик с ревизией при изменении; повреждённый исходный снимок не заменяется молча.

    if (!key) return;
    if (draft.loadError) {
      setStorageError(draft.loadError);
      return;
    }
    try {
      requiredStorage.setItem(key, JSON.stringify(draft));
      setStorageError(null);
    } catch {
      setStorageError(
        "Черновик тегов не сохранён. Разрешите хранение данных сайта и не закрывайте редактор.",
      );
    }
  }, [draft, key]);
  const selectedTags = draft.tags;
  const toggleTag = (slug: string) => {
    // Обновляет только локальный набор slug, оставляя исходные теги для сравнения.

    setDraft((prev) => ({
      ...prev,
      tags: prev.tags.includes(slug)
        ? prev.tags.filter((t) => t !== slug)
        : [...prev.tags, slug],
    }));
  };
  const handleSave = () => {
    // Сначала подтверждает локальную запись черновика, затем передаёт теги и ожидаемую ревизию в mutation.

    if (blocked || !key || draft.loadError) return;
    try {
      requiredStorage.setItem(key, JSON.stringify(draft));
      setStorageError(null);
      onSave(selectedTags, draft.revision);
    } catch {
      setStorageError(
        "Не удалось сохранить черновик тегов. Запрос не отправлен.",
      );
    }
  };
  if (!visible || !post) return null;
  return (
    <Dialog label="Теги публикации" open motion="slide" onClose={onClose}>
      {storageError && <StatusNotice tone="error">{storageError}</StatusNotice>}
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
  // Общий контроль действий карточки разделяет полное редактирование, теги и удаление с восстановлением неизвестного исхода.

  const utils = trpc.useUtils();
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [activePost, setActivePost] = useState<PostData | null>(null);
  const [tagConflict, setTagConflict] = useState(false);
  const [tagServer, setTagServer] = useState<Record<string, unknown>>();
  const [acceptedTagRevision, setAcceptedTagRevision] = useState<string>();
  const { isOwner, user } = useAuth();
  const active = useScreenActive();
  const actions = useConfirmedAction(isOwner && active && !editModalVisible);
  const assertReadCurrent = (signal: AbortSignal) => {
    // Отмена или смена владельца не позволяет позднему чтению обновлять чужую карточку.

    signal.throwIfAborted();
    if (!user?.id || !isPersonalDataOwner(user.id))
      throw new DOMException("Операция отменена", "AbortError");
  };
  const readPost = async (id: number, signal: AbortSignal) => {
    // Проверяет ID, теги и ревизию полного административного ответа; null означает удаление, а не ошибку сети.

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
    if (post) readEditRevision(post);
    return post;
  };
  const refreshPosts = (id: number) => {
    // Обновляет краткие страницы, агрегаты и пользовательские карточки, включая URL по ID и UUID.

    void utils.admin.postDetail.invalidate({ id });
    void utils.admin.postsPage.invalidate();
    void utils.admin.postCounts.invalidate();
    void utils.admin.postCalendar.invalidate();
    void utils.admin.stats.invalidate();
    // Одна публикация может быть закэширована по старой ссылке и по UUID.
    void utils.feed.getById.invalidate();
    void utils.feed.list.invalidate();
    void utils.feed.listPaginated.invalidate();
    void utils.club.listByCategory.invalidate();
    onRefresh();
  };
  const closePost = () => {
    // Закрывает относящиеся к выбранному посту диалоги после подтверждённого результата.

    setActivePost(null);
    setEditModalVisible(false);
    setTagModalVisible(false);
    setActionSheetVisible(false);
  };
  const inspectTags = async (
    id: number,
    signal: AbortSignal,
    wanted?: string[],
  ) => {
    // Сравнивает желаемый набор с реально прочитанными тегами; только совпадение закрывает форму и очищает локальную копию.

    const post = await readPost(id, signal);
    assertReadCurrent(signal);
    if (post === null) closePost();
    else if (
      wanted &&
      JSON.stringify([...post.tags].sort()) ===
        JSON.stringify([...wanted].sort())
    ) {
      if (user) {
        try {
          requiredStorage.removeItem(tagDraftKey(user.id, id));
        } catch {
          /* The confirmed result must still close this editor. */
        }
      }
      setTagModalVisible(false);
      setTagConflict(false);
      actions.setError(null);
    } else
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
    // Подтверждает удаление по null полной детализации, не по исчезновению карточки из текущей страницы.

    if ((await readPost(id, signal)) !== null) throw invalidResponse();
    assertReadCurrent(signal);
    closePost();
    refreshPosts(id);
  };
  // Теги сохраняются с ревизией; после таймаута читаем тот же пост и сравниваем набор, не повторяя update.
  const updateMutation = {
    isPending: actions.blocked,
    mutate: (input: { id: number; tags: string[] }) =>
      /* Запускает одну операцию обновления тегов с чтением исходного поста для восстановления. */ void actions.run({
        kind: "tags",
        label: "Сохранить теги",
        read: (signal) => /* Проверяет желаемые теги исходной команды без повторного update. */ inspectTags(input.id, signal, input.tags),
        perform: async (signal) => {
          // Отправляет теги с ревизией и проверяет существование поста; конфликт оставляет локальный ввод для сравнения.

          try {
            const result = await utils.client.admin.updatePost.mutate(input, {
              signal,
            });
            if (!(await readPost(input.id, signal))) throw invalidResponse();
            return result;
          } catch (cause) {
            if (getHttpStatus(cause) === 409 || getHttpStatus(cause) === 412)
              setTagConflict(true);
            throw cause;
          }
        },
        validate: (result) => {
          // Квитанция update должна явно подтверждать success, иначе результат остаётся неопределённым.

          if (result?.success !== true) throw invalidResponse();
        },
        commit: () => {
          // После подтверждения снимает локальный черновик и обновляет только теги выбранного поста.

          if (user) {
            try {
              requiredStorage.removeItem(tagDraftKey(user.id, input.id));
            } catch {
              /* Keep the confirmed mutation terminal. */
            }
          }
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
      /* Удаление проходит отдельный подтверждаемый путь, блокируя повтор при неизвестном ответе. */ void actions.run({
        kind: "delete",
        label: "Удалить пост",
        read: (signal) => /* Проверяет отсутствие исходного ID после прерванного удаления. */ inspectDeletion(input.id, signal),
        perform: async (signal) => {
          // После delete перечитывает детализацию и требует её отсутствия.

          await utils.client.admin.deletePost.mutate(input, { signal });
          if ((await readPost(input.id, signal)) !== null)
            throw invalidResponse();
        },
        validate: () => {
          // Возвращаемого payload нет: подтверждение отсутствия уже выполнено внутри perform.
},
        commit: () => {
          // Закрывает выбранный пост и обновляет связанные списки только после проверки удаления.

          closePost();
          refreshPosts(input.id);
        },
      }),
  };
  const openMenu = useCallback(
    (post: PostData) => {
      // Не открывает новую карточку поверх неподтверждённого административного действия.

      if (actions.blocked) return;
      setActivePost(post);
      setActionSheetVisible(true);
    },
    [actions.blocked],
  );
  const closeMenu = useCallback(() => {
    // Закрывает только меню выбора, сохраняя контекст выбранного поста.

    setActionSheetVisible(false);
  }, []);
  const handleAction = async (action: MenuAction) => {
    // Для правки сначала читает полные media и ревизию; удаление отдельно требует согласия.

    if (actions.blocked) return;
    setActionSheetVisible(false);
    if (action === "edit" || action === "tags") {
      if (!activePost) return;
      const task = actions.operation.begin("read-post");
      if (!task) return;
      try {
        const full = await readPost(activePost.id, task.signal);
        task.assertCurrent();
        if (!full || !Array.isArray(full.media)) throw invalidResponse();
        setActivePost({ ...full, editRevision: readEditRevision(full) });
        setTagConflict(false);
        setTagServer(undefined);
        setAcceptedTagRevision(undefined);
        if (action === "edit") setEditModalVisible(true);
        else setTagModalVisible(true);
      } catch (cause) {
        if (task.isCurrent())
          actions.setError(
            cause instanceof Error
              ? cause.message
              : "Не удалось открыть публикацию",
          );
      } finally {
        task.finish();
      }
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
  const handleTagsSave = (tags: string[], revision?: string) => {
    // Передаёт исходную ожидаемую ревизию вместе с тегами, не выдумывая её из краткой карточки.

    if (activePost) {
      const input = withExpectedRevision({ id: activePost.id, tags }, revision);
      updateMutation.mutate(input);
    }
  };
  const compareTags = async () => {
    // Сопоставляет локальный набор с сервером и либо подтверждает совпадение, либо оставляет новую версию для явного принятия.

    if (!activePost) return;
    const task = actions.operation.begin("compare-tags");
    if (!task) return;
    try {
      const detail = await readPost(activePost.id, task.signal);
      task.assertCurrent();
      if (!detail)
        throw new Error("Публикация удалена. Черновик тегов сохранён.");
      if (user) {
        const local = JSON.parse(
          requiredStorage.getItem(tagDraftKey(user.id, activePost.id)) ?? "{}",
        );
        if (
          Array.isArray(local.tags) &&
          JSON.stringify([...local.tags].sort()) ===
            JSON.stringify([...detail.tags].sort())
        ) {
          try {
            requiredStorage.removeItem(tagDraftKey(user.id, activePost.id));
          } catch {
            /* Keep the read-confirmed result terminal. */
          }
          setTagModalVisible(false);
          setTagConflict(false);
          actions.setError(null);
          return;
        }
      }
      setTagServer(detail);
    } catch (cause) {
      if (task.isCurrent())
        actions.setError(
          cause instanceof Error
            ? cause.message
            : "Не удалось прочитать публикацию",
        );
    } finally {
      task.finish();
    }
  };
  // Конфликт, неизвестный исход и выполняющееся действие отображаются раздельно; ни одно чтение не заменяет ввод без согласия.
  const status = (
    <>
      {actions.operation.busy ? (
        <StatusNotice>
          {actions.operation.kind === "check"
            ? "Проверяем публикации…"
            : "Сохраняем изменения…"}
        </StatusNotice>
      ) : null}
      {actions.error ? (
        <StatusNotice tone="error">{actions.error}</StatusNotice>
      ) : null}
      {tagModalVisible && tagConflict ? (
        <EditComparison
          current={{
            tags:
              user && activePost
                ? (() => {
                    try {
                      return JSON.parse(
                        requiredStorage.getItem(
                          tagDraftKey(user.id, activePost.id),
                        ) ?? "{}",
                      ).tags;
                    } catch {
                      return activePost.tags;
                    }
                  })()
                : [],
          }}
          server={tagServer ? { tags: tagServer.tags } : undefined}
          busy={actions.operation.busy}
          onRead={() => void compareTags()}
          onAccept={
            tagServer
              ? () => {
                  const revision = readEditRevision(tagServer);
                  if (!revision) {
                    actions.setError(
                      "Сервер пока не передаёт версию публикации. Черновик тегов сохранён.",
                    );
                    return;
                  }
                  if (
                    window.confirm(
                      "Использовать выбранные вами теги относительно показанной версии? Сохранение потребуется нажать отдельно.",
                    )
                  ) {
                    setAcceptedTagRevision(revision);
                    setTagConflict(false);
                    actions.setError(null);
                  }
                }
              : undefined
          }
        />
      ) : null}
      {actions.unknown && !actions.operation.busy ? (
        <StatusNoticeAction onClick={() => void actions.check()}>
          Обновить публикации
        </StatusNoticeAction>
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
              <StatusNoticeAction onClick={() => actions.setError(null)}>
                Закрыть
              </StatusNoticeAction>
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
                  editRevision: activePost.editRevision,
                  status: activePost.status ?? "published",
                  target: activePost.target || "feed",
                  scheduledAt: activePost.scheduledAt
                    ? new Date(activePost.scheduledAt).toISOString()
                    : null,
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
      {tagModalVisible && (
        <TagSelectionModal
          key={`${user?.id}:${activePost?.id}`}
          visible={tagModalVisible}
          post={activePost}
          onClose={() => {
            if (!actions.blocked) setTagModalVisible(false);
          }}
          onSave={handleTagsSave}
          blocked={actions.blocked || tagConflict}
          acceptedRevision={acceptedTagRevision}
          status={status}
        />
      )}
    </>
  );
  return {
    openMenu,
    ManagementModals,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
