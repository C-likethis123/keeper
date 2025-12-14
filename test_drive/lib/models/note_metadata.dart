/// Lightweight metadata for a note file before full parsing
class NoteMetadata {
  final String filePath;
  final String fileName;
  final DateTime lastModified;
  final String sourceFolder;

  NoteMetadata({
    required this.filePath,
    required this.fileName,
    required this.lastModified,
    required this.sourceFolder,
  });
}
