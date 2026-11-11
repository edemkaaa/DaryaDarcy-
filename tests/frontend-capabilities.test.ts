/** Проверяем строгие булевы server capabilities на клиентской границе чтения и записи файла. */
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
/** Сбрасываем ответ API-заглушки перед каждым сценарием. */
beforeEach(() => vi.mocked(apiCall).mockReset());

/** Неизвестная форма ответа не должна включать комментарий или загрузку по умолчанию. */
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

/** Строка true не заменяет настоящий boolean ни в одном известном поле. */
it.each(Object.keys(disabled))(
  "rejects an invalid type for %s",
  async (key) => {
    vi.mocked(apiCall).mockResolvedValue({ ...disabled, [key]: "true" });
    await expect(getAppCapabilities()).rejects.toMatchObject({
      kind: "invalid-response",
    });
  },
);

/** Полный набор false сохраняется как подтверждённое отсутствие возможностей. */
it("preserves the explicitly disabled legacy contract", async () => {
  vi.mocked(apiCall).mockResolvedValue(disabled);
  await expect(getAppCapabilities()).resolves.toEqual(disabled);
});

/** Явный обязательный gate позволяет старому ответу не содержать новые необязательные переключатели. */
it("accepts an explicit comment gate with optional older release fields omitted", async () => {
  vi.mocked(apiCall).mockResolvedValue({ privateContentUploads: false });
  await expect(getAppCapabilities()).resolves.toEqual(disabled);
});

/** Известные true сохраняются; неизвестное будущее поле не меняет проверенную модель. */
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

/** Перед записью повторно требуется валидная capability-модель, а не только состояние кнопки. */
it("rejects an invalid response at the file write boundary too", async () => {
  vi.mocked(apiCall).mockResolvedValue(null);
  await expect(
    requirePrivateUpload("privateContentUploads"),
  ).rejects.toMatchObject({ kind: "invalid-response" });
});
