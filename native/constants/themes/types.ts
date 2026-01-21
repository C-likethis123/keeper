import { Theme } from '@react-navigation/native';
import { TextStyle } from 'react-native';

export interface SyntaxTheme {
  background: string;
  defaultText: string;
  keyword: string;
  string: string;
  number: string;
  comment: string;
  function: string;
  typeOfVariable: string;
  variable: string;
  operator: string;
  punctuation: string;
  attribute: string;
  tag: string;
  getColorForClass: (className: string | null) => string;
}

export interface CodeEditorTheme {
  background: string;
  headerBackground: string;
  border: string;
  icon: string;
  dropdownText: string;
}

export interface Typography {
  heading1: TextStyle;
  heading2: TextStyle;
  heading3: TextStyle;
  body: TextStyle;
}

export interface ExtendedTheme extends Theme {
  typography: Typography;
  custom: {
    syntax: SyntaxTheme;
    codeEditor: CodeEditorTheme;
    editor: {
      blockBackground: string;
      blockFocused: string;
      blockBorder: string;
      placeholder: string;
      inlineCode: {
        fontFamily: string;
        backgroundColor: string;
        color: string;
      };
    };
  };
}

