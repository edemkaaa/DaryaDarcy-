"use client";

import classes from "./profile-setup.module.scss";
import {
  ScrollArea,
  Typography,
  Action,
  Field,
  Spinner,
} from "@/shared/ui/elements";

import { useEffect, useRef, useState } from "react";
import { Picture } from "@/shared/media/image";
import * as ImagePicker from "@/shared/browser/file-picker";
import { MAX_AVATAR_SOURCE_BYTES } from "@/shared/browser/file-operations";
import { MaterialIcons } from "@/shared/ui/icons";
import { SafeArea } from "@/shared/ui/safe-area";
import { AvatarCropper } from "@/shared/media/avatar-cropper";
import { BROWN_MUTED, CREAM } from "./profile-setup.content";

import { useAuth } from "@/domain/session/session-context";
import { useProfileUpdate } from "@/domain/profile/use-profile-update";
import { ProfileDraftReview } from "@/domain/profile/profile-draft-review";
import { useProfileAvatar } from "@/domain/profile/use-profile-avatar";
import {
  CLUB_PROFILE_DRAFT_KEY,
  CLUB_PROFILE_PENDING_KEY,
  LEGACY_PROFILE_NAME_KEY,
  LEGACY_PROFILE_GENDER_KEY,
} from "@/domain/profile/profile-draft";
import AsyncStorage, {
  isPersonalDataOwner,
  requiredStorage,
} from "@/shared/browser/storage";

type Gender = "female" | "male";
interface ProfileSetupProps {
  onComplete: () => void;
}
interface CropperImage {
  uri: string;
  width: number;
  height: number;
}
export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const { user } = useAuth();
  const update = useProfileUpdate(
    CLUB_PROFILE_PENDING_KEY,
    CLUB_PROFILE_DRAFT_KEY,
  );
  const initialUser = useRef(user);
  const { storeDraft } = update;
  const beginInitialEdit = useRef(update.beginEdit);
  const avatar = useProfileAvatar();
  const [ready, setReady] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const [name, setName] = useState(user?.name ?? "");
  const [gender, setGender] = useState<Gender | null>(user?.gender ?? null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [cropperImage, setCropperImage] = useState<CropperImage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const completed = useRef(false);
  useEffect(() => {
    const user = initialUser.current;
    const ownerId = user?.id;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled || !ownerId || !isPersonalDataOwner(ownerId)) return;
      try {
        const legacyName = requiredStorage.getItem(LEGACY_PROFILE_NAME_KEY);
        const legacyGender = requiredStorage.getItem(LEGACY_PROFILE_GENDER_KEY);
        const restored = beginInitialEdit.current(
          {
            name: user?.name ?? legacyName ?? "",
            gender:
              user?.gender ??
              (legacyGender === "female" || legacyGender === "male"
                ? legacyGender
                : null),
            avatarUrl: null,
          },
          legacyName !== null || legacyGender !== null,
        );
        if (!restored) return;
        setName(restored.name ?? "");
        setGender(restored.gender ?? null);
        setAvatarUri(restored.avatarUrl ?? null);
        setReady(true);
      } catch {
        setDraftError(
          "Не удалось прочитать черновик профиля. Разрешите хранение данных сайта и перезагрузите страницу.",
        );
      }
    });
    return () => {
      cancelled = true;
    };
    // Background session reads must not reset typing in this owner-scoped form.
  }, []);
  useEffect(() => {
    if (completed.current || !ready || !user || !isPersonalDataOwner(user.id))
      return;
    storeDraft({ name, gender, avatarUrl: avatarUri });
  }, [ready, name, gender, avatarUri, user, storeDraft]);
  const blocked =
    !ready ||
    submitting ||
    update.busy ||
    update.unknown ||
    avatar.busy ||
    avatar.unknown;
  useEffect(() => {
    if (!update.unknown || !update.pendingInput) return;
    if (update.pendingInput.name) setName(update.pendingInput.name);
    if (update.pendingInput.gender) setGender(update.pendingInput.gender);
  }, [update.unknown, update.pendingInput]);
  const error = [avatar.error, update.error, update.draftError, draftError]
    .filter(Boolean)
    .join(" ");
  const complete = async () => {
    const ownerId = initialUser.current?.id;
    if (!ownerId || !isPersonalDataOwner(ownerId)) return;
    completed.current = true;
    await AsyncStorage.multiRemove([
      LEGACY_PROFILE_NAME_KEY,
      LEGACY_PROFILE_GENDER_KEY,
    ]);
    if (isPersonalDataOwner(ownerId)) onComplete();
  };
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      maxBytes: MAX_AVATAR_SOURCE_BYTES,
      allowsEditing: false,
      quality: 0.9,
    }).catch((error: unknown) => {
      window.alert(
        error instanceof Error ? error.message : "Не удалось выбрать фото",
      );
      return { canceled: true, assets: [] };
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setCropperImage({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      });
    }
  };
  const handleCropComplete = (croppedUri: string) => {
    setAvatarUri(croppedUri);
    setCropperImage(null);
  };
  const handleCropCancel = () => {
    setCropperImage(null);
  };
  const handleSubmit = async () => {
    if (
      !name.trim() ||
      !gender ||
      blocked ||
      update.needsReview ||
      submittingRef.current
    )
      return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      if (avatarUri) {
        if (!(await avatar.upload(avatarUri))) return;
        setAvatarUri(null);
      }
      if (await update.save({ name: name.trim(), gender })) await complete();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  const isValid = name.trim().length > 0 && gender !== null;
  // Show cropper full-screen when an image is selected for cropping
  if (cropperImage) {
    return (
      <SafeArea
        edges={["top", "bottom", "left", "right"]}
        className={classes.container}
      >
        <AvatarCropper
          imageUri={cropperImage.uri}
          imageWidth={cropperImage.width}
          imageHeight={cropperImage.height}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
        />
      </SafeArea>
    );
  }
  return (
    <SafeArea
      edges={["top", "bottom", "left", "right"]}
      className={classes.container}
    >
      <div
        className={["ui-stack ", classes.keyboardView]
          .filter(Boolean)
          .join(" ")}
      >
        <ScrollArea hideScrollbar contentClassName={classes.scrollContent}>
          {/* Title */}
          <Typography className={classes.title}>Оформи свой профиль</Typography>

          {/* Avatar picker */}
          <Action
            onClick={pickImage}
            disabled={blocked}
            aria-label="Выбрать фото профиля"
            className={({ pressed }) =>
              [classes.action, pressed ? classes.opacityState : ""]
                .filter(Boolean)
                .join(" ")
            }
          >
            {avatarUri || user?.avatarUrl ? (
              <Picture
                source={{ uri: avatarUri || user!.avatarUrl! }}
                contentFit="cover"
                className={classes.avatarImage}
              />
            ) : (
              <div
                className={["ui-stack ", classes.avatarPlaceholder]
                  .filter(Boolean)
                  .join(" ")}
              >
                <MaterialIcons
                  name="add-a-photo"
                  size={32}
                  color={BROWN_MUTED}
                />
                <Typography className={classes.avatarPlaceholderText}>
                  Добавить фото
                </Typography>
              </div>
            )}
          </Action>

          {/* Name input */}
          <div
            className={["ui-stack ", classes.inputSection]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.label}>Имя или никнейм</Typography>
            <Field
              disabled={blocked}
              value={name}
              onValueChange={setName}
              placeholder="Как тебя зовут?"
              placeholderColor="#A89880"
              autoCapitalize="words"
              className={classes.textInput}
            />
          </div>

          {/* Gender selection */}
          <div
            className={["ui-stack ", classes.inputSection]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.label}>Пол</Typography>
            <div
              className={["ui-stack ", classes.genderRow]
                .filter(Boolean)
                .join(" ")}
            >
              <Action
                disabled={blocked}
                onClick={() => setGender("female")}
                className={({ pressed }) =>
                  [
                    classes.action2,
                    pressed ? classes.opacityState2 : "",
                    gender === "female"
                      ? classes.appearanceState
                      : classes.appearanceState2,
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <Typography
                  className={[
                    classes.genderTextActive,
                    gender === "female"
                      ? classes.appearanceState3
                      : classes.appearanceState4,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  Женский
                </Typography>
              </Action>
              <Action
                disabled={blocked}
                onClick={() => setGender("male")}
                className={({ pressed }) =>
                  [
                    classes.action2,
                    pressed ? classes.opacityState3 : "",
                    gender === "male"
                      ? classes.appearanceState5
                      : classes.appearanceState6,
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <Typography
                  className={[
                    classes.genderTextActive,
                    gender === "male"
                      ? classes.appearanceState7
                      : classes.appearanceState8,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  Мужской
                </Typography>
              </Action>
            </div>
          </div>

          {error && (
            <Typography role="alert" className={classes.errorText}>
              {error}
            </Typography>
          )}
          {(update.unknown || (update.needsReview && !update.review)) && (
            <Action
              disabled={update.busy}
              onClick={() =>
                void update.check().then((saved) => {
                  if (saved) void complete();
                })
              }
              className={classes.action3}
            >
              <Typography className={classes.submitButtonText}>
                {update.unknown
                  ? "Проверить сохранение анкеты"
                  : "Сверить черновик анкеты"}
              </Typography>
            </Action>
          )}
          {update.needsReview && update.review && (
            <ProfileDraftReview
              snapshot={update.review}
              busy={update.busy || update.unknown}
              onAccept={update.acceptReview}
              showGender
            />
          )}
          {avatar.unknown && (
            <Action
              disabled={avatar.busy}
              onClick={() => void avatar.check()}
              className={classes.action3}
            >
              <Typography className={classes.submitButtonText}>
                Проверить фото в профиле
              </Typography>
            </Action>
          )}
          {/* Submit button */}
          <Action
            onClick={handleSubmit}
            disabled={!isValid || blocked || update.needsReview}
            aria-label="Продолжить"
            aria-busy={submitting}
            className={({ pressed }) =>
              [
                classes.action3,
                pressed && isValid ? classes.transformState : "",
                pressed && isValid
                  ? classes.opacityState4
                  : !isValid || blocked
                    ? classes.opacityState5
                    : "",
              ]
                .filter(Boolean)
                .join(" ")
            }
          >
            {submitting ? (
              <Spinner color={CREAM} size="small" />
            ) : (
              <Typography className={classes.submitButtonText}>
                Продолжить
              </Typography>
            )}
          </Action>
        </ScrollArea>
      </div>
    </SafeArea>
  );
}
