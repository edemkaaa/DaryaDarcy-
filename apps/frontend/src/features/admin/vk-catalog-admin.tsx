"use client";
/** Операции каталога VK учитывают ревизии и сохранённый черновик, отделяя обновление данных ролика от обычного списка постов. */
import { useEffect, useState } from "react";
import { useAuth } from "@/domain/session/session-context";
import {
  useSessionOperation,
  checkOperationAccessError,
} from "@/domain/session/use-session-operation";
import { trpc } from "@/shared/api/trpc";
import {
  getHttpStatus,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";
import { Action, Field, ScrollArea, Typography } from "@/shared/ui/elements";
import { StatusNotice, StatusNoticeAction } from "@/shared/ui/status-notice";
import {
  isVideoThumbnailsEnabled,
  parseVkEditorDetail,
  requireVkVideoId,
  getVkCatalogEmbedUrl,
} from "@/features/videos/catalog-api";
import {
  VkEditorDraftStore,
  emptyVkEditorDraft,
  draftFromVkDetail,
  vkEditorPayload,
  reviewVkDraft,
  reconcileVkDraft,
  type VkEditorDraft,
} from "./vk-editor-draft";
import { VkVideoField } from "./vk-video-field";
import classes from "./articles-admin.module.scss";

export function VkCatalogAdmin() {
  // Монтирует редактор только владельцу интерфейса и заново создаёт его область при смене аккаунта.

  const { user, isOwner } = useAuth();
  return user && isOwner ? <Editor key={user.id} ownerId={user.id} /> : null;
}
function Editor({ ownerId }: { ownerId: number }) {
  // Разделяет новое VK-видео, изменение по ID и проверку серверной ревизии; черновик хранится в текущей вкладке.

  const auth = useAuth();
  const utils = trpc.useUtils();
  const operation = useSessionOperation(
    !auth.loading && !auth.error && !auth.refreshError,
  );
  const [store] = useState(() => new VkEditorDraftStore(ownerId));
  const [draft, setDraft] = useState(() => emptyVkEditorDraft(ownerId));
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [error, setError] = useState("");
  const thumbnailsEnabled = isVideoThumbnailsEnabled();
  const restore = () => {
    // Повторяет чтение tab-local черновика; ошибка storage блокирует новую отправку вместо сброса введённых данных.

    try {
      setDraft(store.read() ?? emptyVkEditorDraft(ownerId));
      setLoaded(true);
      setStorageError("");
    } catch (cause) {
      setStorageError(
        cause instanceof Error
          ? cause.message
          : "Не удалось прочитать черновик VK.",
      );
    }
  };
  useEffect(() => {
    // Читает tab-local черновик после монтирования; закрытая область не принимает отложенный результат.

    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      try {
        setDraft(store.read() ?? emptyVkEditorDraft(ownerId));
        setLoaded(true);
      } catch (cause) {
        setStorageError(
          cause instanceof Error
            ? cause.message
            : "Не удалось прочитать черновик VK.",
        );
      }
    });
    return () => {
      live = false;
    };
  }, [store, ownerId]);
  const remember = (next: VkEditorDraft) => {
    // Показывает свежий ввод, но разрешает отправку только после подтверждённой записи durable копии в storage.

    setDraft(next);
    try {
      store.save(next);
      setStorageError("");
      return true;
    } catch (cause) {
      setStorageError(
        cause instanceof Error
          ? cause.message
          : "Не удалось сохранить черновик VK.",
      );
      return false;
    }
  };
  const change = (patch: Partial<VkEditorDraft>) => {
    // Сохраняет изменение поля вместе с остальными данными и сбрасывает старое сообщение об ошибке.

    remember({ ...draft, ...patch });
    setError("");
  };
  // После неизвестного сохранения поля заморожены до проверки: иначе повтор мог бы превратиться в другую запись.
  const locked = !loaded || operation.busy || draft.state !== "draft";
  const fieldsLocked = locked || (draft.editing && !draft.base);
  const reset = () => {
    // Явный отказ очищает только черновик этой вкладки и требует согласия при наличии ввода или неопределённой записи.

    if (
      (draft.title || draft.base || draft.state !== "draft" || storageError) &&
      !window.confirm("Удалить черновик VK из этой вкладки и очистить форму?")
    )
      return;
    if (remember(emptyVkEditorDraft(ownerId))) {
      setLoaded(true);
      setError("");
    }
  };
  const read = async (savedId?: number) => {
    // Проверяет корректный ID и тип VK; новую серверную версию сначала показывает для сверки, не подменяя базу изменения.

    if (
      !savedId &&
      !draft.base &&
      (draft.title || draft.embedUrl) &&
      !window.confirm(
        "Загрузить данные указанного видео вместо текущего ввода?",
      )
    )
      return;
    const id = savedId ?? Number(draft.id);
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      (!savedId && !/^[1-9]\d*$/.test(draft.id))
    ) {
      setError("Укажите корректный ID видео VK.");
      return;
    }
    const task = operation.begin("read-vk-video");
    if (!task) return;
    setError("");
    try {
      const current = parseVkEditorDetail(
        await utils.client.admin.vkVideoDetail.query(
          { id },
          { signal: task.signal },
        ),
        id,
      );
      task.assertCurrent();
      remember(
        draft.base && !savedId
          ? reviewVkDraft(draft, current)
          : draftFromVkDetail(ownerId, current),
      );
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent())
        setError(
          getHttpStatus(cause) === 404
            ? "Видео с таким ID не найдено или не является VK-видео. Новая запись вместо него не создаётся."
            : getRequestErrorMessage(cause),
        );
    } finally {
      task.finish();
    }
  };
  const save = async () => {
    // До отправки сохраняет неизменяемый payload; конфликт требует чтения ревизии, неизвестный ответ сохраняет исходные данные для восстановления.

    let payload;
    try {
      payload = vkEditorPayload(draft, thumbnailsEnabled);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : getRequestErrorMessage(cause),
      );
      return;
    }
    const task = operation.begin("save-vk-video");
    if (!task) return;
    const started = {
      ...draft,
      state: "uncertain" as const,
      review: null,
      writePayload: payload,
    };
    setError("");
    try {
      if (!remember(started)) return;
      task.assertCurrent();
      const saved = requireVkVideoId(
        await utils.client.admin.upsertVkVideo.mutate(payload, {
          signal: task.signal,
        }),
      );
      task.assertCurrent();
      if (payload.id !== undefined && saved !== payload.id)
        throw invalidResponse();
      remember({ ...started, state: "saved", savedId: saved });
      await Promise.all([
        utils.videos.catalog.invalidate(),
        utils.invalidate(undefined, {
          predicate: (query) =>
            /* Инвалидирует карточки и playback каталога после подтверждённого сохранения, не сбрасывая несвязанные запросы. */ ["video-card", "video-playback"].includes(
              String(query.queryKey[0]),
            ),
        }),
      ]);
    } catch (cause) {
      checkOperationAccessError(cause);
      if (!task.isCurrent()) return;
      const status = getHttpStatus(cause);
      if (payload.id !== undefined && (status === 409 || status === 412)) {
        const conflicted = { ...started, state: "conflict" as const };
        remember(conflicted);
        setError(
          status === 409
            ? "Видео изменено или запись конфликтует с другими данными. Ваш ввод сохранён. Сверьте его с актуальной версией."
            : "Перед сохранением нужно перечитать актуальную версию видео. Ваш ввод сохранён.",
        );
        try {
          const current = parseVkEditorDetail(
            await utils.client.admin.vkVideoDetail.query(
              { id: payload.id },
              { signal: task.signal },
            ),
            payload.id,
          );
          task.assertCurrent();
          remember(reviewVkDraft(conflicted, current));
        } catch (readError) {
          checkOperationAccessError(readError);
          if (task.isCurrent())
            setError(
              "Ваш ввод сохранён. Не удалось прочитать актуальную версию. Повторите проверку результата.",
            );
        }
      } else {
        if (status && [400, 401, 403, 404, 409, 412].includes(status))
          remember({ ...started, state: "draft", writePayload: null });
        setError(
          status === 409
            ? "Это видео уже связано с другими данными. Укажите его ID для явного редактирования; новая запись не создана."
            : status === 404
              ? "Видео с таким ID не найдено. Новая запись вместо него не создаётся."
              : status === 400
                ? "Проверьте название, ссылку VK и адрес обложки. Изменения не сохранены."
                : status === 412
                  ? "Каталог VK пока недоступен. Сохранение не подтверждено."
                  : getRequestErrorMessage(cause),
        );
      }
    } finally {
      task.finish();
    }
  };
  return (
    <ScrollArea contentClassName={`ui-stack ${classes.form}`}>
      <Typography className={classes.formTitle}>Видео VK в каталоге</Typography>
      {storageError ? (
        <StatusNotice
          tone="error"
          actions={
            <StatusNoticeAction disabled={operation.busy} onClick={restore}>
              Повторить чтение черновика
            </StatusNoticeAction>
          }
        >
          {storageError}
        </StatusNotice>
      ) : loaded ? (
        <Typography className={classes.hint}>
          Черновик сохранён в этой вкладке и восстановится после перезагрузки.
        </Typography>
      ) : null}
      <div className={`ui-stack ${classes.row}`}>
        {([false, true] as const).map((editing) => (
          <Action
            key={String(editing)}
            className={`${classes.chipOn} ${draft.editing === editing ? classes.backgroundColorState3 : classes.backgroundColorState4}`}
            disabled={locked}
            aria-pressed={draft.editing === editing}
            onClick={() =>
              change({ editing, id: "", base: null, review: null })
            }
          >
            <Typography
              className={`${classes.chipTextOn} ${draft.editing === editing ? classes.colorState3 : classes.colorState4}`}
            >
              {editing ? "Редактировать по ID" : "Новое видео"}
            </Typography>
          </Action>
        ))}
      </div>
      {draft.editing ? (
        <>
          <Typography className={classes.hint}>
            Укажите ID существующего VK-видео и загрузите его данные.
            YouTube-записи этим действием не преобразуются.
          </Typography>
          <Field
            aria-label="ID видео VK"
            value={draft.id}
            onValueChange={(id) => change({ id, base: null, review: null })}
            inputMode="numeric"
            disabled={locked}
            className={classes.titleInput}
          />
          {!draft.base ? (
            <Action
              className={classes.btn}
              disabled={locked || !draft.id}
              onClick={() => void read()}
            >
              <Typography className={classes.btnText}>
                Загрузить видео
              </Typography>
            </Action>
          ) : null}
        </>
      ) : null}
      <Typography className={classes.label}>Название</Typography>
      <Field
        aria-label="Название видео VK"
        value={draft.title}
        onValueChange={(title) => change({ title })}
        maxLength={512}
        disabled={fieldsLocked}
        className={classes.titleInput}
      />
      <VkVideoField
        videos={[]}
        disabled={fieldsLocked}
        onAdd={(embedUrl) => change({ embedUrl })}
        validateUrl={getVkCatalogEmbedUrl}
        helpText="В VK откройте «Поделиться» → «Экспортировать» и скопируйте адрес src без HTML-кода. Для каталога выберите доступ и публикацию ниже."
      />
      {draft.embedUrl ? (
        <Typography className={classes.hint}>Ссылка VK добавлена</Typography>
      ) : null}
      {thumbnailsEnabled ? (
        <>
          <Typography className={classes.label}>Обложка</Typography>
          <Field
            aria-label="Публичный адрес обложки VK"
            value={draft.thumbnailUrl}
            onValueChange={(thumbnailUrl) =>
              change({ thumbnailUrl, thumbnailChanged: true })
            }
            placeholder="https://… или /assets/responsive/…"
            disabled={fieldsLocked}
            className={classes.titleInput}
          />
          <Typography className={classes.hint}>
            {draft.editing && !draft.thumbnailChanged
              ? "Если поле не менять, текущая обложка сохранится."
              : draft.thumbnailChanged && draft.thumbnailUrl === ""
                ? "Видео будет сохранено без обложки."
                : "Используйте согласованное публичное изображение. Файл здесь не загружается."}
          </Typography>
          {draft.editing ? (
            <Action
              className={classes.btn}
              disabled={fieldsLocked}
              onClick={() =>
                change({ thumbnailUrl: "", thumbnailChanged: true })
              }
            >
              <Typography className={classes.btnText}>
                Удалить обложку
              </Typography>
            </Action>
          ) : null}
        </>
      ) : null}
      <div className={`ui-stack ${classes.row}`}>
        {(["public", "club"] as const).map((access) => (
          <Action
            key={access}
            className={`${classes.chipOn} ${draft.access === access ? classes.backgroundColorState3 : classes.backgroundColorState4}`}
            disabled={fieldsLocked}
            aria-pressed={draft.access === access}
            onClick={() => change({ access })}
          >
            <Typography
              className={`${classes.chipTextOn} ${draft.access === access ? classes.colorState3 : classes.colorState4}`}
            >
              {access === "public" ? "Для всех" : "Для клуба"}
            </Typography>
          </Action>
        ))}
      </div>
      <label className={classes.hint}>
        <input
          type="checkbox"
          checked={draft.published}
          onChange={(event) => change({ published: event.target.checked })}
          disabled={fieldsLocked}
        />{" "}
        Опубликовано
      </label>
      {error ? <StatusNotice tone="error">{error}</StatusNotice> : null}
      {draft.state === "uncertain" || draft.state === "conflict" ? (
        <StatusNotice>
          Результат сохранения не подтверждён. Ваш ввод и исходная версия
          сохранены в этой вкладке. Чтение каталога не подтверждает выполнение
          именно вашего запроса.
        </StatusNotice>
      ) : null}
      {draft.base && draft.state !== "saved" ? (
        <Action
          className={classes.btn}
          disabled={operation.busy}
          onClick={() => void read()}
        >
          <Typography className={classes.btnText}>
            Проверить актуальную версию
          </Typography>
        </Action>
      ) : null}
      {draft.review ? (
        <StatusNotice
          actions={
            <StatusNoticeAction
              disabled={operation.busy || Boolean(storageError)}
              onClick={() => {
                if (
                  window.confirm(
                    "Сверили изменения? Использовать прочитанную версию как основу, сохранив ваш ввод? Сохранение видео выполняется отдельной кнопкой.",
                  )
                ) {
                  remember(reconcileVkDraft(draft));
                  setError("");
                }
              }}
            >
              Продолжить после сверки
            </StatusNoticeAction>
          }
        >
          <Typography>
            Актуальная версия на сервере: {draft.review.title}
          </Typography>
          <Typography>
            Доступ: {draft.review.access === "club" ? "Для клуба" : "Для всех"}.{" "}
            {draft.review.published ? "Опубликовано" : "Черновик"}.
          </Typography>
          <Field
            aria-label="Актуальная ссылка VK"
            value={draft.review.embedUrl ?? ""}
            readOnly
          />
          <Field
            aria-label="Актуальная обложка VK"
            value={draft.review.thumbnailUrl ?? ""}
            readOnly
          />
          <Typography>
            Ваш ввод остаётся в форме. Прочитанные данные не подтверждают
            результат потерянного запроса.
          </Typography>
        </StatusNotice>
      ) : null}
      {draft.state === "saved" ? (
        <>
          <StatusNotice tone="success">
            Видео сохранено. ID: {draft.savedId}
          </StatusNotice>
          <Action
            className={classes.btn}
            disabled={operation.busy}
            onClick={() => void read(draft.savedId!)}
          >
            <Typography className={classes.btnText}>
              Редактировать сохранённое видео
            </Typography>
          </Action>
        </>
      ) : (
        <Action
          className={classes.btn}
          disabled={
            !loaded ||
            operation.busy ||
            Boolean(storageError) ||
            !draft.embedUrl ||
            !draft.title.trim() ||
            (draft.editing && (!draft.base || draft.state !== "draft"))
          }
          onClick={() => void save()}
        >
          <Typography className={classes.btnText}>
            {operation.busy
              ? "Сохранение…"
              : draft.state === "uncertain"
                ? "Повторить сохранение"
                : "Сохранить видео"}
          </Typography>
        </Action>
      )}
      <Action className={classes.btn} disabled={operation.busy} onClick={reset}>
        <Typography className={classes.btnText}>Очистить форму</Typography>
      </Action>
    </ScrollArea>
  );
}
