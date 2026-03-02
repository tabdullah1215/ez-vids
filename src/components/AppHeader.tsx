import React from 'react';
import { View, Text } from 'react-native';
import { createThemedStyles } from '@/src/theme';

interface AppHeaderProps {
  subtitle?: string;
  children?: React.ReactNode;
}

export function AppHeader({ subtitle, children }: AppHeaderProps) {
  const s = useStyles();

  return (
    <View style={s.header}>
      <Text style={s.logo}>EZ Vids</Text>
      <View style={s.subtitleSlot}>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={s.childrenSlot}>
        {children}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((c) => ({
  header: {
    alignItems: 'center' as const,
    backgroundColor: c.surfaceAlt,
    paddingTop: 4,
    paddingBottom: 8,
  },
  logo: {
    fontSize: 32, fontWeight: '800' as const, color: c.textPrimary,
    textAlign: 'center' as const, letterSpacing: -0.5,
  },
  subtitleSlot: {
    height: 28,
    justifyContent: 'center' as const,
  },
  subtitle: {
    fontSize: 14, color: c.brandLightest, fontWeight: '800' as const,
    letterSpacing: 3, textAlign: 'center' as const,
    textShadowColor: c.brandLight,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  childrenSlot: {
    height: 70,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    alignSelf: 'stretch' as const,
  },
}));
