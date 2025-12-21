import '../block_node.dart';
import '../document.dart';
import 'operation.dart';

/// Operation to insert a new block
class InsertBlockOperation implements Operation {
  final int blockIndex;
  final BlockNode block;

  const InsertBlockOperation({
    required this.blockIndex,
    required this.block,
  });

  @override
  OperationType get type => OperationType.insertBlock;

  @override
  Document apply(Document document) {
    return document.insertBlock(blockIndex, block);
  }

  @override
  Operation inverse(Document document) {
    return DeleteBlockOperation(blockIndex: blockIndex, block: block);
  }
}

/// Operation to delete a block
class DeleteBlockOperation implements Operation {
  final int blockIndex;
  final BlockNode block;

  const DeleteBlockOperation({
    required this.blockIndex,
    required this.block,
  });

  @override
  OperationType get type => OperationType.deleteBlock;

  @override
  Document apply(Document document) {
    return document.removeBlock(blockIndex);
  }

  @override
  Operation inverse(Document document) {
    return InsertBlockOperation(blockIndex: blockIndex, block: block);
  }
}