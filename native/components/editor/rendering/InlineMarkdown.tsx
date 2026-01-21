import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';

interface InlineMarkdownProps {
  text: string;
  style?: TextStyle;
  onLinkPress?: (url: string) => void;
}

interface TextSegment {
  text: string;
  style?: TextStyle;
  onPress?: () => void;
}

/// Renders inline markdown formatting (bold, italic, code, links, wiki links)
export function InlineMarkdown({
  text,
  style,
  onLinkPress,
}: InlineMarkdownProps) {
  const theme = useExtendedTheme();
  const segments = parseInlineMarkdown(text, style || {}, onLinkPress, theme);

  return (
    <Text style={style}>
      {segments.map((segment, index) => {
          return (
            <Text
              key={index}
              style={[style, segment.style]}
              onPress={segment.onPress}
            >
              {segment.text}
            </Text>
          );
      })}
    </Text>
  );
}

function parseInlineMarkdown(
  text: string,
  baseStyle: TextStyle,
  onLinkPress: ((url: string) => void) | undefined,
  theme: ReturnType<typeof useExtendedTheme>,
): TextSegment[] {
  const segments: TextSegment[] = [];
  let buffer = '';
  let i = 0;

  const flushBuffer = () => {
    if (buffer.length > 0) {
      segments.push({ text: buffer, style: baseStyle });
      buffer = '';
    }
  };

  while (i < text.length) {
    // Check for wiki links: [[text]]
    if (text[i] === '[' && i + 1 < text.length && text[i + 1] === '[') {
      const closeIndex = text.indexOf(']]', i + 2);
      if (closeIndex !== -1) {
        flushBuffer();
        const linkText = text.substring(i + 2, closeIndex);
        segments.push({
          text: linkText,
          style: {
            ...baseStyle,
            color: theme.colors.primary,
            textDecorationLine: 'underline',
          },
          onPress: onLinkPress
            ? () => onLinkPress(linkText)
            : undefined,
        });
        i = closeIndex + 2;
        continue;
      }
    }

    // Check for links: [text](url)
    if (text[i] === '[' && !isEscaped(text, i)) {
      const closeBracket = text.indexOf(']', i);
      if (
        closeBracket !== -1 &&
        closeBracket + 1 < text.length &&
        text[closeBracket + 1] === '('
      ) {
        const closeParenIndex = text.indexOf(')', closeBracket + 2);
        if (closeParenIndex !== -1) {
          flushBuffer();
          const linkText = text.substring(i + 1, closeBracket);
          const url = text.substring(closeBracket + 2, closeParenIndex);

          segments.push({
            text: linkText,
            style: {
              ...baseStyle,
              color: theme.colors.primary,
              textDecorationLine: 'underline',
            },
            onPress: () => onLinkPress?.(url),
          });

          i = closeParenIndex + 1;
          continue;
        }
      }
    }

    // Check for inline code: `code`
    if (text[i] === '`' && !isEscaped(text, i)) {
      const endIndex = text.indexOf('`', i + 1);
      if (endIndex !== -1) {
        flushBuffer();
        const code = text.substring(i + 1, endIndex);
        segments.push({
          text: code,
          style: {
            ...baseStyle,
            fontFamily: theme.custom.editor.inlineCode.fontFamily,
            fontSize: (baseStyle.fontSize || theme.typography.body.fontSize || 16) * 0.9,
            backgroundColor: theme.custom.editor.inlineCode.backgroundColor,
            color: theme.custom.editor.inlineCode.color,
          },
        });
        i = endIndex + 1;
        continue;
      }
    }

    // Check for bold: **text** or __text__
    if (
      i + 1 < text.length &&
      ((text[i] === '*' && text[i + 1] === '*') ||
        (text[i] === '_' && text[i + 1] === '_')) &&
      !isEscaped(text, i)
    ) {
      const marker = text.substring(i, i + 2);
      const endIndex = text.indexOf(marker, i + 2);
      if (endIndex !== -1) {
        flushBuffer();
        const boldText = text.substring(i + 2, endIndex);
        // Recursively parse the bold text for nested formatting
        const nestedSegments = parseInlineMarkdown(
          boldText,
          { ...baseStyle, fontWeight: 'bold' },
          onLinkPress,
          theme,
        );
        segments.push(...nestedSegments);
        i = endIndex + 2;
        continue;
      }
    }

    // Check for italic: *text* or _text_
    if ((text[i] === '*' || text[i] === '_') && !isEscaped(text, i)) {
      const marker = text[i];
      // Make sure it's not bold
      if (i + 1 < text.length && text[i + 1] !== marker) {
        const endIndex = findUnescapedChar(text, marker, i + 1);
        if (endIndex !== -1 && endIndex > i + 1) {
          flushBuffer();
          const italicText = text.substring(i + 1, endIndex);
          // Recursively parse the italic text for nested formatting
          const nestedSegments = parseInlineMarkdown(
            italicText,
            { ...baseStyle, fontStyle: 'italic' },
            onLinkPress,
            theme,
          );
          segments.push(...nestedSegments);
          i = endIndex + 1;
          continue;
        }
      }
    }

    // Check for strikethrough: ~~text~~
    if (
      i + 1 < text.length &&
      text[i] === '~' &&
      text[i + 1] === '~' &&
      !isEscaped(text, i)
    ) {
      const endIndex = text.indexOf('~~', i + 2);
      if (endIndex !== -1) {
        flushBuffer();
        const strikeText = text.substring(i + 2, endIndex);
        segments.push({
          text: strikeText,
          style: {
            ...baseStyle,
            textDecorationLine: 'line-through',
          },
        });
        i = endIndex + 2;
        continue;
      }
    }

    // Regular character
    buffer += text[i];
    i++;
  }

  flushBuffer();
  return segments;
}

function isEscaped(text: string, index: number): boolean {
  if (index === 0) {
    return false;
  }
  let backslashCount = 0;
  let i = index - 1;
  while (i >= 0 && text[i] === '\\') {
    backslashCount++;
    i--;
  }
  return backslashCount % 2 === 1;
}

function findUnescapedChar(
  text: string,
  char: string,
  startIndex: number,
): number {
  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === char && !isEscaped(text, i)) {
      return i;
    }
  }
  return -1;
}

