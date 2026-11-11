"use client";
/** Поля вложений показывают отдельно локальные файлы и уже сохранённые элементы, передавая изменения владельцу редактора. */

import { Action, Typography } from "@/shared/ui/elements";
import { MaterialIcons } from "@/shared/ui/icons";
import type { PostAttachment } from "@/domain/post/save-post";
import classes from "./post-attachments-field.module.scss";
import { uploadUnavailableMessage } from "@/shared/api/capabilities";

type ListProps = {
  attachments: readonly PostAttachment[];
  disabled?: boolean;
  onRemove?: (index: number) => void;
};
export function PostAttachmentsList({
  attachments,
  disabled,
  onRemove,
}: ListProps) {
  // Показывает аудио и документы с единым списком удаления; локальные File и серверные ID остаются в родительском состоянии.

  if (!attachments.length) return null;
  return (
    <div className={`ui-stack ${classes.list}`}>
      {attachments.map((item, index) => (
        <div
          key={item.id ?? `${item.type}-${index}`}
          className={`ui-stack ${classes.item}`}
        >
          <MaterialIcons
            name={item.type === "audio" ? "headphones" : "description"}
            size={16}
            color="#8B7355"
          />
          <Typography lines={1} className={classes.name} title={item.name}>
            {item.name}
          </Typography>
          {onRemove ? (
            <Action
              disabled={disabled}
              onClick={() => onRemove(index)}
              aria-label={`Удалить вложение ${item.name}`}
              className={classes.remove}
            >
              <MaterialIcons name="close" size={14} color="#A85C5C" />
            </Action>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PostAttachmentsField({
  attachments,
  disabled,
  onRemove,
  onPick,
  uploadEnabled,
}: ListProps & {
  uploadEnabled: boolean;
  onRemove: (index: number) => void;
  onPick: (type: PostAttachment["type"]) => void;
}) {
  // Отключает выбор при недоступной серверной capability и передаёт тип вложения общему обработчику.

  return (
    <div className={`ui-stack ${classes.section}`}>
      <Typography className={classes.label}>
        Аудио и документы ({attachments.length})
      </Typography>
      <div className={`ui-stack ${classes.buttons}`}>
        {(["audio", "document"] as const).map((type) => (
          <Action
            key={type}
            onClick={() => onPick(type)}
            disabled={disabled || !uploadEnabled}
            title={!uploadEnabled ? uploadUnavailableMessage : undefined}
            className={({ pressed }) =>
              `${classes.pick} ${pressed ? classes.pressed : ""}`
            }
          >
            <MaterialIcons
              name={type === "audio" ? "headphones" : "description"}
              size={18}
              color="#FDF8F0"
            />
            <Typography className={classes.buttonText}>
              {type === "audio" ? "Аудио" : "Документ"}
            </Typography>
          </Action>
        ))}
      </div>
      <PostAttachmentsList
        attachments={attachments}
        onRemove={onRemove}
        disabled={disabled}
      />
    </div>
  );
}
