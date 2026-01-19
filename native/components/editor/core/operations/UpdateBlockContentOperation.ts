import { Document, updateBlock } from '../Document';
import { copyBlock } from '../BlockNode';
import { Operation, OperationType } from './Operation';

/// Operation to update the content of a block
export class UpdateBlockContentOperation implements Operation {
  readonly type = OperationType.updateBlock;

  constructor(
    readonly blockIndex: number,
    readonly oldContent: string,
    readonly newContent: string,
  ) {}

  apply(document: Document): Document {
    const block = document.blocks[this.blockIndex];
    return updateBlock(document, this.blockIndex, copyBlock(block, { content: this.newContent }));
  }

  inverse(document: Document): Operation {
    return new UpdateBlockContentOperation(
      this.blockIndex,
      this.newContent,
      this.oldContent,
    );
  }
}

