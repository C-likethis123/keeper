import { useExtendedTheme } from '@/hooks/useExtendedTheme';
import katex from 'katex';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MathJaxSvg } from 'react-native-mathjax-html-to-svg';

export interface MathViewProps {
  expression: string;
  displayMode?: boolean;
  onError?: (error: string) => void;
  style?: object;
}

function renderKaTeXToHtml(
  expression: string,
  displayMode: boolean,
  textColor: string
): string | null {
  try {
    const html = katex.renderToString(expression.trim(), {
      displayMode,
      throwOnError: false,
      output: 'html',
    });
    return `<span style="color:${textColor}">${html}</span>`;
  } catch {
    return null;
  }
}

export function MathView({
  expression,
  displayMode = false,
  onError,
  style,
}: MathViewProps) {
  const theme = useExtendedTheme();
  const textColor = theme.colors.text;
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!expression.trim()) {
      setHtml(null);
      setError(null);
      return;
    }
    try {
      const result = renderKaTeXToHtml(expression, displayMode, textColor);
      if (result) {
        setHtml(result);
        setError(null);
      } else {
        setError('Invalid LaTeX');
        setHtml(null);
        onErrorRef.current?.('Invalid LaTeX');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid LaTeX';
      setError(msg);
      setHtml(null);
      onErrorRef.current?.(msg);
    }
  }, [expression, displayMode, textColor]);

  const styles = useMemo(() => createStyles(displayMode), [displayMode]);

  if (!expression.trim()) {
    return (
      <View style={[styles.container, style]}>
        <Text style={[styles.fallback, { color: theme.colors.text }]}>{expression || ' '}</Text>
      </View>
    );
  }

  if (Platform.OS === 'web') {
    if (error) {
      return (
        <View style={[styles.container, style]}>
          <Text style={[styles.fallback, { color: theme.colors.error }]}>{expression}</Text>
        </View>
      );
    }
    return React.createElement('div', {
      style: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: displayMode ? 60 : 24,
        backgroundColor: 'transparent',
        color: textColor,
      },
      dangerouslySetInnerHTML: { __html: html ?? '' },
    });
  }

  const mathJaxInput = displayMode
    ? `$$${expression}$$`
    : `\\(${expression}\\)`;
  const fontSize = displayMode ? 18 : 14;

  return (
    <View style={[styles.container, style]}>
      <MathJaxSvg
        fontSize={fontSize}
        color={textColor}
        style={styles.mathJaxContainer}
      >
        {mathJaxInput}
      </MathJaxSvg>
    </View>
  );
}

function createStyles(displayMode: boolean) {
  return StyleSheet.create({
    container: {
      ...(displayMode ? { width: '100%' } : { alignSelf: 'flex-start' }),
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: displayMode ? 60 : 24,
      backgroundColor: 'transparent',
    },
    mathJaxContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      flexShrink: 1,
    },
    fallback: {
      fontSize: 16,
      fontFamily: 'monospace',
    },
  });
}
