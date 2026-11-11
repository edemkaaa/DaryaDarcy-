"use client";
/** Подсказка установки учитывает возможности браузера; установка ярлыка не означает наличие офлайн-копии закрытого контента. */
import classes from "./install-guide.module.scss";
import { Typography, Dialog, Action } from "@/shared/ui/elements";
import { useEffect, useState } from "react";
import AsyncStorage from "@/shared/browser/storage";
import { MaterialIcons } from "@/shared/ui/icons";
import { SEEN_KEY, BROWN } from "./install-guide.content";
/** Распознаём установленный режим браузера через iOS standalone либо display-mode; при SSR отвечаем false. */
function isStandaloneWeb(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & {
    standalone?: boolean;
  };
  return (
    Boolean(nav.standalone) ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}
/** Выбираем текст инструкции для iOS по доступному userAgent; это подсказка установки, не проверка поддержки офлайн. */
function isIosWeb(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent);
}
/** Оформляем один статический шаг инструкции с декоративным значком. */
function Step({
  icon,
  text,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  text: string;
}) {
  return (
    <div className={["ui-stack ", classes.stepRow].filter(Boolean).join(" ")}>
      <div
        className={["ui-stack ", classes.stepIcon].filter(Boolean).join(" ")}
      >
        <MaterialIcons name={icon} size={18} color={BROWN} />
      </div>
      <Typography className={classes.step}>{text}</Typography>
    </div>
  );
}
/** Не показываем инструкцию установленному приложению или после отметки seen; позднее чтение storage отменяется при уходе. */
export function InstallGuide() {
  const [visible, setVisible] = useState(false);
  const ios = isIosWeb();
  useEffect(() => {
    if (isStandaloneWeb()) return;
    let cancelled = false;
    AsyncStorage.getItem(SEEN_KEY).then((seen) => {
      if (!cancelled && !seen) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  /** Сначала скрываем диалог, затем сохраняем необязательное предпочтение, не блокируя остальное приложение. */
  const dismiss = async () => {
    setVisible(false);
    await AsyncStorage.setItem(SEEN_KEY, "1");
  };
  if (!visible) return null;
  return (
    <Dialog label="Установка приложения" motion="fade" open onClose={dismiss}>
      <div
        className={["ui-stack  ui-pointer-children", classes.backdrop]
          .filter(Boolean)
          .join(" ")}
      >
        <Action
          onClick={dismiss}
          aria-label="Закрыть"
          className={classes.action}
        />
        <div className={["ui-stack ", classes.card].filter(Boolean).join(" ")}>
          <Typography className={classes.kicker}>DARYADARCY</Typography>
          <Typography className={classes.title}>
            Добавить на экран Домой
          </Typography>
          <Typography className={classes.body}>
            Так приложение открывается как обычная иконка, без адресной строки
            браузера.
          </Typography>
          <div
            className={["ui-stack ", classes.steps].filter(Boolean).join(" ")}
          >
            {ios ? (
              <>
                <Step
                  icon="ios-share"
                  text="1. Нажмите «Поделиться» в Safari"
                />
                <Step icon="add-box" text="2. Выберите «На экран Домой»" />
                <Step icon="check" text="3. Подтвердите «Добавить»" />
              </>
            ) : (
              <>
                <Step icon="more-vert" text="1. Откройте меню браузера" />
                <Step icon="ios-share" text="2. Выберите «На экран Домой»" />
                <Step icon="check" text="3. Подтвердите «Добавить»" />
              </>
            )}
          </div>
          <Action
            onClick={dismiss}
            className={({ pressed }) =>
              [classes.action2, pressed ? classes.opacityState : ""]
                .filter(Boolean)
                .join(" ")
            }
          >
            <MaterialIcons name="home" size={18} color={BROWN} />
            <Typography className={classes.buttonText}>Понятно →</Typography>
          </Action>
        </div>
      </div>
    </Dialog>
  );
}
