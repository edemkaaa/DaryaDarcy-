"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/domain/session/session-context";
import {
  checkOperationAccessError,
  useSessionOperation,
} from "@/domain/session/use-session-operation";
import { trpc } from "@/shared/api/trpc";
import { invalidResponse } from "@/shared/api/errors";
import AsyncStorage, { isPersonalDataOwner } from "@/shared/browser/storage";
import { Action, Field, Typography } from "@/shared/ui/elements";
import { MaterialIcons } from "@/shared/ui/icons";
import { BROWN_MUTED, PROFILE_NAME_KEY } from "./profile-screen.content";
import classes from "./profile-screen.module.scss";

export function ProfileNameEditor({ displayName }: { displayName: string }) {
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();
  const operation = useSessionOperation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  // Keep an acknowledged save visible while auth refresh is pending. A new
  // server name supersedes it without discarding an unsaved editing draft.
  const [confirmation, setConfirmation] = useState({
    source: displayName,
    name: displayName,
  });
  if (confirmation.source !== displayName) {
    setConfirmation({ source: displayName, name: displayName });
  }
  const shownName =
    confirmation.source === displayName ? confirmation.name : displayName;
  useEffect(() => {
    if (!user?.id || !isPersonalDataOwner(user.id)) return;
    let cancelled = false;
    // Absence also means club setup has not been completed. Reconcile an
    // existing cache, but do not create that marker merely by viewing a profile.
    void AsyncStorage.getItem(PROFILE_NAME_KEY).then((cached) => {
      if (cancelled || !cached || !isPersonalDataOwner(user.id)) return;
      if (user.name) void AsyncStorage.setItem(PROFILE_NAME_KEY, user.name);
      else void AsyncStorage.removeItem(PROFILE_NAME_KEY);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.name]);
  // Enter, disabling the input and removing it can also trigger blur.
  const editingRef = useRef(false);
  const errorRef = useRef(false);
  const save = async () => {
    if (!editingRef.current) return;
    const name = draft.trim();
    if (!name) return;
    const task = operation.begin("save-profile-name");
    if (!task) return;
    errorRef.current = false;
    setError(false);
    try {
      const result = await utils.client.profile.update.mutate(
        { name },
        { signal: task.signal },
      );
      if (result?.success !== true) throw invalidResponse();
      task.assertCurrent();
      // Publish and cache only a server-confirmed name for the current owner.
      setConfirmation({ source: displayName, name });
      await AsyncStorage.setItem(PROFILE_NAME_KEY, name);
      task.assertCurrent();
      editingRef.current = false;
      setEditing(false);
      await refresh();
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent()) {
        errorRef.current = true;
        setError(true);
      }
    } finally {
      task.finish();
    }
  };
  if (editing)
    return (
      <div className={["ui-stack", classes.nameEditor].join(" ")}>
        <div className={["ui-stack", classes.nameEditRow].join(" ")}>
          <Field
            aria-label="Имя профиля"
            value={draft}
            onValueChange={setDraft}
            autoFocus
            disabled={operation.busy}
            onSubmit={() => void save()}
            onBlur={() => {
              if (!errorRef.current) void save();
            }}
            className={classes.nameInput}
          />
        </div>
        {error && (
          <div
            role="alert"
            className={["ui-stack", classes.nameError].join(" ")}
          >
            <Typography className={classes.nameErrorText}>
              Не удалось сохранить имя: результат не подтверждён. Ваш ввод
              сохранён.
            </Typography>
            <Action
              className={classes.action5}
              disabled={operation.busy}
              onClick={() => void save()}
            >
              <Typography className={classes.cardButtonText}>
                Повторить сохранение имени
              </Typography>
            </Action>
          </div>
        )}
      </div>
    );
  return (
    <Action
      onClick={() => {
        setDraft(shownName);
        editingRef.current = true;
        setEditing(true);
      }}
      className={({ pressed }) =>
        pressed ? classes.opacityState5 : classes.opacityState6
      }
    >
      <div className={["ui-stack", classes.nameRow].join(" ")}>
        <Typography className={classes.profileName}>{shownName}</Typography>
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
