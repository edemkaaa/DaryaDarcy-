import { Link, useParams } from "react-router-dom";
import { asPhotos, asTags, formatDate } from "../lib";
import { trpc } from "../trpc";

export default function Post() {
  const { id } = useParams();
  const postId = Number(id);
  const { data: post, isLoading, isError } = trpc.feed.getById.useQuery(
    { id: postId },
    { enabled: postId > 0 },
  );

  if (isLoading) return <div className="page muted">Загрузка…</div>;
  if (isError || !post) return <div className="page error">Пост не найден</div>;

  const photos = asPhotos(post.photos);
  const tags = asTags(post.tags);

  return (
    <article className="page article">
      <Link to="/feed" className="muted">← лента</Link>
      <p className="muted">{formatDate(post.createdAt)}</p>
      {photos.map((src) => (
        <img key={src} src={src} alt="" />
      ))}
      <p style={{ whiteSpace: "pre-wrap" }}>{post.text}</p>
      <div className="chips">
        {tags.map((tag) => (
          <span key={tag} className="chip">{tag}</span>
        ))}
      </div>
    </article>
  );
}
