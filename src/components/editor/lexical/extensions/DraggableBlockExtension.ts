import {
  $getNearestNodeFromDOMNode,
  $getNodeByKey,
  $getRoot,
  type LexicalEditor,
  type NodeKey,
  defineExtension,
} from "lexical";

interface DraggableBlockExtensionOptions {
  getAnchorElem: () => HTMLElement | null;
}

const HANDLE_SIZE = 24;
const HANDLE_LEFT = 4;
const TARGET_LINE_LEFT = 24;
const TARGET_LINE_HALF_HEIGHT = 1;

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
  const targetHeight = Number.isNaN(lineHeight)
    ? targetRect.height
    : lineHeight;
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

function createHandleElement() {
  const handleElem = document.createElement("div");
  handleElem.ariaHidden = "true";
  handleElem.className = "keeper-draggable-block-handle";
  handleElem.appendChild(document.createElement("span"));
  return handleElem;
}

function createTargetLineElement() {
  const lineElem = document.createElement("div");
  lineElem.className = "keeper-draggable-block-target-line";
  hideTargetLine(lineElem);
  return lineElem;
}

export function createDraggableBlockExtension({
  getAnchorElem,
}: DraggableBlockExtensionOptions) {
  return defineExtension({
    name: "keeper/DraggableBlock",
    register(editor) {
      let cleanup: (() => void) | undefined;

      const attach = (anchorElem: HTMLElement) => {
        const menuElem = createHandleElement();
        const targetLineElem = createTargetLineElement();
        let hoverBlockElem: HTMLElement | null = null;
        let latestPointerY: number | null = null;
        let draggedKey: NodeKey | null = null;
        let dropBlockElem: HTMLElement | null = null;
        let dropClientY: number | null = null;
        let isPointerDragListening = false;

        const setHoverBlockElem = (element: HTMLElement | null) => {
          hoverBlockElem = element;
          positionMenu(menuElem, hoverBlockElem, anchorElem);
        };

        const handleMouseMove = (event: MouseEvent) => {
          latestPointerY = event.clientY;
          if (menuElem.contains(event.target as Node)) return;
          setHoverBlockElem(getBlockElementAtY(editor, event.clientY));
        };

        const handleMouseLeave = () => setHoverBlockElem(null);

        const handlePointerDown = (event: PointerEvent) => {
          if (event.button !== 0) return;
          latestPointerY = event.clientY;
          const menuRect = menuElem.getBoundingClientRect();
          const fallbackY =
            latestPointerY ?? menuRect.top + menuRect.height / 2;
          const draggedBlockElem =
            hoverBlockElem ?? getBlockElementAtY(editor, fallbackY);
          if (!draggedBlockElem) return;

          let nodeKey: NodeKey | null = null;
          editor.read(() => {
            nodeKey =
              $getNearestNodeFromDOMNode(draggedBlockElem)?.getKey() ?? null;
          });
          if (!nodeKey) return;

          event.preventDefault();
          setHoverBlockElem(draggedBlockElem);
          draggedKey = nodeKey;
          dropBlockElem = draggedBlockElem;
          dropClientY = event.clientY;
          menuElem.classList.add("keeper-draggable-block-handle-active");
          startPointerDragListening();
          positionTargetLine(
            targetLineElem,
            draggedBlockElem,
            anchorElem,
            event.clientY,
          );
        };

        const handlePointerMove = (event: PointerEvent) => {
          if (!draggedKey) return;

          const targetBlockElem = getBlockElementAtY(
            editor,
            event.clientY,
            true,
          );
          if (!targetBlockElem) return;

          event.preventDefault();
          dropBlockElem = targetBlockElem;
          dropClientY = event.clientY;
          positionTargetLine(
            targetLineElem,
            targetBlockElem,
            anchorElem,
            event.clientY,
          );
        };

        const handlePointerUp = (event: PointerEvent) => {
          if (!draggedKey) return;
          event.preventDefault();

          const targetBlockElem =
            dropBlockElem ?? getBlockElementAtY(editor, event.clientY, true);
          if (!targetBlockElem) {
            draggedKey = null;
            dropBlockElem = null;
            dropClientY = null;
            hideTargetLine(targetLineElem);
            menuElem.classList.remove("keeper-draggable-block-handle-active");
            stopPointerDragListening();
            return;
          }
          const clientY = dropClientY ?? event.clientY;
          const key = draggedKey;
          editor.update(() => {
            const draggedNode = $getNodeByKey(key);
            const targetNode = targetBlockElem
              ? $getNearestNodeFromDOMNode(targetBlockElem)
              : null;
            if (!draggedNode || !targetNode || draggedNode === targetNode)
              return;

            if (clientY >= targetBlockElem.getBoundingClientRect().top) {
              targetNode.insertAfter(draggedNode);
            } else {
              targetNode.insertBefore(draggedNode);
            }
          });

          draggedKey = null;
          dropBlockElem = null;
          dropClientY = null;
          setHoverBlockElem(null);
          hideTargetLine(targetLineElem);
          menuElem.classList.remove("keeper-draggable-block-handle-active");
          stopPointerDragListening();
        };

        const startPointerDragListening = () => {
          if (isPointerDragListening) return;
          isPointerDragListening = true;
          document.addEventListener("pointermove", handlePointerMove, true);
          document.addEventListener("pointerup", handlePointerUp, true);
          document.addEventListener("pointercancel", handlePointerUp, true);
        };

        const stopPointerDragListening = () => {
          if (!isPointerDragListening) return;
          isPointerDragListening = false;
          document.removeEventListener("pointermove", handlePointerMove, true);
          document.removeEventListener("pointerup", handlePointerUp, true);
          document.removeEventListener("pointercancel", handlePointerUp, true);
        };

        anchorElem.append(menuElem, targetLineElem);
        anchorElem.addEventListener("mousemove", handleMouseMove);
        anchorElem.addEventListener("mouseleave", handleMouseLeave);
        menuElem.addEventListener("pointerdown", handlePointerDown);

        return () => {
          anchorElem.removeEventListener("mousemove", handleMouseMove);
          anchorElem.removeEventListener("mouseleave", handleMouseLeave);
          menuElem.removeEventListener("pointerdown", handlePointerDown);
          stopPointerDragListening();
          menuElem.remove();
          targetLineElem.remove();
        };
      };

      const attachToRoot = (rootElement: HTMLElement | null) => {
        cleanup?.();
        cleanup = undefined;

        const anchorElem =
          getAnchorElem() ??
          rootElement?.closest<HTMLElement>(".keeper-editor-content") ??
          null;
        if (anchorElem) {
          cleanup = attach(anchorElem);
        }
      };

      attachToRoot(editor.getRootElement());
      const unregisterRootListener = editor.registerRootListener(attachToRoot);

      return () => {
        unregisterRootListener();
        cleanup?.();
      };
    },
  });
}
