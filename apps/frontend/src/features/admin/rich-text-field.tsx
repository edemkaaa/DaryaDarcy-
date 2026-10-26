"use client";
import classes from "./rich-text-field.module.scss";

import { Field, Action, Typography, Dialog } from "@/shared/ui/elements";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { RichTextRenderer } from "@/domain/content/rich-text-renderer";
import type { RichTextBlock } from "@/domain/content/types";
import { formatToolbarProps } from "@/shared/browser/press";
import { useRichTextFormatting } from "@/features/admin/use-rich-text-formatting";
import { HighlightedTextInput } from "./highlighted-text-input";
import { RICH_TEXT_INPUT_ID } from "@/shared/browser/selection";
import { BROWN_DARK, BROWN_LIGHT, ACCENT } from "./rich-text-field.content";
export type RichTextFieldHandle = {
  getRichTextBlocks: () => RichTextBlock[] | undefined;
  getRichTextBlocksForSubmit: () => RichTextBlock[] | undefined;
};
interface RichTextFieldProps {
  value: string;
  onValueChange: (text: string) => void;
  richTextSeed?: RichTextBlock[] | null;
  onRichTextChange?: (richText: RichTextBlock[] | undefined) => void;
  textAreaClassName?: string;
  placeholder?: string;
}
export const RichTextField = forwardRef<
  RichTextFieldHandle,
  RichTextFieldProps
>(function RichTextField(
  {
    value,
    onValueChange,
    richTextSeed,
    onRichTextChange,
    textAreaClassName = "",
    placeholder = "Текст поста… Enter — новый абзац",
  },
  ref,
) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = editor.current;
    const scroll = node?.closest<HTMLElement>(".ui-scroll");
    if (!node || !scroll) return;
    let frame = 0;
    const reveal = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!node.contains(document.activeElement) || node.closest("[inert]"))
          return;
        // Keep the toolbar with the native textarea when the keyboard shrinks
        // the form. Scroll only this form, without changing focus or selection.
        const area = scroll.getBoundingClientRect();
        const box = node.getBoundingClientRect();
        if (box.bottom > area.bottom)
          scroll.scrollTop += box.bottom - area.bottom;
        else if (box.top < area.top && box.height <= area.height)
          scroll.scrollTop += box.top - area.top;
      });
    };
    const observer = new ResizeObserver(reveal);
    observer.observe(scroll);
    node.addEventListener("focusin", reveal);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      node.removeEventListener("focusin", reveal);
    };
  }, []);
  const fmt = useRichTextFormatting(
    value,
    richTextSeed,
    onRichTextChange,
    previewOpen,
  );
  useImperativeHandle(ref, () => ({
    getRichTextBlocks: fmt.getRichTextBlocks,
    getRichTextBlocksForSubmit: fmt.getRichTextBlocksForSubmit,
  }));
  const formatActionProps = (action: () => void) => ({
    ...formatToolbarProps(action, fmt.prepareToolbarSelection),
    onPointerCancel: fmt.cancelToolbarSelection,
    onKeyDown: fmt.cancelToolbarSelection,
  });
  const webInputProps = {
    id: RICH_TEXT_INPUT_ID,
    onMouseUp: () => fmt.syncLiveSelection(),
    onKeyUp: () => fmt.syncLiveSelection(),
    onTouchEnd: () => fmt.syncLiveSelection(),
    onClick: () => fmt.syncLiveSelection(),
  } as const;
  return (
    <>
      <div
        ref={editor}
        className={[`ui-stack ${textAreaClassName}`, classes.div]
          .filter(Boolean)
          .join(" ")}
      >
        <HighlightedTextInput
          {...webInputProps}
          value={value}
          links={fmt.linkRanges}
          onBeforeTextChange={fmt.prepareTextEdit}
          onValueChange={(next) => {
            onValueChange(next);
            fmt.handleTextChange(next);
          }}
          onSelection={(e) => fmt.handleSelectionChange(e)}
          onBlur={fmt.flushSelectionUi}
          placeholder={placeholder}
          placeholderColor={BROWN_LIGHT}
          multiline
          selectOnFocus={false}
        />

        <div
          className={["ui-stack ", classes.inlineToolbar]
            .filter(Boolean)
            .join(" ")}
        >
          <Action
            {...formatActionProps(fmt.toggleBold)}
            className={[
              classes.formatBtnActive,
              fmt.isInBold ? classes.appearanceState : classes.appearanceState2,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography
              className={[
                classes.formatBtnTextActive,
                fmt.isInBold ? classes.colorState : classes.colorState2,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              Ж
            </Typography>
          </Action>
          <Action
            {...formatActionProps(fmt.toggleItalic)}
            className={[
              classes.formatBtnActive,
              fmt.isInItalic
                ? classes.appearanceState3
                : classes.appearanceState4,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography
              className={[
                classes.formatBtnTextActive2,
                fmt.isInItalic ? classes.colorState3 : classes.colorState4,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              К
            </Typography>
          </Action>
          <Action
            {...formatActionProps(fmt.addLink)}
            aria-label="Добавить ссылку"
            aria-pressed={Boolean(fmt.currentLink)}
            className={[
              classes.formatBtn,
              fmt.currentLink ? classes.linkButtonActive : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <MaterialIcons
              name="link"
              size={17}
              color={
                fmt.hasSelection || fmt.currentLink ? BROWN_DARK : BROWN_LIGHT
              }
            />
          </Action>
          <Typography className={classes.formatHint}>
            {fmt.hasSelection
              ? fmt.selectionPreview || "Выделено"
              : "Выделите текст"}
          </Typography>
        </div>
      </div>

      <Action
        onClick={() => setPreviewOpen((open) => !open)}
        className={({ pressed }) =>
          [
            classes.action,
            pressed ? classes.opacityState : classes.opacityState2,
          ]
            .filter(Boolean)
            .join(" ")
        }
      >
        <MaterialIcons
          name={previewOpen ? "expand-less" : "visibility"}
          size={17}
          color={ACCENT}
        />
        <Typography className={classes.previewToggleText}>
          {previewOpen ? "Скрыть" : "Проверить"}
        </Typography>
      </Action>

      {previewOpen ? (
        <div
          className={["ui-stack ", classes.previewBox]
            .filter(Boolean)
            .join(" ")}
        >
          <RichTextRenderer richText={fmt.formatPreview} plainText={value} />
        </div>
      ) : null}

      {fmt.linkModalVisible ? (
        <Dialog
          label="Ссылка в публикации"
          open
          motion="fade"
          onClose={() => {
            fmt.setLinkModalVisible(false);
            fmt.setLinkUrlInput("");
          }}
        >
          <div
            onClick={() => {
              fmt.setLinkModalVisible(false);
              fmt.setLinkUrlInput("");
            }}
            className={["ui-stack ", classes.linkModalOverlay]
              .filter(Boolean)
              .join(" ")}
          >
            <div
              onClick={(e) => e.stopPropagation?.()}
              className={["ui-stack ", classes.linkModalCard]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography className={classes.linkModalTitle}>Ссылка</Typography>
              <Field
                value={fmt.linkUrlInput}
                onValueChange={fmt.setLinkUrlInput}
                placeholder="https://..."
                placeholderColor={BROWN_LIGHT}
                autoCapitalize="off"
                autoCorrect="off"
                inputMode="text"
                autoFocus
                className={classes.linkModalInput}
              />
              <div
                className={["ui-stack ", classes.linkModalActions]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Action
                  onClick={() => {
                    fmt.setLinkModalVisible(false);
                    fmt.setLinkUrlInput("");
                  }}
                  className={classes.linkModalCancel}
                >
                  <Typography className={classes.linkModalCancelText}>
                    Отмена
                  </Typography>
                </Action>
                <Action
                  onClick={() => fmt.applyLink(fmt.linkUrlInput)}
                  className={classes.linkModalApply}
                >
                  <Typography className={classes.linkModalApplyText}>
                    {fmt.linkModalMode === "edit" ? "Сохранить" : "Добавить"}
                  </Typography>
                </Action>
              </div>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  );
});
