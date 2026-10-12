import { getVkVideoEmbedUrl } from "./vk-video-url";

export function VkVideoEmbed({
  url,
  className,
}: {
  url: string;
  className: string;
}) {
  const src = getVkVideoEmbedUrl(url);
  if (!src) return null;
  return (
    <iframe
      src={src}
      title="VK Видео"
      className={className}
      style={{ border: 0 }}
      allow="encrypted-media; fullscreen; picture-in-picture"
      allowFullScreen
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
