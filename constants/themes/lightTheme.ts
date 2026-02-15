import { DefaultTheme as NavigationLightTheme } from '@react-navigation/native';
import { withOpacity } from '@/utils/color';
import { ExtendedTheme } from './types';
import { lightSyntaxTheme } from './syntaxTheme';
import { lightCodeEditorTheme } from './codeEditorTheme';

export function createLightTheme(): ExtendedTheme {
  const { colors } = NavigationLightTheme;
  return {
    ...NavigationLightTheme,
    colors: {
      ...colors,
      error: '#ef4444',
      textMuted: withOpacity(colors.text, 0.5),
      textFaded: withOpacity(colors.text, 0.375),
      textDisabled: withOpacity(colors.text, 0.25),
      primaryPressed: withOpacity(colors.primary, 0.8),
    },
    typography: {
      heading1: {
        fontSize: 32,
        fontWeight: 'bold',
        lineHeight: 40,
        color: NavigationLightTheme.colors.text,
      },
      heading2: {
        fontSize: 24,
        fontWeight: 'bold',
        lineHeight: 32,
        color: NavigationLightTheme.colors.text,
      },
      heading3: {
        fontSize: 20,
        fontWeight: '600',
        lineHeight: 28,
        color: NavigationLightTheme.colors.text,
      },
      body: {
        fontSize: 16,
        lineHeight: 24,
        color: NavigationLightTheme.colors.text,
      },
    },
    custom: {
      syntax: lightSyntaxTheme,
      codeEditor: lightCodeEditorTheme,
      editor: {
        blockBackground: '#FFFFFF',
        blockFocused: '#F5F5F5',
        blockBorder: '#E0E0E0',
        placeholder: '#999999',
        inlineCode: {
          fontFamily: 'monospace',
          backgroundColor: '#F5F5F5',
          color: lightSyntaxTheme.string,
        },
      },
    },
  };
}

