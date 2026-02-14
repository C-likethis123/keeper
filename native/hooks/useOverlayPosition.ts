import { useMemo } from 'react';
import { ViewStyle } from 'react-native';

export type OverlayPositionStrategy = 'center' | 'absolute';

export interface UseOverlayPositionOptions {
  strategy?: OverlayPositionStrategy;
  zIndex?: number;
  elevation?: number;
  wrapperStyle?: ViewStyle;
  containerStyle?: ViewStyle;
}

export interface UseOverlayPositionReturn {
  wrapperStyle: ViewStyle;
  containerStyle: ViewStyle;
  wrapperProps: {
    pointerEvents: 'box-none';
  };
  containerProps: {
    pointerEvents: 'auto';
  };
}

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
      elevation,
    };

    return customContainerStyle
      ? { ...baseStyle, ...customContainerStyle }
      : baseStyle;
  }, [elevation, customContainerStyle]);

  const wrapperProps = useMemo(
    () => ({
      pointerEvents: 'box-none' as const,
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

