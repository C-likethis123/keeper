/// Configuration for a programming language
export interface LanguageConfig {
  name: string;
  displayName: string;
  extensions: string[];
  bracePairs: Record<string, string>;
  commentLine: string;
  commentBlockStart?: string;
  commentBlockEnd?: string;
  indentSize: number;
  useTabs: boolean;
}

/// Registry of programming languages
export class LanguageRegistry {
  private _languages = new Map<string, LanguageConfig>();
  private static _instance: LanguageRegistry;

  private constructor() {
    this.registerDefaultLanguages();
  }

  static get instance(): LanguageRegistry {
    if (!LanguageRegistry._instance) {
      LanguageRegistry._instance = new LanguageRegistry();
    }
    return LanguageRegistry._instance;
  }

  private registerDefaultLanguages(): void {
    // Dart
    this.register({
      name: 'dart',
      displayName: 'Dart',
      extensions: ['.dart'],
      bracePairs: { '{': '}', '(': ')', '[': ']', '<': '>' },
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      indentSize: 2,
      useTabs: false,
    });

    // JavaScript
    this.register({
      name: 'javascript',
      displayName: 'JavaScript',
      extensions: ['.js', '.jsx', '.mjs'],
      bracePairs: { '{': '}', '(': ')', '[': ']' },
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      indentSize: 2,
      useTabs: false,
    });

    // TypeScript
    this.register({
      name: 'typescript',
      displayName: 'TypeScript',
      extensions: ['.ts', '.tsx'],
      bracePairs: { '{': '}', '(': ')', '[': ']', '<': '>' },
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      indentSize: 2,
      useTabs: false,
    });

    // Python
    this.register({
      name: 'python',
      displayName: 'Python',
      extensions: ['.py', '.pyw'],
      bracePairs: { '{': '}', '(': ')', '[': ']' },
      commentLine: '#',
      commentBlockStart: '"""',
      commentBlockEnd: '"""',
      indentSize: 4,
      useTabs: false,
    });

    // Java
    this.register({
      name: 'java',
      displayName: 'Java',
      extensions: ['.java'],
      bracePairs: { '{': '}', '(': ')', '[': ']', '<': '>' },
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      indentSize: 4,
      useTabs: false,
    });

    // Kotlin
    this.register({
      name: 'kotlin',
      displayName: 'Kotlin',
      extensions: ['.kt', '.kts'],
      bracePairs: { '{': '}', '(': ')', '[': ']', '<': '>' },
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      indentSize: 2,
      useTabs: false,
    });

    // Swift
    this.register({
      name: 'swift',
      displayName: 'Swift',
      extensions: ['.swift'],
      bracePairs: { '{': '}', '(': ')', '[': ']', '<': '>' },
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      indentSize: 2,
      useTabs: false,
    });

    // Go
    this.register({
      name: 'go',
      displayName: 'Go',
      extensions: ['.go'],
      bracePairs: { '{': '}', '(': ')', '[': ']' },
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      useTabs: true,
      indentSize: 1,
    });

    // Rust
    this.register({
      name: 'rust',
      displayName: 'Rust',
      extensions: ['.rs'],
      bracePairs: { '{': '}', '(': ')', '[': ']', '<': '>' },
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      indentSize: 2,
      useTabs: false,
    });

    // C++
    this.register({
      name: 'cpp',
      displayName: 'C++',
      extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
      bracePairs: { '{': '}', '(': ')', '[': ']', '<': '>' },
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      indentSize: 2,
      useTabs: false,
    });

    // C#
    this.register({
      name: 'csharp',
      displayName: 'C#',
      extensions: ['.cs'],
      bracePairs: { '{': '}', '(': ')', '[': ']', '<': '>' },
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      indentSize: 2,
      useTabs: false,
    });

    // HTML
    this.register({
      name: 'html',
      displayName: 'HTML',
      extensions: ['.html', '.htm'],
      bracePairs: { '<': '>', '{': '}', '(': ')', '[': ']' },
      commentLine: '<!--',
      commentBlockStart: '<!--',
      commentBlockEnd: '-->',
      indentSize: 2,
      useTabs: false,
    });

    // CSS
    this.register({
      name: 'css',
      displayName: 'CSS',
      extensions: ['.css'],
      bracePairs: { '{': '}', '(': ')', '[': ']' },
      commentLine: '/*',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      indentSize: 2,
      useTabs: false,
    });

    // JSON
    this.register({
      name: 'json',
      displayName: 'JSON',
      extensions: ['.json'],
      bracePairs: { '{': '}', '[': ']' },
      commentLine: '//',
      indentSize: 2,
      useTabs: false,
    });

    // YAML
    this.register({
      name: 'yaml',
      displayName: 'YAML',
      extensions: ['.yaml', '.yml'],
      bracePairs: { '{': '}', '[': ']' },
      commentLine: '#',
      indentSize: 2,
      useTabs: false,
    });

    // SQL
    this.register({
      name: 'sql',
      displayName: 'SQL',
      extensions: ['.sql'],
      bracePairs: { '(': ')' },
      commentLine: '--',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      indentSize: 2,
      useTabs: false,
    });

    // Bash
    this.register({
      name: 'bash',
      displayName: 'Bash',
      extensions: ['.sh', '.bash'],
      bracePairs: { '{': '}', '(': ')', '[': ']' },
      commentLine: '#',
      indentSize: 2,
      useTabs: false,
    });

    // Shell
    this.register({
      name: 'shell',
      displayName: 'Shell',
      extensions: ['.sh'],
      bracePairs: { '{': '}', '(': ')', '[': ']' },
      commentLine: '#',
      indentSize: 2,
      useTabs: false,
    });

    // Plain text (default)
    this.register({
      name: 'plaintext',
      displayName: 'Plain Text',
      extensions: ['.txt'],
      bracePairs: { '{': '}', '(': ')', '[': ']' },
      commentLine: '',
      indentSize: 2,
      useTabs: false,
    });
  }

  private register(config: LanguageConfig): void {
    this._languages.set(config.name.toLowerCase(), config);
    for (const ext of config.extensions) {
      this._languages.set(ext.toLowerCase(), config);
    }
  }

  /// Gets a language configuration by name or extension
  getLanguage(nameOrExtension: string): LanguageConfig | null {
    return this._languages.get(nameOrExtension.toLowerCase()) || null;
  }

  /// Gets all registered language names
  get languages(): string[] {
    const names = new Set<string>();
    for (const config of this._languages.values()) {
      names.add(config.name);
    }
    return Array.from(names).sort();
  }

  /// Highlights code and returns the result
  highlightCode(code: string, language: string): any {
    try {
      const hljs = require('highlight.js');
      const result = hljs.highlight(code, { language });
      return result;
    } catch (e) {
      try {
        const hljs = require('highlight.js');
        const result = hljs.highlightAuto(code);
        return result;
      } catch (_) {
        return null;
      }
    }
  }
}
