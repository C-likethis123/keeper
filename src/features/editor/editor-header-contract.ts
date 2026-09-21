/** Shared editor-header behavior. Platform renderers own visual primitives. */
export type EditorSaveStatus = "idle" | "saving" | "saved";

export type EditorHeaderProps = {
	title: string;
	status: EditorSaveStatus;
	isPinned: boolean;
	onChangeTitle: (value: string) => void;
	onBlurTitle: () => void;
	onSubmitEditing: () => void;
	onBack: () => void;
	onShowHistory: () => void;
	onTogglePin: () => void;
	onDelete: () => void;
};
