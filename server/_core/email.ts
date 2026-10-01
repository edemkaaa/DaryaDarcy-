import nodemailer from "nodemailer";
import { PUBLIC_CONTACT_EMAIL } from "../../shared/contact";

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
  });
  return transporter;
}

export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  const to = input.to.trim();
  if (!to) return false;
  const tx = getTransporter();
  if (!tx) {
    console.warn("[email] SMTP not configured — skipped:", input.subject, "→", to);
    return false;
  }
  const from = (process.env.SMTP_FROM || PUBLIC_CONTACT_EMAIL).trim();
  try {
    await tx.sendMail({
      from: `DARYADARCY <${from}>`,
      to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? input.text.replace(/\n/g, "<br/>"),
    });
    return true;
  } catch (error) {
    console.error("[email] send failed", error);
    return false;
  }
}
