import { Document, updateBlock } from '../Document';
import { copyBlock } from '../BlockNode';
import { Operation, OperationType } from './Operation';

/// Operation to update the list level of a block
export class UpdateListLevelOperation implements Operation {
  readonly type = OperationType.updateListLevel;

  constructor(
    readonly blockIndex: number,
    readonly oldLevel: number,
    readonly newLevel: number,
  ) {}

  apply(document: Document): Document {
    const block = document.blocks[this.blockIndex];
    return updateBlock(
      document,
      this.blockIndex,
      copyBlock(block, { listLevel: this.newLevel }),
    );
  }

  inverse(document: Document): Operation {
    return new UpdateListLevelOperation(
      this.blockIndex,
      this.newLevel,
      this.oldLevel,
    );
  }
}

