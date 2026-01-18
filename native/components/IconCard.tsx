import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface InfoCardProps {
  icon?: keyof typeof MaterialIcons.glyphMap;
  children: React.ReactNode;
  style?: object;
  backgroundColor?: string;
  textColor?: string;
}

export const InfoCard: React.FC<InfoCardProps> = ({
  icon = 'info',
  children,
  style = {},
  backgroundColor = '#e0f2ff',
  textColor = '#000',
}) => {
  return (
    <View style={[styles.card, { backgroundColor }, style]}>
      <MaterialIcons name={icon} size={24} color={textColor} style={styles.icon} />
      <Text style={[styles.text, { color: textColor }]}>{children}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    elevation: 2, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  icon: {
    marginRight: 12,
    marginTop: 2,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
