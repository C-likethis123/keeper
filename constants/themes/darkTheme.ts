import { DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { ExtendedTheme } from './types';
import { darkSyntaxTheme } from './syntaxTheme';
import { darkCodeEditorTheme } from './codeEditorTheme';

export function createDarkTheme(): ExtendedTheme {
  return {
    ...NavigationDarkTheme,
    typography: {
      heading1: {
        fontSize: 32,
        fontWeight: 'bold',
        lineHeight: 40,
        color: NavigationDarkTheme.colors.text,
      },
      heading2: {
        fontSize: 24,
        fontWeight: 'bold',
        lineHeight: 32,
        color: NavigationDarkTheme.colors.text,
      },
      heading3: {
        fontSize: 20,
        fontWeight: '600',
        lineHeight: 28,
        color: NavigationDarkTheme.colors.text,
      },
      body: {
        fontSize: 16,
        lineHeight: 24,
        color: NavigationDarkTheme.colors.text,
      },
    },
    custom: {
      syntax: darkSyntaxTheme,
      codeEditor: darkCodeEditorTheme,
      editor: {
        blockBackground: '#1E1E1E',
        blockFocused: '#252526',
        blockBorder: '#1AFFFFFF', // white with 10% opacity
        placeholder: '#999999',
        inlineCode: {
          fontFamily: 'monospace',
          backgroundColor: '#252526',
          color: darkSyntaxTheme.string,
        },
      },
    },
  };
}

