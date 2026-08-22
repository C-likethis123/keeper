import { $createCodeNode, $isCodeNode, CodeNode } from "@lexical/code";
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  createEditor,
} from "lexical";
import { handleCodeTextInsertion, handleEnter } from "../codeBlockSmartEdit";
import { exitCodeBlock } from "../exitCodeBlock";
import { convertTodoTriggerAtSelection } from "../../todoTrigger/todoTriggerTransform";

describe("CodeBlockExtension smart edit", () => {
  it("escapes a code block into a new paragraph", () => {
    const editor = createEditor({ nodes: [CodeNode] });

    editor.update(
      () => {
        const codeNode = $createCodeNode();
        const textNode = $createTextNode("const answer = 42;");
        codeNode.append(textNode);
        $getRoot().append(codeNode);
        textNode.selectEnd();
        exitCodeBlock(codeNode);
      },
      { discrete: true },
    );

    editor.getEditorState().read(() => {
      const children = $getRoot().getChildren();
      expect(children).toHaveLength(2);
      expect($isCodeNode(children[0])).toBe(true);
      expect($isParagraphNode(children[1])).toBe(true);
      const selection = $getSelection();
      expect($isRangeSelection(selection)).toBe(true);
      expect(selection?.anchor.getNode().getTopLevelElement()).toBe(children[1]);
    });
  });

  it("completes opening braces in code blocks", () => {
    expect(handleCodeTextInsertion("foo", 3, "{")).toEqual({
      handled: true,
      newCursorOffset: 4,
      newText: "foo{}",
    });
  });

  it("steps over an existing closing brace", () => {
    expect(handleCodeTextInsertion("foo{}", 4, "}")).toEqual({
      handled: true,
      newCursorOffset: 5,
      newText: "foo{}",
    });
  });

  it("ignores ordinary text insertion", () => {
    expect(handleCodeTextInsertion("foo", 3, "a")).toEqual({
      handled: false,
      newCursorOffset: 3,
      newText: "foo",
    });
  });

  it("does not apply TODO link styling inside code blocks", () => {
    const editor = createEditor({ nodes: [CodeNode] });
    let converted = true;

    editor.update(
      () => {
        const codeNode = $createCodeNode();
        const textNode = $createTextNode("TODO: keep literal");
        codeNode.append(textNode);
        $getRoot().append(codeNode);
        textNode.selectEnd();
        converted = convertTodoTriggerAtSelection();
      },
      { discrete: true },
    );

    expect(converted).toBe(false);
    editor.getEditorState().read(() => {
      expect($getRoot().getTextContent()).toBe("TODO: keep literal");
    });
  });

  it("opens an indented blank line between paired braces", () => {
    expect(handleEnter("if (ok) {}", 9)).toEqual({
      handled: true,
      newCursorOffset: 14,
      newText: "if (ok) {\n    \n}",
    });
  });

  it("keeps closing brace aligned with the current block indent", () => {
    expect(handleEnter("    if (ok) {}", 13)).toEqual({
      handled: true,
      newCursorOffset: 22,
      newText: "    if (ok) {\n        \n    }",
    });
  });
});
