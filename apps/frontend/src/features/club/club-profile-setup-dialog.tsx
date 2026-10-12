"use client";

import { useAuth } from "@/domain/session/session-context";
import {
  checkOperationAccessError,
  useSessionOperation,
} from "@/domain/session/use-session-operation";
import {
  CLUB_PROFILE_AVATAR_KEY,
  CLUB_PROFILE_GENDER_KEY,
  CLUB_PROFILE_NAME_KEY,
} from "@/domain/profile/sync-profile";
import { invalidResponse } from "@/shared/api/errors";
import { trpc } from "@/shared/api/trpc";
import AsyncStorage, { isPersonalDataOwner } from "@/shared/browser/storage";
import { uriToBase64 } from "@/shared/media/image-upload";
import { Action, Dialog } from "@/shared/ui/elements";
import { MaterialIcons } from "@/shared/ui/icons";
import { ProfileSetup, type ClubProfileDraft } from "./profile-setup";
import { PROFILE_COMPLETED_KEY } from "./club-subscribed.content";
import classes from "./club-subscribed.module.scss";

export function ClubProfileSetupDialog({
  active,
  onDismissed,
  onSaved,
}: {
  active: boolean;
  onDismissed: () => void;
  onSaved: (draft: ClubProfileDraft) => void;
}) {
  const { user, refresh } = useAuth();
  const utils = trpc.useUtils();
  const operation = useSessionOperation(active);
  const save = async (draft: ClubProfileDraft) => {
    const task = operation.begin("save-club-profile");
    if (!task) throw new DOMException("Операция отменена", "AbortError");
    try {
      let avatarUrl = draft.avatarUrl;
      if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
        const base64 = await uriToBase64(avatarUrl, { signal: task.signal });
        task.assertCurrent();
        const uploaded = await utils.client.profile.uploadAvatar.mutate(
          { base64, filename: "avatar.jpg", mimeType: "image/jpeg" },
          { signal: task.signal },
        );
        task.assertCurrent();
        if (!uploaded?.url || !/^https?:\/\//i.test(uploaded.url))
          throw invalidResponse();
        avatarUrl = uploaded.url;
      }
      const result = await utils.client.profile.update.mutate(
        {
          name: draft.name,
          gender: draft.gender,
          ...(avatarUrl ? { avatarUrl } : {}),
        },
        { signal: task.signal },
      );
      if (result?.success !== true) throw invalidResponse();
      task.assertCurrent();
      // These optional scoped preferences are published only after native ACK.
      // The storage adapter writes synchronously before returning its promise.
      await Promise.all([
        AsyncStorage.setItem(CLUB_PROFILE_NAME_KEY, draft.name),
        AsyncStorage.setItem(CLUB_PROFILE_GENDER_KEY, draft.gender),
        AsyncStorage.setItem(PROFILE_COMPLETED_KEY, "true"),
        ...(avatarUrl
          ? [AsyncStorage.setItem(CLUB_PROFILE_AVATAR_KEY, avatarUrl)]
          : []),
      ]);
      task.assertCurrent();
      await refresh();
      task.assertCurrent();
      void utils.club.comments.invalidate();
      onSaved({ ...draft, avatarUrl });
    } catch (cause) {
      checkOperationAccessError(cause);
      throw cause;
    } finally {
      task.finish();
    }
  };
  return (
    <Dialog label="Настройка профиля клуба" open motion="slide">
      <div className={["ui-stack ", classes.div].filter(Boolean).join(" ")}>
        <Action
          aria-label="Закрыть настройку профиля"
          disabled={operation.busy}
          onClick={async () => {
            if (!active || !user?.id || !isPersonalDataOwner(user.id)) return;
            await AsyncStorage.setItem(PROFILE_COMPLETED_KEY, "true");
            if (isPersonalDataOwner(user.id)) onDismissed();
          }}
          className={({ pressed }) =>
            [
              classes.action3,
              pressed ? classes.opacityState3 : classes.opacityState4,
            ]
              .filter(Boolean)
              .join(" ")
          }
        >
          <MaterialIcons name="close" size={24} color="#4A3728" />
        </Action>
      </div>
      <ProfileSetup onComplete={save} />
    </Dialog>
  );
}
