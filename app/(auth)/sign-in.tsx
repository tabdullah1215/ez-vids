import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { createThemedStyles } from '@/src/theme';

export default function SignInScreen() {
  const s = useStyles();
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setError('');
    setLoading(true);

    const { error: authError } = await signIn(email.trim(), password);

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
    // On success, onAuthStateChange fires → route guard redirects automatically
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.inner}>
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.subtitle}>Sign in to your account</Text>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={s._placeholderColor}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor={s._placeholderColor}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
        />

        <TouchableOpacity style={s.button} onPress={handleSignIn} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={s._buttonTextColor} />
          ) : (
            <Text style={s.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.linkRow} onPress={() => router.push('/(auth)/sign-up')}>
          <Text style={s.linkText}>
            Don't have an account? <Text style={s.linkBold}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((c) => ({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: c.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: c.textSecondary,
    marginBottom: 28,
  },
  error: {
    color: c.error,
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: c.textPrimary,
    fontSize: 16,
    marginBottom: 12,
  },
  button: {
    backgroundColor: c.brand,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 4,
  },
  buttonText: {
    color: c.textOnBrand,
    fontSize: 16,
    fontWeight: '700',
  },
  linkRow: {
    marginTop: 24,
    alignItems: 'center' as const,
  },
  linkText: {
    color: c.textSecondary,
    fontSize: 14,
  },
  linkBold: {
    color: c.brand,
    fontWeight: '600',
  },
  // Workaround: store colors for dynamic props that can't go in StyleSheet
  _placeholderColor: c.textMuted,
  _buttonTextColor: c.textOnBrand,
} as any));
