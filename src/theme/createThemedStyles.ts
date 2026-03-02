import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import type { ThemePalette } from './types';
import { useTheme } from './ThemeContext';

export function createThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: ThemePalette) => T | StyleSheet.NamedStyles<T>,
) {
  const cache = new Map<string, T>();

  return function useStyles(): T {
    const { colors, themeName } = useTheme();

    return useMemo(() => {
      const cached = cache.get(themeName);
      if (cached) return cached;

      const styles = StyleSheet.create(factory(colors) as T);
      cache.set(themeName, styles);
      return styles;
    }, [colors, themeName]);
  };
}
