import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';

interface MathViewProps {
  expression: string;
  displayMode?: boolean;
  onError?: (error: string) => void;
  style?: any;
}

/**
 * TODO: make this a Cross-platform component for rendering LaTeX math expressions
 */
export function MathView({
  expression,
  displayMode = false,
  onError,
  style,
}: MathViewProps) {
  const theme = useExtendedTheme();


  const styles = useMemo(() => createStyles(displayMode), [displayMode]);

  // TODO: implement LaTeX view
  return (
    <View style={[styles.container, style]}>
      <Text>{expression}</Text>
    </View>
  );
}

function createStyles(displayMode: boolean) {
  return StyleSheet.create({
    container: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: displayMode ? 60 : 24,
      backgroundColor: 'transparent',
    },
  });
}

