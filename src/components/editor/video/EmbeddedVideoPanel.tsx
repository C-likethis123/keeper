import type { ExtendedTheme } from "@/constants/themes/types";
import { useStyles } from "@/hooks/useStyles";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";
import { WebView } from "react-native-webview";
import type { EmbeddedVideoSource } from "./videoUtils";

interface EmbeddedVideoPanelProps {
  source: EmbeddedVideoSource;
  style?: ViewStyle;
}

export function EmbeddedVideoPanel({ source, style }: EmbeddedVideoPanelProps) {
  const styles = useStyles(createStyles);
  const { height: viewportHeight } = useWindowDimensions();

  const origin =
    Platform.OS === "web" ? window.location.origin : "https://keeper.app";
  const embedUrlWithOrigin = `${source.embedUrl}&origin=${encodeURIComponent(origin)}`;

  return (
    <View style={[styles.panel, style]} testID={"embedded-video-panel"}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Video</Text>
        </View>
      </View>
      <>
        <View
          style={[
            styles.playerFrame,
            {
              height: viewportHeight * (Platform.OS === "web" ? 0.5 : 1 / 3),
            },
          ]}
        >
          {Platform.OS === "web" ? (
            <iframe
              src={embedUrlWithOrigin}
              title={"Youtube video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              style={{
                border: "0",
                width: "100%",
                height: "100%",
                borderRadius: 12,
                backgroundColor: "#000",
              }}
            />
          ) : (
            <WebView
              allowsFullscreenVideo
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              source={{
                uri: embedUrlWithOrigin,
              }}
              style={styles.webView}
            />
          )}
        </View>
        <Text numberOfLines={1} style={styles.caption}>
          {source.rawUrl}
        </Text>
      </>
      )
    </View>
  );
}

function createStyles(theme: ExtendedTheme) {
  const isWeb = Platform.OS === "web";
  return StyleSheet.create({
    panel: {
      borderWidth: isWeb ? 1 : 0,
      borderLeftWidth: 0,
      borderRightWidth: 0,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      borderRadius: isWeb ? 16 : 0,
      padding: isWeb ? 12 : 0,
      paddingVertical: isWeb ? 12 : 8,
      gap: 10,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 16,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      color: theme.colors.textMuted,
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: theme.colors.text,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    iconButton: {
      width: 32,
      height: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.background,
    },
    expandIcon: {
      color: theme.colors.text,
    },
    playerFrame: {
      overflow: "hidden",
      borderRadius: isWeb ? 12 : 0,
      backgroundColor: "#000000",
    },
    webView: {
      flex: 1,
      backgroundColor: "#000000",
    },
    caption: {
      fontSize: 12,
      color: theme.colors.textMuted,
      paddingHorizontal: isWeb ? 0 : 16,
    },
  });
}
