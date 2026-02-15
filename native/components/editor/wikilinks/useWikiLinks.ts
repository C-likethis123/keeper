import { useState, useCallback, useRef } from 'react';
import { WikiLinkSession } from './WikiLinkSession';
import { NotesIndexService } from '@/services/notes/notesIndex';
import { useEditorState } from '../core/EditorState';

interface UseWikiLinksReturn {
  // State
  session: WikiLinkSession | null;
  query: string;
  results: string[];
  selectedIndex: number;
  isActive: boolean;
  isLoading: boolean;
  shouldShowOverlay: boolean;

  // Handlers
  handleTriggerStart: (blockIndex: number, startOffset: number) => void;
  handleQueryUpdate: (blockIndex: number, query: string, caretOffset: number) => Promise<void>;
  handleTriggerEnd: () => void;
  handleSelect: (link: string, blockIndex: number, onUpdateContent: (index: number, content: string) => void) => void;

  // Navigation
  selectNext: () => void;
  selectPrevious: () => void;
  getSelectedResult: () => string | null;

  // Utilities
  isActiveFor: (blockIndex: number) => boolean;
}

/// Custom hook for managing wiki link autocomplete state
/// Replaces the WikiLinkController class with React state management
export function useWikiLinks(): UseWikiLinksReturn {
  const [session, setSession] = useState<WikiLinkSession | null>(null);
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const editorState = useEditorState();
  // Use ref to track if search is in progress to avoid race conditions
  const searchInProgressRef = useRef(false);

  const isActive = session !== null;
  const shouldShowOverlay = session !== null && (isLoading || results.length > 0);

  /// End the wiki link session
  const handleTriggerEnd = useCallback(() => {
    setSession(null);
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
    setIsLoading(false);
  }, []);

  /// Start a new wiki link session
  const handleTriggerStart = useCallback((blockIndex: number, startOffset: number) => {
    // Only start if not already active for this block
    if (session?.blockIndex === blockIndex) {
      return;
    }

    setSession({
      blockIndex,
      startOffset,
    });
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
    setIsLoading(false);
  }, [session]);

  /// Update the query and search for results
  const handleQueryUpdate = useCallback(async (
    blockIndex: number,
    queryText: string,
    caretOffset: number
  ) => {
    if (session === null) return;

    const start = session.startOffset;

    // Get current block from editor state (zustand stores read current state)
    const block = editorState.document.blocks[blockIndex];
    if (!block || caretOffset < start + 2 || caretOffset > block.content.length) {
      handleTriggerEnd();
      return;
    }
    const raw = block.content.substring(start + 2, caretOffset);

    // User typed closing bracket or newline → exit
    if (raw.includes(']') || raw.includes('\n')) {
      handleTriggerEnd();
      return;
    }

    // Update block index if it changed (e.g., block type conversion)
    if (session.blockIndex !== blockIndex) {
      setSession({
        blockIndex,
        startOffset: session.startOffset,
      });
    }

    setQuery(raw);

    // Fetch results (debounce by checking if search is in progress)
    if (searchInProgressRef.current) {
      return;
    }

    // Only show loading if there's a query to search
    if (raw.length > 0) {
      setIsLoading(true);
    }

    searchInProgressRef.current = true;
    try {
      const result = await NotesIndexService.instance.listAllNotes(
        20,
        undefined,
        raw.length > 0 ? raw : undefined
      );
      
      const titles: string[] = [];
      const seenTitles = new Set<string>();
      
      for (const item of result.items) {
        if (titles.length >= 20) break;
        
        const title = item.title || item.noteId.split("/").pop()?.replace(/\.md$/, "") || "";
        
        if (title && !seenTitles.has(title)) {
          seenTitles.add(title);
          titles.push(title);
        }
      }
      
      setResults(titles);
      setSelectedIndex(0);
    } catch (error) {
      console.warn('Failed to search notes:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
      searchInProgressRef.current = false;
    }
  }, [session, editorState, handleTriggerEnd]);

  /// Cancel the wiki link session (same as end)
  const cancel = useCallback(() => {
    handleTriggerEnd();
  }, [handleTriggerEnd]);

  /// Select a wiki link and insert it into the block
  const handleSelect = useCallback((
    link: string,
    blockIndex: number,
    onUpdateContent: (index: number, content: string) => void
  ) => {
    if (session === null || session.blockIndex !== blockIndex) {
      return;
    }

    // Get current block from editor state (zustand stores read current state)
    const block = editorState.document.blocks[blockIndex];
    if (!block) return;

    const text = block.content;
    const start = session.startOffset;
    const end = start + 2 + query.length; // [[ + query

    const newText = text.substring(0, start) + `[[${link}]]` + text.substring(end);

    onUpdateContent(blockIndex, newText);
    handleTriggerEnd();
  }, [session, query, editorState, handleTriggerEnd]);

  /// Navigate to next result
  const selectNext = useCallback(() => {
    if (results.length === 0) return;
    setSelectedIndex((prev) => (prev + 1) % results.length);
  }, [results.length]);

  /// Navigate to previous result
  const selectPrevious = useCallback(() => {
    if (results.length === 0) return;
    setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
  }, [results.length]);

  /// Get the currently selected result
  const getSelectedResult = useCallback((): string | null => {
    if (results.length === 0) return null;
    return results[selectedIndex];
  }, [results, selectedIndex]);

  /// Check if wiki link is active for a specific block
  const isActiveFor = useCallback((blockIndex: number): boolean => {
    return session !== null && session.blockIndex === blockIndex;
  }, [session]);

  return {
    // State
    session,
    query,
    results,
    selectedIndex,
    isActive,
    isLoading,
    shouldShowOverlay,

    // Handlers
    handleTriggerStart,
    handleQueryUpdate,
    handleTriggerEnd,
    handleSelect,

    // Navigation
    selectNext,
    selectPrevious,
    getSelectedResult,

    // Utilities
    isActiveFor,
  };
}

