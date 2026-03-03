import type { Theme } from '../types';
import { midnightTheme } from './midnight';
import { daylightTheme } from './daylight';

export const themes: Record<string, Theme> = {
  midnight: midnightTheme,
  daylight: daylightTheme,
};
