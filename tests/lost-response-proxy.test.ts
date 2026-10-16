import { expect, it } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { httpResponseFaultProxy } from "./helpers/http-response-fault-proxy";

it.each([
  "admin.createPost",
  "club.addComment",
  "club.uploadPrivateCommentPhoto",
])(
  "drops only the response after the real upstream mutation has committed: %s",
  async (procedure) => {
    let writes = 0;
    const upstream = createServer((req, res) => {
      req.resume();
      req.once("end", () => {
        writes++;
        res.end("committed");
      });
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, "127.0.0.1", resolve),
    );
    const proxy = await httpResponseFaultProxy(
      `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
    );
    try {
      const fault = proxy.arm(procedure, "drop");
      await expect(
        fetch(`${proxy.base}/api/trpc/${procedure}?batch=1`, {
          method: "POST",
          body: "{}",
        }),
      ).rejects.toThrow();
      await fault.reached;
      expect(writes).toBe(1);
      expect(proxy.calls).toMatchObject([
        { status: 200, pathname: `/api/trpc/${procedure}` },
      ]);
      const response = await fetch(`${proxy.base}/api/trpc/${procedure}`, {
        method: "POST",
        body: "{}",
      });
      expect(await response.text()).toBe("committed");
      expect(writes).toBe(2); // The proxy neither retries nor invents a response.
    } finally {
      await proxy.close();
      upstream.closeAllConnections();
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
    }
  },
);

it.each(["admin.privateAttachmentStatus", "club.privateCommentPhotoStatus"])(
  "holds a completed status response until released, without replacing it: %s",
  async (procedure) => {
    const upstream = createServer((_req, res) => {
      res.setHeader("x-real", "yes");
      res.end("ready");
    });
    await new Promise<void>((resolve) =>
      upstream.listen(0, "127.0.0.1", resolve),
    );
    const proxy = await httpResponseFaultProxy(
      `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`,
    );
    try {
      const fault = proxy.arm(procedure, "hold");
      let settled = false;
      const response = fetch(`${proxy.base}/api/trpc/${procedure}`).then(
        (value) => {
          settled = true;
          return value;
        },
      );
      await fault.reached;
      expect(settled).toBe(false);
      fault.release();
      const received = await response;
      expect(received.headers.get("x-real")).toBe("yes");
      expect(await received.text()).toBe("ready");
    } finally {
      await proxy.close();
      upstream.closeAllConnections();
      await new Promise<void>((resolve) => upstream.close(() => resolve()));
    }
  },
);
