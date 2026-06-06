import { useStyles } from "@/hooks/useStyles";
import { File } from "expo-file-system";
import React, { useCallback, useRef } from "react";
import { View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import {
  DocumentPanelFallback,
  DocumentPanelHeader,
  DocumentPanelLoading,
  type DocumentPanelProps,
  createDocumentPanelStyles,
  useDocumentPanelState,
} from "./DocumentPanel.shared";

const createStyles = (theme: Parameters<typeof createDocumentPanelStyles>[0]) =>
  createDocumentPanelStyles(theme, { showRightBorder: false });

async function readAttachmentBase64(fileUri: string) {
  const file = new File(fileUri);
  return file.base64();
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
  const webViewRef = useRef<WebView>(null);
  const {
    failedAttachmentType,
    fileUri,
    filename,
    handleOpenExternally,
    handleViewerMessage,
    isLoading,
    pdfOpenMessage,
    viewerHtml,
  } = useDocumentPanelState({
    noteId,
    attachmentPath,
    attachmentType,
    onTextSelected,
    onDocumentPositionChange,
    theme,
    readAttachmentBase64,
  });

  const handlePdfLoad = useCallback(() => {
    if (!pdfOpenMessage) return;
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(pdfOpenMessage)} })); true;`,
    );
  }, [pdfOpenMessage]);

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

    if (attachmentType === "epub" && viewerHtml) {
      return (
        <WebView
          ref={webViewRef}
          source={{ html: viewerHtml, baseUrl: "" }}
          originWhitelist={["*"]}
          javaScriptEnabled
          onMessage={handleMessage}
          style={styles.webView}
        />
      );
    }

    if (attachmentType === "pdf" && viewerHtml && pdfOpenMessage) {
      return (
        <WebView
          ref={webViewRef}
          source={{
            html: viewerHtml,
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
      );
    }

    return (
      <DocumentPanelFallback
        attachmentType={attachmentType}
        message={
          attachmentType === "epub" && fileUri && failedAttachmentType === "epub"
            ? "Unable to load this EPUB in the reader."
            : "Unable to load this document in the reader."
        }
        onOpenExternally={handleOpenExternally}
        styles={styles}
      />
    );
  }, [
    attachmentType,
    failedAttachmentType,
    fileUri,
    handleMessage,
    handleOpenExternally,
    handlePdfLoad,
    isLoading,
    pdfOpenMessage,
    styles,
    viewerHtml,
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
