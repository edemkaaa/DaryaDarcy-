import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createServer } from "vite";
import { interceptorPlugin } from "@vitest/mocker/node";

it.each([
  ["outside root", "opaque:../outside.js", "ORIGINAL"],
  ["denied synthetic file", "file:///denied-fixture.js", "ORIGINAL"],
  ["allowed redirect", "file:///allowed.js", "ALLOWED"],
])(
  "enforces Vite file policy for %s over loopback WebSocket/HTTP",
  async (_name, redirect, marker) => {
    const fixture = await fs.mkdtemp(join(tmpdir(), "daryadarcy-mocker-"));
    await fs.chmod(fixture, 0o700);
    await fs.mkdir(join(fixture, "project"));
    const root = await fs.realpath(join(fixture, "project"));
    await fs.writeFile(
      join(fixture, "outside.js"),
      'export const marker = "OUTSIDE";',
    );
    await fs.writeFile(
      join(root, "victim.js"),
      'export const marker = "ORIGINAL";',
    );
    await fs.writeFile(
      join(root, "denied-fixture.js"),
      'export const marker = "DENIED";',
    );
    await fs.writeFile(
      join(root, "allowed.js"),
      'export const marker = "ALLOWED";',
    );
    const server = await createServer({
      root,
      configFile: false,
      logLevel: "silent",
      plugins: [interceptorPlugin()],
      optimizeDeps: { noDiscovery: true, include: [] },
      server: {
        host: "127.0.0.1",
        port: 0,
        preTransformRequests: false,
        fs: { strict: true, allow: [root], deny: ["**/denied-fixture.js"] },
      },
    });
    let socket: WebSocket | undefined;
    try {
      await server.listen();
      const address = server.httpServer!.address();
      if (!address || typeof address === "string")
        throw new Error("Missing loopback listener");
      socket = new WebSocket(`ws://127.0.0.1:${address.port}`, "vite-hmr");
      await new Promise<void>((resolve, reject) => {
        socket!.addEventListener("open", () => resolve(), { once: true });
        socket!.addEventListener(
          "error",
          () => reject(new Error("WebSocket connection failed")),
          { once: true },
        );
      });
      const registered = new Promise<void>((resolve) => {
        socket!.addEventListener("message", function ack(event) {
          const message = JSON.parse(String(event.data));
          if (message.event === "vitest:interceptor:register:result") {
            socket!.removeEventListener("message", ack);
            resolve();
          }
        });
      });
      socket.send(
        JSON.stringify({
          type: "custom",
          event: "vitest:interceptor:register",
          data: {
            type: "redirect",
            raw: "./victim.js",
            id: join(root, "victim.js"),
            url: "/victim.js",
            redirect,
          },
        }),
      );
      await registered;
      const response = await fetch(
        `http://127.0.0.1:${address.port}/victim.js`,
      );
      const body = await response.text();
      expect(response.status, body).toBe(200);
      expect(body).toContain(`"${marker}"`);
      if (marker === "ORIGINAL") {
        expect(body).not.toContain('"OUTSIDE"');
        expect(body).not.toContain('"DENIED"');
      }
    } finally {
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        const closed = new Promise<void>((resolve) =>
          socket!.addEventListener("close", () => resolve(), { once: true }),
        );
        socket.close();
        await closed;
      }
      await server.close();
      const owner = await fs.lstat(fixture);
      if (
        !owner.isDirectory() ||
        owner.isSymbolicLink() ||
        owner.uid !== process.getuid?.() ||
        (owner.mode & 0o777) !== 0o700
      ) {
        throw new Error("Refusing cleanup of unowned fixture");
      }
      await fs.rm(fixture, { recursive: true });
    }
  },
  10000,
);
