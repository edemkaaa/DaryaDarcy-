// Архив Expo. Собирает имя/пол/локальный аватар и передаёт сохранение владельцу через onComplete.
import { useState } from "react";
import {
  Text,
  View,
  Pressable,
  TextInput,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { AvatarCropper } from "./avatar-cropper";

// ─── Constants ──────────────────────────────────────────────────────────────

const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";
const CREAM = "#FDF8F0";
const OLIVE = "#6B7B5E";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Types ──────────────────────────────────────────────────────────────────

type Gender = "female" | "male";

interface ProfileSetupProps {
  onComplete: (data: { name: string; gender: Gender; avatarUrl?: string }) => void | Promise<void>;
}

interface CropperImage {
  uri: string;
  width: number;
  height: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  // Собирает имя/пол/локальный аватар и передаёт сохранение владельцу через onComplete.

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [cropperImage, setCropperImage] = useState<CropperImage | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    // Открывает галерею без встроенного editing и переносит размеры выбранного фото в кроппер.

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
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
    // Заменяет локальный preview результатом и закрывает кроппер.

    setAvatarUri(croppedUri);
    setCropperImage(null);
  };

  const handleCropCancel = () => {
    // Закрывает кроппер без изменения выбранного аватара.

    setCropperImage(null);
  };

  const handleSubmit = async () => {
    // Проверяет непустое имя/пол и ждёт onComplete; после успеха предполагается переход владельцем формы.

    if (!name.trim() || !gender) return;

    setSubmitting(true);
    try {
      // Complete profile setup (data saved locally by parent component)
      await onComplete({ name: name.trim(), gender, avatarUrl: avatarUri || undefined });
    } catch (error) {
      console.error("[ProfileSetup] Error:", error);
      setSubmitting(false);
    }
  };

  const isValid = name.trim().length > 0 && gender !== null;

  // Show cropper full-screen when an image is selected for cropping
  if (cropperImage) {
    return (
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.container}>
        <AvatarCropper
          imageUri={cropperImage.uri}
          imageWidth={cropperImage.width}
          imageHeight={cropperImage.height}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <Text style={styles.title}>Оформи свой профиль</Text>

          {/* Avatar picker */}
          <Pressable
            style={({ pressed }) => [
              styles.avatarPicker,
              pressed && { opacity: 0.8 },
            ]}
            onPress={pickImage}
          >
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatarImage}
                contentFit="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialIcons name="add-a-photo" size={32} color={BROWN_MUTED} />
                <Text style={styles.avatarPlaceholderText}>Добавить фото</Text>
              </View>
            )}
          </Pressable>

          {/* Name input */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Имя или никнейм</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Как тебя зовут?"
              placeholderTextColor="#A89880"
              returnKeyType="done"
              autoCapitalize="words"
            />
          </View>

          {/* Gender selection */}
          <View style={styles.inputSection}>
            <Text style={styles.label}>Пол</Text>
            <View style={styles.genderRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.genderOption,
                  gender === "female" && styles.genderOptionActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setGender("female")}
              >
                <Text
                  style={[
                    styles.genderText,
                    gender === "female" && styles.genderTextActive,
                  ]}
                >
                  Женский
                </Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.genderOption,
                  gender === "male" && styles.genderOptionActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => setGender("male")}
              >
                <Text
                  style={[
                    styles.genderText,
                    gender === "male" && styles.genderTextActive,
                  ]}
                >
                  Мужской
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Submit button */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              !isValid && styles.submitButtonDisabled,
              pressed && isValid && { transform: [{ scale: 0.97 }], opacity: 0.9 },
            ]}
            onPress={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting ? (
              <ActivityIndicator color={CREAM} size="small" />
            ) : (
              <Text style={styles.submitButtonText}>Продолжить</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

// SafeArea и KeyboardAvoidingView сохраняют форму над клавиатурой, а ScrollView оставляет кнопку доступной на коротком экране.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CREAM,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: "center",
  },
  title: {
    fontFamily: "Gogol-Regular",
    fontSize: 28,
    color: BROWN,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: BROWN_MUTED,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },

  // Avatar
  avatarPicker: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    marginBottom: 32,
    borderWidth: 2,
    borderColor: "rgba(139,115,85,0.2)",
    borderStyle: "dashed",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(139,115,85,0.05)",
    gap: 4,
  },
  avatarPlaceholderText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 12,
    color: BROWN_MUTED,
  },

  // Input
  inputSection: {
    width: "100%",
    marginBottom: 24,
  },
  label: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 15,
    color: BROWN,
    marginBottom: 8,
  },
  textInput: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: BROWN,
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.2)",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
  },

  // Gender
  genderRow: {
    flexDirection: "row",
    gap: 12,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(139,115,85,0.2)",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  genderOptionActive: {
    borderColor: OLIVE,
    backgroundColor: "rgba(107,123,94,0.08)",
  },
  genderText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: BROWN_MUTED,
  },
  genderTextActive: {
    fontFamily: "EBGaramond-SemiBold",
    color: OLIVE,
  },

  // Submit
  submitButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: OLIVE,
    alignItems: "center",
    marginTop: 16,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 17,
    color: CREAM,
    letterSpacing: 0.3,
  },
});
