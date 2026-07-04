import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { CHECK_LIST, UNORDERED_LIST } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  TableCellNode,
  TableNode,
  TableRowNode,
} from "@lexical/table";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  COPY_COMMAND,
  PASTE_COMMAND,
  createEditor,
} from "lexical";
import {
  $isDetailsNode,
  DetailsContentNode,
  DetailsNode,
  DetailsSummaryNode,
} from "../DetailsNode";
import { $createImageNode, ImageNode } from "../image/ImageNode";
import { EquationNode } from "../equations/EquationNode";
import {
  KEEPER_MARKDOWN_TRANSFORMERS,
  exportLexicalToMarkdown,
  importMarkdownToLexical,
  parseMarkdownToSerializedNodes,
} from "../markdown";
import { registerChecklistMarkdownPrefixTransform } from "../lists/checklistMarkdownPrefix";
import { convertTodoTriggerAtSelection } from "../todoTrigger/todoTriggerTransform";
import { ClipboardShortcutsExtension } from "../extensions/ClipboardShortcutsExtension";
import { MarkdownPasteExtension } from "../extensions/MarkdownPasteExtension";

function roundTripMarkdown(markdown: string): string {
  const editor = createEditor({
    namespace: "KeeperMarkdownTest",
    nodes: [
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
    ],
    onError: (error) => {
      throw error;
    },
  });

  let result = "";
  editor.update(
    () => {
      importMarkdownToLexical(markdown);
      result = exportLexicalToMarkdown();
    },
    { discrete: true },
  );

  return result;
}

function getFirstImportedNode(markdown: string) {
  const editor = createEditor({
    namespace: "KeeperMarkdownNodeTest",
    nodes: [
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
    ],
    onError: (error) => {
      throw error;
    },
  });

  let node = null;
  editor.update(
    () => {
      importMarkdownToLexical(markdown);
      node = $getRoot().getFirstChild();
    },
    { discrete: true },
  );

  return node;
}

describe("Keeper Lexical markdown transformers", () => {
  it("parses pasted markdown into serialized lexical nodes", () => {
    const nodes = parseMarkdownToSerializedNodes("# Heading\n\n- **bold** item");

    expect(nodes).toMatchObject([
      { tag: "h1", type: "heading" },
      { listType: "bullet", type: "list" },
    ]);
  });

  it("handles paste events by inserting parsed markdown nodes", () => {
    const editor = createEditor({
      namespace: "KeeperMarkdownPasteTest",
      nodes: [
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
      ],
      onError: (error) => {
        throw error;
      },
    });
    const unregisterPaste =
      MarkdownPasteExtension.register?.(editor, {}, {} as never) ??
      (() => {});
    const preventDefault = jest.fn();

    editor.update(
      () => {
        importMarkdownToLexical("");
        $getRoot().selectEnd();
      },
      { discrete: true },
    );

    editor.dispatchCommand(PASTE_COMMAND, {
      clipboardData: {
        getData: () => "# Pasted",
      },
      preventDefault,
    } as unknown as ClipboardEvent);

    let markdown = "";
    editor.getEditorState().read(() => {
      markdown = exportLexicalToMarkdown();
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(markdown).toBe("# Pasted");

    unregisterPaste();
  });

  it("copies full editor selection as markdown", () => {
    const editor = createEditor({
      namespace: "KeeperCopyMarkdownTest",
      nodes: [
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
      ],
      onError: (error) => {
        throw error;
      },
    });
    const unregisterCopy =
      ClipboardShortcutsExtension.register?.(editor, {}, {} as never) ??
      (() => {});
    const preventDefault = jest.fn();
    const setData = jest.fn();

    editor.update(
      () => {
        importMarkdownToLexical("# Title\n\n- item");
        $getRoot().select(0, $getRoot().getChildrenSize());
      },
      { discrete: true },
    );

    editor.dispatchCommand(COPY_COMMAND, {
      clipboardData: { setData },
      preventDefault,
    } as unknown as ClipboardEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(setData).toHaveBeenCalledWith("text/plain", "# Title\n\n- item");

    unregisterCopy();
  });

  it("round-trips image markdown through ImageNode", () => {
    expect(roundTripMarkdown("![Diagram](keeper://asset/image.png)")).toBe(
      "![Diagram](keeper://asset/image.png)",
    );
  });

  it("exports an inserted image instead of empty paragraph text", () => {
    const editor = createEditor({
      namespace: "KeeperInsertedImageMarkdownTest",
      nodes: [
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
      ],
      onError: (error) => {
        throw error;
      },
    });

    let result = "";
    editor.update(
      () => {
        const paragraph = $createParagraphNode();
        paragraph.append($createImageNode("assets/image.png", ""));
        $getRoot().append(paragraph);
        result = exportLexicalToMarkdown();
      },
      { discrete: true },
    );

    expect(result).toBe("![](assets/image.png)");
  });

  it("round-trips block equation markdown through EquationNode", () => {
    expect(roundTripMarkdown("$$x = y + z$$")).toBe("$$x = y + z$$");
  });

  it("round-trips inline equation markdown through EquationNode", () => {
    expect(roundTripMarkdown("Inline $x = y + z$ equation")).toBe(
      "Inline $x = y + z$ equation",
    );
  });

  it("round-trips details markdown through DetailsNode", () => {
    const markdown = [
      "<details>",
      "<summary>Title</summary>",
      "",
      "## Heading",
      "",
      "- **One**",
      "- Two",
      "",
      "</details>",
    ].join("\n");

    expect(roundTripMarkdown(markdown)).toBe(markdown);
    expect($isDetailsNode(getFirstImportedNode(markdown))).toBe(true);
  });

  it("round-trips table markdown through TableNode", () => {
    const markdown = ["| A | B |", "| --- | --- |", "| 1 | 2 |"].join("\n");

    expect(roundTripMarkdown(markdown)).toBe(markdown);
  });

  it("exports inserted tables to markdown", () => {
    const editor = createEditor({
      namespace: "KeeperInsertedTableMarkdownTest",
      nodes: [
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
      ],
      onError: (error) => {
        throw error;
      },
    });

    let result = "";
    editor.update(
      () => {
        const tableNode = $createTableNode();
        for (const row of [
          ["A", "B"],
          ["1", "2"],
          ["3", "4"],
        ]) {
          const rowNode = $createTableRowNode();
          for (const cell of row) {
            const cellNode = $createTableCellNode();
            cellNode.append(
              $createParagraphNode().append($createTextNode(cell)),
            );
            rowNode.append(cellNode);
          }
          tableNode.append(rowNode);
        }
        $getRoot().append(tableNode);
        result = exportLexicalToMarkdown();
      },
      { discrete: true },
    );

    expect(result).toBe(
      ["| A | B |", "| --- | --- |", "| 1 | 2 |", "| 3 | 4 |"].join("\n"),
    );
  });

  it("round-trips fenced code block language through CodeNode", () => {
    const markdown = "```cpp\nint main() {\n\treturn 0;\n}\n```";

    expect(roundTripMarkdown(markdown)).toBe(markdown);
  });

  it("round-trips unchecked checklist items", () => {
    expect(roundTripMarkdown("- [ ] Follow up")).toBe("- [ ] Follow up");
  });

  it("round-trips checked checklist items", () => {
    expect(roundTripMarkdown("- [x] Done")).toBe("- [x] Done");
  });

  it("checks checklist markdown before unordered list markdown", () => {
    const checklistIndex = KEEPER_MARKDOWN_TRANSFORMERS.findIndex(
      (transformer) => transformer === CHECK_LIST,
    );
    const unorderedListIndex = KEEPER_MARKDOWN_TRANSFORMERS.findIndex(
      (transformer) => transformer === UNORDERED_LIST,
    );

    expect(checklistIndex).toBeGreaterThanOrEqual(0);
    expect(checklistIndex).toBeLessThan(unorderedListIndex);
  });

  it("converts a bullet item prefix into a checklist item", () => {
    const editor = createEditor({
      namespace: "KeeperChecklistPrefixTest",
      nodes: [ListNode, ListItemNode],
      onError: (error) => {
        throw error;
      },
    });
    const unregister = registerChecklistMarkdownPrefixTransform(editor);

    let result = "";
    editor.update(
      () => {
        importMarkdownToLexical("- [x] test");
        result = exportLexicalToMarkdown();
      },
      { discrete: true },
    );
    unregister();

    expect(result).toBe("- [x] test");
  });

  it("does not convert a TODO trigger while text is still being edited", () => {
    const editor = createEditor({
      namespace: "KeeperTodoTriggerIdleTest",
      nodes: [LinkNode],
      onError: (error) => {
        throw error;
      },
    });

    let result = "";
    editor.update(
      () => {
        importMarkdownToLexical("TODO: B");
        result = exportLexicalToMarkdown();
      },
      { discrete: true },
    );

    expect(result).toBe("TODO: B");
  });

  it("converts a TODO trigger into a wiki link when leaving the paragraph", () => {
    const editor = createEditor({
      namespace: "KeeperTodoTriggerTest",
      nodes: [LinkNode],
      onError: (error) => {
        throw error;
      },
    });

    let result = "";
    editor.update(
      () => {
        importMarkdownToLexical("TODO: Buy milk");
        $getRoot().getFirstChild()?.selectEnd();
        convertTodoTriggerAtSelection();
        result = exportLexicalToMarkdown();
      },
      { discrete: true },
    );

    expect(result).toBe("TODO: [[Buy milk]]");
  });

  it("preserves the accepted TODO trigger keyword and separator", () => {
    const editor = createEditor({
      namespace: "KeeperTodoTriggerNoColonTest",
      nodes: [LinkNode],
      onError: (error) => {
        throw error;
      },
    });

    let result = "";
    editor.update(
      () => {
        importMarkdownToLexical("todo Call Alice");
        $getRoot().getFirstChild()?.selectEnd();
        convertTodoTriggerAtSelection();
        result = exportLexicalToMarkdown();
      },
      { discrete: true },
    );

    expect(result).toBe("todo [[Call Alice]]");
  });
});
