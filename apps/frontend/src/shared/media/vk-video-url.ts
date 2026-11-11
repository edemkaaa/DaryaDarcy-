/** Экспортируемый адрес VK приводится к разрешённому формату плеера; ссылка на публикацию не равна адресу самого iframe. */
const VK_PLAYER_HOSTS = new Set(["vk.com", "vk.ru", "vkvideo.ru"]);

/** Разбираем только экспортированный HTTPS-плеер VK с уникальными oid/id и необязательным валидным hash; лишние параметры отбрасываем, autoplay выключаем. */
export function getVkVideoEmbedUrl(value: string): string | null {
  if (!value || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !VK_PLAYER_HOSTS.has(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.pathname !== "/video_ext.php"
    )
      return null;
    const oid = url.searchParams.get("oid");
    const id = url.searchParams.get("id");
    const hash = url.searchParams.get("hash");
    if (
      !oid ||
      !/^-?[1-9]\d{0,19}$/.test(oid) ||
      !id ||
      !/^[1-9]\d{0,19}$/.test(id) ||
      (hash !== null && !/^[a-zA-Z0-9_-]{8,128}$/.test(hash)) ||
      url.searchParams.getAll("hash").length > 1 ||
      ["oid", "id"].some((key) => url.searchParams.getAll(key).length !== 1)
    )
      return null;
    const player = new URL("/video_ext.php", url.origin);
    player.searchParams.set("oid", oid);
    player.searchParams.set("id", id);
    if (hash !== null) player.searchParams.set("hash", hash);
    const hd = url.searchParams.get("hd");
    if (hd && /^[0-3]$/.test(hd)) player.searchParams.set("hd", hd);
    player.searchParams.set("autoplay", "0");
    return player.toString();
  } catch {
    return null;
  }
}
