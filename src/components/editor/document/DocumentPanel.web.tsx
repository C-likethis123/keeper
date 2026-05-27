import { useStyles } from "@/hooks/useStyles";
import React, { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import {
	createDocumentPanelStyles,
	DocumentPanelFallback,
	DocumentPanelHeader,
	DocumentPanelLoading,
	type DocumentPanelProps,
	useDocumentPanelState,
} from "./DocumentPanel.shared";

const createStyles = (theme: Parameters<typeof createDocumentPanelStyles>[0]) =>
	createDocumentPanelStyles(theme, { showRightBorder: true });

async function readAttachmentBase64(fileUri: string) {
	const response = await fetch(fileUri);
	const buffer = await response.arrayBuffer();
	const bytes = new Uint8Array(buffer);
	let binary = "";
	for (let index = 0; index < bytes.byteLength; index++) {
		binary += String.fromCharCode(bytes[index]);
	}
	return btoa(binary);
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
	const {
		epubHtml,
		filename,
		handleOpenExternally,
		handleViewerMessage,
		isLoading,
		pdfHtml,
		pdfOpenMessage,
	} = useDocumentPanelState({
		noteId,
		attachmentPath,
		attachmentType,
		onTextSelected,
		theme,
		readAttachmentBase64,
	});

	useEffect(() => {
		if (
			attachmentType !== "pdf" ||
			!pdfOpenMessage ||
			!pdfHtml ||
			!iframeRef.current
		) {
			return;
		}

		const timer = setTimeout(() => {
			iframeRef.current?.contentWindow?.postMessage(pdfOpenMessage, "*");
		}, 100);
		return () => clearTimeout(timer);
	}, [attachmentType, pdfHtml, pdfOpenMessage]);

	useEffect(() => {
		function handleMessage(event: MessageEvent) {
			try {
				handleViewerMessage(event.data);
			} catch {
				// ignore
			}
		}

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [handleViewerMessage]);

	const renderViewer = useCallback(() => {
		if (isLoading) {
			return <DocumentPanelLoading styles={styles} />;
		}

		if (attachmentType === "pdf" && pdfHtml) {
			return (
				<iframe
					ref={iframeRef}
					srcDoc={pdfHtml}
					title={filename}
					sandbox="allow-scripts allow-same-origin"
					style={{ width: "100%", height: "100%", border: "none" }}
				/>
			);
		}

		if (attachmentType === "epub" && epubHtml) {
			return (
				<iframe
					ref={iframeRef}
					srcDoc={epubHtml}
					title={filename}
					sandbox="allow-scripts allow-same-origin"
					style={{ width: "100%", height: "100%", border: "none" }}
				/>
			);
		}

		return (
			<DocumentPanelFallback
				attachmentType={attachmentType}
				message="Unable to load this document."
				onOpenExternally={handleOpenExternally}
				styles={styles}
			/>
		);
	}, [
		attachmentType,
		epubHtml,
		filename,
		handleOpenExternally,
		isLoading,
		pdfHtml,
		styles,
	]);

	return (
		<View style={[styles.panel, style]}>
			<DocumentPanelHeader
				attachmentType={attachmentType}
				filename={filename}
				onDismiss={onDismiss}
				styles={styles}
			/>
			<View style={styles.viewerContainer}>{renderViewer()}</View>
		</View>
	);
}
