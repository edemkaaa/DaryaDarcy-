const S3_PREFIX = "https://s3.twcstorage.ru/daryadarcy-s3/";

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
