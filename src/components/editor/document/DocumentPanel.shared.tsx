import type { ExtendedTheme } from "@/constants/themes/types";
import {
	type AttachmentType,
	resolveAttachmentUri,
} from "@/services/notes/attachmentStorage";
import { FontAwesome } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	Linking,
	Pressable,
	StyleSheet,
	Text,
	View,
	type ViewStyle,
} from "react-native";
import {
	loadDocumentPosition,
	saveDocumentPosition,
} from "./documentPositionStore";
import { buildEpubViewerHtml, buildPdfViewerHtml } from "./viewerTemplates";

const POSITION_SAVE_DEBOUNCE_MS = 1000;

export interface DocumentPanelProps {
	noteId: string;
	attachmentPath: string;
	attachmentType: AttachmentType;
	onTextSelected?: (text: string) => void;
	onDocumentPositionChange?: (
		attachmentPath: string,
		position: string,
	) => Promise<void> | void;
	onDismiss: () => void;
	style?: ViewStyle;
	theme?: "light" | "dark";
}

export type ReadAttachmentBase64 = (fileUri: string) => Promise<string>;

export type DocumentViewerMessage = {
	type: string;
	cfi?: string;
	page?: string;
	text?: string;
	message?: string;
};

type UseDocumentPanelStateOptions = Pick<
	DocumentPanelProps,
	| "noteId"
	| "attachmentPath"
	| "attachmentType"
	| "onTextSelected"
	| "onDocumentPositionChange"
	| "theme"
> & {
	readAttachmentBase64: ReadAttachmentBase64;
};

export function useDocumentPanelState({
	noteId,
	attachmentPath,
	attachmentType,
	onTextSelected,
	onDocumentPositionChange,
	theme = "light",
	readAttachmentBase64,
}: UseDocumentPanelStateOptions) {
	const [fileUri, setFileUri] = useState<string | null>(null);
	const [savedPosition, setSavedPosition] = useState<string | null>(null);
	const [epubBase64, setEpubBase64] = useState<string | null>(null);
	const [epubHtml, setEpubHtml] = useState<string>("");
	const [pdfHtml, setPdfHtml] = useState<string>("");
	const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
	const [failedAttachmentType, setFailedAttachmentType] =
		useState<AttachmentType | null>(null);
	const positionSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const pendingPositionRef = useRef<string | null>(null);

	const filename = attachmentPath.split("/").pop() ?? attachmentPath;

	useEffect(() => {
		const resolved = resolveAttachmentUri(attachmentPath);
		setFileUri(resolved);
		setSavedPosition(null);
		loadDocumentPosition(noteId, attachmentPath).then((position) => {
			if (position) setSavedPosition(position);
		});
	}, [noteId, attachmentPath]);

	const flushPendingPosition = useCallback(() => {
		if (positionSaveTimeoutRef.current) {
			clearTimeout(positionSaveTimeoutRef.current);
			positionSaveTimeoutRef.current = null;
		}

		const position = pendingPositionRef.current;
		if (!position) return;
		pendingPositionRef.current = null;
		if (onDocumentPositionChange) {
			void onDocumentPositionChange(attachmentPath, position);
			return;
		}
		void saveDocumentPosition(noteId, attachmentPath, position);
	}, [noteId, attachmentPath, onDocumentPositionChange]);

	const schedulePositionSave = useCallback(
		(position: string) => {
			pendingPositionRef.current = position;
			setSavedPosition(position);
			if (positionSaveTimeoutRef.current) {
				clearTimeout(positionSaveTimeoutRef.current);
			}
			positionSaveTimeoutRef.current = setTimeout(() => {
				flushPendingPosition();
			}, POSITION_SAVE_DEBOUNCE_MS);
		},
		[flushPendingPosition],
	);

	useEffect(() => {
		return () => {
			flushPendingPosition();
		};
	}, [flushPendingPosition]);

	useEffect(() => {
		if (attachmentType === "epub") {
			setEpubHtml(
				epubBase64 ? buildEpubViewerHtml(theme, epubBase64, savedPosition) : "",
			);
			setPdfHtml("");
		} else if (attachmentType === "pdf") {
			setPdfHtml(buildPdfViewerHtml(theme));
			setEpubHtml("");
		}
	}, [attachmentType, theme, epubBase64, savedPosition]);

	useEffect(() => {
		let isCancelled = false;
		if (!fileUri || attachmentType !== "epub") {
			setEpubBase64(null);
			return;
		}

		setFailedAttachmentType(null);
		readAttachmentBase64(fileUri)
			.then((base64) => {
				if (!isCancelled) setEpubBase64(base64);
			})
			.catch(() => {
				if (!isCancelled) {
					setEpubBase64(null);
					setFailedAttachmentType("epub");
				}
			});

		return () => {
			isCancelled = true;
		};
	}, [attachmentType, fileUri, readAttachmentBase64]);

	useEffect(() => {
		let isCancelled = false;
		if (!fileUri || attachmentType !== "pdf") {
			setPdfDataUri(null);
			return;
		}

		setFailedAttachmentType(null);
		readAttachmentBase64(fileUri)
			.then((base64) => {
				if (!isCancelled) {
					setPdfDataUri(`data:application/pdf;base64,${base64}`);
				}
			})
			.catch(() => {
				if (!isCancelled) {
					setPdfDataUri(null);
					setFailedAttachmentType("pdf");
				}
			});

		return () => {
			isCancelled = true;
		};
	}, [attachmentType, fileUri, readAttachmentBase64]);

	const handleViewerMessage = useCallback(
		(data: DocumentViewerMessage | string) => {
			const message =
				typeof data === "string"
					? (JSON.parse(data) as DocumentViewerMessage)
					: data;

			if (message.type === "cfi" && message.cfi) {
				schedulePositionSave(message.cfi);
			} else if (message.type === "page" && message.page) {
				schedulePositionSave(message.page);
			} else if (message.type === "textSelected" && message.text) {
				onTextSelected?.(message.text);
			}

			return message;
		},
		[onTextSelected, schedulePositionSave],
	);

	const handleOpenExternally = useCallback(async () => {
		if (fileUri) {
			Linking.openURL(fileUri);
		}
	}, [fileUri]);

	const pdfOpenMessage =
		pdfDataUri && attachmentType === "pdf"
			? JSON.stringify({
					type: "open",
					fileUri: pdfDataUri,
					page: savedPosition ?? undefined,
				})
			: null;

	const isLoading =
		!fileUri ||
		(attachmentType === "epub" &&
			!epubHtml &&
			failedAttachmentType !== "epub") ||
		(attachmentType === "pdf" &&
			(!pdfHtml || !pdfDataUri) &&
			failedAttachmentType !== "pdf");

	return {
		epubBase64,
		epubHtml,
		fileUri,
		filename,
		handleOpenExternally,
		handleViewerMessage,
		isLoading,
		pdfDataUri,
		pdfHtml,
		pdfOpenMessage,
		savedPosition,
	};
}

export function DocumentPanelHeader({
	attachmentType,
	filename,
	onDismiss,
	styles,
}: Pick<DocumentPanelProps, "attachmentType" | "onDismiss"> & {
	filename: string;
	styles: ReturnType<typeof createDocumentPanelStyles>;
}) {
	return (
		<View style={styles.header}>
			<FontAwesome
				name={attachmentType === "epub" ? "book" : "file-pdf-o"}
				size={14}
				style={styles.headerIcon}
			/>
			<Text style={styles.filename} numberOfLines={1}>
				{filename}
			</Text>
			<Pressable
				onPress={onDismiss}
				style={styles.dismissButton}
				accessibilityLabel="Close document panel"
			>
				<FontAwesome name="times" size={14} style={styles.dismissIcon} />
			</Pressable>
		</View>
	);
}

export function DocumentPanelLoading({
	styles,
}: {
	styles: ReturnType<typeof createDocumentPanelStyles>;
}) {
	return (
		<View style={styles.loadingPlaceholder}>
			<Text style={styles.loadingText}>Loading…</Text>
		</View>
	);
}

export function DocumentPanelFallback({
	attachmentType,
	message,
	onOpenExternally,
	styles,
}: Pick<DocumentPanelProps, "attachmentType"> & {
	message: string;
	onOpenExternally: () => void;
	styles: ReturnType<typeof createDocumentPanelStyles>;
}) {
	return (
		<View style={styles.fallbackContainer}>
			<FontAwesome
				name={attachmentType === "epub" ? "book" : "file-pdf-o"}
				size={40}
				style={styles.fallbackIcon}
			/>
			<Text style={styles.fallbackText}>{message}</Text>
			<Pressable style={styles.openExternalButton} onPress={onOpenExternally}>
				<Text style={styles.openExternalText}>Open in external app</Text>
			</Pressable>
		</View>
	);
}

export function createDocumentPanelStyles(
	theme: ExtendedTheme,
	options: { showRightBorder: boolean },
) {
	return StyleSheet.create({
		panel: {
			flex: 1,
			backgroundColor: theme.colors.card,
			borderColor: theme.colors.border,
			borderRightWidth: options.showRightBorder ? 1 : 0,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			paddingHorizontal: 12,
			paddingVertical: 8,
			borderBottomWidth: 1,
			borderBottomColor: theme.colors.border,
			gap: 8,
		},
		headerIcon: {
			color: theme.colors.textMuted,
		},
		filename: {
			flex: 1,
			fontSize: 13,
			fontWeight: "600",
			color: theme.colors.text,
		},
		dismissButton: {
			width: 28,
			height: 28,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 14,
			borderWidth: 1,
			borderColor: theme.colors.border,
			backgroundColor: theme.colors.background,
		},
		dismissIcon: {
			color: theme.colors.text,
		},
		viewerContainer: {
			flex: 1,
			overflow: "hidden",
		},
		webView: {
			flex: 1,
			backgroundColor: "transparent",
		},
		loadingPlaceholder: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
		},
		loadingText: {
			color: theme.colors.textMuted,
			fontSize: 14,
		},
		fallbackContainer: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			padding: 24,
			gap: 16,
		},
		fallbackIcon: {
			color: theme.colors.textMuted,
		},
		fallbackText: {
			fontSize: 14,
			color: theme.colors.textMuted,
			textAlign: "center",
		},
		openExternalButton: {
			paddingHorizontal: 16,
			paddingVertical: 10,
			borderRadius: 8,
			backgroundColor: theme.colors.primary,
		},
		openExternalText: {
			fontSize: 14,
			color: "#ffffff",
			fontWeight: "600",
		},
	});
}
