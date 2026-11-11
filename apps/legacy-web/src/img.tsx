/** Архивная обёртка картинок Vite и прежняя маршрутизация публичного S3 через /media. */
const S3_PREFIX = "https://s3.twcstorage.ru/daryadarcy-s3/";

/** Меняет только известный S3-префикс; локальные, data/blob и другие адреса возвращает без дополнительной проверки. */
export function mediaUrl(src: string | null | undefined): string {
  if (!src) return "";
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return src;
  if (src.startsWith(S3_PREFIX)) {
    return `/media/${src.slice(S3_PREFIX.length).replace(/^\/+/, "")}`;
  }
  return src;
}

type ImgProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
};

/** Задаёт прежние lazy/async defaults и позволяет приоритетным картинкам загружаться сразу. */
export function Img({
  src,
  alt = "",
  priority = false,
  loading,
  decoding,
  fetchPriority,
  ...rest
}: ImgProps) {
  return (
    <img
      src={mediaUrl(typeof src === "string" ? src : undefined)}
      alt={alt}
      loading={loading ?? (priority ? "eager" : "lazy")}
      decoding={decoding ?? "async"}
      fetchPriority={fetchPriority ?? (priority ? "high" : "low")}
      {...rest}
    />
  );
}
