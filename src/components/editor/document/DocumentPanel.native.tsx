import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import {
	type AttachmentType,
	resolveAttachmentUri,
} from "@/services/notes/attachmentStorage";
import { FontAwesome } from "@expo/vector-icons";
import { File } from "expo-file-system";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
	Linking,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
	type ViewStyle,
} from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import {
	loadDocumentPosition,
	saveDocumentPosition,
} from "./documentPositionStore";
import { buildEpubViewerHtml, buildPdfViewerHtml } from "./viewerTemplates";

interface DocumentPanelProps {
	noteId: string;
	attachmentPath: string;
	attachmentType: AttachmentType;
	/** Called with quote text when user selects text in the viewer */
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
	const webViewRef = useRef<WebView>(null);
	const [fileUri, setFileUri] = useState<string | null>(null);
	const [savedPosition, setSavedPosition] = useState<string | null>(null);
	const [epubHtml, setEpubHtml] = useState<string>("");
	const [pdfHtml, setPdfHtml] = useState<string>("");
	const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);
	const [epubBase64, setEpubBase64] = useState<string | null>(null);

	const filename = attachmentPath.split("/").pop() ?? attachmentPath;

	// Resolve attachment URI and load saved position
	useEffect(() => {
		const resolved = resolveAttachmentUri(attachmentPath);
		setFileUri(resolved);
		loadDocumentPosition(noteId, attachmentPath).then((pos) => {
			if (pos) setSavedPosition(pos);
		});
	}, [noteId, attachmentPath]);

	// Build viewer HTML — for EPUB, embed base64 directly so it auto-opens
	// without any message passing (avoids file:// origin restrictions in WebView).
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
		if (!fileUri || attachmentType !== "pdf") {
			setPdfDataUri(null);
			return;
		}

		const pdfFile = new File(fileUri);
		pdfFile
			.base64()
			.then((base64) => {
				if (!isCancelled) {
					setPdfDataUri(`data:application/pdf;base64,${base64}`);
				}
			})
			.catch(() => {
				if (!isCancelled) {
					setPdfDataUri(null);
				}
			});

		return () => {
			isCancelled = true;
		};
	}, [attachmentType, fileUri]);

	useEffect(() => {
		let isCancelled = false;
		if (!fileUri || attachmentType !== "epub") {
			setEpubBase64(null);
			return;
		}

		const epubFile = new File(fileUri);
		epubFile
			.base64()
			.then((base64) => {
				if (!isCancelled) {
					console.log(
						"[DocumentPanel] epub base64 loaded, length:",
						base64.length,
					);
					setEpubBase64(base64);
				}
			})
			.catch((err) => {
				console.log("[DocumentPanel] epub base64 failed:", err);
				if (!isCancelled) {
					setEpubBase64(null);
				}
			});

		return () => {
			isCancelled = true;
		};
	}, [attachmentType, fileUri]);

	const handlePdfLoad = useCallback(() => {
		if (!pdfDataUri) return;
		const msg = JSON.stringify({
			type: "open",
			fileUri: pdfDataUri,
			page: savedPosition ?? undefined,
		});
		webViewRef.current?.injectJavaScript(
			`window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(msg)} })); true;`,
		);
	}, [pdfDataUri, savedPosition]);

	const handleMessage = useCallback(
		(event: WebViewMessageEvent) => {
			try {
				const msg = JSON.parse(event.nativeEvent.data) as {
					type: string;
					cfi?: string;
					page?: string;
					text?: string;
					message?: string;
				};
				if (msg.type === "cfi" && msg.cfi) {
					saveDocumentPosition(noteId, attachmentPath, msg.cfi);
				} else if (msg.type === "page" && msg.page) {
					saveDocumentPosition(noteId, attachmentPath, msg.page);
				} else if (msg.type === "textSelected" && msg.text) {
					onTextSelected?.(msg.text);
				} else if (msg.type === "error" || msg.type === "debug") {
					console.log("[DocumentPanel]", msg);
				}
			} catch {
				// ignore parse errors
			}
		},
		[noteId, attachmentPath, onTextSelected],
	);

	const handleOpenExternally = useCallback(async () => {
		if (fileUri) {
			Linking.openURL(fileUri);
		}
	}, [fileUri]);

	return (
		<View style={[styles.panel, style]}>
			{/* Header */}
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

			{/* Viewer */}
			<View style={styles.viewerContainer}>
				{!fileUri ? (
					<View style={styles.loadingPlaceholder}>
						<Text style={styles.loadingText}>Loading…</Text>
					</View>
				) : attachmentType === "epub" && epubHtml ? (
					<WebView
						ref={webViewRef}
						source={{ html: epubHtml, baseUrl: "" }}
						originWhitelist={["*"]}
						javaScriptEnabled
						onMessage={handleMessage}
						style={styles.webView}
					/>
				) : attachmentType === "pdf" && pdfHtml && pdfDataUri ? (
					<WebView
						ref={webViewRef}
						source={{
							html: pdfHtml,
							baseUrl: "",
						}}
						originWhitelist={["*"]}
						allowFileAccess
						allowUniversalAccessFromFileURLs
						javaScriptEnabled
						onLoad={handlePdfLoad}
						onMessage={handleMessage}
						style={styles.webView}
					/>
				) : (
					<View style={styles.fallbackContainer}>
						<FontAwesome
							name="file-pdf-o"
							size={40}
							style={styles.fallbackIcon}
						/>
						<Text style={styles.fallbackText}>
							Unable to load this PDF in the reader.
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
			borderColor: theme.colors.border,
			borderRightWidth: Platform.OS === "web" ? 1 : 0,
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
