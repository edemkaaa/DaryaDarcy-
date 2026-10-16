import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { uploadAdminPrivateVideo } from "../apps/frontend/src/features/admin/media/private-video-upload";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";
vi.mock("../apps/frontend/src/shared/config/api", () => ({
  getApiBaseUrl: () => "http://127.0.0.1:19191",
}));
const file = () =>
  new File(["original video"], "lesson & one.mp4", { type: "video/mp4" });
const key = "private-video-original-key";
const receipt = {
  state: "ready",
  assetId: "3af23d8c-140f-454b-a123-123456789abc",
  type: "video",
  filename: "lesson & one.mp4",
  mimeType: "video/mp4",
  fileSize: 14,
};
let requests: { url: RequestInfo | URL; init: RequestInit }[];
beforeEach(() => {
  requests = [];
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init: RequestInit) => {
    requests.push({ url, init });
    return Response.json(receipt);
  });
});
afterEach(() => {
  cancelSessionRequests();
  vi.unstubAllGlobals();
});
it("sends the exact File/key to the private binary route with session-bound credentials", async () => {
  const selected = file();
  await expect(uploadAdminPrivateVideo(selected, key)).resolves.toEqual(
    receipt,
  );
  expect(requests).toHaveLength(1);
  const { url, init } = requests[0];
  expect(String(url)).toBe(
    "http://127.0.0.1:19191/api/admin/private-video-uploads?filename=lesson%20%26%20one.mp4",
  );
  expect(init.method).toBe("POST");
  expect(init.body).toBe(selected);
  expect(await (init.body as File).text()).toBe("original video");
  expect(new Headers(init.headers).get("Idempotency-Key")).toBe(key);
  expect(new Headers(init.headers).get("Content-Type")).toBe("video/mp4");
  expect(init.credentials).toBe("include");
  expect(init.cache).toBe("no-store");
});
it.each([400, 401, 403, 409, 413, 503])(
  "preserves HTTP %s without returning server details",
  async (status) => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ error: "PRIVATE_SERVER_DETAIL" }, { status }),
    );
    const error = await uploadAdminPrivateVideo(file(), key).then(
      () => undefined,
      (cause: unknown) => cause,
    );
    expect(error).toMatchObject({ status });
    expect((error as Error).message).not.toContain("PRIVATE_SERVER_DETAIL");
  },
);
it("refuses invalid keys before dispatch", async () => {
  await expect(uploadAdminPrivateVideo(file(), "short")).rejects.toThrow();
  expect(requests).toEqual([]);
});
it.each([
  { ...receipt, url: "https://storage.invalid/private.mp4" },
  { ...receipt, fileSize: 15 },
  { ...receipt, type: "document" },
])("rejects a mismatched/public acknowledgement", async (bad) => {
  vi.stubGlobal("fetch", async () => Response.json(bad));
  await expect(uploadAdminPrivateVideo(file(), key)).rejects.toThrow();
});
it("does not retry a request whose outcome is unknown", async () => {
  let sent = 0;
  vi.stubGlobal("fetch", async () => {
    sent++;
    throw new TypeError("Lost ACK");
  });
  await expect(uploadAdminPrivateVideo(file(), key)).rejects.toMatchObject({
    kind: "network",
  });
  expect(sent).toBe(1);
});
