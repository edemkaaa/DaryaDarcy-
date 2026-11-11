import { createServer, type Server, type Socket } from "node:net";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let server: Server;
let sockets: Set<Socket>;
let commands: string[];
let messages: string[];
let rejectRecipient = false;

/** Поднимает настоящий loopback SMTP-протокол с управляемым RCPT-отказом и только тестовыми реквизитами. */
beforeEach(async () => {
  vi.resetModules();
  sockets = new Set(); commands = []; messages = []; rejectRecipient = false;
  // Real SMTP boundary, restricted to loopback and test-only credentials.
  server = createServer(socket => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.setEncoding("utf8");
    socket.write("220 local.test ESMTP\r\n");
    let pending = "", data: string[] | null = null;
    socket.on("data", chunk => {
      pending += chunk;
      let end: number;
      while ((end = pending.indexOf("\r\n")) >= 0) {
        const line = pending.slice(0, end); pending = pending.slice(end + 2);
        if (data !== null) {
          if (line === ".") { messages.push(data.join("\r\n")); data = null; socket.write("250 queued\r\n"); }
          else data.push(line.replace(/^\.\./, "."));
          continue;
        }
        commands.push(line);
        if (/^EHLO|^HELO/.test(line)) socket.write("250-local.test\r\n250-AUTH PLAIN\r\n250 8BITMIME\r\n");
        else if (line.startsWith("STARTTLS")) socket.write("454 TLS unavailable\r\n");
        else if (line.startsWith("AUTH PLAIN")) socket.write("235 authenticated\r\n");
        else if (line.startsWith("MAIL FROM")) socket.write("250 sender accepted\r\n");
        else if (line.startsWith("RCPT TO")) socket.write(rejectRecipient ? "550 recipient rejected\r\n" : "250 recipient accepted\r\n");
        else if (line === "DATA") { data = []; socket.write("354 send data\r\n"); }
        else if (line === "QUIT") socket.end("221 goodbye\r\n");
        else socket.write("500 unsupported\r\n");
      }
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test SMTP listener");
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("SMTP_HOST", "127.0.0.1");
  vi.stubEnv("SMTP_PORT", String(address.port));
  vi.stubEnv("SMTP_SECURE", "false");
  vi.stubEnv("SMTP_USER", "sender@example.test");
  vi.stubEnv("SMTP_PASS", "smtp-test-only");
  vi.stubEnv("SMTP_FROM", "sender@example.test");
  vi.stubEnv("SMTP_REPLY_TO", "");
});

/** Закрывает свои SMTP-сокеты и сервер и возвращает окружение и подмены. */
afterEach(async () => {
  for (const socket of sockets) socket.destroy();
  await new Promise<void>(resolve => server.close(() => resolve()));
  vi.unstubAllEnvs(); vi.restoreAllMocks();
});

const mail = { to: "member@example.test", subject: "Access", text: "<tag>&", messageId: "<access-test@example.test>" };

/** Проверяет независимый legacy SMTP sender от публичного адреса получения обращений. */
it("keeps the legacy SMTP identity independent of the public contact recipient", async () => {
  vi.stubEnv("SMTP_USER", "");
  vi.stubEnv("SMTP_FROM", "");
  const { sendTransactionalEmail } = await import("../apps/backend/src/_core/email");
  expect(await sendTransactionalEmail(mail)).toBe(true);
  expect(commands).toContain("MAIL FROM:<daryadarcyapp@yandex.ru>");
  const auth = commands.find(command => command.startsWith("AUTH PLAIN "))!;
  expect(Buffer.from(auth.slice("AUTH PLAIN ".length), "base64").toString()).toBe(
    "\0daryadarcyapp@yandex.ru\0smtp-test-only",
  );
});

/** Проверяет явную настроенную sender-идентичность по настоящему локальному SMTP envelope и From. */
it("uses an explicitly configured owner identity on the loopback transport", async () => {
  vi.stubEnv("SMTP_USER", "daryadarcy19@gmail.com");
  vi.stubEnv("SMTP_FROM", "daryadarcy19@gmail.com");
  const { sendTransactionalEmail } = await import("../apps/backend/src/_core/email");
  expect(await sendTransactionalEmail(mail)).toBe(true);
  expect(commands).toContain("MAIL FROM:<daryadarcy19@gmail.com>");
  expect(commands.filter(command => command.startsWith("RCPT TO"))).toEqual(["RCPT TO:<member@example.test>"]);
  expect(messages[0]).toContain("From: DARYADARCY <daryadarcy19@gmail.com>");
});

/** Проверяет один envelope-recipient, устойчивый Message-ID и экранированный HTML в принятом локальным SMTP сообщении. */
it("delivers one envelope recipient, stable Message-ID and escaped HTML through real SMTP", async () => {
  const { sendTransactionalEmail } = await import("../apps/backend/src/_core/email");
  expect(await sendTransactionalEmail(mail)).toBe(true);
  expect(commands.filter(command => command.startsWith("RCPT TO"))).toEqual(["RCPT TO:<member@example.test>"]);
  expect(messages).toHaveLength(1);
  expect(messages[0]).toContain("Message-ID: <access-test@example.test>");
  expect(messages[0]).toContain("Content-Type: text/plain;");
  expect(messages[0]).toContain("Content-Type: text/html;");
  expect(messages[0]).toContain("&lt;tag&gt;&amp;");
});

/** Проверяет false при отказе SMTP и отсутствие адресата в диагностике без принятого сообщения. */
it("does not report successful delivery or log recipient data on SMTP rejection", async () => {
  rejectRecipient = true;
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const { sendTransactionalEmail } = await import("../apps/backend/src/_core/email");
  expect(await sendTransactionalEmail(mail)).toBe(false);
  expect(messages).toEqual([]);
  expect(log.mock.calls.flat().join(" ")).not.toContain(mail.to);
});

/** Проверяет запрет передачи production-реквизитов серверу, не согласовавшему TLS. */
it("does not expose credentials to a production SMTP server that cannot negotiate TLS", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { sendTransactionalEmail } = await import("../apps/backend/src/_core/email");
  expect(await sendTransactionalEmail(mail)).toBe(false);
  expect(commands.some(command => command.startsWith("AUTH"))).toBe(false);
  expect(messages).toEqual([]);
});

/** Проверяет отказ списку адресатов до открытия SMTP-соединения. */
it("rejects recipient lists before making any SMTP connection", async () => {
  const { sendTransactionalEmail } = await import("../apps/backend/src/_core/email");
  expect(await sendTransactionalEmail({ ...mail, to: "member@example.test,second@example.test" })).toBe(false);
  expect(commands).toEqual([]);
});


/** Проверяет Reply-To поддержки без копирования личного письма и без изменения SMTP identity и единственного получателя. */
it("routes replies to the support mailbox without copying private mail or changing SMTP identity", async () => {
  vi.stubEnv("SMTP_REPLY_TO", "support@daryadarcy.com");
  const { sendTransactionalEmail } = await import("../apps/backend/src/_core/email");
  expect(await sendTransactionalEmail(mail)).toBe(true);
  expect(commands).toContain("MAIL FROM:<sender@example.test>");
  expect(commands.filter(command => command.startsWith("RCPT TO"))).toEqual(["RCPT TO:<member@example.test>"]);
  expect(messages).toHaveLength(1);
  expect(messages[0]).toContain("From: DARYADARCY <sender@example.test>");
  expect(messages[0]).toContain("Reply-To: support@daryadarcy.com");
  expect(messages[0]).not.toMatch(/^(?:Cc|Bcc):/mi);
  const auth = commands.find(command => command.startsWith("AUTH PLAIN "))!;
  expect(Buffer.from(auth.slice("AUTH PLAIN ".length), "base64").toString()).toBe("\0sender@example.test\0smtp-test-only");
});

/** Проверяет форму Reply-To и запрет header-injection до SMTP-соединения. */
it.each([
  "support@example.test,other@example.test",
  "Support <support@example.test>",
  "support@example.test\r\nBcc: other@example.test",
  "not-an-address",
])("rejects an invalid support reply address before opening SMTP: %s", async replyTo => {
  vi.stubEnv("SMTP_REPLY_TO", replyTo);
  const { sendTransactionalEmail } = await import("../apps/backend/src/_core/email");
  expect(await sendTransactionalEmail(mail)).toBe(false);
  expect(commands).toEqual([]);
  expect(messages).toEqual([]);
});

/** Проверяет отсутствие дополнительного Reply-To при выключенной необязательной настройке. */
it("preserves existing mail headers when the optional support address is not enabled", async () => {
  vi.stubEnv("SMTP_REPLY_TO", "   ");
  const { sendTransactionalEmail } = await import("../apps/backend/src/_core/email");
  expect(await sendTransactionalEmail(mail)).toBe(true);
  expect(messages[0]).not.toMatch(/^Reply-To:/mi);
});
