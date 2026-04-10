import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
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
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [fileUri, setFileUri] = useState<string | null>(null);
	const [savedPosition, setSavedPosition] = useState<string | null>(null);
	const [epubBase64, setEpubBase64] = useState<string | null>(null);
	const [epubHtml, setEpubHtml] = useState<string>("");
	const [pdfHtml, setPdfHtml] = useState<string>("");
	const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);

	const filename = attachmentPath.split("/").pop() ?? attachmentPath;

	useEffect(() => {
		const resolved = resolveAttachmentUri(attachmentPath);
		setFileUri(resolved);
		loadDocumentPosition(noteId, attachmentPath).then((pos) => {
			if (pos) setSavedPosition(pos);
		});
	}, [noteId, attachmentPath]);

	// Build viewer HTML once data is ready
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

	// Fetch PDF as base64 for the custom viewer
	useEffect(() => {
		let cancelled = false;
		if (!fileUri || attachmentType !== "pdf") {
			setPdfDataUri(null);
			return;
		}
		fetch(fileUri)
			.then((r) => r.arrayBuffer())
			.then((buf) => {
				if (cancelled) return;
				const bytes = new Uint8Array(buf);
				let binary = "";
				for (let i = 0; i < bytes.byteLength; i++) {
					binary += String.fromCharCode(bytes[i]);
				}
				setPdfDataUri(`data:application/pdf;base64,${btoa(binary)}`);
			})
			.catch(() => {
				if (!cancelled) setPdfDataUri(null);
			});
		return () => {
			cancelled = true;
		};
	}, [fileUri, attachmentType]);

	// Send open command to PDF viewer once data URI is ready
	useEffect(() => {
		if (
			attachmentType !== "pdf" ||
			!pdfDataUri ||
			!pdfHtml ||
			!iframeRef.current
		)
			return;
		const msg = JSON.stringify({
			type: "open",
			fileUri: pdfDataUri,
			page: savedPosition ?? undefined,
		});
		// Give the iframe a tick to mount
		const timer = setTimeout(() => {
			iframeRef.current?.contentWindow?.postMessage(msg, "*");
		}, 100);
		return () => clearTimeout(timer);
	}, [attachmentType, pdfDataUri, pdfHtml, savedPosition]);

	// Listen for messages from document iframes (epub + pdf)
	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			try {
				const msg =
					typeof event.data === "string"
						? (JSON.parse(event.data) as {
								type: string;
								cfi?: string;
								page?: string;
								text?: string;
							})
						: (event.data as {
								type: string;
								cfi?: string;
								page?: string;
								text?: string;
							});
				if (msg.type === "cfi" && msg.cfi) {
					saveDocumentPosition(noteId, attachmentPath, msg.cfi);
				} else if (msg.type === "page" && msg.page) {
					saveDocumentPosition(noteId, attachmentPath, msg.page);
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

	const handleOpenExternally = useCallback(async () => {
		if (fileUri) {
			Linking.openURL(fileUri);
		}
	}, [fileUri]);

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
				{!fileUri ||
				(attachmentType === "epub" && !epubHtml) ||
				(attachmentType === "pdf" && (!pdfHtml || !pdfDataUri)) ? (
					<View style={styles.loadingPlaceholder}>
						<Text style={styles.loadingText}>Loading…</Text>
					</View>
				) : attachmentType === "pdf" ? (
					<iframe
						ref={iframeRef}
						srcDoc={pdfHtml}
						title={filename}
						sandbox="allow-scripts allow-same-origin"
						style={{ width: "100%", height: "100%", border: "none" }}
					/>
				) : epubHtml ? (
					<iframe
						ref={iframeRef}
						srcDoc={epubHtml}
						title={filename}
						sandbox="allow-scripts allow-same-origin"
						style={{ width: "100%", height: "100%", border: "none" }}
					/>
				) : (
					<View style={styles.fallbackContainer}>
						<FontAwesome
							name="file-pdf-o"
							size={40}
							style={styles.fallbackIcon}
						/>
						<Text style={styles.fallbackText}>
							Unable to load this document.
						</Text>
						<Pressable
							style={styles.openExternalButton}
							onPress={handleOpenExternally}
						>
							<Text style={styles.openExternalText}>Open in external app</Text>
						</Pressable>
					</View>
				)}
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
