import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AppThemeProvider, useTheme } from '@/src/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function InnerLayout() {
  const { theme } = useTheme();

  return (
    <ThemeProvider value={theme.navigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider defaultTheme="midnight">
      <InnerLayout />
    </AppThemeProvider>
  );
}
