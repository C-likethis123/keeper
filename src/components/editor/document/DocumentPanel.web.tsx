import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import {
	type AttachmentType,
	resolveAttachmentUri,
} from "@/services/notes/attachmentStorage";
import { FontAwesome } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
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
import { buildEpubViewerHtml } from "./viewerTemplates";

interface DocumentPanelProps {
	noteId: string;
	attachmentPath: string;
	attachmentType: AttachmentType;
	onTextSelected?: (text: string) => void;
	onDismiss: () => void;
	style?: ViewStyle;
	theme?: "light" | "dark";
}

export function DocumentPanel({
	noteId,
	attachmentPath,
	attachmentType,
	onTextSelected,
	onDismiss,
	style,
	theme = "light",
}: DocumentPanelProps) {
	const styles = useStyles(createStyles);
	const [fileUri, setFileUri] = useState<string | null>(null);
	const [savedCfi, setSavedCfi] = useState<string | null>(null);
	const [epubBase64, setEpubBase64] = useState<string | null>(null);
	const [epubHtml, setEpubHtml] = useState<string>("");

	const filename = attachmentPath.split("/").pop() ?? attachmentPath;

	useEffect(() => {
		const resolved = resolveAttachmentUri(attachmentPath);
		setFileUri(resolved);
		loadDocumentPosition(noteId, attachmentPath).then((pos) => {
			if (pos) setSavedCfi(pos);
		});
	}, [noteId, attachmentPath]);

	// Fetch epub as base64 so epub.js doesn't need to fetch asset:// URLs directly
	useEffect(() => {
		if (!fileUri || attachmentType !== "epub") {
			setEpubBase64(null);
			return;
		}
		let cancelled = false;
		fetch(fileUri)
			.then((r) => r.arrayBuffer())
			.then((buf) => {
				if (cancelled) return;
				const bytes = new Uint8Array(buf);
				let binary = "";
				for (let i = 0; i < bytes.byteLength; i++) {
					binary += String.fromCharCode(bytes[i]);
				}
				setEpubBase64(btoa(binary));
			})
			.catch(() => {
				if (!cancelled) setEpubBase64(null);
			});
		return () => {
			cancelled = true;
		};
	}, [fileUri, attachmentType]);

	// Build viewer HTML once base64 is ready
	useEffect(() => {
		if (attachmentType !== "epub") {
			setEpubHtml("");
			return;
		}
		setEpubHtml(
			epubBase64 ? buildEpubViewerHtml(theme, epubBase64, savedCfi) : "",
		);
	}, [attachmentType, theme, epubBase64, savedCfi]);

	// Listen for messages from the epub.js iframe
	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			try {
				const msg =
					typeof event.data === "string"
						? (JSON.parse(event.data) as {
								type: string;
								cfi?: string;
								text?: string;
							})
						: (event.data as { type: string; cfi?: string; text?: string });
				if (msg.type === "cfi" && msg.cfi) {
					saveDocumentPosition(noteId, attachmentPath, msg.cfi);
				} else if (msg.type === "textSelected" && msg.text) {
					onTextSelected?.(msg.text);
				}
			} catch {
				// ignore
			}
		}
		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [noteId, attachmentPath, onTextSelected]);

	return (
		<View style={[styles.panel, style]}>
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

			<View style={styles.viewerContainer}>
				{!fileUri || (attachmentType === "epub" && !epubHtml) ? (
					<View style={styles.loadingPlaceholder}>
						<Text style={styles.loadingText}>Loading…</Text>
					</View>
				) : attachmentType === "pdf" ? (
					// Browsers render PDFs natively in an iframe
					<iframe
						src={fileUri}
						title={filename}
						style={{ width: "100%", height: "100%", border: "none" }}
					/>
				) : epubHtml ? (
					<iframe
						srcDoc={epubHtml}
						title={filename}
						sandbox="allow-scripts allow-same-origin"
						style={{ width: "100%", height: "100%", border: "none" }}
					/>
				) : null}
			</View>
		</View>
	);
}

function createStyles(theme: ExtendedTheme) {
	return StyleSheet.create({
		panel: {
			flex: 1,
			backgroundColor: theme.colors.card,
			borderRightWidth: 1,
			borderRightColor: theme.colors.border,
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
		loadingPlaceholder: {
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
		},
		loadingText: {
			color: theme.colors.textMuted,
			fontSize: 14,
		},
	});
}
