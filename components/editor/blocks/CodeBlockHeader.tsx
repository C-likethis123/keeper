import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useExtendedTheme } from '@/hooks/useExtendedTheme';
import { LanguageRegistry } from '../code/LanguageRegistry';

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
  const theme = useExtendedTheme();
  const [showLanguagePicker, setShowLanguagePicker] = React.useState(false);
  const registry = LanguageRegistry.instance;
  const languages = registry.languages;

  const formatLanguageName = (lang: string): string => {
    const config = registry.getLanguage(lang);
    return config?.displayName || lang.charAt(0).toUpperCase() + lang.slice(1);
  };

  const headerTextColor = '#fff';
  const headerBgColor = theme.custom.codeEditor?.background || '#1e1e1e';

  const styles = useMemo(() => createStyles(theme, headerBgColor, headerTextColor), [theme, headerBgColor, headerTextColor]);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.languageSelector}
        onPress={() => setShowLanguagePicker(!showLanguagePicker)}
      >
        <MaterialIcons name="code" size={16} color={headerTextColor} />
        <Text style={styles.languageText}>{formatLanguageName(selectedLanguage)}</Text>
        <MaterialIcons
          name={showLanguagePicker ? 'arrow-drop-up' : 'arrow-drop-down'}
          size={18}
          color={headerTextColor}
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
                  selectedLanguage === lang && styles.languageOptionTextSelected,
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
          <MaterialIcons name="content-copy" size={16} color={headerTextColor} />
        </Pressable>
        <Pressable style={styles.actionButton} onPress={onDelete}>
          <MaterialIcons name="delete-outline" size={16} color={headerTextColor} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(
  theme: ReturnType<typeof useExtendedTheme>,
  headerBgColor: string,
  headerTextColor: string,
) {
  return StyleSheet.create({
    container: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: headerBgColor,
      borderTopLeftRadius: 8,
      borderTopRightRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      position: 'relative',
    },
    languageSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    languageText: {
      color: headerTextColor,
      fontSize: 14,
    },
    languagePicker: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      backgroundColor: headerBgColor,
      borderBottomLeftRadius: 8,
      borderBottomRightRadius: 8,
      maxHeight: 200,
      zIndex: 1000,
      elevation: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    },
    languageOption: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    languageOptionSelected: {
      backgroundColor: headerBgColor + '80',
    },
    languageOptionText: {
      color: headerTextColor,
      fontSize: 14,
    },
    languageOptionTextSelected: {
      fontWeight: '600',
    },
    actions: {
      flexDirection: 'row',
      marginLeft: 'auto',
      gap: 4,
    },
    actionButton: {
      padding: 4,
      minWidth: 28,
      minHeight: 28,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}
