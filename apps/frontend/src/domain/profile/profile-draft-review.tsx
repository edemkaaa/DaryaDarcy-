"use client";
/** Сравнение локального черновика с актуальным профилем оставляет решение о замене данных пользователю. */
import { Action, Typography } from "@/shared/ui/elements";
import type { ProfileSnapshot } from "./profile-draft";
import classes from "./profile-draft-review.module.scss";

/** Показываем текущую серверную базу рядом с локальным вводом; принять черновик можно только с известной ревизией. */
export function ProfileDraftReview({
  snapshot,
  busy,
  onAccept,
  showGender = false,
}: {
  snapshot: ProfileSnapshot;
  busy: boolean;
  onAccept: () => void;
  showGender?: boolean;
}) {
  return (
    <div className={["ui-stack", classes.review].join(" ")} role="status">
      <Typography>
        Сейчас в профиле: {snapshot.name || "имя не указано"}
        {showGender
          ? `, пол: ${snapshot.gender === "female" ? "женский" : snapshot.gender === "male" ? "мужской" : "не указан"}`
          : ""}
        . Ваш ввод остаётся в поле. Подтвердите, если хотите сохранить его
        вместо актуальных данных.
      </Typography>
      <Action
        className={classes.accept}
        disabled={busy || snapshot.revision === null}
        onClick={onAccept}
      >
        Использовать мой черновик
      </Action>
    </div>
  );
}
