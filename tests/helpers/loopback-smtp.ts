import { createServer, type AddressInfo, type Socket } from "node:net";

/** A real SMTP wire confined to loopback; never connects to an external server. */
export async function openLoopbackSmtp() {
  const sockets = new Set<Socket>();
  const messages: string[] = [];
  const recipients: string[] = [];
  let reject = false;
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.setEncoding("utf8");
    socket.write("220 local.test ESMTP\r\n");
    let pending = "";
    let body: string[] | null = null;
    socket.on("data", (chunk) => {
      pending += chunk;
      let end: number;
      while ((end = pending.indexOf("\r\n")) >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (body !== null) {
          if (line === ".") {
            messages.push(body.join("\r\n"));
            body = null;
            socket.write("250 queued\r\n");
          } else body.push(line.replace(/^\.\./, "."));
        } else if (/^EHLO|^HELO/.test(line))
          socket.write("250-local.test\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n");
        else if (line.startsWith("AUTH PLAIN"))
          socket.write("235 authenticated\r\n");
        else if (line.startsWith("MAIL FROM")) socket.write("250 accepted\r\n");
        else if (line.startsWith("RCPT TO")) {
          if (!reject) recipients.push(line);
          socket.write(reject ? "550 rejected\r\n" : "250 accepted\r\n");
        } else if (line === "DATA") {
          body = [];
          socket.write("354 send data\r\n");
        } else if (line === "QUIT") socket.end("221 goodbye\r\n");
        else socket.write("500 unsupported\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    messages,
    recipients,
    rejectRecipients(value: boolean) {
      reject = value;
    },
    reset() {
      messages.length = 0;
      recipients.length = 0;
      reject = false;
    },
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
