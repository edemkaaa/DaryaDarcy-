/** Архивная Лента Vite с постраничным чтением и выбором тега. */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DEFAULT_TAGS } from "../data";
import { asPhotos, asTags, previewText } from "../lib";
import { trpc } from "../trpc";

/** Склеивает страницы в порядке API и загружает следующие по кнопке; права и опубликованность определяет сервер. */
export default function Feed() {
  const [tag, setTag] = useState("all");
  const { data: apiTags } = trpc.feed.tags.useQuery(undefined, { retry: 1 });
  const feed = trpc.feed.listPaginated.useInfiniteQuery(
    { tag: tag === "all" ? undefined : tag, limit: 12 },
    { getNextPageParam: (last) => last.nextCursor ?? undefined },
  );

  /** Использует серверные рубрики, а при пустом результате возвращает прежний фиксированный набор. */
  const tags = useMemo(() => {
    if (apiTags && apiTags.length > 0) {
      return [{ slug: "all", label: "Все" }, ...apiTags.map((t) => ({ slug: t.slug, label: t.label }))];
    }
    return DEFAULT_TAGS;
  }, [apiTags]);

  const posts = feed.data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <div className="page">
      <h2>Лента</h2>
      <div className="chips">
        {tags.map((item) => (
          <button
            key={item.slug}
            className={`chip ${tag === item.slug ? "on" : ""}`}
            onClick={() => setTag(item.slug)}
            type="button"
          >
            {item.label}
          </button>
        ))}
      </div>
      {feed.isLoading ? <p className="muted">Загрузка…</p> : null}
      {feed.isError ? <p className="error">Не удалось загрузить ленту</p> : null}
      <div className="grid">
        {posts.map((post) => {
          const photos = asPhotos(post.photos);
          const labels = asTags(post.tags);
          return (
            <Link key={post.id} to={`/post/${post.id}`} className="post-card">
              {photos[0] ? <img src={photos[0]} alt="" loading="lazy" /> : <div className="ph" />}
              <div className="caption">
                {previewText(post.text || "")}
                {labels[0] ? <div className="muted">{labels[0]}</div> : null}
              </div>
            </Link>
          );
        })}
      </div>
      {feed.hasNextPage ? (
        <p style={{ marginTop: 16 }}>
          <button className="btn" type="button" onClick={() => feed.fetchNextPage()} disabled={feed.isFetchingNextPage}>
            {feed.isFetchingNextPage ? "Загрузка…" : "Ещё"}
          </button>
        </p>
      ) : null}
    </div>
  );
}
