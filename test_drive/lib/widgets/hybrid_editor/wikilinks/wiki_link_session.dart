class WikiLinkSession {
  final int blockIndex;
  final int startOffset; // where [[ started

  WikiLinkSession({
    required this.blockIndex,
    required this.startOffset,
  });
}