import '../block_node.dart';
import '../document.dart';
import 'operation.dart';

/// Operation to update the type of a block
class UpdateBlockTypeOperation implements Operation {
  final int blockIndex;
  final BlockType oldType;
  final BlockType newType;
  final String? oldLanguage;
  final String? newLanguage;

  const UpdateBlockTypeOperation({
    required this.blockIndex,
    required this.oldType,
    required this.newType,
    this.oldLanguage,
    this.newLanguage,
  });

  @override
  OperationType get type => OperationType.updateBlock;

  @override
  Document apply(Document document) {
    final block = document[blockIndex];
    return document.updateBlock(
      blockIndex,
      block.copyWith(type: newType, language: newLanguage),
    );
  }

  @override
  Operation inverse(Document document) {
    return UpdateBlockTypeOperation(
      blockIndex: blockIndex,
      oldType: newType,
      newType: oldType,
      oldLanguage: newLanguage,
      newLanguage: oldLanguage,
    );
  }
}
