import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  confirmEmailBinding,
  takeEmailBindingProof,
} from "../apps/frontend/src/shared/api/email-binding-confirmation";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";
import { createServer } from "node:http";

const api = vi.hoisted(() => ({ origin: "https://api.example.test" }));
vi.mock("../apps/frontend/src/shared/config/api", () => ({
  apiUrl: (path: string) => api.origin + path,
}));
const proof = "a".repeat(43);
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  cancelSessionRequests();
  api.origin = "https://api.example.test";
});
const signal = () => new AbortController().signal;
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

it("posts proof only without a session, referrer or automatic redirect and accepts exact confirmation", async () => {
  fetcher.mockResolvedValue(reply({ ok: true }));
  await expect(confirmEmailBinding(proof, signal())).resolves.toBeUndefined();
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    "https://api.example.test/api/auth/email-bindings/confirm",
    expect.objectContaining({
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: proof }),
    }),
  );
});
it.each([
  "",
  "a".repeat(42),
  "a".repeat(44),
  "a".repeat(42) + "=",
  " " + proof,
  proof + "\n",
])("refuses invalid proof before transport: %j", async (token) => {
  await expect(confirmEmailBinding(token, signal())).rejects.toMatchObject({
    status: 400,
  });
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([
  null,
  [],
  {},
  { ok: false },
  { ok: true, email: "private@example.test" },
  { ok: true, token: proof },
])(
  "does not infer confirmation from malformed or overbroad receipt: %j",
  async (body) => {
    fetcher.mockResolvedValue(reply(body));
    await expect(confirmEmailBinding(proof, signal())).rejects.toMatchObject({
      kind: "invalid-response",
    });
  },
);
it.each([201, 202])("does not call HTTP %i confirmation", async (status) => {
  fetcher.mockResolvedValue(reply({ ok: true }, status));
  await expect(confirmEmailBinding(proof, signal())).rejects.toMatchObject({
    kind: "invalid-response",
  });
});
it("keeps consumed-proof refusal ambiguous after a previous lost response without echoing provider data", async () => {
  fetcher.mockResolvedValue(
    reply({ error: proof + " private@example.test" }, 400),
  );
  const error = await confirmEmailBinding(proof, signal()).catch(
    (error) => error,
  );
  expect(error.status).toBe(400);
  expect(error.message).toContain("уже использована");
  expect(error.message).not.toContain(proof);
  expect(error.message).not.toContain("private@example.test");
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("preserves only a numeric rate limit without reading sensitive error bodies", async () => {
  fetcher.mockResolvedValue(
    new Response(proof, { status: 429, headers: { "Retry-After": "12" } }),
  );
  await expect(confirmEmailBinding(proof, signal())).rejects.toMatchObject({
    status: 429,
    retryAfterSec: 12,
  });
});
it("bounds an unreadable confirmation body and never retries proof automatically", async () => {
  vi.useFakeTimers();
  fetcher.mockResolvedValue(
    new Response(new ReadableStream({ start() {} }), { status: 200 }),
  );
  const result = confirmEmailBinding(proof, signal());
  const rejected = expect(result).rejects.toMatchObject({ kind: "timeout" });
  await vi.advanceTimersByTimeAsync(15_000);
  await rejected;
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("does not bind a public proof request to the currently signed-in identity", async () => {
  let receive!: (value: Response) => void;
  fetcher.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        receive = resolve;
      }),
  );
  const result = confirmEmailBinding(proof, signal());
  cancelSessionRequests();
  receive(reply({ ok: true }));
  await expect(result).resolves.toBeUndefined();
});
it("honors page cancellation before transport", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    confirmEmailBinding(proof, controller.signal),
  ).rejects.toMatchObject({ kind: "cancelled" });
  expect(fetcher).not.toHaveBeenCalled();
});
it("sends the purpose-specific proof over real loopback HTTP without adding account data", async () => {
  vi.unstubAllGlobals();
  let observed: unknown;
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      observed = {
        url: request.url,
        method: request.method,
        cookie: request.headers.cookie,
        body: JSON.parse(body),
      };
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end('{"ok":true}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing loopback address");
  api.origin = `http://127.0.0.1:${address.port}`;
  try {
    await confirmEmailBinding(proof, signal());
    expect(observed).toEqual({
      url: "/api/auth/email-bindings/confirm",
      method: "POST",
      cookie: undefined,
      body: { token: proof },
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
it("captures a fragment only after clearing it and never performs a request while opening", () => {
  const clear = vi.fn();
  expect(takeEmailBindingProof("#token=" + proof, clear)).toBe(proof);
  expect(clear).toHaveBeenCalledTimes(1);
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([
  "",
  "#token=bad",
  "#token=" + proof + "&token=" + proof,
  "#token=" + proof + "&email=x",
  "#token=%61" + "a".repeat(42),
  "#token=" + "a".repeat(100_000),
  "#token=" + proof + "\n",
])(
  "clears malformed fragments without accepting a partial token",
  (fragment) => {
    const clear = vi.fn();
    expect(takeEmailBindingProof(fragment, clear)).toBeNull();
    expect(clear).toHaveBeenCalledTimes(1);
  },
);
it("does not expose a usable proof when removing it from browser history fails", () => {
  expect(
    takeEmailBindingProof("#token=" + proof, () => {
      throw new Error("history denied");
    }),
  ).toBeNull();
});
