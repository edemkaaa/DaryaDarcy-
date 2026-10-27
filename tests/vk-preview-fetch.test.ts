import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchVkPreview } from "../apps/backend/src/media/vk-preview-fetch";
afterEach(() => vi.unstubAllEnvs());
describe("private VK preview egress", () => {
  it("preserves the player parameters and uses the private gateway without credentials", async () => {
    vi.stubEnv("VK_PREVIEW_PROXY_URL", "http://s3-egress:8081");
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    await fetchVkPreview(
      "https://vk.com/video_ext.php?oid=-1&id=2&hash=synthetic",
      AbortSignal.timeout(1000),
      transport,
    );
    expect(transport).toHaveBeenCalledWith(
      "http://s3-egress:8081/player?oid=-1&id=2&hash=synthetic",
      expect.objectContaining({
        redirect: "error",
        credentials: "omit",
        headers: {},
      }),
    );
  });
  it("preserves signed image query parameters and pins the upstream host", async () => {
    vi.stubEnv("VK_PREVIEW_PROXY_URL", "http://s3-egress:8081");
    const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response());
    await fetchVkPreview(
      "https://iv.okcdn.ru/getVideoPreview?id=2&tkn=signed%2Bvalue",
      AbortSignal.timeout(1000),
      transport,
    );
    expect(transport).toHaveBeenCalledWith(
      "http://s3-egress:8081/image/getVideoPreview?id=2&tkn=signed%2Bvalue",
      expect.objectContaining({
        headers: { "X-VK-Preview-Host": "iv.okcdn.ru" },
      }),
    );
  });
  it.each([
    "http://127.0.0.1/a.jpg",
    "https://iv.okcdn.ru/other",
    "https://vk.com/wall-1_2",
    "https://evil.test/image.jpg",
    "https://sun9.userapi.com:444/image.jpg",
  ])("rejects non-preview resources before transport: %s", async (url) => {
    const transport = vi.fn<typeof fetch>();
    expect(() =>
      fetchVkPreview(url, AbortSignal.timeout(1000), transport),
    ).toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
  it("does not accept an arbitrary configured proxy", () => {
    vi.stubEnv("VK_PREVIEW_PROXY_URL", "http://127.0.0.1:8081");
    const transport = vi.fn<typeof fetch>();
    expect(() =>
      fetchVkPreview(
        "https://vk.com/video_ext.php?oid=-1&id=2",
        AbortSignal.timeout(1000),
        transport,
      ),
    ).toThrow();
    expect(transport).not.toHaveBeenCalled();
  });
});
