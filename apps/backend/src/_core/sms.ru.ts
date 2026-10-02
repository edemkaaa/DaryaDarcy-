import { ENV } from "./env";

type SmsRuSendResult = {
  status?: string;
  status_code?: number;
  status_text?: string;
  sms?: Record<
    string,
    { status?: string; status_code?: number; status_text?: string; sms_id?: string }
  >;
};

function userMessageForCode(code: number | undefined): string {
  switch (code) {
    case 201:
      return "Сейчас не удалось отправить SMS. Попробуйте позже.";
    case 202:
    case 207:
      return "На этот номер нельзя отправить код. Проверьте номер.";
    case 204:
    case 221:
      return "Не удалось отправить SMS. Попробуйте позже.";
    case 206:
      return "На сегодня лимит SMS исчерпан. Войдите по почте или попробуйте завтра.";
    case 220:
    case 230:
    case 231:
    case 232:
    case 233:
    case 505:
      return "Слишком много SMS на этот номер. Попробуйте позже.";
    default:
      return "Не удалось отправить SMS. Попробуйте позже.";
  }
}

function nestedResult(result: SmsRuSendResult, to: string) {
  return result.sms?.[to];
}

function senderRejected(result: SmsRuSendResult, to: string): boolean {
  const nested = nestedResult(result, to);
  return result.status_code === 204 || result.status_code === 221 || nested?.status_code === 204;
}

async function postSms(to: string, msg: string, ip: string, withFrom: boolean): Promise<SmsRuSendResult> {
  const body = new URLSearchParams({
    api_id: ENV.smsRuApiId,
    to,
    msg,
    json: "1",
    ttl: "5",
    ip: ip || "0.0.0.0",
  });
  if (withFrom && ENV.smsRuFrom) {
    body.set("from", ENV.smsRuFrom);
  }

  const response = await fetch("https://sms.ru/sms/send", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15000),
  });

  const text = await response.text();
  try {
    return JSON.parse(text) as SmsRuSendResult;
  } catch {
    console.error("[SMS] unexpected response", { http: response.status });
    throw new Error("Не удалось отправить SMS. Попробуйте позже.");
  }
}

export async function sendLoginSms(to: string, code: string, ip: string): Promise<void> {
  if (!ENV.smsRuApiId) {
    throw new Error("Вход по SMS временно недоступен");
  }

  const msg = `${code} — код для входа на daryadarcy.com. Никому не сообщайте.`;
  let usedFrom = Boolean(ENV.smsRuFrom);
  let result = await postSms(to, msg, ip, usedFrom);

  if (usedFrom && senderRejected(result, to)) {
    usedFrom = false;
    result = await postSms(to, msg, ip, false);
  }

  const phoneResult = nestedResult(result, to);
  const ok =
    result.status === "OK" &&
    result.status_code === 100 &&
    (!phoneResult || phoneResult.status === "OK" || phoneResult.status_code === 100);

  if (!ok) {
    const statusCode = phoneResult?.status_code ?? result.status_code;
    console.error("[SMS] send failed", {
      status_code: statusCode,
      status_text: phoneResult?.status_text || result.status_text,
      from: usedFrom ? ENV.smsRuFrom : "default",
    });
    throw new Error(userMessageForCode(statusCode));
  }

  console.info("[SMS] sent", {
    to: `***${to.slice(-4)}`,
    sms_id: phoneResult?.sms_id || null,
    from: usedFrom ? ENV.smsRuFrom : "default",
  });
}
