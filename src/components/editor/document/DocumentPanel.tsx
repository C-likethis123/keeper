import "@/components/shared/shared.css";
import { useStyles } from "@/hooks/useStyles";
import { useCallback, useEffect, useRef } from "react";
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
	void relativePath;
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
		<div
			className="keeper-layout"
			style={{ ...styles.panel, ...props.style }}
			data-testid="article-split-panel"
		>
			<DocumentPanelHeader
				dismissLabel="Hide article"
				iconName="newspaper-o"
				onDismiss={props.onDismiss}
				onOpenExternally={() => openExternalUrl(props.url)}
				openExternalLabel="Open article externally"
				styles={styles}
				title="Article"
			/>
			<div className="keeper-layout" style={styles.viewerContainer}>
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
			</div>
		</div>
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
		<div className="keeper-layout" style={{ ...styles.panel, ...props.style }}>
			<DocumentPanelHeader
				iconName={getAttachmentPanelIcon(props.attachmentType)}
				onDismiss={props.onDismiss}
				styles={styles}
				title={filename}
			/>
			<div className="keeper-layout" style={styles.viewerContainer}>
				{renderViewer()}
			</div>
		</div>
	);
}
