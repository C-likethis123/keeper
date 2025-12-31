class WikiTrigger {
  static int? findStart(String text, int caret) {
    if (caret < 2) return null;
    final index = text.lastIndexOf('[[', caret - 1);
    return index;
  }

  static bool shouldStart(String text, int caret) {
    return findStart(text, caret) != null;
  }
}
