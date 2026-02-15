import { useTheme } from '@react-navigation/native';
import { ExtendedTheme } from '@/constants/themes/types';

/**
 * Type-safe hook for accessing the extended theme with custom properties.
 * 
 * This hook extends React Navigation's useTheme hook to provide
 * type-safe access to custom theme properties like syntax highlighting
 * and code editor themes.
 * 
 * @returns The extended theme object with custom properties
 */
export function useExtendedTheme(): ExtendedTheme {
  const theme = useTheme();
  return theme as ExtendedTheme;
}

