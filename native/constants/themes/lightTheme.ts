import { DefaultTheme as NavigationLightTheme } from '@react-navigation/native';
import { ExtendedTheme } from './types';
import { lightSyntaxTheme } from './syntaxTheme';
import { lightCodeEditorTheme } from './codeEditorTheme';

export function createLightTheme(): ExtendedTheme {
  return {
    ...NavigationLightTheme,
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

