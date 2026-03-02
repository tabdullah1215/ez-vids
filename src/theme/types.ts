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
      regular: { fontFamily: string; fontWeight: string };
      medium: { fontFamily: string; fontWeight: string };
      bold: { fontFamily: string; fontWeight: string };
      heavy: { fontFamily: string; fontWeight: string };
    };
  };
}
