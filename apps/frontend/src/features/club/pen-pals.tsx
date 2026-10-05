"use client";
import classes from "./pen-pals.module.scss";
import {
  Action,
  Spinner,
  Typography,
  ScrollArea,
  Field,
} from "@/shared/ui/elements";
import { useEffect, useRef, useState } from "react";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { useRouter } from "@/shared/navigation/router";
import { useAuth } from "@/domain/session/session-context";
import { trpc } from "@/shared/api/trpc";
import {
  PEN_PAL_INTERESTS,
  PEN_PAL_ADULT_CONSENT_LABEL,
} from "@/domain/pen-pals/types";
import { BROWN_MUTED, CREAM, OLIVE, SAGE } from "./pen-pals.content";
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
  const router = useRouter();
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
      if (prev.includes(interest))
        return prev.filter((item) => item !== interest);
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
    {
      if (
        typeof window !== "undefined" &&
        window.confirm("Удалить анкету из Почтового отделения?")
      )
        run();
      return;
    }
  };
  const busy =
    upsert.isPending ||
    find.isPending ||
    remove.isPending ||
    requestMatch.isPending ||
    respondMatch.isPending;
  const refreshMatches = () => {
    find.mutate(undefined, {
      onSuccess: (result) => {
        setMatches(result.matches);
        setSearched(true);
      },
    });
  };
  return (
    <div className={["ui-stack ", classes.container].filter(Boolean).join(" ")}>
      <div className={["ui-stack ", classes.header].filter(Boolean).join(" ")}>
        <Action onClick={onClose} className={classes.closeButton}>
          <MaterialIcons name="close" size={24} color={BROWN_MUTED} />
        </Action>
      </div>

      {authLoading || booting ? (
        <div
          className={["ui-stack ", classes.centered].filter(Boolean).join(" ")}
        >
          <Spinner color={OLIVE} />
        </div>
      ) : !isAuthenticated ? (
        <div
          className={["ui-stack ", classes.centered].filter(Boolean).join(" ")}
        >
          <MaterialIcons name="mail-outline" size={42} color={OLIVE} />
          <Typography className={classes.successTitle}>
            Войдите в аккаунт
          </Typography>
          <Typography className={classes.successText}>
            Чтобы найти друга по переписке, нужно войти — так мы сможем передать
            адрес только вашей паре.
          </Typography>
          <Action
            onClick={() => {
              onClose();
              router.push("/login?next=/club");
            }}
            className={classes.submitButton}
          >
            <Typography className={classes.submitButtonText}>Войти</Typography>
          </Action>
        </div>
      ) : screen === "results" ? (
        <ScrollArea hideScrollbar contentClassName={classes.content}>
          <Typography className={classes.title}>Почтовое отделение</Typography>
          {matches.length > 0 ? (
            <>
              <Typography className={classes.subtitle}>
                Адрес показывается только после взаимного подтверждения (7 дней
                на ответ)
              </Typography>
              {matches.map((match) => (
                <div
                  key={match.userId}
                  className={["ui-stack ", classes.letterCard]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div
                    className={["ui-stack ", classes.letterHeader]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {match.avatarUrl ? (
                      <Picture
                        source={{ uri: match.avatarUrl }}
                        contentFit="cover"
                        className={classes.avatar}
                      />
                    ) : (
                      <div
                        className={["ui-stack ", classes.avatarFallback]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <Typography className={classes.avatarInitial}>
                          {(match.name || "?").slice(0, 1).toUpperCase()}
                        </Typography>
                      </div>
                    )}
                    <div
                      className={["ui-stack ", classes.div]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Typography className={classes.letterName}>
                        {match.fullName || match.name || "Участница клуба"}
                      </Typography>
                      <Typography className={classes.letterCity}>
                        {match.mutualConfirmed
                          ? "Адрес открыт — можно писать письмо"
                          : match.myConfirmed && !match.theirConfirmed
                            ? "Ожидаем подтверждения от собеседницы"
                            : match.theirConfirmed && !match.myConfirmed
                              ? "Собеседница ждёт вашего подтверждения"
                              : "Новое совпадение по интересам"}
                      </Typography>
                    </div>
                    <MaterialIcons name="markunread" size={22} color={SAGE} />
                  </div>
                  {match.mutualConfirmed && match.address ? (
                    <>
                      <Typography className={classes.letterLabel}>
                        Почтовый адрес
                      </Typography>
                      <Typography className={classes.letterAddress}>
                        {match.address}
                      </Typography>
                    </>
                  ) : null}
                  <div
                    className={["ui-stack ", classes.interestsGrid]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {match.interests.map((interest) => {
                      const shared = match.sharedInterests.includes(interest);
                      return (
                        <div
                          key={interest}
                          className={[
                            ["ui-stack ", classes.interestChipSelected]
                              .filter(Boolean)
                              .join(" "),
                            shared
                              ? classes.appearanceState
                              : classes.appearanceState2,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <Typography
                            className={[
                              classes.interestChipTextSelected,
                              shared
                                ? classes.appearanceState3
                                : classes.appearanceState4,
                            ]
                              .filter(Boolean)
                              .join(" ")}
                          >
                            {interest}
                          </Typography>
                        </div>
                      );
                    })}
                  </div>
                  {!match.mutualConfirmed && match.matchId ? (
                    <div
                      className={["ui-stack ", classes.matchActions]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {!match.myConfirmed ? (
                        <Action
                          onClick={() =>
                            respondMatch.mutate(
                              { matchId: match.matchId!, accept: true },
                              { onSuccess: refreshMatches },
                            )
                          }
                          className={classes.confirmBtn}
                        >
                          <Typography className={classes.confirmBtnText}>
                            Подтвердить переписку
                          </Typography>
                        </Action>
                      ) : null}
                      <Action
                        onClick={() =>
                          respondMatch.mutate(
                            { matchId: match.matchId!, accept: false },
                            { onSuccess: refreshMatches },
                          )
                        }
                      >
                        <Typography className={classes.textButtonMuted}>
                          Отклонить
                        </Typography>
                      </Action>
                    </div>
                  ) : null}
                  {!match.matchId && !match.mutualConfirmed ? (
                    <Action
                      onClick={() =>
                        requestMatch.mutate(
                          { targetUserId: match.userId },
                          { onSuccess: refreshMatches },
                        )
                      }
                      className={classes.confirmBtn}
                    >
                      <Typography className={classes.confirmBtnText}>
                        Хочу переписываться
                      </Typography>
                    </Action>
                  ) : null}
                </div>
              ))}
            </>
          ) : (
            <div
              className={["ui-stack ", classes.successSection]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons name="hourglass-empty" size={40} color={OLIVE} />
              <Typography className={classes.successTitle}>
                Пока не нашлось совпадений, попробуйте позже!
              </Typography>
              <Typography className={classes.successText}>
                Как появятся участницы с похожими интересами, нажмите «Искать
                ещё».
              </Typography>
            </div>
          )}

          <Action
            onClick={handleFindMore}
            disabled={busy}
            className={({ pressed }) =>
              [
                classes.submitButton,
                pressed
                  ? classes.opacityState
                  : busy
                    ? classes.opacityState2
                    : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            {busy ? (
              <Spinner color={CREAM} />
            ) : (
              <MaterialIcons name="mail-outline" size={18} color={CREAM} />
            )}
            <Typography className={classes.submitButtonText}>
              Искать ещё
            </Typography>
          </Action>
          <Action
            onClick={() => setScreen("form")}
            className={classes.textButton}
          >
            <Typography className={classes.textButtonLabel}>
              Изменить анкету
            </Typography>
          </Action>
          <Action onClick={handleRemove} className={classes.textButton}>
            <Typography className={classes.textButtonMuted}>
              Удалить анкету
            </Typography>
          </Action>
          <div
            className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
          />
        </ScrollArea>
      ) : (
        <ScrollArea hideScrollbar contentClassName={classes.content}>
          <Typography className={classes.title}>Почтовое отделение</Typography>
          <Typography className={classes.subtitle}>
            Найдите друга по переписке — настоящие бумажные письма, как в старые
            добрые времена
          </Typography>

          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <Typography className={classes.sectionLabel}>
              Ваше ФИО (для переписки):
            </Typography>
            <Field
              value={fullName}
              onValueChange={setFullName}
              placeholder="Иванова Анна Сергеевна"
              placeholderColor="#A89880"
              className={classes.cityInput}
            />
          </div>

          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <Typography className={classes.sectionLabel}>
              Выберите 2–3 темы, которые вам близки:
            </Typography>
            <div
              className={["ui-stack ", classes.interestsGrid]
                .filter(Boolean)
                .join(" ")}
            >
              {PEN_PAL_INTERESTS.map((interest) => {
                const isSelected = selectedInterests.includes(interest);
                return (
                  <Action
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={[
                      classes.interestChipSelected,
                      isSelected
                        ? classes.appearanceState5
                        : classes.appearanceState6,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography
                      className={[
                        classes.interestChipTextSelected,
                        isSelected
                          ? classes.appearanceState7
                          : classes.appearanceState8,
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {interest}
                    </Typography>
                  </Action>
                );
              })}
            </div>
            <Typography className={classes.interestHint}>
              Выбрано: {selectedInterests.length}/3
            </Typography>
          </div>

          <div
            className={["ui-stack ", classes.section].filter(Boolean).join(" ")}
          >
            <Typography className={classes.sectionLabel}>
              Ваш почтовый адрес:
            </Typography>
            <Field
              value={address}
              onValueChange={setAddress}
              placeholder="Город, индекс, улица, дом, квартира или До востребования"
              placeholderColor="#A89880"
              multiline
              rows={3}
              className={classes.addressInput}
            />
          </div>

          <Action
            onClick={() => setAdultConsent((v) => !v)}
            className={classes.consentRow}
          >
            <MaterialIcons
              name={adultConsent ? "check-box" : "check-box-outline-blank"}
              size={22}
              color={adultConsent ? OLIVE : BROWN_MUTED}
            />
            <Typography className={classes.consentText}>
              {PEN_PAL_ADULT_CONSENT_LABEL}
            </Typography>
          </Action>

          <Action
            onClick={handleSubmit}
            disabled={!canSubmit || busy}
            className={({ pressed }) =>
              [
                classes.submitButton,
                pressed
                  ? classes.opacityState3
                  : !canSubmit || busy
                    ? classes.opacityState4
                    : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            {busy ? (
              <Spinner color={CREAM} />
            ) : (
              <MaterialIcons name="mail-outline" size={18} color={CREAM} />
            )}
            <Typography className={classes.submitButtonText}>
              {searched ? "Сохранить и искать" : "Отправить заявку"}
            </Typography>
          </Action>

          <Typography className={classes.privacyNote}>
            Адрес не показывается в анкете другим участникам. Он откроется
            только после взаимного подтверждения переписки.
          </Typography>
          {searched ? (
            <Action onClick={handleRemove} className={classes.textButton}>
              <Typography className={classes.textButtonMuted}>
                Удалить анкету
              </Typography>
            </Action>
          ) : null}
          <div
            className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
          />
        </ScrollArea>
      )}
    </div>
  );
}
