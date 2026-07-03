import { useStyles } from "@/hooks/useStyles";
import { getTauriInvoke } from "@/services/storage/runtime";
import React, { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import {
	DocumentPanelFallback,
	DocumentPanelHeader,
	DocumentPanelLoading,
	type ArticleDocumentPanelProps,
	type AttachmentDocumentPanelProps,
	type DocumentPanelProps,
	createDocumentPanelStyles,
	getAttachmentPanelIcon,
	openExternalUrl,
	useDocumentPanelState,
} from "./DocumentPanel.shared";

const createStyles = (theme: Parameters<typeof createDocumentPanelStyles>[0]) =>
	createDocumentPanelStyles(theme, { showRightBorder: true });

function bytesToBase64(bytes: Uint8Array) {
	let binary = "";
	for (let index = 0; index < bytes.byteLength; index++) {
		binary += String.fromCharCode(bytes[index]);
	}
	return btoa(binary);
}

async function readAttachmentBase64(fileUri: string, relativePath: string) {
	const invoke = getTauriInvoke();
	if (invoke) {
		const bytes = await invoke<number[]>("read_attachment", { relativePath });
		return bytesToBase64(new Uint8Array(bytes));
	}
	const response = await fetch(fileUri);
	const buffer = await response.arrayBuffer();
	return bytesToBase64(new Uint8Array(buffer));
}

export function DocumentPanel(props: DocumentPanelProps) {
	if (props.variant === "article") {
		return <ArticleDocumentPanel {...props} />;
	}
	return <AttachmentDocumentPanel {...props} />;
}

function ArticleDocumentPanel(props: ArticleDocumentPanelProps) {
	const styles = useStyles(createStyles);
	return (
		<View style={[styles.panel, props.style]} testID="article-split-panel">
			<DocumentPanelHeader
				dismissLabel="Hide article"
				iconName="newspaper-o"
				onDismiss={props.onDismiss}
				onOpenExternally={() => openExternalUrl(props.url)}
				openExternalLabel="Open article externally"
				styles={styles}
				title="Article"
			/>
			<View style={styles.viewerContainer}>
				<iframe
					src={props.url}
					title="Article"
					style={{
						border: "0",
						width: "100%",
						height: "100%",
						backgroundColor: "#ffffff",
					}}
				/>
			</View>
		</View>
	);
}

function AttachmentDocumentPanel(props: AttachmentDocumentPanelProps) {
	const styles = useStyles(createStyles);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const {
		filename,
		handleOpenExternally,
		handleViewerMessage,
		isLoading,
		viewer,
	} = useDocumentPanelState({
		noteId: props.noteId,
		attachmentPath: props.attachmentPath,
		attachmentType: props.attachmentType,
		onTextSelected: props.onTextSelected,
			onDocumentPositionChange: props.onDocumentPositionChange,
			theme: props.theme,
			readAttachmentBase64,
			preferFileUri: true,
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
					attachmentType={props.attachmentType}
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
		props.attachmentType,
		filename,
		handleOpenExternally,
		isLoading,
		styles,
		viewer,
	]);

	return (
		<View style={[styles.panel, props.style]}>
			<DocumentPanelHeader
				iconName={getAttachmentPanelIcon(props.attachmentType)}
				onDismiss={props.onDismiss}
				styles={styles}
				title={filename}
			/>
			<View style={styles.viewerContainer}>{renderViewer()}</View>
		</View>
	);
}
