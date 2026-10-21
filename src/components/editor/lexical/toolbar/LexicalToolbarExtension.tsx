import "@/components/shared/shared.css";
import {
	ReactExtension,
	type EditorChildrenComponentProps,
} from "@lexical/react/ReactExtension";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useExtensionDependency } from "@lexical/react/useExtensionComponent";
import { useSignalValue } from "@lexical/react/useExtensionSignalValue";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import { namedSignals } from "@lexical/extension";
import {
	configExtension,
	defineExtension,
	INDENT_CONTENT_COMMAND,
	OUTDENT_CONTENT_COMMAND,
	REDO_COMMAND,
	safeCast,
	UNDO_COMMAND,
} from "lexical";
import { FontAwesome } from "@/components/shared/Icons";
import type React from "react";

interface ToolbarExtensionConfig {
	getOnInsertImage: () => (() => void) | undefined;
	getOnShowVideoModal: () => (() => void) | undefined;
	getOnToggleRelatedNotes: () => (() => void) | undefined;
	getOnToggleActivePanel: () => (() => void) | undefined;
}

const styles = {
	toolbar: {
		borderBottomWidth: 1,
		paddingTop: 8,
		paddingBottom: 8,
		paddingLeft: 16,
		paddingRight: 16,
	},
	toolbarContent: { flexDirection: "row", alignItems: "center", gap: 12 },
	toolbarButton: {
		alignItems: "center",
		borderRadius: 18,
		height: 36,
		justifyContent: "center",
		width: 36,
	},

	toolbarIcon: { color: "#8e8e93" },
	toolbarIconDisabled: { color: "#4d4d4d" },
} satisfies Record<string, React.CSSProperties>;

const noop = () => {};
type ToolbarIconName = React.ComponentProps<typeof FontAwesome>["name"];

function ToolbarIconButton({
	disabled = false,
	label,
	name,
	onPress,
}: {
	disabled?: boolean;
	label?: string;
	name: ToolbarIconName;
	onPress: () => void;
}) {
	return (
		<button
			type="button"
			className="keeper-control"
			aria-label={label}
			disabled={disabled}
			onPointerDown={(event) => event.preventDefault()}
			onClick={onPress}
			style={{ ...styles.toolbarButton }}
		>
			<FontAwesome
				name={name}
				size={20}
				style={[styles.toolbarIcon, disabled && styles.toolbarIconDisabled]}
			/>
		</button>
	);
}

function Toolbar() {
	const { output } = useExtensionDependency(ToolbarExtension);
	const [editor] = useLexicalComposerContext();
	const onInsertImage = useSignalValue(output.getOnInsertImage)();
	const onShowVideoModal = useSignalValue(output.getOnShowVideoModal)();
	const onToggleRelatedNotes = useSignalValue(output.getOnToggleRelatedNotes)();
	const onToggleActivePanel = useSignalValue(output.getOnToggleActivePanel)();

	const handleUndo = () => editor.dispatchCommand(UNDO_COMMAND, undefined);
	const handleRedo = () => editor.dispatchCommand(REDO_COMMAND, undefined);
	const handleIndent = () =>
		editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined);
	const handleOutdent = () =>
		editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined);
	const handleInsertTable = () => {
		editor.dispatchCommand(INSERT_TABLE_COMMAND, {
			columns: "3",
			includeHeaders: true,
			rows: "3",
		});
	};

	return (
		<div className="keeper-layout" style={styles.toolbar}>
			<div className="keeper-layout" style={{ overflowX: "auto", ...{} }}>
				<div className="keeper-layout" style={styles.toolbarContent}>
					<ToolbarIconButton name="undo" label="Undo" onPress={handleUndo} />
					<ToolbarIconButton name="repeat" label="Redo" onPress={handleRedo} />
					<ToolbarIconButton
						name="indent"
						label="Indent"
						onPress={handleIndent}
					/>
					<ToolbarIconButton
						name="dedent"
						label="Outdent"
						onPress={handleOutdent}
					/>
					<ToolbarIconButton
						name="table"
						onPress={handleInsertTable}
						label="Insert table"
					/>
					<ToolbarIconButton
						name="image"
						onPress={onInsertImage ?? noop}
						disabled={!onInsertImage}
						label="Insert image"
					/>
					<ToolbarIconButton
						name="video-camera"
						onPress={onShowVideoModal ?? noop}
						disabled={!onShowVideoModal}
						label="Attach video"
					/>
					<ToolbarIconButton
						name="link"
						onPress={onToggleRelatedNotes ?? noop}
						disabled={!onToggleRelatedNotes}
						label="Show related notes"
					/>
					<ToolbarIconButton
						name="exchange"
						onPress={onToggleActivePanel ?? noop}
						disabled={!onToggleActivePanel}
						label="Switch panel"
					/>
				</div>
			</div>
		</div>
	);
}

function ToolbarEditorChildren({
	contentEditable,
	children,
}: EditorChildrenComponentProps) {
	return (
		<>
			{contentEditable}
			<div className="keeper-editor-shell">
				<div className="keeper-toolbar-sticky">
					<Toolbar />
				</div>
				{children}
			</div>
		</>
	);
}

export const ToolbarExtension = defineExtension({
	config: safeCast<ToolbarExtensionConfig>({
		getOnInsertImage: () => undefined,
		getOnShowVideoModal: () => undefined,
		getOnToggleRelatedNotes: () => undefined,
		getOnToggleActivePanel: () => undefined,
	}),
	dependencies: [
		configExtension(ReactExtension, {
			EditorChildrenComponent: ToolbarEditorChildren,
		}),
	],
	build(_editor, config) {
		return namedSignals(config);
	},
	name: "keeper/Toolbar",
});
