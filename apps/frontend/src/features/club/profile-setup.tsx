"use client";

import classes from "./profile-setup.module.scss";
import {
  ScrollArea,
  Typography,
  Action,
  Field,
  Spinner,
} from "@/shared/ui/elements";

import { useState } from "react";
import { Picture } from "@/shared/media/image";
import * as ImagePicker from "@/shared/browser/file-picker";
import { MaterialIcons } from "@/shared/ui/icons";
import { SafeArea } from "@/shared/ui/safe-area";
import { AvatarCropper } from "@/shared/media/avatar-cropper";
import { BROWN_MUTED, CREAM } from "./profile-setup.content";

type Gender = "female" | "male";
interface ProfileSetupProps {
  onComplete: (data: {
    name: string;
    gender: Gender;
    avatarUrl?: string;
  }) => void | Promise<void>;
}
interface CropperImage {
  uri: string;
  width: number;
  height: number;
}
export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [cropperImage, setCropperImage] = useState<CropperImage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    if (!name.trim() || !gender) return;
    setSubmitting(true);
    try {
      // Complete profile setup (data saved locally by parent component)
      await onComplete({
        name: name.trim(),
        gender,
        avatarUrl: avatarUri || undefined,
      });
    } catch (error) {
      console.error("[ProfileSetup] Error:", error);
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
            className={({ pressed }) =>
              [classes.action, pressed ? classes.opacityState : ""]
                .filter(Boolean)
                .join(" ")
            }
          >
            {avatarUri ? (
              <Picture
                source={{ uri: avatarUri }}
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

          {/* Submit button */}
          <Action
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className={({ pressed }) =>
              [
                classes.action3,
                pressed && isValid ? classes.transformState : "",
                pressed && isValid
                  ? classes.opacityState4
                  : !isValid
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
