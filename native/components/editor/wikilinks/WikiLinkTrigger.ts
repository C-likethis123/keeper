/// Utility functions for detecting wiki link triggers ([[)
export class WikiLinkTrigger {
  /// Finds the start position of a wiki link trigger before the caret
  /// Returns null if no trigger is found
  static findStart(text: string, caret: number): number | null {
    if (caret < 2) return null;
    const index = text.lastIndexOf('[[', caret - 1);
    return index >= 0 ? index : null;
  }
}

