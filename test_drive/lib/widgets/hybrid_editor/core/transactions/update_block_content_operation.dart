import '../document.dart';
import 'operation.dart';

/// Operation to update the content of a block
class UpdateBlockContentOperation implements Operation {
  final int blockIndex;
  final String oldContent;
  final String newContent;

  const UpdateBlockContentOperation({
    required this.blockIndex,
    required this.oldContent,
    required this.newContent,
  });

  @override
  OperationType get type => OperationType.updateBlock;

  @override
  Document apply(Document document) {
    final block = document[blockIndex];
    return document.updateBlock(
      blockIndex,
      block.copyWith(content: newContent),
    );
  }

  @override
  Operation inverse(Document document) {
    return UpdateBlockContentOperation(
      blockIndex: blockIndex,
      oldContent: newContent,
      newContent: oldContent,
    );
  }
}