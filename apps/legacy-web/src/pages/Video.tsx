/** Архивный просмотр YouTube по числовому ID. Не описывает действующий VK-плеер. */
import { Link, useParams } from "react-router-dom";
import { trpc } from "../trpc";

/** Читает прежнюю запись и строит YouTube iframe и внешнюю ссылку по youtubeId. */
export default function Video() {
  const { id } = useParams();
  const videoId = Number(id);
  const { data: video, isLoading, isError } = trpc.videos.getById.useQuery(
    { id: videoId },
    { enabled: videoId > 0 },
  );

  if (isLoading) return <div className="page muted">Загрузка…</div>;
  if (isError || !video) return <div className="page error">Видео не найдено</div>;

  return (
    <div className="page article">
      <Link to="/videos" className="muted">← видео</Link>
      <h2>{video.title}</h2>
      {video.youtubeId ? (
        <div className="embed">
          <iframe
            title={video.title}
            src={`https://www.youtube.com/embed/${video.youtubeId}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : null}
      {video.publishedText ? <p className="muted">{video.publishedText}</p> : null}
      <p>
        <a className="btn" href={`https://www.youtube.com/watch?v=${video.youtubeId}`} target="_blank" rel="noreferrer">
          Открыть на YouTube
        </a>
      </p>
    </div>
  );
}
