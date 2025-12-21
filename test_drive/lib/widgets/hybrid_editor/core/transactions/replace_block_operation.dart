import '../block_node.dart';
import '../document.dart';
import 'operation.dart';

/// Operation to replace multiple blocks
class ReplaceBlocksOperation implements Operation {
  final int startIndex;
  final int endIndex;
  final List<BlockNode> oldBlocks;
  final List<BlockNode> newBlocks;

  const ReplaceBlocksOperation({
    required this.startIndex,
    required this.endIndex,
    required this.oldBlocks,
    required this.newBlocks,
  });

  @override
  OperationType get type => OperationType.replaceBlocks;

  @override
  Document apply(Document document) {
    return document.replaceBlocks(startIndex, endIndex, newBlocks);
  }

  @override
  Operation inverse(Document document) {
    return ReplaceBlocksOperation(
      startIndex: startIndex,
      endIndex: startIndex + newBlocks.length,
      oldBlocks: newBlocks,
      newBlocks: oldBlocks,
    );
  }
}