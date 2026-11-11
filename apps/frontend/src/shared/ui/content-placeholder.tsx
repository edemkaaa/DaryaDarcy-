/** Заглушки сохраняют форму контента при ожидании, не добавляя повторных анимаций поверх уже подтверждённых данных. */
import styles from "./content-placeholder.module.scss";

export type PlaceholderKind = "video" | "feed" | "library" | "article";

/** Сохраняем форму ожидаемого контента статичными карточками; видимые рамки декоративны, состояние загрузки озвучивается один раз. Повторного shimmer или анимированного вступления у заглушки нет. */
export function ContentPlaceholder({
  kind = "article",
  count = 2,
}: {
  kind?: PlaceholderKind;
  count?: number;
}) {
  return (
    <div
      className={`${styles.content} ${styles[kind]}`}
      role="status"
      aria-label="Загрузка материалов"
      aria-busy="true"
      data-content-placeholder={kind}
    >
      <div className={styles.frames} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div className={styles.card} key={index}>
            {kind !== "article" && <div className={styles.cover} />}
            <div className={styles.lines}>
              <div className={styles.line} />
              <div className={styles.line} />
              {kind === "article" && <div className={styles.line} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
