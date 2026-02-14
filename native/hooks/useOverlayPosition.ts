import { useMemo } from 'react';
import { ViewStyle } from 'react-native';

export type OverlayPositionStrategy = 'center' | 'absolute';

export interface UseOverlayPositionOptions {
  /**
   * Positioning strategy for the overlay
   * - 'center': Centers the overlay in the middle of the screen using flexbox
   * - 'absolute': Uses absolute positioning (requires top/left/right/bottom to be provided)
   * @default 'center'
   */
  strategy?: OverlayPositionStrategy;
  /**
   * zIndex for the overlay wrapper
   * @default 1000
   */
  zIndex?: number;
  /**
   * Android elevation for the overlay container
   * @default 10
   */
  elevation?: number;
  /**
   * Custom styles to merge with wrapper style
   */
  wrapperStyle?: ViewStyle;
  /**
   * Custom styles to merge with container style
   */
  containerStyle?: ViewStyle;
}

export interface UseOverlayPositionReturn {
  /**
   * Style object for the overlay wrapper (full-screen container)
   */
  wrapperStyle: ViewStyle;
  /**
   * Style object for the overlay container (content wrapper)
   */
  containerStyle: ViewStyle;
  /**
   * Props to apply to the wrapper View component
   */
  wrapperProps: {
    pointerEvents: 'box-none';
  };
  /**
   * Props to apply to the container View component
   */
  containerProps: {
    pointerEvents: 'auto';
  };
}

/**
 * Hook for managing overlay positioning and styling
 *
 * Provides consistent overlay positioning logic that can be reused across
 * different overlay components. Supports centered and absolute positioning strategies.
 *
 * @example
 * ```tsx
 * const { wrapperStyle, containerStyle, wrapperProps, containerProps } = useOverlayPosition({
 *   strategy: 'center',
 *   zIndex: 1000,
 * });
 *
 * return (
 *   <View style={wrapperStyle} {...wrapperProps}>
 *     <View style={containerStyle} {...containerProps}>
 *       <OverlayContent />
 *     </View>
 *   </View>
 * );
 * ```
 */
export function useOverlayPosition(
  options: UseOverlayPositionOptions = {}
): UseOverlayPositionReturn {
  const {
    strategy = 'center',
    zIndex = 1000,
    elevation = 10,
    wrapperStyle: customWrapperStyle,
    containerStyle: customContainerStyle,
  } = options;

  const wrapperStyle = useMemo<ViewStyle>(() => {
    const baseStyle: ViewStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex,
    };

    if (strategy === 'center') {
      baseStyle.justifyContent = 'center';
      baseStyle.alignItems = 'center';
    }

    return customWrapperStyle
      ? { ...baseStyle, ...customWrapperStyle }
      : baseStyle;
  }, [strategy, zIndex, customWrapperStyle]);

  const containerStyle = useMemo<ViewStyle>(() => {
    const baseStyle: ViewStyle = {
      elevation, // Android elevation to ensure it's above TextInput
    };

    return customContainerStyle
      ? { ...baseStyle, ...customContainerStyle }
      : baseStyle;
  }, [elevation, customContainerStyle]);

  const wrapperProps = useMemo(
    () => ({
      pointerEvents: 'box-none' as const, // Allow touches to pass through to children
    }),
    []
  );

  const containerProps = useMemo(
    () => ({
      pointerEvents: 'auto' as const,
    }),
    []
  );

  return {
    wrapperStyle,
    containerStyle,
    wrapperProps,
    containerProps,
  };
}

