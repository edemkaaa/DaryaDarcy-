import { forwardRef, useImperativeHandle, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { RichTextRenderer } from "@/components/rich-text-renderer";
import type { RichTextBlock } from "@/components/rich-text-renderer";
import { formatToolbarProps } from "@/lib/ios-web-press";
import { runAfterSelectionReady, useRichTextFormatting } from "@/lib/use-rich-text-formatting";
import { RICH_TEXT_INPUT_ID } from "@/lib/selection";

const BROWN_DARK = "#4A3728";
const BROWN_LIGHT = "#7A6B5E";
const ACCENT = "#8B7355";
const CREAM_BG = "#FDF8F0";

export type RichTextFieldHandle = {
  getRichTextBlocks: () => RichTextBlock[] | undefined;
  getRichTextBlocksForSubmit: () => RichTextBlock[] | undefined;
};

interface RichTextFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  richTextSeed?: RichTextBlock[] | null;
  onRichTextChange?: (richText: RichTextBlock[] | undefined) => void;
  textAreaStyle?: StyleProp<TextStyle>;
  placeholder?: string;
}

function shellStyle(textAreaStyle: StyleProp<TextStyle> | undefined) {
  const flat = StyleSheet.flatten(textAreaStyle) ?? {};
  return {
    backgroundColor: flat.backgroundColor ?? "#fff",
    borderWidth: flat.borderWidth ?? 1,
    borderColor: flat.borderColor ?? "#E8E2D8",
    borderRadius: flat.borderRadius ?? 10,
    minHeight: flat.minHeight ?? 200,
  };
}

function inputStyle(textAreaStyle: StyleProp<TextStyle> | undefined) {
  const flat = StyleSheet.flatten(textAreaStyle) ?? {};
  return {
    paddingHorizontal: flat.padding ?? 14,
    paddingTop: flat.padding ?? 14,
    fontSize: flat.fontSize ?? 15,
    color: flat.color ?? BROWN_DARK,
    lineHeight: flat.lineHeight ?? 22,
    fontFamily: flat.fontFamily,
  };
}

export const RichTextField = forwardRef<RichTextFieldHandle, RichTextFieldProps>(function RichTextField(
  {
    value,
    onChangeText,
    richTextSeed,
    onRichTextChange,
    textAreaStyle,
    placeholder = "Текст поста… Enter — новый абзац",
  },
  ref,
) {
  const fmt = useRichTextFormatting(value, richTextSeed, onRichTextChange);
  const [previewOpen, setPreviewOpen] = useState(false);

  useImperativeHandle(ref, () => ({
    getRichTextBlocks: fmt.getRichTextBlocks,
    getRichTextBlocksForSubmit: fmt.getRichTextBlocksForSubmit,
  }));

  const formatActionProps = (action: () => void) =>
    formatToolbarProps(() => runAfterSelectionReady(action), () => fmt.syncLiveSelection());

  const webInputProps =
    Platform.OS === "web"
      ? ({
          id: RICH_TEXT_INPUT_ID,
          onMouseUp: () => fmt.syncLiveSelection(),
          onKeyUp: () => fmt.syncLiveSelection(),
          onTouchEnd: () => fmt.syncLiveSelection(),
        } as const)
      : ({} as const);

  const shell = shellStyle(textAreaStyle);
  const inner = inputStyle(textAreaStyle);

  return (
    <>
      <View style={[styles.editorShell, shell]}>
        <TextInput
          nativeID={RICH_TEXT_INPUT_ID}
          {...webInputProps}
          style={[styles.editorInput, inner, styles.editorInputWithBar]}
          value={value}
          onChangeText={(next) => {
            onChangeText(next);
            fmt.handleTextChange(next);
          }}
          onSelectionChange={(e) => fmt.handleSelectionChange(e.nativeEvent.selection)}
          onTouchEnd={fmt.flushSelectionUi}
          onBlur={fmt.flushSelectionUi}
          placeholder={placeholder}
          placeholderTextColor={BROWN_LIGHT}
          multiline
          textAlignVertical="top"
          scrollEnabled
          selectTextOnFocus={false}
        />

        <View style={styles.inlineToolbar}>
          <Pressable
            {...formatActionProps(fmt.toggleBold)}
            style={[styles.formatBtn, fmt.isInBold && styles.formatBtnActive]}
          >
            <Text style={[styles.formatBtnText, { fontWeight: "700" }, fmt.isInBold && styles.formatBtnTextActive]}>
              Ж
            </Text>
          </Pressable>
          <Pressable
            {...formatActionProps(fmt.toggleItalic)}
            style={[styles.formatBtn, fmt.isInItalic && styles.formatBtnActive]}
          >
            <Text
              style={[styles.formatBtnText, { fontStyle: "italic" }, fmt.isInItalic && styles.formatBtnTextActive]}
            >
              К
            </Text>
          </Pressable>
          <Pressable {...formatActionProps(fmt.addLink)} style={styles.formatBtn}>
            <MaterialIcons name="link" size={17} color={fmt.hasSelection ? BROWN_DARK : BROWN_LIGHT} />
          </Pressable>
          <Text style={styles.formatHint}>{fmt.hasSelection ? fmt.selectionPreview || "Выделено" : "Выделите текст"}</Text>
        </View>
      </View>

      <Pressable
        onPress={() => setPreviewOpen((open) => !open)}
        style={({ pressed }) => [styles.previewToggle, { opacity: pressed ? 0.75 : 1 }]}
      >
        <MaterialIcons name={previewOpen ? "expand-less" : "visibility"} size={17} color={ACCENT} />
        <Text style={styles.previewToggleText}>{previewOpen ? "Скрыть" : "Проверить"}</Text>
      </Pressable>

      {previewOpen ? (
        <View style={styles.previewBox}>
          <RichTextRenderer richText={fmt.formatPreview} plainText={value} />
        </View>
      ) : null}

      {fmt.linkModalVisible ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => {
            fmt.setLinkModalVisible(false);
            fmt.setLinkUrlInput("");
          }}
        >
          <Pressable
            style={styles.linkModalOverlay}
            onPress={() => {
              fmt.setLinkModalVisible(false);
              fmt.setLinkUrlInput("");
            }}
          >
            <Pressable style={styles.linkModalCard} onPress={(e) => e.stopPropagation?.()}>
              <Text style={styles.linkModalTitle}>Ссылка</Text>
              <TextInput
                style={styles.linkModalInput}
                value={fmt.linkUrlInput}
                onChangeText={fmt.setLinkUrlInput}
                placeholder="https://..."
                placeholderTextColor={BROWN_LIGHT}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                autoFocus
              />
              <View style={styles.linkModalActions}>
                <Pressable
                  onPress={() => {
                    fmt.setLinkModalVisible(false);
                    fmt.setLinkUrlInput("");
                  }}
                  style={styles.linkModalCancel}
                >
                  <Text style={styles.linkModalCancelText}>Отмена</Text>
                </Pressable>
                <Pressable onPress={() => fmt.applyLink(fmt.linkUrlInput)} style={styles.linkModalApply}>
                  <Text style={styles.linkModalApplyText}>Добавить</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
});

const styles = StyleSheet.create({
  editorShell: {
    overflow: "hidden",
  },
  editorInput: {
    flex: 1,
    minHeight: 168,
    paddingBottom: 14,
    textAlignVertical: "top",
  },
  editorInputWithBar: {
    paddingBottom: 8,
  },
  inlineToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#E8E2D8",
    backgroundColor: "#FAF7F1",
  },
  formatBtn: {
    width: 34,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E8E2D8",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  formatBtnActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  formatBtnText: {
    fontSize: 15,
    color: BROWN_DARK,
  },
  formatBtnTextActive: {
    color: CREAM_BG,
  },
  formatHint: {
    flex: 1,
    fontSize: 12,
    color: BROWN_LIGHT,
    marginLeft: 4,
  },
  previewToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  previewToggleText: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: "600",
  },
  previewBox: {
    marginTop: 8,
    padding: 14,
    borderRadius: 10,
    backgroundColor: "#F3EEE4",
    borderWidth: 1,
    borderColor: "#E8E2D8",
  },
  linkModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  linkModalCard: {
    width: "88%",
    maxWidth: 360,
    backgroundColor: CREAM_BG,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E2D8",
  },
  linkModalTitle: {
    fontSize: 16,
    fontFamily: "EBGaramond-SemiBold",
    color: BROWN_DARK,
    marginBottom: 10,
  },
  linkModalInput: {
    borderWidth: 1,
    borderColor: "#E8E2D8",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: BROWN_DARK,
    backgroundColor: "#fff",
  },
  linkModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 14,
  },
  linkModalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  linkModalCancelText: {
    fontSize: 14,
    color: BROWN_LIGHT,
  },
  linkModalApply: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  linkModalApplyText: {
    fontSize: 14,
    fontWeight: "600",
    color: CREAM_BG,
  },
});
