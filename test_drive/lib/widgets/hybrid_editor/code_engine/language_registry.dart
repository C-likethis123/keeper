import 'package:highlight/highlight.dart' show highlight, Mode, Result;
import 'package:highlight/languages/dart.dart' as dart_lang;
import 'package:highlight/languages/javascript.dart' as js_lang;
import 'package:highlight/languages/typescript.dart' as ts_lang;
import 'package:highlight/languages/python.dart' as python_lang;
import 'package:highlight/languages/java.dart' as java_lang;
import 'package:highlight/languages/kotlin.dart' as kotlin_lang;
import 'package:highlight/languages/swift.dart' as swift_lang;
import 'package:highlight/languages/go.dart' as go_lang;
import 'package:highlight/languages/rust.dart' as rust_lang;
import 'package:highlight/languages/cpp.dart' as cpp_lang;
import 'package:highlight/languages/cs.dart' as csharp_lang;
import 'package:highlight/languages/xml.dart' as xml_lang;
import 'package:highlight/languages/css.dart' as css_lang;
import 'package:highlight/languages/json.dart' as json_lang;
import 'package:highlight/languages/yaml.dart' as yaml_lang;
import 'package:highlight/languages/sql.dart' as sql_lang;
import 'package:highlight/languages/bash.dart' as bash_lang;
import 'package:highlight/languages/shell.dart' as shell_lang;

/// Configuration for a programming language
class LanguageConfig {
  final String name;
  final String displayName;
  final List<String> extensions;
  final Mode mode;
  final Map<String, String> bracePairs;
  final String commentLine;
  final String? commentBlockStart;
  final String? commentBlockEnd;
  final int indentSize;
  final bool useTabs;

  const LanguageConfig({
    required this.name,
    required this.displayName,
    required this.extensions,
    required this.mode,
    this.bracePairs = const {
      '{': '}',
      '(': ')',
      '[': ']',
    },
    this.commentLine = '//',
    this.commentBlockStart,
    this.commentBlockEnd,
    this.indentSize = 2,
    this.useTabs = false,
  });
}

/// Registry of programming languages
class LanguageRegistry {
  final Map<String, LanguageConfig> _languages = {};

  static final LanguageRegistry instance = LanguageRegistry._();

  LanguageRegistry._() {
    _registerDefaultLanguages();
  }

  void _registerDefaultLanguages() {
    // Register language modes with highlight.dart
    highlight.registerLanguage('dart', dart_lang.dart);
    highlight.registerLanguage('javascript', js_lang.javascript);
    highlight.registerLanguage('typescript', ts_lang.typescript);
    highlight.registerLanguage('python', python_lang.python);
    highlight.registerLanguage('java', java_lang.java);
    highlight.registerLanguage('kotlin', kotlin_lang.kotlin);
    highlight.registerLanguage('swift', swift_lang.swift);
    highlight.registerLanguage('go', go_lang.go);
    highlight.registerLanguage('rust', rust_lang.rust);
    highlight.registerLanguage('cpp', cpp_lang.cpp);
    highlight.registerLanguage('csharp', csharp_lang.cs);
    highlight.registerLanguage('html', xml_lang.xml);
    highlight.registerLanguage('xml', xml_lang.xml);
    highlight.registerLanguage('css', css_lang.css);
    highlight.registerLanguage('json', json_lang.json);
    highlight.registerLanguage('yaml', yaml_lang.yaml);
    highlight.registerLanguage('sql', sql_lang.sql);
    highlight.registerLanguage('bash', bash_lang.bash);
    highlight.registerLanguage('shell', shell_lang.shell);

    // Register language configurations
    _register(LanguageConfig(
      name: 'dart',
      displayName: 'Dart',
      extensions: ['.dart'],
      mode: dart_lang.dart,
      bracePairs: {'{': '}', '(': ')', '[': ']', '<': '>'},
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
    ));

    _register(LanguageConfig(
      name: 'javascript',
      displayName: 'JavaScript',
      extensions: ['.js', '.jsx', '.mjs'],
      mode: js_lang.javascript,
      bracePairs: {'{': '}', '(': ')', '[': ']'},
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
    ));

    _register(LanguageConfig(
      name: 'typescript',
      displayName: 'TypeScript',
      extensions: ['.ts', '.tsx'],
      mode: ts_lang.typescript,
      bracePairs: {'{': '}', '(': ')', '[': ']', '<': '>'},
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
    ));

    _register(LanguageConfig(
      name: 'python',
      displayName: 'Python',
      extensions: ['.py', '.pyw'],
      mode: python_lang.python,
      bracePairs: {'{': '}', '(': ')', '[': ']'},
      commentLine: '#',
      commentBlockStart: '"""',
      commentBlockEnd: '"""',
      indentSize: 4,
    ));

    _register(LanguageConfig(
      name: 'java',
      displayName: 'Java',
      extensions: ['.java'],
      mode: java_lang.java,
      bracePairs: {'{': '}', '(': ')', '[': ']', '<': '>'},
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      indentSize: 4,
    ));

    _register(LanguageConfig(
      name: 'kotlin',
      displayName: 'Kotlin',
      extensions: ['.kt', '.kts'],
      mode: kotlin_lang.kotlin,
      bracePairs: {'{': '}', '(': ')', '[': ']', '<': '>'},
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
    ));

    _register(LanguageConfig(
      name: 'swift',
      displayName: 'Swift',
      extensions: ['.swift'],
      mode: swift_lang.swift,
      bracePairs: {'{': '}', '(': ')', '[': ']', '<': '>'},
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
    ));

    _register(LanguageConfig(
      name: 'go',
      displayName: 'Go',
      extensions: ['.go'],
      mode: go_lang.go,
      bracePairs: {'{': '}', '(': ')', '[': ']'},
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
      useTabs: true,
    ));

    _register(LanguageConfig(
      name: 'rust',
      displayName: 'Rust',
      extensions: ['.rs'],
      mode: rust_lang.rust,
      bracePairs: {'{': '}', '(': ')', '[': ']', '<': '>'},
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
    ));

    _register(LanguageConfig(
      name: 'cpp',
      displayName: 'C++',
      extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.h'],
      mode: cpp_lang.cpp,
      bracePairs: {'{': '}', '(': ')', '[': ']', '<': '>'},
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
    ));

    _register(LanguageConfig(
      name: 'csharp',
      displayName: 'C#',
      extensions: ['.cs'],
      mode: csharp_lang.cs,
      bracePairs: {'{': '}', '(': ')', '[': ']', '<': '>'},
      commentLine: '//',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
    ));

    _register(LanguageConfig(
      name: 'html',
      displayName: 'HTML',
      extensions: ['.html', '.htm'],
      mode: xml_lang.xml,
      bracePairs: {'<': '>', '{': '}', '(': ')', '[': ']'},
      commentLine: '<!--',
      commentBlockStart: '<!--',
      commentBlockEnd: '-->',
    ));

    _register(LanguageConfig(
      name: 'css',
      displayName: 'CSS',
      extensions: ['.css'],
      mode: css_lang.css,
      bracePairs: {'{': '}', '(': ')', '[': ']'},
      commentLine: '/*',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
    ));

    _register(LanguageConfig(
      name: 'json',
      displayName: 'JSON',
      extensions: ['.json'],
      mode: json_lang.json,
      bracePairs: {'{': '}', '[': ']'},
      commentLine: '//', // JSON doesn't have comments, but some variants do
    ));

    _register(LanguageConfig(
      name: 'yaml',
      displayName: 'YAML',
      extensions: ['.yaml', '.yml'],
      mode: yaml_lang.yaml,
      bracePairs: {'{': '}', '[': ']'},
      commentLine: '#',
    ));

    _register(LanguageConfig(
      name: 'sql',
      displayName: 'SQL',
      extensions: ['.sql'],
      mode: sql_lang.sql,
      bracePairs: {'(': ')'},
      commentLine: '--',
      commentBlockStart: '/*',
      commentBlockEnd: '*/',
    ));

    _register(LanguageConfig(
      name: 'bash',
      displayName: 'Bash',
      extensions: ['.sh', '.bash'],
      mode: bash_lang.bash,
      bracePairs: {'{': '}', '(': ')', '[': ']'},
      commentLine: '#',
    ));

    _register(LanguageConfig(
      name: 'shell',
      displayName: 'Shell',
      extensions: ['.sh'],
      mode: shell_lang.shell,
      bracePairs: {'{': '}', '(': ')', '[': ']'},
      commentLine: '#',
    ));
  }

  void _register(LanguageConfig config) {
    _languages[config.name] = config;
    // Also register aliases
    for (final ext in config.extensions) {
      _languages[ext] = config;
    }
  }

  /// Gets a language configuration by name or extension
  LanguageConfig? getLanguage(String nameOrExtension) {
    return _languages[nameOrExtension.toLowerCase()];
  }

  /// Highlights code and returns the result
  Result? highlightCode(String code, String language) {
    try {
      return highlight.parse(code, language: language);
    } catch (e) {
      // Fallback to auto-detection
      try {
        return highlight.parse(code, autoDetection: true);
      } catch (_) {
        return null;
      }
    }
  }

  /// Gets all registered language names
  List<String> get languages => _languages.values
      .map((c) => c.name)
      .toSet()
      .toList()
    ..sort();
}
