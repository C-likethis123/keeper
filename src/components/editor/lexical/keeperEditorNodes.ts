import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode } from "@lexical/link";
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
  DetailsContentNode,
  DetailsNode,
  DetailsSummaryNode,
  EquationNode,
  ImageNode,
];
