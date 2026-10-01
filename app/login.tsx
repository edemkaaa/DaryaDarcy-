import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { SmsCodeForm } from "@/components/sms-code-form";
import * as Api from "@/lib/_core/api";
import { useAuth } from "@/hooks/use-auth";

const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const CREAM = "#FDF8F0";
const OLIVE = "#6B7B5E";

function safeNextPath(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return null;
  }
  return raw;
}

export default function LoginScreen() {
  const { applySession } = useAuth();
  const params = useLocalSearchParams<{ next?: string }>();
  const [method, setMethod] = useState<"sms" | "email">("sms");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const goNext = async (user: Api.AuthUser | null) => {
    await applySession(user);
    const next = safeNextPath(params.next);
    if (next) {
      router.replace(next as any);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/profile" as any);
    }
  };

  const submitEmail = async () => {
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === "login"
          ? await Api.loginWithEmail(email, password)
          : await Api.registerWithEmail(email, password, name);
      await goNext(result.user ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer containerClassName="bg-[#FDF8F0]">
      <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.kicker}>DARYADARCY</Text>
            <Text style={styles.title}>
              {method === "sms" ? "Вход" : mode === "login" ? "Вход по почте" : "Регистрация"}
            </Text>
            <Text style={styles.subtitle}>
              {method === "sms"
                ? "Введите номер — код придёт в SMS в течение минуты"
                : mode === "login"
                  ? "Войдите, чтобы сохранять посты и пользоваться клубом"
                  : "Создайте аккаунт по email"}
            </Text>

            {method === "sms" ? (
              <SmsCodeForm purpose="login" onSuccess={(user) => void goNext(user)} />
            ) : (
              <>
                {mode === "register" && (
                  <TextInput
                    style={styles.input}
                    placeholder="Имя"
                    placeholderTextColor={BROWN_MUTED}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                )}
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor={BROWN_MUTED}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Пароль"
                  placeholderTextColor={BROWN_MUTED}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="go"
                  onSubmitEditing={() => {
                    if (!busy) void submitEmail();
                  }}
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <Pressable
                  style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
                  onPress={submitEmail}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color={CREAM} />
                  ) : (
                    <Text style={styles.buttonText}>
                      {mode === "login" ? "Войти" : "Создать аккаунт"}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => {
                    setError(null);
                    setMode(mode === "login" ? "register" : "login");
                  }}
                >
                  <Text style={styles.switchText}>
                    {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
                  </Text>
                </Pressable>
              </>
            )}

            <Pressable
              onPress={() => {
                setError(null);
                setMethod(method === "sms" ? "email" : "sms");
                setMode("login");
              }}
            >
              <Text style={styles.switchText}>
                {method === "sms" ? "Войти по почте" : "Войти по телефону"}
              </Text>
            </Pressable>

            <Pressable onPress={() => router.back()}>
              <Text style={styles.backText}>Назад</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
  },
  kicker: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 13,
    letterSpacing: 4,
    color: OLIVE,
    textAlign: "center",
    marginBottom: 8,
  },
  title: {
    fontFamily: "PlayfairDisplay-Regular",
    fontSize: 36,
    color: BROWN,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: BROWN_MUTED,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
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
  buttonText: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 17,
    color: CREAM,
  },
  switchText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: BROWN,
    textAlign: "center",
    marginTop: 20,
    textDecorationLine: "underline",
  },
  backText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: BROWN_MUTED,
    textAlign: "center",
    marginTop: 16,
  },
});
