import { Link } from "react-router-dom";
import { trpc } from "../trpc";
import { videoCoverUrl } from "../videoCover";

export default function Videos() {
  const { data: videos, isLoading, isError } = trpc.videos.list.useQuery();

  return (
    <div className="page">
      <h2>Видео</h2>
      {isLoading ? <p className="muted">Загрузка…</p> : null}
      {isError ? <p className="error">Не удалось загрузить видео</p> : null}
      <div className="stack">
        {(videos ?? []).map((video) => {
          const thumb = videoCoverUrl(video.youtubeId, video.thumbnailUrl);
          return (
            <Link key={video.id} to={`/video/${video.id}`} className="video-card">
              <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" />
              <div className="caption">
                <strong>{video.title}</strong>
                {video.duration ? <div className="muted">{video.duration}</div> : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
