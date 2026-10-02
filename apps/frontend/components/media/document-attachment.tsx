import React from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { friendlyMediaName } from "@shared/media-label";

const BROWN_DARK = "#4A3728";
const BROWN_LIGHT = "#7A6B5E";
const CREAM_BG = "#FDF8F0";

interface DocumentAttachmentProps {
  url: string;
  filename?: string;
  mimeType?: string;
  fileSize?: number;
}

function getDocIcon(mimeType?: string): keyof typeof MaterialIcons.glyphMap {
  if (!mimeType) return "insert-drive-file";
  if (mimeType.includes("pdf")) return "picture-as-pdf";
  if (mimeType.includes("word") || mimeType.includes("document")) return "description";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "table-chart";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "slideshow";
  return "insert-drive-file";
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentAttachmentCard({ url, filename, mimeType, fileSize }: DocumentAttachmentProps) {
  const handlePress = () => {
    Linking.openURL(url);
  };

  const icon = getDocIcon(mimeType);
  const displayName = friendlyMediaName(filename, "document") || "Документ";
  const sizeStr = formatFileSize(fileSize);

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.iconContainer}>
        <MaterialIcons name={icon} size={24} color={BROWN_DARK} />
      </View>
      <View style={styles.info}>
        <Text style={styles.filename} numberOfLines={1}>
          {displayName}
        </Text>
        {sizeStr ? <Text style={styles.size}>{sizeStr}</Text> : null}
      </View>
      <MaterialIcons name="open-in-new" size={18} color={BROWN_LIGHT} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CREAM_BG,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E8E0D8",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F0EBE4",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  filename: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 13,
    color: BROWN_DARK,
  },
  size: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 11,
    color: BROWN_LIGHT,
    marginTop: 2,
  },
});
