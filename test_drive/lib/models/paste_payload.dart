import 'dart:typed_data';

class PastePayload {
  final String? text;
  final Uint8List? imageBytes;

  PastePayload.text(this.text) : imageBytes = null;
  PastePayload.image(this.imageBytes) : text = null;

  bool get isImage => imageBytes != null;
}
