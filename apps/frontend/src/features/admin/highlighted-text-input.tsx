"use client";
/** Подсветка диапазонов и само поле имеют общий текст; визуальный слой не становится самостоятельным источником ввода. */
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentProps,
} from "react";
import { Field } from "@/shared/ui/elements";
import classes from "./rich-text-field.module.scss";
import type { TextEditHint } from "./editor-range-change";

type LinkRange = { start: number; end: number; url: string };

/** Keep native mobile typing/selection; paint links beneath the transparent text. */
export function HighlightedTextInput({
  value,
  links,
  onBeforeTextChange,
  ...props
}: ComponentProps<typeof Field> & {
  value: string;
  links: LinkRange[];
  onBeforeTextChange: (hint: TextEditHint) => void;
}) {
  const input = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = input.current;
    if (!(node instanceof HTMLTextAreaElement)) return;
    const capture = (event: Event) =>
      onBeforeTextChange({
        start: node.selectionStart,
        end: node.selectionEnd,
        inputType: (event as InputEvent).inputType ?? "",
      });
    node.addEventListener("beforeinput", capture);
    return () => node.removeEventListener("beforeinput", capture);
  }, [onBeforeTextChange]);
  const syncScroll = useCallback(() => {
    const node = input.current;
    if (!node || !viewport.current || !content.current) return;
    const transform = `translate(${-node.scrollLeft}px, ${-node.scrollTop}px)`;
    if (content.current.style.transform !== transform)
      content.current.style.transform = transform;
  }, []);
  useLayoutEffect(() => {
    const node = input.current;
    if (!node) return;
    const syncSize = () => {
      if (!viewport.current) return;
      // clientWidth excludes the native scrollbar; measure only on resize.
      const width = `${node.clientWidth}px`;
      if (viewport.current.style.width !== width)
        viewport.current.style.width = width;
      syncScroll();
    };
    syncSize();
    const observer = new ResizeObserver(syncSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [syncScroll]);
  useLayoutEffect(syncScroll, [syncScroll, value]);

  const fragments = useMemo(() => {
    if (!links.length) return null;
    const result = [];
    let position = 0;
    for (const link of links) {
      result.push(value.slice(position, link.start));
      result.push(
        <span
          key={`${link.start}:${link.end}`}
          className={classes.highlightLink}
          data-editor-link={link.url}
        >
          {value.slice(link.start, link.end)}
        </span>,
      );
      position = link.end;
    }
    result.push(value.slice(position));
    return result;
  }, [value, links]);
  return (
    <div className={`ui-stack ${classes.editorTextArea}`}>
      <div
        ref={viewport}
        aria-hidden="true"
        className={classes.highlightViewport}
      >
        <div ref={content} className={classes.highlightContent}>
          {fragments}
        </div>
      </div>
      <Field
        {...props}
        ref={input}
        value={value}
        multiline
        data-highlighted={links.length > 0}
        onScroll={syncScroll}
        className={classes.editorInputWithBar}
      />
    </div>
  );
}
