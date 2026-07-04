import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import {
  DetailsContentNode,
  DetailsNode,
  DetailsSummaryNode,
} from "./DetailsNode";
import { EquationNode } from "./equations/EquationNode";
import { ImageNode } from "./image/ImageNode";

export const KEEPER_MARKDOWN_IMPORT_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
  AutoLinkNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  DetailsContentNode,
  DetailsNode,
  DetailsSummaryNode,
  EquationNode,
  ImageNode,
];
