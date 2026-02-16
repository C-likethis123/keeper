import { useCallback } from 'react';
import { useEditorState } from '@/components/editor/core/EditorState';
import { createCollapsedSelection } from '@/components/editor/core/Selection';

export interface UseFocusBlockOptions {
  delay?: number;
  preserveSelection?: boolean;
  useAnimationFrame?: boolean;
}

export interface UseFocusBlockReturn {
  focusBlock: (index: number, options?: UseFocusBlockOptions) => void;
  blurBlock: () => void;
}

export function useFocusBlock(): UseFocusBlockReturn {
  const editorState = useEditorState();

  const focusBlock = useCallback(
    (index: number, _options?: UseFocusBlockOptions) => {
      const block = editorState.document.blocks[index];
      const offset = block?.content.length ?? 0;
      editorState.setSelection(
        createCollapsedSelection({ blockIndex: index, offset }),
      );
    },
    [editorState],
  );

  const blurBlock = useCallback(() => {
    editorState.setSelection(null);
  }, [editorState]);

  return {
    focusBlock,
    blurBlock,
  };
}

