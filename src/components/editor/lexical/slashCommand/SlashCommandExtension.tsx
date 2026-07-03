import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuRenderFn,
  type MenuTextMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { ReactExtension } from "@lexical/react/ReactExtension";
import { useExtensionDependency } from "@lexical/react/useExtensionComponent";
import { useSignalValue } from "@lexical/react/useExtensionSignalValue";
import { namedSignals } from "@lexical/extension";
import {
	$createParagraphNode,
	$createTextNode,
	$insertNodes,
	COMMAND_PRIORITY_LOW,
	configExtension,
	defineExtension,
	safeCast,
	type TextNode,
} from "lexical";
import React, { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  SlashCommandOverlay,
  type SlashCommandItem,
} from "./SlashCommandOverlay";
import { findSlashCommandTriggerStart } from "./SlashCommandTrigger";
import {
  $createDetailsContentNode,
  $createDetailsNode,
  $createDetailsSummaryNode,
} from "../DetailsNode";

const COMMANDS: SlashCommandItem[] = [
  {
    id: "insert-collapsible",
    title: "Collapsible",
    description: "Insert a collapsible details section.",
    keywords: ["collapse", "collapsible", "details", "toggle", "summary"],
  },
  {
    id: "insert-template",
    title: "Insert template",
    description: "Open the template picker and replace the note body.",
    keywords: ["template", "insert", "snippet"],
  },
];
const MENU_WIDTH = 420;

interface SlashCommandExtensionConfig {
	getOnInsertTemplateCommand: () =>
		| (() => void | Promise<void>)
		| undefined;
}

class SlashCommandOption extends MenuOption {
  item: SlashCommandItem;

  constructor(item: SlashCommandItem) {
    super(item.id);
    this.item = item;
  }
}

function insertCollapsibleBlock() {
  const detailsNode = $createDetailsNode();
  const summaryNode = $createDetailsSummaryNode();
  const contentNode = $createDetailsContentNode();
  const paragraphNode = $createParagraphNode();

  summaryNode.append($createTextNode("Title"));
  paragraphNode.append($createTextNode("Content"));
  contentNode.append(paragraphNode);
  detailsNode.append(summaryNode, contentNode);

  $insertNodes([detailsNode]);
  paragraphNode.selectEnd();
}

function slashTriggerFn(text: string): MenuTextMatch | null {
  const slashStart = findSlashCommandTriggerStart(text, text.length);
  if (slashStart === null) {
    return null;
  }

  const matchingString = text.slice(slashStart + 1);
  return {
    leadOffset: slashStart,
    matchingString,
    replaceableString: `/${matchingString}`,
  };
}

function SlashCommandTypeahead() {
	const { output } = useExtensionDependency(SlashCommandExtension);
	const getOnInsertTemplateCommand = useSignalValue(
		output.getOnInsertTemplateCommand,
	);
	const [query, setQuery] = useState<string | null>(null);

  const options = useMemo(() => {
    const normalizedQuery = query?.trim().toLowerCase() ?? "";
    if (normalizedQuery.length === 0) {
      return COMMANDS.map((item) => new SlashCommandOption(item));
    }

    return COMMANDS.filter((item) => {
      const haystacks = [item.title, item.description, ...item.keywords];
      return haystacks.some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    }).map((item) => new SlashCommandOption(item));
  }, [query]);

  const selectItem = useCallback(
    (item: SlashCommandItem, textNodeContainingQuery: TextNode | null) => {
      textNodeContainingQuery?.remove();
      if (item.id === "insert-collapsible") {
        insertCollapsibleBlock();
        return;
      }
			if (item.id === "insert-template") {
				const onInsertTemplateCommand = getOnInsertTemplateCommand();
				void onInsertTemplateCommand?.();
			}
		},
		[getOnInsertTemplateCommand],
	);

  const menuRenderFn = useCallback<MenuRenderFn<SlashCommandOption>>(
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
              <SlashCommandOverlay
                results={options.map((option) => option.item)}
                selectedIndex={selectedIndex ?? 0}
                onSelect={(item) => {
                  const option = options.find(
                    (option) => option.item.id === item.id,
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
    [],
  );

  return (
    <LexicalTypeaheadMenuPlugin<SlashCommandOption>
      commandPriority={COMMAND_PRIORITY_LOW}
      menuRenderFn={menuRenderFn}
      onQueryChange={setQuery}
      onSelectOption={(option, textNodeContainingQuery, closeMenu) => {
        selectItem(option.item, textNodeContainingQuery);
        closeMenu();
      }}
      options={options}
      triggerFn={slashTriggerFn}
    />
	);
}

export const SlashCommandExtension = defineExtension({
	config: safeCast<SlashCommandExtensionConfig>({
		getOnInsertTemplateCommand: () => undefined,
	}),
	dependencies: [
		configExtension(ReactExtension, {
			decorators: [
				<SlashCommandTypeahead key="keeper-slash-command-typeahead" />,
			],
		}),
	],
	build(_editor, config) {
		return namedSignals(config);
	},
	name: "keeper/SlashCommand",
});
