import type { Theme } from '../types';

export const daylightTheme: Theme = {
  name: 'daylight',
  palette: {
    // Brand
    brand:            '#6366F1',
    brandLight:       '#818cf8',
    brandLightest:    '#4F46E5',

    // Backgrounds
    bg:               '#F5F5F7',
    surface:          '#FFFFFF',
    surfaceAlt:       '#EBEBED',
    surfaceBrandTint: '#EEF2FF',
    surfaceErrorTint: '#FEF2F2',

    // Borders
    border:           '#6B7280',
    borderSubtle:     '#9CA3AF',
    borderMuted:      '#4B5563',

    // Text
    textPrimary:      '#111827',
    textSecondary:    '#374151',
    textTertiary:     '#6B7280',
    textMuted:        '#6B7280',
    textFaint:        '#6B7280',
    textDisabled:     '#D1D5DB',
    textSubdued:      '#6B7280',
    textInactive:     '#9CA3AF',

    // Status
    success:          '#16A34A',
    error:            '#DC2626',
    errorText:        '#DC2626',

    // Overlays
    overlayLight:     'rgba(0,0,0,0.3)',
    overlayHeavy:     'rgba(0,0,0,0.7)',

    // Misc
    switchTrackOff:   '#D1D5DB',
    transparent:      'transparent',
    headerBg:         'rgba(99, 102, 241, 0.16)',
    textOnBrand:      '#FFFFFF',
    pillBg:           '#EEF2FF',
  },
  navigationTheme: {
    dark: false,
    colors: {
      primary:      '#6366F1',
      background:   '#F5F5F7',
      card:         '#FFFFFF',
      text:         '#111827',
      border:       '#6B7280',
      notification: '#DC2626',
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium:  { fontFamily: 'System', fontWeight: '500' },
      bold:    { fontFamily: 'System', fontWeight: '700' },
      heavy:   { fontFamily: 'System', fontWeight: '900' },
    },
  },
};
