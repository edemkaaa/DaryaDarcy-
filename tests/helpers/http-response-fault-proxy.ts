import { createServer, request } from "node:http";
import type { AddressInfo } from "node:net";

/** Transport faults only: every response originates in the real loopback API.
 * No retries, fake successes, request body logging or cookie capture. */
export async function httpResponseFaultProxy(upstream: string) {
  // Проксирует только явный loopback API и теряет либо удерживает уже полученный реальный ответ; запрос не повторяет и cookie не записывает.

  const target = new URL(upstream);
  if (
    target.protocol !== "http:" ||
    target.hostname !== "127.0.0.1" ||
    !target.port ||
    target.username ||
    target.password ||
    target.pathname !== "/" ||
    target.search ||
    target.hash
  )
    throw new Error("Explicit loopback API required");
  type Rule = {
    procedure: string;
    mode: "drop" | "hold";
    reached: () => void;
    release: () => void;
    released: Promise<void>;
  };
  let rule: Rule | undefined;
  const held = new Set<Rule>();
  const calls: { pathname: string; status: number }[] = [];
  const server = createServer((req, res) => {
    const pathname = new URL(req.url!, "http://127.0.0.1").pathname;
    const procedures = pathname.startsWith("/api/trpc/")
      ? pathname.slice(10).split(",")
      : pathname === "/api/admin/private-video-uploads"
        ? ["binary.privateVideoUpload"]
        : [];
    const selected =
      rule && procedures.includes(rule.procedure) ? rule : undefined;
    if (selected) {
      rule = undefined;
      held.add(selected);
    }
    const forwarded = request(
      new URL(req.url!, target),
      { method: req.method, headers: { ...req.headers, host: target.host } },
      (response) => {
        const status = response.statusCode ?? 502;
        calls.push({ pathname, status });
        if (!selected) {
          res.writeHead(status, response.headers);
          response.pipe(res);
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 1024 * 1024) {
            response.destroy();
            res.destroy();
            selected.reached();
            return;
          }
          chunks.push(chunk);
        });
        response.once("end", () => {
          selected.reached();
          if (selected.mode === "drop") {
            held.delete(selected);
            res.destroy();
            return;
          }
          void selected.released.then(() => {
            held.delete(selected);
            if (!res.destroyed) {
              res.writeHead(status, response.headers);
              res.end(Buffer.concat(chunks));
            }
          });
        });
        response.once("error", () => {
          selected.reached();
          res.destroy();
        });
      },
    );
    forwarded.once("error", () => {
      selected?.reached();
      res.destroy();
    });
    req.pipe(forwarded);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return {
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    calls,
    arm(procedure: string, mode: "drop" | "hold") {
      // Разрешает одну fault-инъекцию для указанной процедуры; перекрывающиеся правила и произвольные маршруты отклоняются.

      if (
        rule ||
        (!/^admin\.[A-Za-z]+$/.test(procedure) &&
          ![
            "club.addComment",
            "club.uploadPrivateCommentPhoto",
            "club.privateCommentPhotoStatus",
            "binary.privateVideoUpload",
          ].includes(procedure))
      )
        throw new Error("Invalid or overlapping transport fault");
      let reached!: () => void, release!: () => void;
      const pending = new Promise<void>((resolve) => {
        reached = resolve;
      });
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      rule = { procedure, mode, reached, release, released };
      return { reached: pending, release };
    },
    async close() {
      // Освобождает удержанные ответы и закрывает только собственные соединения фикстуры.

      for (const item of held) item.release();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
