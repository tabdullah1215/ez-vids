import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { Theme, ThemePalette } from './types';
import { midnightTheme } from './palettes/midnight';
import { themes } from './palettes';

interface ThemeContextValue {
  theme: Theme;
  colors: ThemePalette;
  themeName: string;
  setTheme: (name: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  defaultTheme?: string;
  children: React.ReactNode;
}

export function AppThemeProvider({ defaultTheme = 'midnight', children }: ThemeProviderProps) {
  const [themeName, setThemeName] = useState(defaultTheme);

  const setTheme = useCallback((name: string) => {
    if (themes[name]) {
      setThemeName(name);
    } else {
      console.warn(`Theme "${name}" not found. Available: ${Object.keys(themes).join(', ')}`);
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const theme = themes[themeName] ?? midnightTheme;
    return { theme, colors: theme.palette, themeName, setTheme };
  }, [themeName, setTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within an AppThemeProvider');
  return ctx;
}
