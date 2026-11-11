"use client";
/** Разметку выводим React-элементами; адрес каждой ссылки проходит проверку отдельно от её видимой подписи. */
import { memo } from "react";
import { Typography } from "@/shared/ui/elements";
import { splitForEmojiRendering } from "@/shared/media/emoji-text";
import { normalizeLinkUrl } from "@/shared/media/photo-aspect-ratios";
import { safeExternalUrl } from "@/shared/navigation/external-url";
import {
  sanitizePlainPostText,
  sanitizeRichTextForDisplay,
} from "./post-text-sanitize";
import type { RichTextInline, RichTextBlock } from "./types";
import classes from "./rich-text-renderer.module.scss";
export type { RichTextInline, RichTextBlock } from "./types";

interface RichTextRendererProps {
  richText?: RichTextBlock[] | null;
  plainText?: string;
  lines?: number;
  textClassName?: string;
  linkColor?: string;
  selectable?: boolean;
}

/** Санитизируем сохранённые блоки перед React-рендером; при их отсутствии используем plain text, сохраняя переносы и ограничение строк. */
export const RichTextRenderer = memo(function RichTextRenderer({
  richText,
  plainText,
  lines,
  textClassName = "",
  linkColor = "#6B7B5E",
  selectable = true,
}: RichTextRendererProps) {
  const safePlain = plainText ? sanitizePlainPostText(plainText) : "";
  const blocks = sanitizeRichTextForDisplay(richText);
  const paragraphClass = [classes.paragraph, textClassName]
    .filter(Boolean)
    .join(" ");
  const headingClass = [classes.heading, textClassName]
    .filter(Boolean)
    .join(" ");
  if (!blocks || blocks.length === 0) {
    if (!safePlain) return null;
    if (lines !== undefined)
      return (
        <Typography
          selectable={selectable}
          className={paragraphClass}
          lines={lines}
        >
          {renderPlainText(safePlain)}
        </Typography>
      );
    const paragraphs = safePlain.split("\n");
    return (
      <>
        {paragraphs.map((part, index) => (
          <Typography
            key={index}
            selectable={selectable}
            className={[
              paragraphClass,
              index < paragraphs.length - 1 ? classes.paragraphGap : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {renderPlainText(part.length > 0 ? part : " ")}
          </Typography>
        ))}
      </>
    );
  }
  if (lines !== undefined)
    return (
      <Typography
        selectable={selectable}
        className={paragraphClass}
        lines={lines}
      >
        {blocks.map((block, index) => (
          <Typography key={index}>
            {index > 0 && "\n"}
            {block.type === "heading" ? (
              <Typography className={classes.heading}>
                {renderInlines(block.children, linkColor)}
              </Typography>
            ) : (
              renderInlines(block.children, linkColor)
            )}
          </Typography>
        ))}
      </Typography>
    );
  return (
    <>
      {blocks.map((block, index) => (
        <Typography
          key={index}
          selectable={selectable}
          className={
            block.type === "heading"
              ? headingClass
              : [
                  paragraphClass,
                  index < blocks.length - 1 ? classes.paragraphGap : "",
                ]
                  .filter(Boolean)
                  .join(" ")
          }
        >
          {renderInlines(block.children, linkColor)}
        </Typography>
      ))}
    </>
  );
});

/** Собираем форматированные фрагменты React-элементами; адрес ссылки проверяется независимо от безопасно экранированной подписи. */
function renderInlines(
  children: RichTextInline[] | undefined,
  linkColor: string,
) {
  if (!Array.isArray(children)) return null;
  return children.map((inline, index) => {
    const text = typeof inline.text === "string" ? inline.text : "";
    const className = [
      inline.bold ? classes.bold : "",
      inline.italic ? classes.italic : "",
    ]
      .filter(Boolean)
      .join(" ");
    if (inline.link)
      return (
        <a
          key={index}
          href={safeExternalUrl(normalizeLinkUrl(inline.link)) ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={["ui-inline-link", classes.link, className]
            .filter(Boolean)
            .join(" ")}
          style={{ color: linkColor }}
          onClick={(event) => event.stopPropagation()}
        >
          {renderPlainText(text)}
        </a>
      );
    return (
      <Typography key={index} className={className}>
        {renderPlainText(text)}
      </Typography>
    );
  });
}

/** Выделяем emoji для системного шрифта, сохраняя текст без HTML-интерпретации и лишних обёрток для обычной строки. */
function renderPlainText(text: string | undefined | null) {
  const safe = typeof text === "string" ? text : "";
  const segments = splitForEmojiRendering(safe);
  if (segments.length === 1 && !segments[0].isEmoji) return safe;
  return segments.map((segment, index) => (
    <Typography
      key={index}
      className={segment.isEmoji ? undefined : classes.bodyText}
    >
      {segment.value}
    </Typography>
  ));
}
