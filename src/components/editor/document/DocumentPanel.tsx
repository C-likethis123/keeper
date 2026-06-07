import { useStyles } from "@/hooks/useStyles";
import { File } from "expo-file-system";
import React, { useCallback, useRef } from "react";
import { View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
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
  createDocumentPanelStyles(theme, { showRightBorder: false });

async function readAttachmentBase64(fileUri: string) {
  const file = new File(fileUri);
  return file.base64();
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
        <WebView source={{ uri: props.url }} style={styles.webView} />
      </View>
    </View>
  );
}

function AttachmentDocumentPanel(props: AttachmentDocumentPanelProps) {
  const styles = useStyles(createStyles);
  const webViewRef = useRef<WebView>(null);
  const {
    failedAttachmentType,
    fileUri,
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
  });

  const handleViewerLoad = useCallback(() => {
    if (!viewer.openMessage) return;
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(viewer.openMessage)} })); true;`,
    );
  }, [viewer.openMessage]);

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const message = handleViewerMessage(event.nativeEvent.data);
        if (message.type === "error" || message.type === "debug") {
          console.log("[DocumentPanel]", message);
        }
      } catch {
        // ignore parse errors
      }
    },
    [handleViewerMessage],
  );

  const renderViewer = useCallback(() => {
    if (isLoading) {
      return <DocumentPanelLoading styles={styles} />;
    }

    if (viewer.html && (!viewer.requiresOpenMessage || viewer.openMessage)) {
      return (
        <WebView
          ref={webViewRef}
          source={{
            html: viewer.html,
            baseUrl: "",
          }}
          originWhitelist={["*"]}
          allowFileAccess
          allowUniversalAccessFromFileURLs
          javaScriptEnabled
          onLoad={viewer.requiresOpenMessage ? handleViewerLoad : undefined}
          onMessage={handleMessage}
          style={styles.webView}
        />
      );
    }

    return (
      <DocumentPanelFallback
        attachmentType={props.attachmentType}
        message={
          props.attachmentType === "epub" &&
          fileUri &&
          failedAttachmentType === "epub"
            ? "Unable to load this EPUB in the reader."
            : "Unable to load this document in the reader."
        }
        onOpenExternally={handleOpenExternally}
        styles={styles}
      />
    );
  }, [
    props.attachmentType,
    failedAttachmentType,
    fileUri,
    handleMessage,
    handleOpenExternally,
    handleViewerLoad,
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
