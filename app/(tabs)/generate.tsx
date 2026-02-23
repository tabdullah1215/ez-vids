import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useVideoJob } from '@/src/hooks/useVideoJob';
import { EZVIDS_DEFAULTS } from '@/src/config/defaults';
import { api } from '@/src/api/client';

export default function GenerateScreen() {
  // --- Form state (all optional — defaults used when empty) ---
  const [scriptText, setScriptText] = useState('');
  const [avatarId, setAvatarId] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');

  // --- Connection test state ---
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  const job = useVideoJob();

  // --- Handlers ---
  const handleTestConnection = async () => {
    try {
      const result = await api.health();
      setApiOk(result.status === 'ok');
    } catch {
      setApiOk(false);
    }
  };

  const handleGenerate = () => {
    job.submit({
      voiceMode: 'tts',
      scriptText:      scriptText.trim()      || undefined,
      avatarId:        avatarId.trim()         || undefined,
      voiceId:         voiceId.trim()          || undefined,
      productImageUrl: productImageUrl.trim()  || undefined,
    });
  };

  const handleOpenVideo = () => {
    if (job.videoUrl) {
      Linking.openURL(job.videoUrl).catch(() =>
        Alert.alert('Error', 'Could not open video URL')
      );
    }
  };

  // --- Derived state ---
  const showForm = job.phase === 'idle';
  const showLoading = job.phase === 'submitting' || job.phase === 'polling';
  const showSuccess = job.phase === 'completed' && !!job.videoUrl;
  const showError = job.phase === 'failed';

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      {/* ========== HEADER ========== */}
      <Text style={s.logo}>EZVids</Text>
      <Text style={s.tagline}>Voice memo → TikTok-ready video</Text>

      {/* ========== FORM (idle) ========== */}
      {showForm && (
        <>
          {/* API Connection Test */}
          <TouchableOpacity style={s.testBtn} onPress={handleTestConnection}>
            <Text style={s.testBtnText}>
              {apiOk === null
                ? '🔌 Test API Connection'
                : apiOk
                ? '✅ API Connected'
                : '❌ API Unreachable — Check Setup Guide'}
            </Text>
          </TouchableOpacity>

          <Text style={s.sectionHint}>
            All fields optional — tap Generate to use defaults.
          </Text>

          {/* Script */}
          <View style={s.field}>
            <Text style={s.label}>Script (what the avatar says)</Text>
            <TextInput
              style={s.textArea}
              multiline
              numberOfLines={4}
              placeholder={EZVIDS_DEFAULTS.scriptText}
              placeholderTextColor="#555"
              value={scriptText}
              onChangeText={setScriptText}
            />
          </View>

          {/* Avatar ID */}
          <View style={s.field}>
            <Text style={s.label}>Avatar ID</Text>
            <TextInput
              style={s.input}
              placeholder={`Default: ${EZVIDS_DEFAULTS.avatarId.slice(0, 16)}...`}
              placeholderTextColor="#555"
              value={avatarId}
              onChangeText={setAvatarId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Voice ID */}
          <View style={s.field}>
            <Text style={s.label}>Voice ID (TTS accent)</Text>
            <TextInput
              style={s.input}
              placeholder={`Default: ${EZVIDS_DEFAULTS.voiceId.slice(0, 16)}...`}
              placeholderTextColor="#555"
              value={voiceId}
              onChangeText={setVoiceId}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Product Image */}
          <View style={s.field}>
            <Text style={s.label}>Product Image URL</Text>
            <TextInput
              style={s.input}
              placeholder="https://... (optional background)"
              placeholderTextColor="#555"
              value={productImageUrl}
              onChangeText={setProductImageUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          {/* Generate Button */}
          <TouchableOpacity
            style={s.generateBtn}
            onPress={handleGenerate}
            activeOpacity={0.8}
          >
            <Text style={s.generateBtnText}>⚡ Generate Video</Text>
          </TouchableOpacity>

          {/* Defaults Info */}
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>MVP Defaults</Text>
            <Text style={s.infoLine}>Aspect ratio: 9:16 (TikTok)</Text>
            <Text style={s.infoLine}>Captions: auto-generated</Text>
            <Text style={s.infoLine}>Voice mode: Text-to-Speech</Text>
            <Text style={s.infoLine}>Cost: ~5 Creatify credits / 30s</Text>
          </View>
        </>
      )}

      {/* ========== LOADING (submitting / polling) ========== */}
      {showLoading && (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={s.statusTitle}>
            {job.phase === 'submitting'
              ? 'Submitting...'
              : 'Creating your video...'}
          </Text>

          {job.providerStatus && (
            <Text style={s.statusLabel}>
              Status: {job.providerStatus}
            </Text>
          )}

          <Text style={s.elapsed}>{job.elapsedSeconds}s</Text>

          <Text style={s.statusHint}>
            Usually ready in 30–90 seconds.
          </Text>

          {job.jobId && (
            <Text style={s.mono}>Job: {job.jobId.slice(0, 8)}...</Text>
          )}
        </View>
      )}

      {/* ========== SUCCESS ========== */}
      {showSuccess && (
        <View style={s.center}>
          <Text style={s.bigEmoji}>🎬</Text>
          <Text style={s.statusTitle}>Video Ready!</Text>

          <TouchableOpacity
            style={s.primaryBtn}
            onPress={handleOpenVideo}
            activeOpacity={0.8}
          >
            <Text style={s.primaryBtnText}>▶ Open Video</Text>
          </TouchableOpacity>

          <Text style={s.urlText} numberOfLines={2}>
            {job.videoUrl}
          </Text>

          <TouchableOpacity style={s.secondaryBtn} onPress={job.reset}>
            <Text style={s.secondaryBtnText}>Make Another</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ========== ERROR ========== */}
      {showError && (
        <View style={s.center}>
          <Text style={s.bigEmoji}>⚠️</Text>
          <Text style={s.statusTitle}>Something Went Wrong</Text>
          <Text style={s.errorText}>{job.error}</Text>

          <TouchableOpacity style={s.secondaryBtn} onPress={job.reset}>
            <Text style={s.secondaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

// =============================================================
// Styles
// =============================================================

const BRAND = '#6366F1'; // Indigo-500
const BG = '#0A0A0A';
const CARD = '#141414';
const BORDER = '#262626';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { padding: 20, paddingTop: 56, paddingBottom: 80 },

  // Header
  logo: {
    fontSize: 32, fontWeight: '800', color: '#fff',
    textAlign: 'center', letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14, color: '#666', textAlign: 'center',
    marginTop: 4, marginBottom: 20,
  },

  // Test button
  testBtn: {
    backgroundColor: CARD, borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: BORDER, marginBottom: 16,
  },
  testBtnText: { color: '#aaa', fontSize: 13, textAlign: 'center' },

  sectionHint: {
    color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 20,
  },

  // Form
  field: { marginBottom: 14 },
  label: { color: '#999', fontSize: 13, fontWeight: '600', marginBottom: 5 },
  input: {
    backgroundColor: CARD, borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 15, borderWidth: 1, borderColor: BORDER,
  },
  textArea: {
    backgroundColor: CARD, borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 15, borderWidth: 1, borderColor: BORDER,
    minHeight: 96, textAlignVertical: 'top',
  },

  // Generate CTA
  generateBtn: {
    backgroundColor: BRAND, borderRadius: 14, padding: 18,
    alignItems: 'center', marginTop: 8, marginBottom: 20,
  },
  generateBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Info box
  infoBox: {
    backgroundColor: '#0F0F1A', borderRadius: 10, padding: 16,
    borderWidth: 1, borderColor: '#1E1E3A',
  },
  infoTitle: { color: '#818CF8', fontWeight: '700', marginBottom: 6, fontSize: 13 },
  infoLine: { color: '#555', fontSize: 12, lineHeight: 20 },

  // Centered states
  center: { alignItems: 'center', paddingTop: 80 },
  bigEmoji: { fontSize: 56, marginBottom: 8 },
  statusTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 16 },
  statusLabel: { fontSize: 14, color: '#888', marginTop: 8 },
  statusHint: { fontSize: 13, color: '#555', marginTop: 16, textAlign: 'center' },
  elapsed: { fontSize: 40, fontWeight: '200', color: BRAND, marginTop: 16 },
  mono: { fontSize: 11, color: '#444', marginTop: 20, fontFamily: 'monospace' },

  // Buttons
  primaryBtn: {
    backgroundColor: BRAND, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 36, marginTop: 24,
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 1, borderColor: '#333', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 28, marginTop: 20,
  },
  secondaryBtnText: { color: '#888', fontSize: 15 },

  // Misc
  urlText: {
    fontSize: 11, color: '#444', marginTop: 12,
    textAlign: 'center', paddingHorizontal: 24,
  },
  errorText: {
    color: '#F87171', fontSize: 14, marginTop: 12,
    textAlign: 'center', paddingHorizontal: 24, lineHeight: 20,
  },
});
