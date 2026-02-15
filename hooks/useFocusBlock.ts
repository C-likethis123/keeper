import { useCallback } from 'react';
import { useEditorState } from '@/components/editor/core/EditorState';

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
        (index: number, options: UseFocusBlockOptions = {
            delay: 50,
            preserveSelection: false,
            useAnimationFrame: true,
        }) => {
            editorState.setFocusedBlock(index, options?.preserveSelection ?? false);
        },
        [editorState],
    );

    const blurBlock = useCallback(() => {
        editorState.setFocusedBlock(null);
    }, [editorState]);

    return {
        focusBlock,
        blurBlock,
    };
}

