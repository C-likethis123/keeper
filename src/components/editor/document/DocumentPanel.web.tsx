import { useStyles } from "@/hooks/useStyles";
import React, { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import {
	DocumentPanelFallback,
	DocumentPanelHeader,
	DocumentPanelLoading,
	type DocumentPanelProps,
	createDocumentPanelStyles,
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
	onDocumentPositionChange,
	onDismiss,
	style,
	theme = "light",
}: DocumentPanelProps) {
	const styles = useStyles(createStyles);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const {
		filename,
		handleOpenExternally,
		handleViewerMessage,
		isLoading,
		viewer,
	} = useDocumentPanelState({
		noteId,
		attachmentPath,
		attachmentType,
		onTextSelected,
		onDocumentPositionChange,
		theme,
		readAttachmentBase64,
	});

	useEffect(() => {
		if (
			!viewer.requiresOpenMessage ||
			!viewer.openMessage ||
			!viewer.html ||
			!iframeRef.current
		) {
			return;
		}

		const timer = setTimeout(() => {
			iframeRef.current?.contentWindow?.postMessage(viewer.openMessage, "*");
		}, 100);
		return () => clearTimeout(timer);
	}, [viewer]);

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

		if (!viewer.html) {
			return (
				<DocumentPanelFallback
					attachmentType={attachmentType}
					message="Unable to load this document."
					onOpenExternally={handleOpenExternally}
					styles={styles}
				/>
			);
		}

		return (
			<iframe
				ref={iframeRef}
				srcDoc={viewer.html}
				title={filename}
				sandbox="allow-scripts allow-same-origin"
				style={{ width: "100%", height: "100%", border: "none" }}
			/>
		);
	}, [
		attachmentType,
		filename,
		handleOpenExternally,
		isLoading,
		styles,
		viewer,
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
