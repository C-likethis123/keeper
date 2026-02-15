import { Document, removeBlock } from '../Document';
import { BlockNode } from '../BlockNode';
import { Operation, OperationType } from './Operation';
import { InsertBlockOperation } from './InsertBlockOperation';

/// Operation to delete a block
export class DeleteBlockOperation implements Operation {
  readonly type = OperationType.deleteBlock;

  constructor(
    readonly blockIndex: number,
    readonly block: BlockNode,
  ) {}

  apply(document: Document): Document {
    return removeBlock(document, this.blockIndex);
  }

  inverse(document: Document): Operation {
    return new InsertBlockOperation(this.blockIndex, this.block);
  }
}

