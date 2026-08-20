import type { CodeNode } from "@lexical/code";
import { $createParagraphNode } from "lexical";

export function exitCodeBlock(codeNode: CodeNode) {
  const paragraph = $createParagraphNode();
  codeNode.insertAfter(paragraph);
  paragraph.selectStart();
}
