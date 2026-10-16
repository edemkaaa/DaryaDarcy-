import { expect, it } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { httpResponseFaultProxy } from "./helpers/http-response-fault-proxy";

it.each([
  "admin.createPost",
  "club.addComment",
  "club.uploadPrivateCommentPhoto",
  "binary.privateVideoUpload",
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
      const path =
        procedure === "binary.privateVideoUpload"
          ? "/api/admin/private-video-uploads?filename=video.mp4"
          : `/api/trpc/${procedure}?batch=1`;
      await expect(
        fetch(`${proxy.base}${path}`, {
          method: "POST",
          body: "{}",
        }),
      ).rejects.toThrow();
      await fault.reached;
      expect(writes).toBe(1);
      expect(proxy.calls).toMatchObject([
        { status: 200, pathname: path.split("?")[0] },
      ]);
      const response = await fetch(`${proxy.base}${path}`, {
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

it.each([
  "admin.privateAttachmentStatus",
  "club.privateCommentPhotoStatus",
  "binary.privateVideoUpload",
])(
  "holds a completed upstream response until released, without replacing it: %s",
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
      const path =
        procedure === "binary.privateVideoUpload"
          ? "/api/admin/private-video-uploads?filename=video.mp4"
          : `/api/trpc/${procedure}`;
      const response = fetch(`${proxy.base}${path}`, {
        method: procedure === "binary.privateVideoUpload" ? "POST" : "GET",
      }).then((value) => {
        settled = true;
        return value;
      });
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
