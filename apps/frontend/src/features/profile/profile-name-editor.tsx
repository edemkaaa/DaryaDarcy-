"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/domain/session/session-context";
import { useProfileUpdate } from "@/domain/profile/use-profile-update";
import {
  PROFILE_NAME_DRAFT_KEY,
  PROFILE_NAME_PENDING_KEY,
} from "@/domain/profile/profile-draft";
import AsyncStorage, {
  isPersonalDataOwner,
  requiredStorage,
} from "@/shared/browser/storage";
import { Action, Field, Spinner, Typography } from "@/shared/ui/elements";
import { MaterialIcons } from "@/shared/ui/icons";
import { BROWN_MUTED } from "./profile-screen.content";
import classes from "./profile-screen.module.scss";

export function ProfileNameEditor({ displayName }: { displayName: string }) {
  const { user } = useAuth();
  const update = useProfileUpdate(PROFILE_NAME_PENDING_KEY);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
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
  const closeWithFocus = () => {
    restoreFocus.current = true;
    setEditing(false);
  };
  const finish = async (saved: boolean) => {
    if (!saved || !user || !isPersonalDataOwner(user.id)) return;
    await AsyncStorage.removeItem(PROFILE_NAME_DRAFT_KEY);
    if (isPersonalDataOwner(user.id)) closeWithFocus();
  };
  const save = async () => {
    const name = draft.trim();
    if (!name || !editing || update.busy || update.unknown) return;
    await finish(await update.save({ name }));
  };
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
                try {
                  requiredStorage.setItem(PROFILE_NAME_DRAFT_KEY, value);
                  setDraftError(null);
                } catch {
                  setDraftError(
                    "Черновик имени не сохранён на устройстве. Не закрывайте страницу до сохранения имени.",
                  );
                }
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
                disabled={update.busy || update.unknown || !draft.trim()}
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
            onClick={async () => {
              const ownerId = user?.id;
              const savedDraft = await AsyncStorage.getItem(
                PROFILE_NAME_DRAFT_KEY,
              );
              if (!ownerId || !isPersonalDataOwner(ownerId)) return;
              update.beginEdit();
              setDraft(update.pendingInput?.name ?? savedDraft ?? displayName);
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
      {editing && (update.error || draftError) && (
        <div role="alert" className={["ui-stack", classes.nameError].join(" ")}>
          <Typography className={classes.nameErrorText}>
            {update.error || draftError}
          </Typography>
          {update.unknown && (
            <Action
              className={classes.action5}
              disabled={update.busy}
              onClick={() => void update.check().then(finish)}
            >
              <Typography className={classes.cardButtonText}>
                Проверить сохранение имени
              </Typography>
            </Action>
          )}
        </div>
      )}
    </div>
  );
}
