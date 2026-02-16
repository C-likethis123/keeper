import { createEditorState, UseEditorState } from '@/components/editor/core/EditorState';
import React, { createContext, useContext, useMemo } from 'react';

const EditorStateContext = createContext<UseEditorState | null>(null);

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const useEditorStateStore = useMemo(() => createEditorState(), []);
  return (
    <EditorStateContext.Provider value={useEditorStateStore}>
      {children}
    </EditorStateContext.Provider>
  );
}

export function useEditorState() {
  const useEditorStateStore = useContext(EditorStateContext);
  if (!useEditorStateStore) {
    throw new Error('useEditorState must be used within EditorProvider');
  }
  return useEditorStateStore();
}
