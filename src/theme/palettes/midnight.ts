import type { Theme } from '../types';

export const midnightTheme: Theme = {
  name: 'midnight',
  palette: {
    // Brand
    brand:            '#6366F1',
    brandLight:       '#818cf8',
    brandLightest:    '#c7d2fe',

    // Backgrounds
    bg:               '#0A0A0A',
    surface:          '#141414',
    surfaceAlt:       '#1a1a1a',
    surfaceBrandTint: '#1a1a2e',
    surfaceErrorTint: '#1A0A0A',

    // Borders
    border:           '#4a4a4a',
    borderSubtle:     '#262626',
    borderMuted:      '#666666',

    // Text
    textPrimary:      '#FFFFFF',
    textSecondary:    '#e0e0e0',
    textTertiary:     '#bbbbbb',
    textMuted:        '#999999',
    textFaint:        '#888888',
    textDisabled:     '#666666',
    textSubdued:      '#6B7280',
    textInactive:     '#aaaaaa',

    // Status
    success:          '#22C55E',
    error:            '#EF4444',
    errorText:        '#F87171',

    // Overlays
    overlayLight:     'rgba(0,0,0,0.6)',
    overlayHeavy:     'rgba(0,0,0,0.85)',

    // Misc
    switchTrackOff:   '#333333',
    transparent:      'transparent',
  },
  navigationTheme: {
    dark: true,
    colors: {
      primary:      '#6366F1',
      background:   '#0A0A0A',
      card:         '#141414',
      text:         '#FFFFFF',
      border:       '#4a4a4a',
      notification: '#EF4444',
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium:  { fontFamily: 'System', fontWeight: '500' },
      bold:    { fontFamily: 'System', fontWeight: '700' },
      heavy:   { fontFamily: 'System', fontWeight: '900' },
    },
  },
};
