"use client";

import { useRef, useState } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { Action } from "@/shared/ui/elements";
import { PhotoViewer } from "@/shared/media/photo-viewer";
import type { ClubTestimonial } from "./club-testimonials.content";
import classes from "./club-testimonials.module.scss";

export function ClubTestimonials({
  items,
  label,
  title,
}: {
  items: readonly ClubTestimonial[];
  label: string;
  title?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  if (!items.length) return null;

  function move(index: number) {
    const node = track.current;
    const article = node?.children[index] as HTMLElement | undefined;
    if (!node || !article) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    node.scrollTo({
      left: article.offsetLeft - node.offsetLeft - 20,
      behavior: reduced ? "instant" : "smooth",
    });
  }

  return (
    <section className={classes.section} aria-label={label}>
      {title ? <h2 className={classes.title}>{title}</h2> : null}
      <div
        ref={track}
        className={classes.track}
        tabIndex={0}
        aria-label="Письма участниц — листайте в стороны"
        onScroll={(event) => {
          const node = event.currentTarget;
          const first = node.children[0] as HTMLElement;
          setCurrent(
            Math.min(
              items.length - 1,
              Math.max(
                0,
                Math.round(node.scrollLeft / (first.offsetWidth + 16)),
              ),
            ),
          );
        }}
      >
        {items.map((item, index) => (
          <article key={item.id} className={classes.letter}>
            <span className={classes.quotation} aria-hidden="true">
              “
            </span>
            <blockquote className={classes.quote}>{item.quote}</blockquote>
            <footer className={classes.signature}>
              <p className={classes.author}>
                {item.author ?? "Участница клуба"}
              </p>
              <span className={classes.excerpt}>Фрагмент отзыва</span>
              <Action
                className={classes.source}
                onClick={() => setViewerIndex(index)}
                aria-label={item.sourceLabel}
              >
                Читать оригинал
                <MaterialIcons name="zoom-in" size={14} />
              </Action>
            </footer>
          </article>
        ))}
      </div>
      <div className={classes.navigation}>
        <span className={classes.position} role="status" aria-live="polite">
          {current + 1} из {items.length}
        </span>
        <div className={classes.buttons}>
          <button
            type="button"
            className={classes.arrow}
            aria-label="Предыдущий отзыв"
            disabled={current === 0}
            onClick={() => move(current - 1)}
          >
            <MaterialIcons name="arrow-back" size={20} />
          </button>
          <button
            type="button"
            className={classes.arrow}
            aria-label="Следующий отзыв"
            disabled={current === items.length - 1}
            onClick={() => move(current + 1)}
          >
            <MaterialIcons name="arrow-forward" size={20} />
          </button>
        </div>
      </div>
      {viewerIndex !== null ? (
        <PhotoViewer
          visible
          photos={items.map((item) => item.source)}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      ) : null}
    </section>
  );
}
