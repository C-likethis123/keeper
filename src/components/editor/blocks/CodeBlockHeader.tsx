import type { useExtendedTheme } from "@/hooks/useExtendedTheme";
import { withOpacity } from "@/utils/color";
import { FontAwesome } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LanguageRegistry } from "../code/LanguageRegistry";

interface CodeBlockHeaderProps {
  selectedLanguage: string;
  onLanguageChanged: (language: string) => void;
  onCopyPressed: () => void;
  onDelete: () => void;
}

export function CodeBlockHeader({
  selectedLanguage,
  onLanguageChanged,
  onCopyPressed,
  onDelete,
}: CodeBlockHeaderProps) {
  const styles = useStyles(createStyles);
  const [showLanguagePicker, setShowLanguagePicker] = React.useState(false);
  const registry = LanguageRegistry.instance;
  const languages = registry.languages;

  const formatLanguageName = (lang: string): string => {
    const config = registry.getLanguage(lang);
    return config?.displayName || lang.charAt(0).toUpperCase() + lang.slice(1);
  };

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.languageSelector}
        onPress={() => setShowLanguagePicker(!showLanguagePicker)}
      >
        <FontAwesome name="code" size={16} style={styles.actionButtonIcon} />
        <Text style={styles.languageText}>
          {formatLanguageName(selectedLanguage)}
        </Text>
        <FontAwesome
          name={showLanguagePicker ? "caret-up" : "caret-down"}
          size={18}
          style={styles.actionButtonIcon}
        />
      </Pressable>

      {showLanguagePicker && (
        <View style={styles.languagePicker}>
          {languages.map((lang: string) => (
            <Pressable
              key={lang}
              style={[
                styles.languageOption,
                selectedLanguage === lang && styles.languageOptionSelected,
              ]}
              onPress={() => {
                onLanguageChanged(lang);
                setShowLanguagePicker(false);
              }}
            >
              <Text
                style={[
                  styles.languageOptionText,
                  selectedLanguage === lang &&
                    styles.languageOptionTextSelected,
                ]}
              >
                {formatLanguageName(lang)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={onCopyPressed}>
          <FontAwesome name="copy" size={16} style={styles.actionButtonIcon} />
        </Pressable>
        <Pressable style={styles.actionButton} onPress={onDelete}>
          <FontAwesome
            name="trash-o"
            size={16}
            style={styles.actionButtonIcon}
          />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useExtendedTheme>) {
  const { codeEditor } = theme.custom;
  const headerSelectedBg = withOpacity(codeEditor.background, 0.5);
  return StyleSheet.create({
    container: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: codeEditor.headerBackground,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      flexDirection: "row",
      alignItems: "center",
      position: "relative",
    },
    languageSelector: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    languageText: {
      color: codeEditor.headerText,
      fontSize: 14,
    },
    actionButtonIcon: {
      color: codeEditor.headerText,
    },
    languagePicker: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
      backgroundColor: codeEditor.headerBackground,
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
      maxHeight: 200,
      zIndex: 1000,
      elevation: 5,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    languageOption: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    languageOptionSelected: {
      backgroundColor: headerSelectedBg,
    },
    languageOptionText: {
      color: codeEditor.headerText,
      fontSize: 14,
    },
    languageOptionTextSelected: {
      fontWeight: "600",
    },
    actions: {
      flexDirection: "row",
      marginLeft: "auto",
      gap: 4,
    },
    actionButton: {
      padding: 4,
      minWidth: 28,
      minHeight: 28,
      justifyContent: "center",
      alignItems: "center",
    },
  });
}
