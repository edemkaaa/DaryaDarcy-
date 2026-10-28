"use client";
import { useState } from "react";
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
import { Action, Field, Typography } from "@/shared/ui/elements";
import { MaterialIcons } from "@/shared/ui/icons";
import { BROWN_MUTED } from "./profile-screen.content";
import classes from "./profile-screen.module.scss";

export function ProfileNameEditor({ displayName }: { displayName: string }) {
  const { user } = useAuth();
  const update = useProfileUpdate(PROFILE_NAME_PENDING_KEY);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const finish = async (saved: boolean) => {
    if (!saved || !user || !isPersonalDataOwner(user.id)) return;
    await AsyncStorage.removeItem(PROFILE_NAME_DRAFT_KEY);
    if (isPersonalDataOwner(user.id)) setEditing(false);
  };
  const save = async () => {
    const name = draft.trim();
    if (!name || !editing) return;
    await finish(await update.save({ name }));
  };
  if (editing)
    return (
      <div className={["ui-stack", classes.nameEditor].join(" ")}>
        <div className={["ui-stack", classes.nameEditRow].join(" ")}>
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
            disabled={update.busy || update.unknown}
            onSubmit={() => void save()}
            className={classes.nameInput}
          />
        </div>
        {!update.unknown && (
          <Action
            disabled={update.busy || !draft.trim()}
            onClick={() => void save()}
            className={classes.action5}
          >
            <Typography className={classes.cardButtonText}>
              Сохранить имя
            </Typography>
          </Action>
        )}
        {(update.error || draftError) && (
          <div
            role="alert"
            className={["ui-stack", classes.nameError].join(" ")}
          >
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
  return (
    <Action
      onClick={async () => {
        const ownerId = user?.id;
        const savedDraft = await AsyncStorage.getItem(PROFILE_NAME_DRAFT_KEY);
        if (!ownerId || !isPersonalDataOwner(ownerId)) return;
        update.beginEdit();
        setDraft(update.pendingInput?.name ?? savedDraft ?? displayName);
        setEditing(true);
      }}
      className={({ pressed }) =>
        pressed ? classes.opacityState5 : classes.opacityState6
      }
    >
      <div className={["ui-stack", classes.nameRow].join(" ")}>
        <Typography className={classes.profileName}>{displayName}</Typography>
        <MaterialIcons
          name="edit"
          size={14}
          color={BROWN_MUTED}
          className={classes.materialIcons}
        />
      </div>
    </Action>
  );
}
