import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuRenderFn,
  type MenuTextMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { ReactExtension } from "@lexical/react/ReactExtension";
import { useExtensionDependency } from "@lexical/react/useExtensionComponent";
import { $createLinkNode } from "@lexical/link";
import {
  $createTextNode,
  COMMAND_PRIORITY_LOW,
  configExtension,
  defineExtension,
  safeCast,
  type TextNode,
} from "lexical";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  WikiLinkOverlay,
  type WikiLinkResult,
} from "@/components/editor/lexical/wikilinks/WikiLinkOverlay";
import { findExactWikiLinkMatch } from "@/components/editor/lexical/wikilinks/wikiLinkUtils";
import { NotesIndexService } from "@/services/notes/notesIndex";
import { createWikiLinkUrl, parseWikiLinkUrl } from "./wikiLinkUrl";

interface WikiLinkExtensionConfig {
  getOnOpenWikiLink: () =>
    | ((title: string) => void | Promise<void>)
    | undefined;
}

const RESULT_LIMIT = 8;
const MENU_WIDTH = 420;

class WikiLinkOption extends MenuOption {
  result: WikiLinkResult;

  constructor(result: WikiLinkResult) {
    super(result.id);
    this.result = result;
  }
}

function findWikiLinkTitle(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const anchor = target.closest("a");
  const href = anchor?.getAttribute("href");
  return href ? parseWikiLinkUrl(href) : null;
}

function wikiLinkTriggerFn(text: string): MenuTextMatch | null {
  const triggerStart = text.lastIndexOf("[[");
  if (triggerStart === -1) {
    return null;
  }

  const query = text.slice(triggerStart + 2);
  if (query.includes("]]") || query.includes("\n")) {
    return null;
  }

  return {
    leadOffset: triggerStart,
    matchingString: query,
    replaceableString: `[[${query}`,
  };
}

function insertWikiLink(
  textNodeContainingQuery: TextNode | null,
  title: string,
) {
  if (!textNodeContainingQuery) {
    return;
  }

  const wikiLink = $createLinkNode(createWikiLinkUrl(title));
  wikiLink.append($createTextNode(title));
  textNodeContainingQuery.replace(wikiLink);
  wikiLink.selectNext();
}

function WikiLinkTypeahead() {
  const { config } = useExtensionDependency(WikiLinkExtension);
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<WikiLinkResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const options = useMemo(
    () => results.map((result) => new WikiLinkOption(result)),
    [results],
  );

  useEffect(() => {
    if (query === null) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const trimmedQuery = query.trim();
    setIsLoading(true);
    NotesIndexService.listNotes(trimmedQuery, RESULT_LIMIT, 0)
      .then((result) => {
        if (cancelled) {
          return;
        }

        const noteResults: WikiLinkResult[] = result.items.map((item) => ({
          id: item.noteId,
          noteId: item.noteId,
          title: item.title,
          type: "existing",
        }));

        const shouldShowCreate =
          trimmedQuery.length > 0 &&
          !findExactWikiLinkMatch(result.items, trimmedQuery);
        setResults(
          shouldShowCreate
            ? [
                ...noteResults,
                {
                  id: `create-${trimmedQuery}`,
                  title: trimmedQuery,
                  type: "create",
                },
              ]
            : noteResults,
        );
      })
      .catch((error) => {
        console.warn("[WikiLinkExtension] note lookup failed:", error);
        if (!cancelled) {
          setResults(
            trimmedQuery.length > 0
              ? [
                  {
                    id: `create-${trimmedQuery}`,
                    title: trimmedQuery,
                    type: "create",
                  },
                ]
              : [],
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [query]);

  const selectResult = useCallback(
    (result: WikiLinkResult, textNodeContainingQuery: TextNode | null) => {
      insertWikiLink(textNodeContainingQuery, result.title);
    },
    [],
  );

  const menuRenderFn = useCallback<MenuRenderFn<WikiLinkOption>>(
    (anchorElementRef, { options, selectedIndex, selectOptionAndCleanUp }) =>
      anchorElementRef.current
        ? createPortal(
            <div
              style={{
                maxWidth: "calc(100vw - 36px)",
                width: MENU_WIDTH,
                zIndex: 100,
              }}
            >
              <WikiLinkOverlay
                results={options.map((option) => option.result)}
                selectedIndex={selectedIndex ?? 0}
                isLoading={isLoading}
                onSelect={(result) => {
                  const option = options.find(
                    (option) => option.result.id === result.id,
                  );
                  if (option) {
                    selectOptionAndCleanUp(option);
                  }
                }}
              />
            </div>,
            anchorElementRef.current,
          )
        : null,
    [isLoading],
  );

  return (
    <LexicalTypeaheadMenuPlugin<WikiLinkOption>
      commandPriority={COMMAND_PRIORITY_LOW}
      menuRenderFn={menuRenderFn}
      onQueryChange={setQuery}
      onSelectOption={(option, textNodeContainingQuery, closeMenu) => {
        selectResult(option.result, textNodeContainingQuery);
        closeMenu();
      }}
      options={options}
      triggerFn={wikiLinkTriggerFn}
    />
  );
}

export const WikiLinkExtension = defineExtension({
  config: safeCast<WikiLinkExtensionConfig>({
    getOnOpenWikiLink: () => undefined,
  }),
  dependencies: [
    configExtension(ReactExtension, {
      decorators: [<WikiLinkTypeahead key="keeper-wikilink-typeahead" />],
    }),
  ],
  name: "keeper/WikiLink",
  register(editor, config) {
    const handleClick = (event: MouseEvent) => {
      const title = findWikiLinkTitle(event.target);
      if (!title) {
        return;
      }

      const onOpenWikiLink = config.getOnOpenWikiLink();
      if (!onOpenWikiLink) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      void onOpenWikiLink(title);
    };

    return editor.registerRootListener((root, previousRoot) => {
      previousRoot?.removeEventListener("click", handleClick, true);
      root?.addEventListener("click", handleClick, true);
    });
  },
});
