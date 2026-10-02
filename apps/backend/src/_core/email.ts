import nodemailer from "nodemailer";
import { PUBLIC_CONTACT_EMAIL } from "../../../../packages/shared/src/contact";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = (process.env.SMTP_HOST || "smtp.yandex.ru").trim();
  const user = (process.env.SMTP_USER || PUBLIC_CONTACT_EMAIL).trim();
  const pass = (process.env.SMTP_PASS || "").trim();
  if (!pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
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
  if (!to) return false;
  const tx = getTransporter();
  if (!tx) {
    console.warn("[email] SMTP not configured");
    return false;
  }
  const from = (process.env.SMTP_FROM || PUBLIC_CONTACT_EMAIL).trim();
  try {
    await tx.sendMail({
      from: `DARYADARCY <${from}>`,
      to,
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
