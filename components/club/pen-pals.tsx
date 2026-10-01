import { useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { PEN_PAL_INTERESTS, PEN_PAL_ADULT_CONSENT_LABEL } from "@/shared/pen-pals";

const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const CREAM = "#FDF8F0";
const OLIVE = "#6B7B5E";
const SAGE = "#8FA87A";

type Screen = "form" | "results";
type MatchCard = {
  userId: number;
  matchId: number | null;
  name: string | null;
  avatarUrl: string | null;
  fullName: string;
  address?: string;
  interests: string[];
  sharedInterests: string[];
  myConfirmed: boolean;
  theirConfirmed: boolean;
  mutualConfirmed: boolean;
  confirmDeadline: Date | string | null;
};

interface PenPalsProps {
  onClose: () => void;
}

export function PenPals({ onClose }: PenPalsProps) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [screen, setScreen] = useState<Screen>("form");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [adultConsent, setAdultConsent] = useState(false);
  const [matches, setMatches] = useState<MatchCard[]>([]);
  const [searched, setSearched] = useState(false);
  const [booting, setBooting] = useState(true);
  const bootRef = useRef(false);

  const meQuery = trpc.penPals.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const upsert = trpc.penPals.upsert.useMutation();
  const find = trpc.penPals.find.useMutation();
  const remove = trpc.penPals.remove.useMutation();
  const requestMatch = trpc.penPals.requestMatch.useMutation();
  const respondMatch = trpc.penPals.respondMatch.useMutation();

  useEffect(() => {
    if (bootRef.current) return;
    if (authLoading) return;
    if (!isAuthenticated) {
      bootRef.current = true;
      setBooting(false);
      return;
    }
    if (meQuery.isLoading) return;

    bootRef.current = true;
    const profile = meQuery.data;
    if (!profile) {
      setBooting(false);
      return;
    }

    setFullName(profile.fullName);
    setAddress(profile.address);
    setSelectedInterests(profile.interests);
    find.mutate(undefined, {
      onSuccess: (result) => {
        setMatches(result.matches);
        setSearched(true);
        setScreen(result.needsProfile ? "form" : "results");
        setBooting(false);
      },
      onError: () => setBooting(false),
    });
  }, [authLoading, isAuthenticated, meQuery.isLoading, meQuery.data, find]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interest)) return prev.filter((item) => item !== interest);
      if (prev.length >= 3) return prev;
      return [...prev, interest];
    });
  };

  const canSubmit =
    selectedInterests.length >= 2 &&
    fullName.trim().length >= 2 &&
    address.trim().length >= 5 &&
    adultConsent;

  const handleSubmit = () => {
    if (!canSubmit) return;
    upsert.mutate(
      {
        fullName: fullName.trim(),
        interests: selectedInterests,
        address: address.trim(),
        adultConsent: true as const,
      },
      {
        onSuccess: () => {
          find.mutate(undefined, {
            onSuccess: (result) => {
              setMatches(result.matches);
              setSearched(true);
              setScreen("results");
            },
          });
        },
      },
    );
  };

  const handleFindMore = () => {
    find.mutate(undefined, {
      onSuccess: (result) => {
        setMatches(result.matches);
        setSearched(true);
      },
    });
  };

  const handleRemove = () => {
    const clearLocal = () => {
      setFullName("");
      setAddress("");
      setSelectedInterests([]);
      setMatches([]);
      setSearched(false);
      setScreen("form");
    };
    const run = () => remove.mutate(undefined, { onSuccess: clearLocal });
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Удалить анкету из Почтового отделения?")) run();
      return;
    }
    Alert.alert("Удалить анкету?", "Вас больше не будут подбирать для переписки.", [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: run },
    ]);
  };

  const busy = upsert.isPending || find.isPending || remove.isPending || requestMatch.isPending || respondMatch.isPending;

  const refreshMatches = () => {
    find.mutate(undefined, {
      onSuccess: (result) => {
        setMatches(result.matches);
        setSearched(true);
      },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color={BROWN_MUTED} />
        </Pressable>
      </View>

      {authLoading || booting ? (
        <View style={styles.centered}>
          <ActivityIndicator color={OLIVE} />
        </View>
      ) : !isAuthenticated ? (
        <View style={styles.centered}>
          <MaterialIcons name="mail-outline" size={42} color={OLIVE} />
          <Text style={styles.successTitle}>Войдите в аккаунт</Text>
          <Text style={styles.successText}>
            Чтобы найти друга по переписке, нужно войти — так мы сможем передать адрес только вашей паре.
          </Text>
          <Pressable
            style={styles.submitButton}
            onPress={() => {
              onClose();
              router.push("/login?next=/club");
            }}
          >
            <Text style={styles.submitButtonText}>Войти</Text>
          </Pressable>
        </View>
      ) : screen === "results" ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Почтовое отделение</Text>
          {matches.length > 0 ? (
            <>
              <Text style={styles.subtitle}>
                Адрес показывается только после взаимного подтверждения (7 дней на ответ)
              </Text>
              {matches.map((match) => (
                <View key={match.userId} style={styles.letterCard}>
                  <View style={styles.letterHeader}>
                    {match.avatarUrl ? (
                      <Image source={{ uri: match.avatarUrl }} style={styles.avatar} contentFit="cover" />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <Text style={styles.avatarInitial}>{(match.name || "?").slice(0, 1).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.letterName}>{match.fullName || match.name || "Участница клуба"}</Text>
                      <Text style={styles.letterCity}>
                        {match.mutualConfirmed
                          ? "Адрес открыт — можно писать письмо"
                          : match.myConfirmed && !match.theirConfirmed
                            ? "Ожидаем подтверждения от собеседницы"
                            : match.theirConfirmed && !match.myConfirmed
                              ? "Собеседница ждёт вашего подтверждения"
                              : "Новое совпадение по интересам"}
                      </Text>
                    </View>
                    <MaterialIcons name="markunread" size={22} color={SAGE} />
                  </View>
                  {match.mutualConfirmed && match.address ? (
                    <>
                      <Text style={styles.letterLabel}>Почтовый адрес</Text>
                      <Text style={styles.letterAddress}>{match.address}</Text>
                    </>
                  ) : null}
                  <View style={styles.interestsGrid}>
                    {match.interests.map((interest) => {
                      const shared = match.sharedInterests.includes(interest);
                      return (
                        <View key={interest} style={[styles.interestChip, shared && styles.interestChipSelected]}>
                          <Text style={[styles.interestChipText, shared && styles.interestChipTextSelected]}>
                            {interest}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {!match.mutualConfirmed && match.matchId ? (
                    <View style={styles.matchActions}>
                      {!match.myConfirmed ? (
                        <Pressable
                          style={styles.confirmBtn}
                          onPress={() =>
                            respondMatch.mutate(
                              { matchId: match.matchId!, accept: true },
                              { onSuccess: refreshMatches },
                            )
                          }
                        >
                          <Text style={styles.confirmBtnText}>Подтвердить переписку</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() =>
                          respondMatch.mutate(
                            { matchId: match.matchId!, accept: false },
                            { onSuccess: refreshMatches },
                          )
                        }
                      >
                        <Text style={styles.textButtonMuted}>Отклонить</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {!match.matchId && !match.mutualConfirmed ? (
                    <Pressable
                      style={styles.confirmBtn}
                      onPress={() =>
                        requestMatch.mutate({ targetUserId: match.userId }, { onSuccess: refreshMatches })
                      }
                    >
                      <Text style={styles.confirmBtnText}>Хочу переписываться</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </>
          ) : (
            <View style={styles.successSection}>
              <MaterialIcons name="hourglass-empty" size={40} color={OLIVE} />
              <Text style={styles.successTitle}>Пока не нашлось совпадений, попробуйте позже!</Text>
              <Text style={styles.successText}>
                Как появятся участницы с похожими интересами, нажмите «Искать ещё».
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleFindMore}
            disabled={busy}
            style={({ pressed }) => [styles.submitButton, busy && styles.submitButtonDisabled, pressed && { opacity: 0.8 }]}
          >
            {busy ? <ActivityIndicator color={CREAM} /> : <MaterialIcons name="mail-outline" size={18} color={CREAM} />}
            <Text style={styles.submitButtonText}>Искать ещё</Text>
          </Pressable>
          <Pressable onPress={() => setScreen("form")} style={styles.textButton}>
            <Text style={styles.textButtonLabel}>Изменить анкету</Text>
          </Pressable>
          <Pressable onPress={handleRemove} style={styles.textButton}>
            <Text style={styles.textButtonMuted}>Удалить анкету</Text>
          </Pressable>
          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Почтовое отделение</Text>
          <Text style={styles.subtitle}>
            Найдите друга по переписке — настоящие бумажные письма, как в старые добрые времена
          </Text>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Ваше ФИО (для переписки):</Text>
            <TextInput
              style={styles.cityInput}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Иванова Анна Сергеевна"
              placeholderTextColor="#A89880"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Выберите 2–3 темы, которые вам близки:</Text>
            <View style={styles.interestsGrid}>
              {PEN_PAL_INTERESTS.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <Pressable
                    key={interest}
                    onPress={() => toggleInterest(interest)}
                    style={[styles.interestChip, isSelected && styles.interestChipSelected]}
                  >
                    <Text style={[styles.interestChipText, isSelected && styles.interestChipTextSelected]}>
                      {interest}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.interestHint}>Выбрано: {selectedInterests.length}/3</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Ваш почтовый адрес:</Text>
            <TextInput
              style={styles.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Город, индекс, улица, дом, квартира или До востребования"
              placeholderTextColor="#A89880"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <Pressable onPress={() => setAdultConsent((v) => !v)} style={styles.consentRow}>
            <MaterialIcons
              name={adultConsent ? "check-box" : "check-box-outline-blank"}
              size={22}
              color={adultConsent ? OLIVE : BROWN_MUTED}
            />
            <Text style={styles.consentText}>{PEN_PAL_ADULT_CONSENT_LABEL}</Text>
          </Pressable>

          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              (!canSubmit || busy) && styles.submitButtonDisabled,
              pressed && { opacity: 0.8 },
            ]}
            disabled={!canSubmit || busy}
          >
            {busy ? <ActivityIndicator color={CREAM} /> : <MaterialIcons name="mail-outline" size={18} color={CREAM} />}
            <Text style={styles.submitButtonText}>{searched ? "Сохранить и искать" : "Отправить заявку"}</Text>
          </Pressable>

          <Text style={styles.privacyNote}>
            Адрес не показывается в анкете другим участникам. Он откроется только после взаимного подтверждения переписки.
          </Text>
          {searched ? (
            <Pressable onPress={handleRemove} style={styles.textButton}>
              <Text style={styles.textButtonMuted}>Удалить анкету</Text>
            </Pressable>
          ) : null}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CREAM,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "web" ? 16 : 56,
    paddingBottom: 8,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(139,115,85,0.08)",
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontFamily: "Gogol-Regular",
    color: BROWN,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: "EBGaramond-SemiBold",
    color: BROWN,
    marginBottom: 12,
  },
  interestsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.2)",
  },
  interestChipSelected: {
    backgroundColor: "rgba(107,123,94,0.15)",
    borderColor: OLIVE,
  },
  interestChipText: {
    fontSize: 14,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
  },
  interestChipTextSelected: {
    color: OLIVE,
    fontFamily: "EBGaramond-SemiBold",
  },
  interestHint: {
    fontSize: 12,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    marginTop: 8,
  },
  cityInput: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.2)",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: "EBGaramond-Regular",
    color: BROWN,
  },
  addressInput: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.2)",
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontFamily: "EBGaramond-Regular",
    color: BROWN,
    minHeight: 80,
    lineHeight: 21,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 28,
    backgroundColor: OLIVE,
    gap: 8,
    alignSelf: "center",
    marginTop: 8,
    minWidth: 220,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: "EBGaramond-SemiBold",
    color: CREAM,
    letterSpacing: 0.3,
  },
  privacyNote: {
    fontSize: 12,
    fontFamily: "EBGaramond-Italic",
    color: BROWN_MUTED,
    textAlign: "center",
    lineHeight: 17,
    marginTop: 16,
    paddingHorizontal: 12,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 16,
  },
  consentText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    lineHeight: 17,
  },
  matchActions: { marginTop: 10, gap: 8 },
  confirmBtn: {
    backgroundColor: OLIVE,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  confirmBtnText: {
    color: CREAM,
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 14,
  },
  successSection: {
    alignItems: "center",
    paddingTop: 24,
    gap: 16,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontFamily: "Gogol-Regular",
    color: BROWN,
    textAlign: "center",
  },
  successText: {
    fontSize: 15,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    textAlign: "center",
    lineHeight: 21,
    paddingHorizontal: 12,
  },
  textButton: {
    alignSelf: "center",
    paddingVertical: 10,
  },
  textButtonLabel: {
    fontSize: 15,
    fontFamily: "EBGaramond-SemiBold",
    color: OLIVE,
  },
  textButtonMuted: {
    fontSize: 14,
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
  },
  letterCard: {
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.18)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    gap: 8,
  },
  letterHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(139,115,85,0.12)",
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(107,123,94,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 20,
    color: OLIVE,
  },
  letterName: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 18,
    color: BROWN,
  },
  letterCity: {
    fontFamily: "EBGaramond-Italic",
    fontSize: 14,
    color: BROWN_MUTED,
  },
  letterLabel: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 12,
    color: BROWN_MUTED,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  letterAddress: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: BROWN,
    lineHeight: 22,
  },
});
