import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '@/src/context/AuthContext';
import { createThemedStyles } from '@/src/theme';

export default function SettingsScreen() {
  const s = useStyles();
  const { user, signOut } = useAuth();

  return (
    <View style={s.container}>
      <View style={s.content}>
        <Text style={s.title}>Settings</Text>

        <View style={s.card}>
          <Text style={s.label}>Account</Text>
          <Text style={s.email}>{user?.email ?? 'Unknown'}</Text>
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((c) => ({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: c.textPrimary,
    marginBottom: 28,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  email: {
    fontSize: 16,
    color: c.textPrimary,
  },
  signOutBtn: {
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: c.error,
  },
  signOutText: {
    color: c.error,
    fontSize: 16,
    fontWeight: '600',
  },
}));
