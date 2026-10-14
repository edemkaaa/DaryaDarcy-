import { createServer } from "node:http";
import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";

/** Owned SDK wire fixture, not Timeweb ACL acceptance. Stores actual request bytes. */
export async function openPrivateUploadWire() {
  const objects = new Map<
    string,
    {
      bytes: Buffer;
      etag: string;
      mime: string;
      metadata: Record<string, string>;
    }
  >();
  const effects: string[] = [];
  let deleteGate: { entered: () => void; wait: Promise<void> } | undefined;
  let dropNextPut = false,
    dropNextDelete = false,
    rejectPolicy = false;
  const bucket = "private-upload-fixture";
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, "http://loopback.invalid");
    effects.push(`${req.method} ${url.pathname}`);
    if (!req.headers.authorization?.startsWith("AWS4-HMAC-SHA256 ")) {
      res.writeHead(403).end();
      return;
    }
    if (url.searchParams.has("policy")) {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          Version: "2012-10-17",
          Statement: rejectPolicy
            ? []
            : [
                {
                  Sid: "DaryadarcyPrivateAttachmentsV1",
                  Effect: "Deny",
                  Principal: "*",
                  Action: ["s3:GetObject", "s3:GetObjectVersion"],
                  Resource: ["audio", "documents"].map(
                    (folder) =>
                      `arn:aws:s3:::${bucket}/feed/${folder}/private-v1/*`,
                  ),
                  Condition: {
                    StringNotEqualsIfExists: {
                      "aws:username": ["fixture-service-user"],
                    },
                  },
                },
              ],
        }),
      );
      return;
    }
    if (url.searchParams.has("versioning")) {
      res.setHeader("content-type", "application/xml");
      res.end(
        '<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>',
      );
      return;
    }
    const key = decodeURIComponent(url.pathname.slice(`/${bucket}/`.length));
    if (req.method === "PUT") {
      if (
        req.headers["if-none-match"] !== "*" ||
        req.headers["x-amz-acl"] !== "private" ||
        !/^feed\/(audio|documents)\/private-v1\/[a-f0-9-]{36}$/.test(key)
      ) {
        res.writeHead(400).end();
        return;
      }
      if (objects.has(key)) {
        res.writeHead(412).end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);
      const etag = `"${createHash("md5").update(bytes).digest("hex")}"`;
      if (
        req.headers["content-md5"] !==
        createHash("md5").update(bytes).digest("base64")
      ) {
        res.writeHead(400).end();
        return;
      }
      const metadata = Object.fromEntries(
        Object.entries(req.headers)
          .filter(([name]) => name.startsWith("x-amz-meta-"))
          .map(([name, value]) => [name.slice(11), String(value)]),
      );
      objects.set(key, {
        bytes,
        etag,
        mime: String(req.headers["content-type"]),
        metadata,
      });
      if (dropNextPut) {
        dropNextPut = false;
        req.socket.destroy();
        return;
      }
      res.setHeader("etag", etag);
      res.end();
      return;
    }
    const object = objects.get(key);
    if (!object) {
      res.writeHead(404).end();
      return;
    }
    if (req.method === "DELETE") {
      if (req.headers["if-match"] !== object.etag) {
        res.writeHead(412).end();
        return;
      }
      if (deleteGate) {
        const gate = deleteGate;
        deleteGate = undefined;
        gate.entered();
        await gate.wait;
      }
      objects.delete(key);
      if (dropNextDelete) {
        dropNextDelete = false;
        req.socket.destroy();
        return;
      }
      res.writeHead(204).end();
      return;
    }
    res.setHeader("content-length", object.bytes.length);
    res.setHeader("content-type", object.mime);
    res.setHeader("etag", object.etag);
    for (const [name, value] of Object.entries(object.metadata))
      res.setHeader(`x-amz-meta-${name}`, value);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    if (req.method === "GET") {
      res.end(object.bytes);
      return;
    }
    res.writeHead(405).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    objects,
    effects,
    bucket,
    endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    dropPutAck: () => {
      dropNextPut = true;
    },
    dropDeleteAck: () => {
      dropNextDelete = true;
    },
    pauseDelete: () => {
      let enter!: () => void, release!: () => void;
      const entered = new Promise<void>((resolve) => {
        enter = resolve;
      });
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      deleteGate = { entered: enter, wait };
      return { entered, release };
    },
    rejectPolicy: (value: boolean) => {
      rejectPolicy = value;
    },
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
