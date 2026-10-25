import { beforeEach, expect, it, vi } from "vitest";
import { apiCall } from "../apps/frontend/src/shared/api/auth";
import {
  getAppCapabilities,
  requirePrivateUpload,
} from "../apps/frontend/src/shared/api/capabilities";

vi.mock("../apps/frontend/src/shared/api/auth", () => ({ apiCall: vi.fn() }));

const disabled = {
  smsLogin: false,
  penPals: false,
  shopOnlinePayment: false,
  webPush: false,
  privateContentUploads: false,
  privatePostMediaUploads: false,
  privatePostVideoUploads: false,
};
beforeEach(() => vi.mocked(apiCall).mockReset());

it.each(
  [
    null,
    [],
    true,
    "unavailable",
    {},
    { smsLogin: false },
    { privateContentUploads: "false" },
    { privateContentUploads: 0 },
    { privateContentUploads: null },
  ].map((response) => ({ response })),
)(
  "rejects an unknown or malformed comment capability: $response",
  async ({ response }) => {
    vi.mocked(apiCall).mockResolvedValue(response);
    await expect(getAppCapabilities()).rejects.toMatchObject({
      kind: "invalid-response",
    });
  },
);

it.each(Object.keys(disabled))(
  "rejects an invalid type for %s",
  async (key) => {
    vi.mocked(apiCall).mockResolvedValue({ ...disabled, [key]: "true" });
    await expect(getAppCapabilities()).rejects.toMatchObject({
      kind: "invalid-response",
    });
  },
);

it("preserves the explicitly disabled legacy contract", async () => {
  vi.mocked(apiCall).mockResolvedValue(disabled);
  await expect(getAppCapabilities()).resolves.toEqual(disabled);
});

it("accepts an explicit comment gate with optional older release fields omitted", async () => {
  vi.mocked(apiCall).mockResolvedValue({ privateContentUploads: false });
  await expect(getAppCapabilities()).resolves.toEqual(disabled);
});

it("preserves enabled switches and ignores future server fields", async () => {
  const enabled = {
    ...disabled,
    privateContentUploads: true,
    privatePostMediaUploads: true,
  };
  vi.mocked(apiCall).mockResolvedValue({
    ...enabled,
    futureFeature: { version: 2 },
  });
  await expect(getAppCapabilities()).resolves.toEqual(enabled);
});

it("rejects an invalid response at the file write boundary too", async () => {
  vi.mocked(apiCall).mockResolvedValue(null);
  await expect(
    requirePrivateUpload("privateContentUploads"),
  ).rejects.toMatchObject({ kind: "invalid-response" });
});
