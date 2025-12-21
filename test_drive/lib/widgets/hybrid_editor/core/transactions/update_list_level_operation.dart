import 'package:test_drive/widgets/hybrid_editor/core/document.dart';
import 'package:test_drive/widgets/hybrid_editor/core/transactions/operation.dart';

class UpdateListLevelOperation implements Operation {
  final int blockIndex;
  final int oldLevel;
  final int newLevel;

  const UpdateListLevelOperation({
    required this.blockIndex,
    required this.oldLevel,
    required this.newLevel,
  });

  @override
  OperationType get type => OperationType.updateListLevel;

  @override
  Document apply(Document document) {
    final block = document[blockIndex];
    return document.updateBlock(
      blockIndex,
      block.copyWith(listLevel: newLevel),
    );
  }

  @override
  Operation inverse(Document document) {
    return UpdateListLevelOperation(
      blockIndex: blockIndex,
      oldLevel: newLevel,
      newLevel: oldLevel,
    );
  }
}
