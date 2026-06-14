import type { AttachmentType } from "@/services/notes/attachmentStorage";
import type React from "react";
import {
  type ComponentProps,
  type StyleProp,
  View,
  type ViewStyle,
} from "react-native";
import { DocumentPanel } from "./document/DocumentPanel";
import VideoSplitPanel from "./video/VideoSplitPanel";

type EditorSidePanel = "document" | "video" | "article";

interface EditorSidePanelHostProps {
  activePanel: EditorSidePanel;
  articleUrl: string;
  attachmentPath: string | null;
  attachmentType: AttachmentType | null;
  dividerStyle: StyleProp<ViewStyle>;
  noteId: string;
  onArticleDismiss: () => void;
  onAttachmentDismiss: () => void;
  onDocumentPositionChange: (path: string, position: string) => void;
  onTextSelected: (text: string) => void;
  onVideoDismiss: () => void;
  paneStyle: StyleProp<ViewStyle>;
  panHandlers: ComponentProps<typeof View>;
  videoUrl: string;
}

export function EditorSidePanelHost({
  activePanel,
  articleUrl,
  attachmentPath,
  attachmentType,
  dividerStyle,
  noteId,
  onArticleDismiss,
  onAttachmentDismiss,
  onDocumentPositionChange,
  onTextSelected,
  onVideoDismiss,
  paneStyle,
  panHandlers,
  videoUrl,
}: EditorSidePanelHostProps) {
  return (
    <>
      <View style={paneStyle}>
        <EditorSidePanelContent
          activePanel={activePanel}
          articleUrl={articleUrl}
          attachmentPath={attachmentPath}
          attachmentType={attachmentType}
          noteId={noteId}
          onArticleDismiss={onArticleDismiss}
          onAttachmentDismiss={onAttachmentDismiss}
          onDocumentPositionChange={onDocumentPositionChange}
          onTextSelected={onTextSelected}
          onVideoDismiss={onVideoDismiss}
          videoUrl={videoUrl}
        />
      </View>
      <View style={dividerStyle} {...panHandlers} />
    </>
  );
}

function EditorSidePanelContent({
  activePanel,
  articleUrl,
  attachmentPath,
  attachmentType,
  noteId,
  onArticleDismiss,
  onAttachmentDismiss,
  onDocumentPositionChange,
  onTextSelected,
  onVideoDismiss,
  videoUrl,
}: Omit<EditorSidePanelHostProps, "dividerStyle" | "paneStyle" | "panHandlers">) {
  if (activePanel === "article") {
    return (
      <DocumentPanel
        variant="article"
        url={articleUrl}
        onDismiss={onArticleDismiss}
      />
    );
  }

  if (activePanel === "video") {
    return <VideoSplitPanel url={videoUrl} onDismiss={onVideoDismiss} />;
  }

  if (!attachmentPath || !attachmentType) {
    return null;
  }

  return (
    <DocumentPanel
      noteId={noteId}
      attachmentPath={attachmentPath}
      attachmentType={attachmentType}
      onTextSelected={onTextSelected}
      onDocumentPositionChange={onDocumentPositionChange}
      onDismiss={onAttachmentDismiss}
    />
  );
}
