"use client";
import { useState } from "react";
import { useAuth } from "@/domain/session/session-context";
import {
  useSessionOperation,
  checkOperationAccessError,
} from "@/domain/session/use-session-operation";
import { trpc } from "@/shared/api/trpc";
import { getHttpStatus, getRequestErrorMessage } from "@/shared/api/errors";
import { Action, Field, ScrollArea, Typography } from "@/shared/ui/elements";
import {
  getVkCatalogEmbedUrl,
  isVideoThumbnailsEnabled,
  normalizeVkThumbnailUrl,
  requireVkVideoId,
} from "@/features/videos/catalog-api";
import { VkVideoField } from "./vk-video-field";
import classes from "./articles-admin.module.scss";

type Payload = {
  id?: number;
  embedUrl: string;
  title: string;
  access: "public" | "club";
  published: boolean;
  thumbnailUrl?: string | null;
};
export function VkCatalogAdmin() {
  const { user, isOwner } = useAuth();
  return user && isOwner ? <Editor key={user.id} /> : null;
}
function Editor() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const operation = useSessionOperation(
    !auth.loading && !auth.error && !auth.refreshError,
  );
  const [editing, setEditing] = useState(false);
  const [id, setId] = useState("");
  const [title, setTitle] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [access, setAccess] = useState<"public" | "club">("club");
  const [published, setPublished] = useState(false);
  const thumbnailsEnabled = isVideoThumbnailsEnabled();
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailChanged, setThumbnailChanged] = useState(false);
  const [pending, setPending] = useState<Payload | null>(null);
  const [resultId, setResultId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const locked = operation.busy || Boolean(pending) || resultId !== null;
  const reset = () => {
    operation.cancel();
    setPending(null);
    setResultId(null);
    setId("");
    setTitle("");
    setEmbedUrl("");
    setAccess("club");
    setPublished(false);
    setThumbnailUrl("");
    setThumbnailChanged(false);
    setError("");
  };
  const save = async () => {
    const canonical = getVkCatalogEmbedUrl(embedUrl);
    const numericId = Number(id);
    if (
      !canonical ||
      !title.trim() ||
      title.trim().length > 512 ||
      (editing && (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(numericId)))
    ) {
      setError(
        "Укажите название, экспортируемую ссылку VK и корректный ID при редактировании.",
      );
      return;
    }
    let thumbnail: Pick<Payload, "thumbnailUrl"> = {};
    if (!pending && thumbnailsEnabled && thumbnailChanged) {
      if (thumbnailUrl === "") thumbnail = { thumbnailUrl: null };
      else {
        const normalized = normalizeVkThumbnailUrl(thumbnailUrl);
        if (!normalized) {
          setError(
            "Укажите публичный адрес обложки без параметров или очистите поле для удаления обложки.",
          );
          return;
        }
        thumbnail = { thumbnailUrl: normalized };
      }
    }
    const task = operation.begin("save-vk-video");
    if (!task) return;
    const payload: Payload = pending ?? {
      ...(editing ? { id: numericId } : {}),
      embedUrl: canonical,
      title: title.trim(),
      access,
      published,
      ...thumbnail,
    };
    setPending(payload);
    setError("");
    try {
      const saved = requireVkVideoId(
        await utils.client.admin.upsertVkVideo.mutate(payload, {
          signal: task.signal,
        }),
      );
      task.assertCurrent();
      setResultId(saved);
      setPending(null);
      await Promise.all([
        utils.videos.catalog.invalidate(),
        utils.invalidate(undefined, {
          predicate: (query) =>
            ["video-card", "video-playback"].includes(
              String(query.queryKey[0]),
            ),
        }),
      ]);
    } catch (cause) {
      if (!task.isCurrent()) return;
      checkOperationAccessError(cause);
      const status = getHttpStatus(cause);
      // A definite rejection permits correction; unknown writes keep their exact payload.
      if (status && [400, 401, 403, 404, 409, 412].includes(status))
        setPending(null);
      setError(
        status === 409
          ? payload.id
            ? "Запись с этим ID нельзя сохранить как VK с указанными данными. Проверьте ID и источник ролика."
            : "Это видео уже связано с другими данными. Укажите его ID для явного редактирования; новая запись не создана."
          : status === 400
            ? "Проверьте название, ссылку VK и адрес обложки. Изменения не сохранены."
            : status === 412
              ? "Каталог VK пока не включён на сервере. Сохранение не подтверждено."
              : status === 404
                ? "Видео с таким ID не найдено. Новая запись вместо него не создаётся."
                : getRequestErrorMessage(cause),
      );
    } finally {
      task.finish();
    }
  };
  return (
    <ScrollArea contentClassName={`ui-stack ${classes.form}`}>
      <Typography className={classes.formTitle}>Видео VK в каталоге</Typography>
      <div className={`ui-stack ${classes.row}`}>
        <Action
          className={`${classes.chipOn} ${!editing ? classes.backgroundColorState3 : classes.backgroundColorState4}`}
          disabled={locked}
          onClick={() => setEditing(false)}
          aria-pressed={!editing}
        >
          <Typography
            className={`${classes.chipTextOn} ${!editing ? classes.colorState3 : classes.colorState4}`}
          >
            Новое видео
          </Typography>
        </Action>
        <Action
          className={`${classes.chipOn} ${editing ? classes.backgroundColorState3 : classes.backgroundColorState4}`}
          disabled={locked}
          onClick={() => setEditing(true)}
          aria-pressed={editing}
        >
          <Typography
            className={`${classes.chipTextOn} ${editing ? classes.colorState3 : classes.colorState4}`}
          >
            Редактировать по ID
          </Typography>
        </Action>
      </div>
      {editing ? (
        <>
          <Typography className={classes.hint}>
            Укажите ID существующего VK-видео и все его данные. YouTube-записи
            этим действием не преобразуются.
          </Typography>
          <Field
            aria-label="ID видео VK"
            value={id}
            onValueChange={setId}
            inputMode="numeric"
            disabled={locked}
            className={classes.titleInput}
          />
        </>
      ) : null}
      <Typography className={classes.label}>Название</Typography>
      <Field
        aria-label="Название видео VK"
        value={title}
        onValueChange={setTitle}
        maxLength={512}
        disabled={locked}
        className={classes.titleInput}
      />
      <VkVideoField
        videos={[]}
        disabled={locked}
        onAdd={setEmbedUrl}
        validateUrl={getVkCatalogEmbedUrl}
        helpText="В VK откройте «Поделиться» → «Экспортировать» и скопируйте адрес src без HTML-кода. Для каталога выберите доступ и публикацию ниже."
      />
      {embedUrl ? (
        <Typography className={classes.hint}>Ссылка VK добавлена</Typography>
      ) : null}
      {thumbnailsEnabled ? (
        <>
          <Typography className={classes.label}>Обложка</Typography>
          <Field
            aria-label="Публичный адрес обложки VK"
            value={thumbnailUrl}
            onValueChange={(value) => {
              setThumbnailUrl(value);
              setThumbnailChanged(true);
            }}
            placeholder="https://… или /assets/responsive/…"
            disabled={locked}
            className={classes.titleInput}
          />
          <Typography className={classes.hint}>
            {editing && !thumbnailChanged
              ? "Если поле не менять, текущая обложка сохранится."
              : thumbnailChanged && thumbnailUrl === ""
                ? "Видео будет сохранено без обложки."
                : "Используйте согласованное публичное изображение. Файл здесь не загружается."}
          </Typography>
          {editing ? (
            <Action
              className={classes.btn}
              disabled={locked}
              onClick={() => {
                setThumbnailUrl("");
                setThumbnailChanged(true);
              }}
            >
              <Typography className={classes.btnText}>
                Удалить обложку
              </Typography>
            </Action>
          ) : null}
        </>
      ) : null}
      <div className={`ui-stack ${classes.row}`}>
        <Action
          className={`${classes.chipOn} ${access === "public" ? classes.backgroundColorState3 : classes.backgroundColorState4}`}
          disabled={locked}
          aria-pressed={access === "public"}
          onClick={() => setAccess("public")}
        >
          <Typography
            className={`${classes.chipTextOn} ${access === "public" ? classes.colorState3 : classes.colorState4}`}
          >
            Для всех
          </Typography>
        </Action>
        <Action
          className={`${classes.chipOn} ${access === "club" ? classes.backgroundColorState3 : classes.backgroundColorState4}`}
          disabled={locked}
          aria-pressed={access === "club"}
          onClick={() => setAccess("club")}
        >
          <Typography
            className={`${classes.chipTextOn} ${access === "club" ? classes.colorState3 : classes.colorState4}`}
          >
            Для клуба
          </Typography>
        </Action>
      </div>
      <label className={classes.hint}>
        <input
          type="checkbox"
          checked={published}
          onChange={(event) => setPublished(event.target.checked)}
          disabled={locked}
        />{" "}
        Опубликовано
      </label>
      {error ? (
        <Typography role="alert" className={classes.hint}>
          {error}
        </Typography>
      ) : null}
      {pending ? (
        <Typography role="status" className={classes.hint}>
          Результат сохранения не подтверждён. Данные сохранены в этой форме.
          Повтор использует тот же набор данных; после перезагрузки сначала
          проверьте каталог.
        </Typography>
      ) : null}
      {resultId !== null ? (
        <Typography role="status">Видео сохранено. ID: {resultId}</Typography>
      ) : (
        <Action
          className={classes.btn}
          disabled={operation.busy || !embedUrl || !title.trim()}
          onClick={() => void save()}
        >
          <Typography className={classes.btnText}>
            {operation.busy
              ? "Сохранение…"
              : pending
                ? "Повторить сохранение"
                : "Сохранить видео"}
          </Typography>
        </Action>
      )}
      {pending || resultId !== null ? (
        <Action
          className={classes.btn}
          disabled={operation.busy}
          onClick={reset}
        >
          <Typography className={classes.btnText}>
            {resultId !== null ? "Очистить форму" : "Вернуться к вводу данных"}
          </Typography>
        </Action>
      ) : null}
    </ScrollArea>
  );
}
