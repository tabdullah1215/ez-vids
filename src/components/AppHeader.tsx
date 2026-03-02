import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AppHeaderProps {
  subtitle?: string;
  children?: React.ReactNode;
}

export function AppHeader({ subtitle, children }: AppHeaderProps) {
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

const s = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingTop: 4,
    paddingBottom: 8,
  },
  logo: {
    fontSize: 32, fontWeight: '800', color: '#fff',
    textAlign: 'center', letterSpacing: -0.5,
  },
  subtitleSlot: {
    height: 28,
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 14, color: '#c7d2fe', fontWeight: '800',
    letterSpacing: 3, textAlign: 'center',
    textShadowColor: '#818cf8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  childrenSlot: {
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
});
