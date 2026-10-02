import nodemailer, { type Transporter } from "nodemailer";
import { z } from "zod";
import { PUBLIC_CONTACT_EMAIL } from "../../../../packages/shared/src/contact";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  const host = (process.env.SMTP_HOST || "smtp.yandex.ru").trim();
  const user = (process.env.SMTP_USER || PUBLIC_CONTACT_EMAIL).trim();
  const pass = (process.env.SMTP_PASS || "").trim();
  if (!pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    // Never fall back to plaintext password authentication in production.
    requireTLS: process.env.NODE_ENV === "production",
    disableFileAccess: true,
    disableUrlAccess: true,
    maxRecipients: 1,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
  return transporter;
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  messageId?: string;
}): Promise<boolean> {
  const to = input.to.trim();
  const from = (process.env.SMTP_FROM || PUBLIC_CONTACT_EMAIL).trim();
  // Access links are private: never accept a display-name/address-list here.
  const recipient = z.email().max(320);
  if (!recipient.safeParse(to).success || !recipient.safeParse(from).success) return false;
  const tx = getTransporter();
  if (!tx) {
    console.warn("[email] SMTP not configured");
    return false;
  }
  try {
    await tx.sendMail({
      from: { name: "DARYADARCY", address: from },
      to: { name: "", address: to },
      subject: input.subject,
      text: input.text,
      messageId: input.messageId,
      html: input.html ?? input.text.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!)).replace(/\n/g, "<br/>"),
    });
    return true;
  } catch (error) {
    console.error("[email] send failed");
    return false;
  }
}
