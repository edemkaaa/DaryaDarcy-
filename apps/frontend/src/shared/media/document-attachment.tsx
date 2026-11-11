"use client";
/** Карточка документа показывает имя и размер; открытие защищённого адреса остаётся отдельным действием пользователя. */
import classes from "./document-attachment.module.scss";
import { Action, Typography } from "@/shared/ui/elements";
import { openExternalUrl } from "@/shared/browser/actions";
import MaterialIcons from "@/shared/ui/material-icon";
import { friendlyMediaName } from "@/shared/media/media-label";
const BROWN_DARK = "#4A3728";
const BROWN_LIGHT = "#7A6B5E";
interface DocumentAttachmentProps {
  url: string;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
}
function getDocIcon(mimeType?: string): keyof typeof MaterialIcons.glyphMap {
  if (!mimeType) return "insert-drive-file";
  if (mimeType.includes("pdf")) return "picture-as-pdf";
  if (mimeType.includes("word") || mimeType.includes("document"))
    return "description";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
    return "table-chart";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return "slideshow";
  return "insert-drive-file";
}
function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function DocumentAttachmentCard({
  url,
  filename,
  mimeType,
  fileSize,
}: DocumentAttachmentProps) {
  const handlePress = () => {
    openExternalUrl(url);
  };
  const icon = getDocIcon(mimeType);
  const displayName = friendlyMediaName(filename, "document") || "Документ";
  const sizeStr = formatFileSize(fileSize);
  return (
    <Action
      onClick={handlePress}
      className={({ pressed }) =>
        [classes.action, pressed ? classes.opacityState : ""]
          .filter(Boolean)
          .join(" ")
      }
    >
      <div
        className={["ui-stack ", classes.iconContainer]
          .filter(Boolean)
          .join(" ")}
      >
        <MaterialIcons name={icon} size={24} color={BROWN_DARK} />
      </div>
      <div className={["ui-stack ", classes.info].filter(Boolean).join(" ")}>
        <Typography lines={1} className={classes.filename}>
          {displayName}
        </Typography>
        {sizeStr ? (
          <Typography className={classes.size}>{sizeStr}</Typography>
        ) : null}
      </div>
      <MaterialIcons name="open-in-new" size={18} color={BROWN_LIGHT} />
    </Action>
  );
}
