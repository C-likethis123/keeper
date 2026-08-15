import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode } from "@lexical/link";
import { HorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import {
  DetailsContentNode,
  DetailsNode,
  DetailsSummaryNode,
} from "./DetailsNode";
import { EquationNode } from "./equations/EquationNode";
import { ImageNode } from "./image/ImageNode";

export const KEEPER_EDITOR_NODES = [
  CodeNode,
  CodeHighlightNode,
  AutoLinkNode,
  HorizontalRuleNode,
  DetailsContentNode,
  DetailsNode,
  DetailsSummaryNode,
  EquationNode,
  ImageNode,
];
