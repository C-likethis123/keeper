import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getRoot,
  type LexicalEditor,
  type NodeKey,
} from "lexical";
import {
  type DragEvent as ReactDragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface KeeperDraggableBlockPluginProps {
  anchorElem: HTMLElement | null;
}

const DRAG_DATA_FORMAT = "application/x-keeper-lexical-drag-block";
const HANDLE_SIZE = 24;
const HANDLE_LEFT = 4;
const TARGET_LINE_LEFT = 24;
const TARGET_LINE_HALF_HEIGHT = 2;

function getTopLevelElements(editor: LexicalEditor) {
  return editor.read(() =>
    $getRoot()
      .getChildrenKeys()
      .map((key) => editor.getElementByKey(key))
      .filter((element): element is HTMLElement => element !== null),
  );
}

function getBlockElementAtY(
  editor: LexicalEditor,
  y: number,
  useEdgeAsDefault = false,
) {
  const elements = getTopLevelElements(editor);
  if (elements.length === 0) return null;

  for (const element of elements) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const marginTop = Number.parseFloat(style.marginTop) || 0;
    const marginBottom = Number.parseFloat(style.marginBottom) || 0;

    if (y >= rect.top - marginTop && y <= rect.bottom + marginBottom) {
      return element;
    }
  }

  if (!useEdgeAsDefault) return null;

  const first = elements[0];
  const last = elements[elements.length - 1];
  if (y < first.getBoundingClientRect().top) return first;
  if (y > last.getBoundingClientRect().bottom) return last;

  return null;
}

function positionMenu(
  menuElem: HTMLElement,
  targetElem: HTMLElement | null,
  anchorElem: HTMLElement,
) {
  if (!targetElem) {
    menuElem.style.display = "none";
    return;
  }

  const targetRect = targetElem.getBoundingClientRect();
  const anchorRect = anchorElem.getBoundingClientRect();
  const targetStyle = window.getComputedStyle(targetElem);
  const lineHeight = Number.parseInt(targetStyle.lineHeight, 10);
  const targetHeight = Number.isNaN(lineHeight) ? targetRect.height : lineHeight;
  const top =
    targetRect.top -
    anchorRect.top +
    (targetHeight - HANDLE_SIZE) / 2 +
    anchorElem.scrollTop;

  menuElem.style.display = "flex";
  menuElem.style.opacity = "1";
  menuElem.style.transform = `translate(${HANDLE_LEFT}px, ${top}px)`;
}

function positionTargetLine(
  lineElem: HTMLElement,
  targetElem: HTMLElement,
  anchorElem: HTMLElement,
  y: number,
) {
  const targetRect = targetElem.getBoundingClientRect();
  const anchorRect = anchorElem.getBoundingClientRect();
  const style = window.getComputedStyle(targetElem);
  const marginTop = Number.parseFloat(style.marginTop) || 0;
  const marginBottom = Number.parseFloat(style.marginBottom) || 0;
  const lineTop =
    y >= targetRect.top
      ? targetRect.bottom + marginBottom / 2
      : targetRect.top - marginTop / 2;
  const top =
    lineTop - anchorRect.top - TARGET_LINE_HALF_HEIGHT + anchorElem.scrollTop;
  const width = Math.max(anchorRect.width - TARGET_LINE_LEFT * 2, 0);

  lineElem.style.opacity = "0.4";
  lineElem.style.transform = `translate(${TARGET_LINE_LEFT}px, ${top}px)`;
  lineElem.style.width = `${width}px`;
}

function hideTargetLine(lineElem: HTMLElement | null) {
  if (!lineElem) return;
  lineElem.style.opacity = "0";
  lineElem.style.transform = "translate(-10000px, -10000px)";
}

export function KeeperDraggableBlockPlugin({
  anchorElem,
}: KeeperDraggableBlockPluginProps) {
  const [editor] = useLexicalComposerContext();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const targetLineRef = useRef<HTMLDivElement | null>(null);
  const draggedKeyRef = useRef<NodeKey | null>(null);
  const [hoverBlockElem, setHoverBlockElem] = useState<HTMLElement | null>(null);

  const updateHoverBlock = useCallback(
    (event: MouseEvent) => {
      if (!anchorElem || menuRef.current?.contains(event.target as Node)) return;
      setHoverBlockElem(getBlockElementAtY(editor, event.clientY));
    },
    [anchorElem, editor],
  );

  useEffect(() => {
    if (!anchorElem) return;

    const handleMouseLeave = () => setHoverBlockElem(null);

    anchorElem.addEventListener("mousemove", updateHoverBlock);
    anchorElem.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      anchorElem.removeEventListener("mousemove", updateHoverBlock);
      anchorElem.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [anchorElem, updateHoverBlock]);

  useEffect(() => {
    if (!anchorElem || !menuRef.current) return;
    positionMenu(menuRef.current, hoverBlockElem, anchorElem);
  }, [anchorElem, hoverBlockElem]);

  const handleDragStart = useCallback(
    (event: ReactDragEvent<HTMLDivElement>) => {
      if (!hoverBlockElem || !event.dataTransfer) return;

      let nodeKey: NodeKey | null = null;
      editor.read(() => {
        nodeKey = $getNearestNodeFromDOMNode(hoverBlockElem)?.getKey() ?? null;
      });
      if (!nodeKey) return;

      draggedKeyRef.current = nodeKey;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(DRAG_DATA_FORMAT, nodeKey);
      event.dataTransfer.setDragImage(hoverBlockElem, 0, 0);
    },
    [editor, hoverBlockElem],
  );

  const handleDragEnd = useCallback(() => {
    draggedKeyRef.current = null;
    hideTargetLine(targetLineRef.current);
  }, []);

  useEffect(() => {
    if (!anchorElem) return;

    const handleDragOver = (event: DragEvent) => {
      if (!draggedKeyRef.current) return;

      const targetBlockElem = getBlockElementAtY(editor, event.clientY, true);
      if (!targetBlockElem || !targetLineRef.current) return;

      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
      positionTargetLine(
        targetLineRef.current,
        targetBlockElem,
        anchorElem,
        event.clientY,
      );
    };

    const handleDrop = (event: DragEvent) => {
      const draggedKey =
        draggedKeyRef.current || event.dataTransfer?.getData(DRAG_DATA_FORMAT);
      if (!draggedKey) return;

      const targetBlockElem = getBlockElementAtY(editor, event.clientY, true);
      if (!targetBlockElem) return;

      event.preventDefault();
      editor.update(() => {
        const draggedNode = $getNodeByKey(draggedKey);
        const targetNode = $getNearestNodeFromDOMNode(targetBlockElem);
        if (!draggedNode || !targetNode || draggedNode === targetNode) return;

        if (event.clientY >= targetBlockElem.getBoundingClientRect().top) {
          targetNode.insertAfter(draggedNode);
        } else {
          targetNode.insertBefore(draggedNode);
        }
      });

      draggedKeyRef.current = null;
      setHoverBlockElem(null);
      hideTargetLine(targetLineRef.current);
    };

    anchorElem.addEventListener("dragover", handleDragOver, true);
    anchorElem.addEventListener("drop", handleDrop, true);

    return () => {
      anchorElem.removeEventListener("dragover", handleDragOver, true);
      anchorElem.removeEventListener("drop", handleDrop, true);
    };
  }, [anchorElem, editor]);

  if (!anchorElem) return null;

  return createPortal(
    <>
      <div
        aria-hidden="true"
        className="keeper-draggable-block-handle"
        draggable={true}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        ref={menuRef}
      >
        <span />
      </div>
      <div className="keeper-draggable-block-target-line" ref={targetLineRef} />
    </>,
    anchorElem,
  );
}
