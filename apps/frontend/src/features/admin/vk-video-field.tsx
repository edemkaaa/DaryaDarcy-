"use client";

import { useId, useState } from "react";
import { Action, Dialog, Field, Typography } from "@/shared/ui/elements";
import { getVkVideoEmbedUrl } from "@/shared/media/vk-video-url";
import { VkVideoEmbed } from "@/shared/media/vk-video-embed";
import classes from "./vk-video-field.module.scss";

/** Uses the existing videos[] draft/write path; adding a link never uploads a file. */
export function VkVideoField({
  videos,
  disabled,
  onAdd,
  validateUrl = getVkVideoEmbedUrl,
  helpText,
}: {
  videos: readonly string[];
  disabled: boolean;
  onAdd: (url: string) => void;
  validateUrl?: (url: string) => string | null;
  helpText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  const close = () => {
    setOpen(false);
    setValue("");
    setError("");
  };
  const add = () => {
    if (disabled) return;
    const url = validateUrl(value.trim());
    if (!url) {
      setError(
        "Вставьте HTTPS-ссылку video_ext.php из экспорта VK с параметрами oid и id. Сохраните hash, если он есть. Ссылка на страницу ролика и HTML-код не подходят.",
      );
      return;
    }
    if (videos.some((item) => validateUrl(item) === url)) {
      setError("Это видео уже добавлено.");
      return;
    }
    onAdd(url);
    close();
  };
  return (
    <>
      <Action
        className={classes.add}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Добавить ссылку VK
      </Action>
      <Dialog
        label="Добавить видео VK"
        open={open}
        onClose={close}
        className={classes.overlay}
      >
        <div className={classes.panel}>
          <Typography className={classes.title}>Видео VK</Typography>
          <label htmlFor={id}>Экспортируемая ссылка VK</label>
          <Field
            id={id}
            value={value}
            onValueChange={(next) => {
              setValue(next);
              setError("");
            }}
            onSubmit={add}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={2048}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-help ${id}-error`}
            placeholder="https://vkvideo.ru/video_ext.php?…"
            className={classes.input}
          />
          <Typography id={`${id}-help`} className={classes.hint}>
            {helpText ??
              `В VK откройте «Поделиться» → «Экспортировать» и скопируйте адрес из
            src, без HTML-кода. Доступ определяется местом публикации поста.
            Ссылка сохраняется вместе с постом.`}
          </Typography>
          <Typography
            id={`${id}-error`}
            role={error ? "alert" : undefined}
            className={classes.error}
          >
            {error}
          </Typography>
          <div className={classes.actions}>
            <Action className={classes.add} onClick={close}>
              Отмена
            </Action>
            <Action
              className={classes.add}
              disabled={disabled || !value.trim()}
              onClick={add}
            >
              Добавить видео
            </Action>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function VkVideoPreviewButton({
  url,
  index,
}: {
  url: string;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  if (!getVkVideoEmbedUrl(url)) return null;
  return (
    <>
      <Action
        className={classes.preview}
        aria-label={`Посмотреть видео VK ${index + 1}`}
        onClick={() => setOpen(true)}
      >
        Смотреть VK
      </Action>
      <Dialog
        label="Предпросмотр видео VK"
        open={open}
        onClose={() => setOpen(false)}
        className={classes.overlay}
      >
        <div className={classes.panel}>
          <Action className={classes.add} onClick={() => setOpen(false)}>
            Закрыть видео
          </Action>
          <div className={classes.frame}>
            <VkVideoEmbed url={url} className={classes.player} />
          </div>
        </div>
      </Dialog>
    </>
  );
}
