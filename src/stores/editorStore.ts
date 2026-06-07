import { create } from "zustand";

interface EditorStoreSlice {
  currentMarkdown: string | null;
  markdownVersion: number;
  preparedMarkdown: string | null;
  preparedVersion: number | null;
}

interface EditorStoreState extends EditorStoreSlice {
  loadMarkdown: (markdown: string) => void;
  setCurrentMarkdown: (markdown: string) => void;
  toMarkdown: () => string;
  prepareContent: () => void;
  getPreparedContent: () => { version: number; markdown: string } | null;
  getContentForVersion: (version?: number) => string;
  getContent: () => string;
  resetState: () => void;
}

const initialEditorStoreSlice = (): EditorStoreSlice => ({
  currentMarkdown: null,
  markdownVersion: 0,
  preparedMarkdown: null,
  preparedVersion: null,
});

export const useEditorState = create<EditorStoreState>()((set, get) => ({
  ...initialEditorStoreSlice(),

  loadMarkdown: (markdown: string) => {
    set((state) => {
      if (state.currentMarkdown === markdown) {
        return state;
      }
      return {
        currentMarkdown: markdown,
        preparedMarkdown: null,
        preparedVersion: null,
      };
    });
  },

  setCurrentMarkdown: (markdown: string) => {
    set((state) => {
      if (state.currentMarkdown === markdown) {
        return state;
      }
      return {
        currentMarkdown: markdown,
        markdownVersion: state.markdownVersion + 1,
        preparedMarkdown: null,
        preparedVersion: null,
      };
    });
  },

  resetState: () => {
    set(initialEditorStoreSlice());
  },

  toMarkdown: () => get().getContentForVersion(),

  prepareContent: () => {
    const state = get();
    set({
      preparedMarkdown: state.currentMarkdown ?? "",
      preparedVersion: state.markdownVersion,
    });
  },

  getPreparedContent: () => {
    const { preparedMarkdown, preparedVersion } = get();
    if (preparedMarkdown == null || preparedVersion == null) {
      return null;
    }
    return {
      version: preparedVersion,
      markdown: preparedMarkdown,
    };
  },

  getContentForVersion: (version?: number) => {
    const state = get();
    if (
      state.preparedMarkdown != null &&
      state.preparedVersion != null &&
      (version == null || state.preparedVersion === version)
    ) {
      return state.preparedMarkdown;
    }
    return state.currentMarkdown ?? "";
  },

  getContent: () => get().getContentForVersion(),
}));
