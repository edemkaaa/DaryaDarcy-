import { Text, Linking, StyleSheet, TextStyle } from "react-native";
import { memo } from "react";
import { splitForEmojiRendering } from "@/lib/emoji-text";
import { normalizeLinkUrl } from "@/lib/photo-aspect-ratios";
import { READABLE_ITALIC_STYLE } from "@/lib/brand-font";
import { sanitizePlainPostText, sanitizeRichTextForDisplay } from "@/lib/post-text-sanitize";

// ── Types (matching drizzle/schema.ts) ──
export interface RichTextInline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  link?: string;
}

export interface RichTextBlock {
  type: "paragraph" | "heading";
  children: RichTextInline[];
}

interface RichTextRendererProps {
  /** Rich text blocks from the post's richText field */
  richText?: RichTextBlock[] | null;
  /** Fallback plain text (used when richText is null/empty) */
  plainText?: string;
  /** Maximum number of lines to show (for preview/truncation) */
  numberOfLines?: number;
  /** Base text style */
  textStyle?: TextStyle;
  /** Link text color */
  linkColor?: string;
  selectable?: boolean;
}

/**
 * Renders rich text content with bold, italic, and inline links.
 * Falls back to plain text display when richText is not available.
 */
export const RichTextRenderer = memo(function RichTextRenderer({
  richText,
  plainText,
  numberOfLines,
  textStyle,
  linkColor = "#6B7B5E",
  selectable = true,
}: RichTextRendererProps) {
  const safePlain = plainText ? sanitizePlainPostText(plainText) : "";
  const blocks = sanitizeRichTextForDisplay(richText);

  // If no rich text, render plain text with paragraph spacing
  if (!blocks || blocks.length === 0) {
    if (!safePlain) return null;
    const paragraphs = safePlain.split("\n");
    if (numberOfLines !== undefined) {
      return (
        <Text selectable={selectable} style={[styles.paragraph, textStyle]} numberOfLines={numberOfLines}>
          {renderPlainText(safePlain, textStyle)}
        </Text>
      );
    }
    return (
      <>
        {paragraphs.map((part, index) => (
          <Text
            key={index}
            selectable={selectable}
            style={[
              styles.paragraph,
              textStyle,
              index < paragraphs.length - 1 ? styles.paragraphGap : null,
            ]}
          >
            {renderPlainText(part.length > 0 ? part : " ", textStyle)}
          </Text>
        ))}
      </>
    );
  }

  // If numberOfLines is set, we render all blocks as a single Text for proper truncation
  if (numberOfLines !== undefined) {
    return (
      <Text selectable={selectable} style={[styles.paragraph, textStyle]} numberOfLines={numberOfLines}>
        {blocks.map((block, blockIndex) => (
          <Text key={blockIndex}>
            {blockIndex > 0 && "\n"}
            {block.type === "heading" ? (
              <Text style={styles.heading}>
                {renderInlines(block?.children, linkColor, textStyle)}
              </Text>
            ) : (
              renderInlines(block?.children, linkColor, textStyle)
            )}
          </Text>
        ))}
      </Text>
    );
  }

  // Full render: each block as separate Text element
  return (
    <>
      {blocks.map((block, blockIndex) => {
        if (block.type === "heading") {
          return (
            <Text key={blockIndex} selectable={selectable} style={[styles.heading, textStyle]}>
              {renderInlines(block?.children, linkColor, textStyle)}
            </Text>
          );
        }
        return (
          <Text
            key={blockIndex}
            selectable={selectable}
            style={[
              styles.paragraph,
              textStyle,
              blockIndex < blocks.length - 1 ? styles.paragraphGap : null,
            ]}
          >
            {renderInlines(block?.children, linkColor, textStyle)}
          </Text>
        );
      })}
    </>
  );
});

function baseFontMetrics(textStyle?: TextStyle) {
  const flat = StyleSheet.flatten(textStyle) ?? {};
  const fontSize = typeof flat.fontSize === "number" ? flat.fontSize : 15;
  const lineHeight =
    typeof flat.lineHeight === "number" ? flat.lineHeight : Math.round(fontSize * 1.47);
  return { fontSize, lineHeight };
}

function boldInlineStyle(textStyle?: TextStyle): TextStyle {
  const { fontSize, lineHeight } = baseFontMetrics(textStyle);
  return {
    fontFamily: "EBGaramond-Bold",
    fontWeight: "700",
    fontSize,
    lineHeight,
  };
}

function italicInlineStyle(textStyle?: TextStyle): TextStyle {
  const { fontSize, lineHeight } = baseFontMetrics(textStyle);
  return {
    ...READABLE_ITALIC_STYLE,
    fontSize,
    lineHeight,
  };
}

function renderInlines(
  children: RichTextInline[] | undefined,
  linkColor: string,
  textStyle?: TextStyle,
) {
  if (!Array.isArray(children)) return null;
  return children.map((inline, i) => {
    const text = typeof inline.text === "string" ? inline.text : "";
    const style: TextStyle[] = [];

    if (inline.bold && inline.italic) {
      style.push({ ...boldInlineStyle(textStyle), ...READABLE_ITALIC_STYLE });
    } else if (inline.bold) {
      style.push(boldInlineStyle(textStyle));
    } else if (inline.italic) {
      style.push(italicInlineStyle(textStyle));
    }
    if (inline.link) style.push({ color: linkColor, textDecorationLine: "underline" });

    if (inline.link) {
      const url = normalizeLinkUrl(inline.link);
      return (
        <Text
          key={i}
          style={style}
          onPress={() => void Linking.openURL(url)}
        >
          {renderPlainText(text)}
        </Text>
      );
    }

    if (style.length > 0) {
      return (
        <Text key={i} style={style}>
          {renderPlainText(text)}
        </Text>
      );
    }

    return <Text key={i}>{renderPlainText(text)}</Text>;
  });
}

function renderPlainText(text: string | undefined | null, textStyle?: TextStyle) {
  const safe = typeof text === "string" ? text : "";
  const segments = splitForEmojiRendering(safe);
  if (segments.length === 1 && !segments[0].isEmoji) {
    return safe;
  }
  return segments.map((segment, index) => (
    <Text
      key={index}
      style={segment.isEmoji ? [textStyle, styles.emojiText] : [styles.bodyText, textStyle]}
    >
      {segment.value}
    </Text>
  ));
}

const styles = StyleSheet.create({
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4A3728",
    fontFamily: "EBGaramond-Regular",
  },
  bodyText: {
    fontFamily: "EBGaramond-Regular",
  },
  emojiText: {
    fontFamily: undefined,
  },
  paragraphGap: {
    marginBottom: 14,
  },
  heading: {
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "EBGaramond-Bold",
    fontWeight: "700",
    color: "#4A3728",
  },
});
