import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Api from "@/lib/_core/api";
import { formatPhoneInput, formatRuPhone, normalizeRuPhone } from "@shared/phone";
import {
  SMS_LOGIN_CONSENT_LABEL,
  SMS_LOGIN_CONSENT_VERSION,
} from "@shared/consent-texts";

const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const CREAM = "#FDF8F0";
const OLIVE = "#6B7B5E";

type Props = {
  purpose: "login" | "bind";
  onSuccess: (user: Api.AuthUser) => void;
};

export function SmsCodeForm({ purpose, onSuccess }: Props) {
  const [phoneInput, setPhoneInput] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [consentChecked, setConsentChecked] = useState(false);
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const verifyingRef = useRef(false);

  const phone = normalizeRuPhone(phoneInput);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = setTimeout(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [retryAfter]);

  const send = async () => {
    setError(null);
    if (!phone) {
      setError("Укажите российский номер: +7 9XX XXX-XX-XX");
      return;
    }
    if (purpose === "login" && !consentChecked) {
      setError("Подтвердите согласие на обработку персональных данных");
      return;
    }
    setBusy(true);
    try {
      const result = await Api.sendSmsCode(phone);
      setStep("code");
      setRetryAfter(result.retryAfterSec || 60);
    } catch (err) {
      const retryAfterSec = (err as Error & { retryAfterSec?: number }).retryAfterSec;
      if (retryAfterSec) {
        setStep("code");
        setRetryAfter(retryAfterSec);
      }
      setError(err instanceof Error ? err.message : "Не удалось отправить SMS");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setError(null);
    if (!phone || code.trim().length < 4) {
      setError("Введите код из SMS");
      return;
    }
    if (verifyingRef.current) return;
    verifyingRef.current = true;
    setBusy(true);
    try {
      const result = await Api.verifySmsCode(
        phone,
        code.trim(),
        purpose === "login" ? SMS_LOGIN_CONSENT_VERSION : undefined,
        totp.trim() || undefined,
      );
      onSuccess(result.user);
    } catch (err) {
      const authErr = err as Error & { requiresTotp?: boolean };
      if (authErr.requiresTotp) setNeedsTotp(true);
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      verifyingRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step !== "code" || code.length !== 6 || busy || verifyingRef.current) return;
    void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-submit once the 6-digit code is complete
  }, [code, step]);

  return (
    <View>
      {step === "phone" ? (
        <>
          <View style={styles.phoneRow}>
            <Text style={styles.prefix}>+7</Text>
            <TextInput
              style={styles.phoneInput}
              placeholder="900 000-00-00"
              placeholderTextColor={BROWN_MUTED}
              value={phoneInput}
              onChangeText={(value) => setPhoneInput(formatPhoneInput(value))}
              keyboardType="phone-pad"
              autoComplete="tel"
              returnKeyType="go"
              onSubmitEditing={() => {
                if (!busy) void send();
              }}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {purpose === "login" ? (
            <Pressable onPress={() => setConsentChecked((v) => !v)} style={styles.consentRow}>
              <MaterialIcons
                name={consentChecked ? "check-box" : "check-box-outline-blank"}
                size={22}
                color={consentChecked ? OLIVE : BROWN_MUTED}
              />
              <Text style={styles.consentCheckboxText}>{SMS_LOGIN_CONSENT_LABEL}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              (busy || (purpose === "login" && !consentChecked)) && styles.buttonDisabled,
              pressed && { opacity: 0.85 },
            ]}
            onPress={send}
            disabled={busy || (purpose === "login" && !consentChecked)}
          >
            {busy ? (
              <ActivityIndicator color={CREAM} />
            ) : (
              <Text style={styles.buttonText}>Получить код</Text>
            )}
          </Pressable>
          {purpose === "login" ? (
            <Text style={styles.consent}>
              Также доступны{" "}
              <Text style={styles.consentLink} onPress={() => router.push("/privacy")}>
                Политика конфиденциальности
              </Text>
              {" "}и{" "}
              <Text style={styles.consentLink} onPress={() => router.push("/legal" as any)}>
                юридические документы
              </Text>
              .
            </Text>
          ) : (
            <Text style={styles.consent}>Код придёт в SMS. Номер сохранится в аккаунте.</Text>
          )}
        </>
      ) : (
        <>
          <Text style={styles.sentTo}>Код отправлен на {formatRuPhone(phone || "")}</Text>
          <Text style={styles.hint}>Действует 5 минут. Имя отправителя может быть служебным, пока модерация не подтвердит daryadarcy.</Text>
          <Pressable
            onPress={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
          >
            <Text style={styles.changeNumber}>Изменить номер</Text>
          </Pressable>
          <TextInput
            style={styles.input}
            autoFocus
            placeholder="Код из SMS"
            placeholderTextColor={BROWN_MUTED}
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="go"
            onSubmitEditing={() => {
              if (!busy) void verify();
            }}
          />
          {needsTotp ? (
            <TextInput
              style={styles.input}
              placeholder="Код 2FA (6 цифр)"
              placeholderTextColor={BROWN_MUTED}
              value={totp}
              onChangeText={(value) => setTotp(value.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
            />
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
            onPress={verify}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={CREAM} />
            ) : (
              <Text style={styles.buttonText}>{purpose === "bind" ? "Привязать" : "Войти"}</Text>
            )}
          </Pressable>
          <Pressable onPress={send} disabled={busy || retryAfter > 0}>
            <Text style={[styles.resend, retryAfter > 0 && { opacity: 0.5 }]}>
              {retryAfter > 0 ? `Отправить ещё раз через ${retryAfter} с` : "Отправить код ещё раз"}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.25)",
    borderRadius: 8,
    marginBottom: 12,
    paddingLeft: 14,
  },
  prefix: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 18,
    color: BROWN,
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontFamily: "EBGaramond-Regular",
    fontSize: 18,
    color: BROWN,
    paddingHorizontal: 0,
    paddingVertical: 12,
    paddingRight: 14,
  },
  input: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 18,
    color: BROWN,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.25)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    letterSpacing: 4,
    textAlign: "center",
  },
  error: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: "#8B3A3A",
    textAlign: "center",
    marginBottom: 12,
  },
  button: {
    backgroundColor: OLIVE,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 17,
    color: CREAM,
  },
  consent: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: BROWN_MUTED,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 14,
  },
  consentLink: {
    textDecorationLine: "underline",
    color: BROWN,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
    marginTop: 4,
  },
  consentCheckboxText: {
    flex: 1,
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: BROWN_MUTED,
    lineHeight: 20,
  },
  sentTo: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: BROWN,
    textAlign: "center",
    marginBottom: 6,
  },
  hint: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: BROWN_MUTED,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 10,
  },
  changeNumber: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: BROWN_MUTED,
    textAlign: "center",
    textDecorationLine: "underline",
    marginBottom: 16,
  },
  resend: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: BROWN,
    textAlign: "center",
    marginTop: 16,
    textDecorationLine: "underline",
  },
});
