"use client";
/** Редактирование имени хранит локальный ввод и предлагает сверку после конфликта, не подменяя подтверждённый профиль сразу при наборе. */
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/domain/session/session-context";
import { useProfileUpdate } from "@/domain/profile/use-profile-update";
import { ProfileDraftReview } from "@/domain/profile/profile-draft-review";
import {
  PROFILE_NAME_DRAFT_KEY,
  PROFILE_NAME_PENDING_KEY,
} from "@/domain/profile/profile-draft";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { Action, Field, Spinner, Typography } from "@/shared/ui/elements";
import { MaterialIcons } from "@/shared/ui/icons";
import { BROWN_MUTED } from "./profile-screen.content";
import classes from "./profile-screen.module.scss";

/** Отделяем локальный ввод имени от подтверждённого профиля; unknown и review управляются общим revision-aware hook. */
export function ProfileNameEditor({ displayName }: { displayName: string }) {
  const { user } = useAuth();
  const update = useProfileUpdate(
    PROFILE_NAME_PENDING_KEY,
    PROFILE_NAME_DRAFT_KEY,
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (!editing && restoreFocus.current) {
      restoreFocus.current = false;
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, [editing]);
  useEffect(() => {
    if (!editing || update.busy || update.unknown) return;
    /** Закрываем готовый редактор при клике вне реальных controls; неподтверждённая операция остаётся открытой. */
    const dismiss = (event: PointerEvent) => {
      const control =
        event.target instanceof Element
          ? event.target.closest("input, button")
          : null;
      // Empty space around the controls is not part of the editing surface.
      if (!control || !editorRef.current?.contains(control)) {
        setEditing(false);
      }
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss, true);
    };
  }, [editing, update.busy, update.unknown]);
  /** Помечаем возврат фокуса на исходную кнопку после следующего render без редактора. */
  const closeWithFocus = () => {
    restoreFocus.current = true;
    setEditing(false);
  };
  /** Закрываем только подтверждённое сохранение текущего владельца; поздний ответ другого аккаунта игнорируем. */
  const finish = async (saved: boolean) => {
    if (!saved || !user || !isPersonalDataOwner(user.id)) return;
    if (isPersonalDataOwner(user.id)) closeWithFocus();
  };
  /** Нормализуем имя и запрещаем запись, пока ввод пуст, занят, unknown или требует сверки. */
  const save = async () => {
    const name = draft.trim();
    if (
      !name ||
      !editing ||
      update.busy ||
      update.unknown ||
      update.needsReview
    )
      return;
    await finish(await update.save({ name }));
  };
  /** Обычная отмена закрывает форму с возвратом фокуса, но не разрешает бросить выполняющийся/неизвестный write. */
  const cancel = () => {
    if (update.busy || update.unknown) return;
    closeWithFocus();
  };
  return (
    <div
      ref={editorRef}
      className={["ui-stack", classes.nameEditor].join(" ")}
      onBlur={(event) => {
        if (update.busy || update.unknown) return;
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setEditing(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && editing) {
          event.preventDefault();
          cancel();
        }
      }}
    >
      <div className={["ui-stack", classes.nameEditRow].join(" ")}>
        {editing ? (
          <>
            <Field
              aria-label="Имя профиля"
              value={draft}
              onValueChange={(value) => {
                setDraft(value);
                update.storeDraft({ name: value });
              }}
              autoFocus
              autoComplete="name"
              enterKeyHint="done"
              disabled={update.busy || update.unknown}
              onSubmit={() => void save()}
              className={classes.nameInput}
            />
            <div className={classes.nameActions}>
              <Action
                aria-label="Сохранить имя"
                title="Сохранить имя"
                disabled={
                  update.busy ||
                  update.unknown ||
                  update.needsReview ||
                  !draft.trim()
                }
                onClick={() => void save()}
                className={[
                  classes.nameIconButton,
                  classes.nameSaveButton,
                ].join(" ")}
              >
                {update.busy ? (
                  <Spinner
                    size={16}
                    label={update.unknown ? "Проверяем имя" : "Сохраняем имя"}
                  />
                ) : (
                  <MaterialIcons name="check" size={20} color="currentColor" />
                )}
              </Action>
              <Action
                aria-label="Отменить редактирование имени"
                title="Отменить редактирование имени"
                disabled={update.busy || update.unknown}
                onClick={cancel}
                className={classes.nameIconButton}
              >
                <MaterialIcons name="close" size={18} color="currentColor" />
              </Action>
            </div>
          </>
        ) : (
          <Action
            ref={triggerRef}
            disabled={update.busy}
            onClick={() => {
              const ownerId = user?.id;
              if (!ownerId || !isPersonalDataOwner(ownerId)) return;
              const restored = update.beginEdit({ name: displayName });
              if (!restored) return;
              setDraft(restored.name ?? displayName);
              setEditing(true);
            }}
            className={classes.nameRow}
          >
            <Typography className={classes.profileName} lines={1}>
              {displayName}
            </Typography>
            <MaterialIcons
              name="edit"
              size={14}
              color={BROWN_MUTED}
              style={{ marginLeft: 6, flexShrink: 0 }}
            />
          </Action>
        )}
      </div>
      {(update.error || update.draftError) && (
        <div role="alert" className={["ui-stack", classes.nameError].join(" ")}>
          <Typography className={classes.nameErrorText}>
            {[update.error, update.draftError].filter(Boolean).join(" ")}
          </Typography>
          {editing &&
            (update.unknown || (update.needsReview && !update.review)) && (
              <Action
                className={classes.action5}
                disabled={update.busy}
                onClick={() => void update.check().then(finish)}
              >
                <Typography className={classes.cardButtonText}>
                  {update.unknown
                    ? "Проверить сохранение имени"
                    : "Сверить черновик имени"}
                </Typography>
              </Action>
            )}
        </div>
      )}
      {editing && update.needsReview && update.review && (
        <ProfileDraftReview
          snapshot={update.review}
          busy={update.busy || update.unknown}
          onAccept={update.acceptReview}
        />
      )}
    </div>
  );
}
