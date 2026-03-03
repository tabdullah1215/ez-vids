export interface ThemePalette {
  // Brand
  brand: string;
  brandLight: string;
  brandLightest: string;

  // Backgrounds
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceBrandTint: string;
  surfaceErrorTint: string;

  // Borders
  border: string;
  borderSubtle: string;
  borderMuted: string;

  // Text (6 levels, brightest to dimmest)
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textMuted: string;
  textFaint: string;
  textDisabled: string;
  textSubdued: string;
  textInactive: string;

  // Status
  success: string;
  error: string;
  errorText: string;

  // Overlays
  overlayLight: string;
  overlayHeavy: string;

  // Misc
  switchTrackOff: string;
  transparent: string;
  headerBg: string;
  textOnBrand: string;
  pillBg: string;
}

export interface Theme {
  name: string;
  palette: ThemePalette;
  navigationTheme: {
    dark: boolean;
    colors: {
      primary: string;
      background: string;
      card: string;
      text: string;
      border: string;
      notification: string;
    };
    fonts: {
      regular: { fontFamily: string; fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' };
      medium: { fontFamily: string; fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' };
      bold: { fontFamily: string; fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' };
      heavy: { fontFamily: string; fontWeight: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' };
    };
  };
}
