import React from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "@/lib/theme/tokens";
import { fontFamilies } from "@/lib/theme/fonts";

interface RichBlogContentProps {
  content?: string | null;
  style?: StyleProp<ViewStyle>;
}

/**
 * Parses inline formatting: **bold**, *italic*, and `code`
 */
function renderInlineText(text: string) {
  // Match **bold**, *italic*, and `code`
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <Text key={index} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }

    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <Text key={index} style={styles.italic}>
          {part.slice(1, -1)}
        </Text>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <Text key={index} style={styles.code}>
          {part.slice(1, -1)}
        </Text>
      );
    }

    return part;
  });
}

/**
 * Editorial Markdown Content Renderer for Mobile Journal
 * Replaces raw markdown symbols (#, ##, -, >) with luxury typography.
 */
export function RichBlogContent({ content, style }: RichBlogContentProps) {
  if (!content || !content.trim()) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.emptyText}>No content available.</Text>
      </View>
    );
  }

  // Normalize line endings and split by double newlines
  const normalized = content.replace(/\r\n/g, "\n");
  const rawBlocks = normalized.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);

  let sectionCount = 0;

  return (
    <View style={[styles.container, style]}>
      {rawBlocks.map((block, blockIdx) => {
        // H1 Heading (# Heading)
        if (/^#\s+/.test(block)) {
          sectionCount++;
          const headingText = block.replace(/^#\s+/, "").trim();
          return (
            <View key={blockIdx} style={styles.h1Container}>
              <View style={styles.sectionKicker}>
                <Text style={styles.sectionKickerText}>
                  § {String(sectionCount).padStart(2, "0")}
                </Text>
              </View>
              <Text style={styles.h1}>{renderInlineText(headingText)}</Text>
            </View>
          );
        }

        // H2 Heading (## Heading)
        if (/^##\s+/.test(block)) {
          sectionCount++;
          const headingText = block.replace(/^##\s+/, "").trim();
          return (
            <View key={blockIdx} style={styles.h2Container}>
              <Text style={styles.h2}>{renderInlineText(headingText)}</Text>
            </View>
          );
        }

        // H3 Heading (### Heading)
        if (/^###\s+/.test(block)) {
          const headingText = block.replace(/^###\s+/, "").trim();
          return (
            <View key={blockIdx} style={styles.h3Container}>
              <Text style={styles.h3}>{renderInlineText(headingText)}</Text>
            </View>
          );
        }

        // Blockquote (> Quote)
        if (/^>\s*/.test(block)) {
          const quoteLines = block
            .split("\n")
            .map((line) => line.replace(/^>\s*/, "").trim())
            .filter(Boolean)
            .join(" ");

          return (
            <View key={blockIdx} style={styles.quoteBox}>
              <View style={styles.quoteBar} />
              <View style={styles.quoteBody}>
                <Text style={styles.quoteGlyph}>“</Text>
                <Text style={styles.quoteText}>{renderInlineText(quoteLines)}</Text>
              </View>
            </View>
          );
        }

        // Horizontal rule (--- or ***)
        if (/^(\-{3,}|\*{3,})$/.test(block)) {
          return (
            <View key={blockIdx} style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerOrnament}>◆</Text>
              <View style={styles.dividerLine} />
            </View>
          );
        }

        // Lists (unordered - or *, ordered 1.)
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        const isBulletList = lines.every((l) => /^[-*•]\s+/.test(l));
        const isOrderedList = lines.every((l) => /^\d+\.\s+/.test(l));

        if (isBulletList) {
          return (
            <View key={blockIdx} style={styles.listContainer}>
              {lines.map((line, lineIdx) => {
                const itemText = line.replace(/^[-*•]\s+/, "");
                return (
                  <View key={lineIdx} style={styles.listItem}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.listText}>{renderInlineText(itemText)}</Text>
                  </View>
                );
              })}
            </View>
          );
        }

        if (isOrderedList) {
          return (
            <View key={blockIdx} style={styles.listContainer}>
              {lines.map((line, lineIdx) => {
                const match = line.match(/^(\d+)\.\s+(.*)/);
                const num = match ? match[1] : `${lineIdx + 1}`;
                const itemText = match ? match[2] : line;
                return (
                  <View key={lineIdx} style={styles.listItem}>
                    <Text style={styles.listNumber}>{num}.</Text>
                    <Text style={styles.listText}>{renderInlineText(itemText)}</Text>
                  </View>
                );
              })}
            </View>
          );
        }

        // Mixed paragraph with bullet lines inside
        if (lines.some((l) => /^[-*•]\s+/.test(l))) {
          return (
            <View key={blockIdx} style={styles.mixedContainer}>
              {lines.map((line, lineIdx) => {
                if (/^[-*•]\s+/.test(line)) {
                  const itemText = line.replace(/^[-*•]\s+/, "");
                  return (
                    <View key={lineIdx} style={styles.listItem}>
                      <View style={styles.bulletDot} />
                      <Text style={styles.listText}>{renderInlineText(itemText)}</Text>
                    </View>
                  );
                }
                return (
                  <Text key={lineIdx} style={styles.paragraph}>
                    {renderInlineText(line)}
                  </Text>
                );
              })}
            </View>
          );
        }

        // Standard Paragraph
        return (
          <Text key={blockIdx} style={styles.paragraph}>
            {renderInlineText(block)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  emptyText: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    color: colors.ink.mute,
    fontStyle: "italic",
  },
  bold: {
    fontFamily: fontFamilies.sans.bold,
    fontWeight: "700",
    color: colors.ink.DEFAULT,
  },
  italic: {
    fontStyle: "italic",
  },
  code: {
    fontFamily: fontFamilies.mono.regular,
    fontSize: 13,
    backgroundColor: "rgba(83, 94, 44, 0.08)",
    color: colors.olive[800],
    paddingHorizontal: 4,
    borderRadius: 3,
  },
  h1Container: {
    marginTop: 32,
    marginBottom: 12,
  },
  sectionKicker: {
    marginBottom: 4,
  },
  sectionKickerText: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.accent2.rust,
    textTransform: "uppercase",
  },
  h1: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 23,
    lineHeight: 31,
    color: colors.ink.DEFAULT,
    letterSpacing: -0.2,
  },
  h2Container: {
    marginTop: 26,
    marginBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(200, 200, 184, 0.35)",
    paddingTop: 18,
  },
  h2: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 19,
    lineHeight: 26,
    color: colors.ink.DEFAULT,
    letterSpacing: -0.1,
  },
  h3Container: {
    marginTop: 18,
    marginBottom: 6,
  },
  h3: {
    fontFamily: fontFamilies.sans.bold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink.DEFAULT,
  },
  paragraph: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15.5,
    lineHeight: 26,
    color: colors.ink.DEFAULT,
    marginBottom: 18,
  },
  mixedContainer: {
    marginBottom: 14,
  },
  quoteBox: {
    flexDirection: "row",
    backgroundColor: "rgba(250, 248, 241, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(200, 200, 184, 0.4)",
    borderRadius: radii.lg,
    padding: spacing[4],
    marginVertical: 18,
    overflow: "hidden",
  },
  quoteBar: {
    width: 3,
    backgroundColor: colors.accent2.rust,
    borderRadius: 2,
    marginRight: 12,
  },
  quoteBody: {
    flex: 1,
  },
  quoteGlyph: {
    fontFamily: fontFamilies.display.semibold,
    fontSize: 28,
    lineHeight: 28,
    color: colors.accent2.rust,
    marginBottom: 2,
  },
  quoteText: {
    fontFamily: fontFamilies.display.italic,
    fontSize: 16,
    lineHeight: 25,
    color: colors.ink.soft,
  },
  listContainer: {
    marginBottom: 18,
    paddingLeft: 4,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent2.rust,
    marginTop: 10,
    marginRight: 10,
  },
  listNumber: {
    fontFamily: fontFamilies.mono.semibold,
    fontSize: 13,
    color: colors.accent2.rust,
    width: 22,
    marginTop: 2,
  },
  listText: {
    flex: 1,
    fontFamily: fontFamilies.sans.regular,
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink.DEFAULT,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(200, 200, 184, 0.5)",
  },
  dividerOrnament: {
    fontSize: 10,
    color: colors.olive[500],
    opacity: 0.6,
  },
});
