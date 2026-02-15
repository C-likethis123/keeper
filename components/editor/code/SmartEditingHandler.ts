import { LanguageConfig, LanguageRegistry } from './LanguageRegistry';

/// Result of a smart edit operation
export interface SmartEditResult {
  newText: string;
  newCursorOffset: number;
  handled: boolean;
}

/// Handles smart editing features for code blocks
export class SmartEditingHandler {
  private languageConfig: LanguageConfig | null;

  /// Default brace pairs if no language config is provided
  private static readonly defaultBracePairs: Record<string, string> = {
    '{': '}',
    '(': ')',
    '[': ']',
    '"': '"',
    "'": "'",
    '`': '`',
  };

  /// Characters that trigger auto-indent on newline
  private static readonly indentTriggers = new Set(['{', '(', '[', ':']);

  /// Characters that trigger outdent
  private static readonly outdentTriggers = new Set(['}', ')', ']']);

  constructor(languageConfig?: LanguageConfig | null) {
    this.languageConfig = languageConfig || null;
  }

  /// Gets the brace pairs for the current language
  private get bracePairs(): Record<string, string> {
    return this.languageConfig?.bracePairs || SmartEditingHandler.defaultBracePairs;
  }

  /// Gets the indent string for the current language
  private get indentString(): string {
    if (this.languageConfig?.useTabs) {
      return '\t';
    }
    const size = this.languageConfig?.indentSize ?? 2;
    return ' '.repeat(size);
  }

  /// Handles a character insertion for brace completion
  handleCharacterInsert(char: string, text: string, cursorOffset: number): SmartEditResult {
    if (this.bracePairs[char]) {
      const closingChar = this.bracePairs[char];

      if (char === '"' || char === "'" || char === '`') {
        if (cursorOffset < text.length && text[cursorOffset] === char) {
          return {
            newText: text,
            newCursorOffset: cursorOffset + 1,
            handled: true,
          };
        }

        if (this.shouldAutoCompleteQuote(text, cursorOffset, char)) {
          const newText =
            text.substring(0, cursorOffset) + char + closingChar + text.substring(cursorOffset);
          return {
            newText,
            newCursorOffset: cursorOffset + 1,
            handled: true,
          };
        }
      } else {
        const newText =
          text.substring(0, cursorOffset) + char + closingChar + text.substring(cursorOffset);
        return {
          newText,
          newCursorOffset: cursorOffset + 1,
          handled: true,
        };
      }
    }

    const closingBraces = Object.values(this.bracePairs);
    if (closingBraces.includes(char)) {
      if (cursorOffset < text.length && text[cursorOffset] === char) {
        return {
          newText: text,
          newCursorOffset: cursorOffset + 1,
          handled: true,
        };
      }
    }

    return { newText: text, newCursorOffset: cursorOffset, handled: false };
  }

  /// Handles backspace for brace deletion
  handleBackspace(text: string, cursorOffset: number): SmartEditResult {
    if (cursorOffset === 0 || cursorOffset > text.length) {
      return { newText: text, newCursorOffset: cursorOffset, handled: false };
    }

    const charBefore = text[cursorOffset - 1];

    if (this.bracePairs[charBefore]) {
      const closingChar = this.bracePairs[charBefore];
      if (cursorOffset < text.length && text[cursorOffset] === closingChar) {
        const newText = text.substring(0, cursorOffset - 1) + text.substring(cursorOffset + 1);
        return {
          newText,
          newCursorOffset: cursorOffset - 1,
          handled: true,
        };
      }
    }

    return { newText: text, newCursorOffset: cursorOffset, handled: false };
  }

  /// Handles enter key for auto-indentation
  handleEnter(text: string, cursorOffset: number): SmartEditResult {
    const beforeCursor = text.substring(0, cursorOffset);
    const afterCursor = text.substring(cursorOffset);
    const lastNewline = beforeCursor.lastIndexOf('\n');
    const currentLine =
      lastNewline === -1 ? beforeCursor : beforeCursor.substring(lastNewline + 1);

    const currentIndent = this.getLeadingWhitespace(currentLine);
    let newIndent = currentIndent;

    const trimmedLine = currentLine.trimEnd();
    if (trimmedLine.length > 0 && SmartEditingHandler.indentTriggers.has(trimmedLine[trimmedLine.length - 1])) {
      newIndent += this.indentString;
    }

    if (afterCursor.length > 0 && SmartEditingHandler.outdentTriggers.has(afterCursor[0])) {
      const newText = `${beforeCursor}\n${newIndent}\n${currentIndent}${afterCursor}`;
      return {
        newText,
        newCursorOffset: cursorOffset + 1 + newIndent.length,
        handled: true,
      };
    }

    const newText = `${beforeCursor}\n${newIndent}${afterCursor}`;
    return {
      newText,
      newCursorOffset: cursorOffset + 1 + newIndent.length,
      handled: true,
    };
  }

  /// Handles tab key for indentation
  handleTab(text: string, cursorOffset: number, shift: boolean = false): SmartEditResult {
    if (shift) {
      return this.handleOutdent(text, cursorOffset);
    } else {
      return this.handleIndent(text, cursorOffset);
    }
  }

  private handleIndent(text: string, cursorOffset: number): SmartEditResult {
    const beforeCursor = text.substring(0, cursorOffset);
    const lastNewline = beforeCursor.lastIndexOf('\n');
    const lineStart = lastNewline + 1;

    const newText = text.substring(0, lineStart) + this.indentString + text.substring(lineStart);
    return {
      newText,
      newCursorOffset: cursorOffset + this.indentString.length,
      handled: true,
    };
  }

  private handleOutdent(text: string, cursorOffset: number): SmartEditResult {
    const beforeCursor = text.substring(0, cursorOffset);
    const lastNewline = beforeCursor.lastIndexOf('\n');
    const lineStart = lastNewline + 1;
    const nextNewline = text.indexOf('\n', lineStart);
    const lineEnd = nextNewline === -1 ? text.length : nextNewline;
    const currentLine = text.substring(lineStart, lineEnd);

    if (currentLine.startsWith(this.indentString)) {
      const newText =
        text.substring(0, lineStart) +
        currentLine.substring(this.indentString.length) +
        text.substring(lineEnd);
      return {
        newText,
        newCursorOffset: Math.max(lineStart, Math.min(text.length, cursorOffset - this.indentString.length)),
        handled: true,
      };
    } else if (currentLine.startsWith('\t')) {
      const newText = text.substring(0, lineStart) + currentLine.substring(1) + text.substring(lineEnd);
      return {
        newText,
        newCursorOffset: Math.max(lineStart, Math.min(text.length, cursorOffset - 1)),
        handled: true,
      };
    }

    return { newText: text, newCursorOffset: cursorOffset, handled: false };
  }

  private shouldAutoCompleteQuote(text: string, cursorOffset: number, quote: string): boolean {
    if (cursorOffset > 0) {
      const charBefore = text[cursorOffset - 1];
      if (/[a-zA-Z0-9_]/.test(charBefore)) {
        return false;
      }
    }

    let quoteCount = 0;
    for (let i = 0; i < cursorOffset; i++) {
      if (text[i] === quote && (i === 0 || text[i - 1] !== '\\')) {
        quoteCount++;
      }
    }

    return quoteCount % 2 === 0;
  }

  private getLeadingWhitespace(line: string): string {
    const match = line.match(/^[\t ]*/);
    return match ? match[0] : '';
  }
}
