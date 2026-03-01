import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  Linking,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Audio } from 'expo-av';
import { useVideoJob } from '@/src/hooks/useVideoJob';
import { EZVIDS_DEFAULTS } from '@/src/config/defaults';
import { api } from '@/src/api/client';
import type { PickerItem } from '@/src/components/PickerModal';

// ─── Visual Styles ───────────────────────────────────────────
const VISUAL_STYLES = [
  { id: 'AvatarBubbleTemplate', name: 'Avatar Bubble', desc: 'Floating avatar bubble over product' },
  { id: 'GreenScreenEffectTemplate', name: 'Green Screen', desc: 'Avatar on custom background' },
  { id: 'SimpleAvatarOverlayTemplate', name: 'Avatar Overlay', desc: 'Simple avatar overlay on product' },
  { id: 'DynamicProductTemplate', name: 'Dynamic Product', desc: 'Animated product showcase' },
  { id: 'FullScreenTemplate', name: 'Full Screen', desc: 'Full-screen avatar presentation' },
  { id: 'QuickTransitionTemplate', name: 'Quick Transition', desc: 'Fast-paced transitions' },
  { id: 'EnhancedVanillaTemplate', name: 'Enhanced Vanilla', desc: 'Clean, enhanced layout' },
  { id: 'DynamicGreenScreenEffect', name: 'Dynamic Green Screen', desc: 'Animated green screen effect' },
  { id: 'FeatureHighlightTemplate', name: 'Feature Highlight', desc: 'Product feature callouts' },
] as const;

// ─── Constants ───────────────────────────────────────────────
const STEPS = ['voice over', 'avatar', 'product', 'style'] as const;
const STEP_COUNT = STEPS.length;

// ─── Wizard Header ──────────────────────────────────────────
function WizardHeader({ step }: { step: number }) {
  return (
    <View style={s.header}>
      <Text style={s.logo}>EZ Vids</Text>
      <Text style={s.subtitle}>GENERATE VIDEO</Text>
      <Text style={s.stepTitle}>{'· ' + STEPS[step] + ' ·'}</Text>
      <View style={s.dots}>
        {STEPS.map((_, i) => (
          <View key={i} style={[s.dot, i <= step && s.dotActive]} />
        ))}
      </View>
    </View>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function GenerateScreen() {
  // --- Wizard step ---
  const [step, setStep] = useState(0);

  // --- Form state ---
  const [scriptText, setScriptText] = useState('');
  const [avatarId, setAvatarId] = useState('');
  const [avatarName, setAvatarName] = useState('');
  const [avatarImageUrl, setAvatarImageUrl] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [voiceName, setVoiceName] = useState('');
  const [productImageUrl, setProductImageUrl] = useState('');
  const [visualStyle, setVisualStyle] = useState('');

  // --- Segment toggle for step 1 ---
  const [avatarSegment, setAvatarSegment] = useState<'avatar' | 'voice'>('avatar');

  // --- Data lists ---
  const [avatars, setAvatars] = useState<PickerItem[]>([]);
  const [voices, setVoices] = useState<PickerItem[]>([]);
  const [avatarsLoading, setAvatarsLoading] = useState(false);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [avatarsError, setAvatarsError] = useState<string | null>(null);
  const [voicesError, setVoicesError] = useState<string | null>(null);

  // --- List refs for auto-scroll ---
  const avatarListRef = useRef<FlatList>(null);
  const voiceListRef = useRef<FlatList>(null);

  // --- Audio preview ---
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // --- Zoom preview ---
  const [previewItem, setPreviewItem] = useState<PickerItem | null>(null);

  const job = useVideoJob();

  // ─── Data fetching ────────────────────────────────────────
  const fetchAvatars = useCallback(async () => {
    if (avatars.length > 0) return;
    setAvatarsLoading(true);
    setAvatarsError(null);
    try {
      const res = await api.getAvatars();
      setAvatars(res.avatars.map((a) => ({
        id: a.id,
        label: a.name,
        sublabel: a.gender ?? '',
        imageUrl: a.previewUrl,
      })));
    } catch (err) {
      setAvatarsError(err instanceof Error ? err.message : 'Failed to load avatars');
    } finally {
      setAvatarsLoading(false);
    }
  }, [avatars.length]);

  const fetchVoices = useCallback(async () => {
    if (voices.length > 0) return;
    setVoicesLoading(true);
    setVoicesError(null);
    try {
      const res = await api.getVoices();
      setVoices(res.voices.map((v) => ({
        id: v.id,
        label: v.name,
        sublabel: v.accentName ?? '',
        previewUrl: v.previewUrl,
      })));
    } catch (err) {
      setVoicesError(err instanceof Error ? err.message : 'Failed to load voices');
    } finally {
      setVoicesLoading(false);
    }
  }, [voices.length]);

  // Auto-fetch when entering relevant steps
  useEffect(() => {
    if (step === 1) {
      fetchAvatars();
      fetchVoices();
    }
  }, [step, fetchAvatars, fetchVoices]);

  // ─── Audio preview ────────────────────────────────────────
  const stopPlayback = useCallback(async () => {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const handlePlay = useCallback(async (item: PickerItem) => {
    if (playingId === item.id) {
      await stopPlayback();
      return;
    }
    await stopPlayback();
    if (!item.previewUrl) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: item.previewUrl },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      setPlayingId(item.id);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          stopPlayback();
        }
      });
    } catch {
      setPlayingId(null);
    }
  }, [playingId, stopPlayback]);

  // Stop audio when leaving step 1
  useEffect(() => {
    if (step !== 1) stopPlayback();
  }, [step, stopPlayback]);

  // ─── Auto-scroll to selected item on step/segment change ──
  const scrollTarget = useRef<{ ref: React.RefObject<FlatList>; index: number } | null>(null);

  useEffect(() => {
    if (step !== 1) return;
    const ref = avatarSegment === 'avatar' ? avatarListRef : voiceListRef;
    const data = avatarSegment === 'avatar' ? avatars : voices;
    const selectedId = avatarSegment === 'avatar' ? avatarId : voiceId;
    if (!selectedId || data.length === 0) return;
    const idx = data.findIndex((item) => item.id === selectedId);
    if (idx > 0) {
      scrollTarget.current = { ref, index: idx };
      setTimeout(() => {
        ref.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
      }, 300);
    }
  }, [step, avatarSegment, avatars, voices, avatarId, voiceId]);

  const handleScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    const target = scrollTarget.current;
    if (!target) return;
    // Scroll to estimated offset to force rendering of nearby items
    target.ref.current?.scrollToOffset({
      offset: info.averageItemLength * info.index,
      animated: false,
    });
    // Retry after items near the target have rendered
    setTimeout(() => {
      target.ref.current?.scrollToIndex({
        index: info.index,
        animated: true,
        viewPosition: 0.3,
      });
    }, 200);
  }, []);

  // ─── Handlers ─────────────────────────────────────────────
  const handleGenerate = () => {
    job.submit({
      voiceMode: 'tts',
      scriptText:      scriptText.trim()      || undefined,
      avatarId:        avatarId.trim()         || undefined,
      voiceId:         voiceId.trim()          || undefined,
      productImageUrl: productImageUrl.trim()  || undefined,
      visualStyle:     visualStyle.trim()      || undefined,
    });
  };

  const handleOpenVideo = () => {
    if (job.videoUrl) {
      Linking.openURL(job.videoUrl).catch(() =>
        Alert.alert('Error', 'Could not open video URL')
      );
    }
  };

  const handleMakeAnother = () => {
    job.reset();
    setStep(0);
    setScriptText('');
    setAvatarId('');
    setAvatarName('');
    setAvatarImageUrl('');
    setVoiceId('');
    setVoiceName('');
    setProductImageUrl('');
    setVisualStyle('');
  };

  // ─── Derived state ────────────────────────────────────────
  const showWizard = job.phase === 'idle';
  const showLoading = job.phase === 'submitting' || job.phase === 'polling';
  const showSuccess = job.phase === 'completed' && !!job.videoUrl;
  const showError = job.phase === 'failed';

  // ─── Render helpers ───────────────────────────────────────
  const renderAvatarRow = ({ item }: { item: PickerItem }) => {
    const selected = item.id === avatarId;
    return (
      <TouchableOpacity
        style={[s.row, selected && s.rowSelected]}
        onPress={() => {
          setAvatarId(item.id);
          setAvatarName(item.label);
          setAvatarImageUrl(item.imageUrl ?? '');
        }}
        activeOpacity={0.7}
      >
        <View style={[s.accentBar, selected && s.accentBarActive]} />
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={s.thumb} />
        ) : null}
        <View style={s.rowText}>
          <Text style={[s.rowLabel, selected && s.rowLabelSelected]}>{item.label}</Text>
          {item.sublabel ? (
            <Text style={[s.rowSublabel, selected && s.rowSublabelSelected]}>{item.sublabel}</Text>
          ) : null}
        </View>
        {item.imageUrl ? (
          <TouchableOpacity
            style={[s.actionBtn, selected && s.actionBtnSelected]}
            onPress={() => setPreviewItem(item)}
            hitSlop={8}
          >
            <Text style={s.zoomIcon}>⊕</Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderVoiceRow = ({ item }: { item: PickerItem }) => {
    const selected = item.id === voiceId;
    return (
      <TouchableOpacity
        style={[s.row, selected && s.rowSelected]}
        onPress={() => {
          setVoiceId(item.id);
          setVoiceName(item.sublabel ? `${item.label} · ${item.sublabel}` : item.label);
        }}
        activeOpacity={0.7}
      >
        <View style={[s.accentBar, selected && s.accentBarActive]} />
        <View style={s.rowText}>
          <Text style={[s.rowLabel, selected && s.rowLabelSelected]}>{item.label}</Text>
          {item.sublabel ? (
            <Text style={[s.rowSublabel, selected && s.rowSublabelSelected]}>{item.sublabel}</Text>
          ) : null}
        </View>
        {item.previewUrl ? (
          <TouchableOpacity
            style={[s.actionBtn, selected && s.actionBtnSelected]}
            onPress={() => handlePlay(item)}
            hitSlop={8}
          >
            <Text style={s.playIcon}>
              {playingId === item.id ? '■' : '▶︎'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderStyleCard = ({ item }: { item: typeof VISUAL_STYLES[number] }) => {
    const selected = item.id === visualStyle;
    return (
      <TouchableOpacity
        style={[s.templateCard, selected && s.templateCardSelected]}
        onPress={() => setVisualStyle(item.id)}
        activeOpacity={0.7}
      >
        <View style={[s.templateThumb, s.templateThumbPlaceholder]}>
          <Text style={s.templateThumbIcon}>🎬</Text>
        </View>
        <Text style={[s.templateName, selected && s.templateNameSelected]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={s.templateDesc} numberOfLines={2}>{item.desc}</Text>
      </TouchableOpacity>
    );
  };

  // ─── Inline loading/error for lists ───────────────────────
  const renderListState = (loading: boolean, error: string | null) => {
    if (loading) {
      return (
        <View style={s.listCenter}>
          <ActivityIndicator size="large" color={BRAND} />
          <Text style={s.listHint}>Loading...</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={s.listCenter}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      );
    }
    return null;
  };

  // ═════════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════════
  return (
    <View style={s.container}>
      {/* ─── Header (always visible) ─── */}
      <WizardHeader step={showWizard ? step : 0} />

      {/* ═══ WIZARD STEPS ═══ */}
      {showWizard && (
        <>
          {/* ─── Step 0: Voice Over (Script) ─── */}
          {step === 0 && (
            <ScrollView style={s.stepContent} contentContainerStyle={s.stepScroll}>
              <Text style={s.stepHint}>
                Write your script or leave empty for a default.
              </Text>
              <TextInput
                style={s.textArea}
                multiline
                numberOfLines={6}
                placeholder={EZVIDS_DEFAULTS.scriptText}
                placeholderTextColor="#666"
                value={scriptText}
                onChangeText={setScriptText}
              />
            </ScrollView>
          )}

          {/* ─── Step 1: Avatar + Voice (segment toggle) ─── */}
          {step === 1 && (
            <View style={s.stepFlex}>
              {/* Segment toggle */}
              <View style={s.segmentRow}>
                <TouchableOpacity
                  style={[s.segmentBtn, avatarSegment === 'avatar' && s.segmentBtnActive]}
                  onPress={() => setAvatarSegment('avatar')}
                >
                  <Text style={[s.segmentText, avatarSegment === 'avatar' && s.segmentTextActive]}>
                    Avatar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.segmentBtn, avatarSegment === 'voice' && s.segmentBtnActive]}
                  onPress={() => setAvatarSegment('voice')}
                >
                  <Text style={[s.segmentText, avatarSegment === 'voice' && s.segmentTextActive]}>
                    Voice
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Selection summary */}
              {(avatarName || voiceName) && (
                <View style={s.selectionSummary}>
                  {avatarName ? <Text style={s.selectionText}>Avatar: {avatarName}</Text> : null}
                  {voiceName ? <Text style={s.selectionText}>Voice: {voiceName}</Text> : null}
                </View>
              )}

              {/* Avatar list */}
              {avatarSegment === 'avatar' && (
                avatarsLoading || avatarsError
                  ? renderListState(avatarsLoading, avatarsError)
                  : <FlatList
                      ref={avatarListRef}
                      data={avatars}
                      keyExtractor={(item) => item.id}
                      renderItem={renderAvatarRow}
                      ItemSeparatorComponent={() => <View style={s.separator} />}
                      contentContainerStyle={s.listPad}
                      onScrollToIndexFailed={handleScrollToIndexFailed}
                    />
              )}

              {/* Voice list */}
              {avatarSegment === 'voice' && (
                voicesLoading || voicesError
                  ? renderListState(voicesLoading, voicesError)
                  : <FlatList
                      ref={voiceListRef}
                      data={voices}
                      keyExtractor={(item) => item.id}
                      renderItem={renderVoiceRow}
                      ItemSeparatorComponent={() => <View style={s.separator} />}
                      contentContainerStyle={s.listPad}
                      onScrollToIndexFailed={handleScrollToIndexFailed}
                    />
              )}
            </View>
          )}

          {/* ─── Step 2: Product ─── */}
          {step === 2 && (
            <ScrollView style={s.stepContent} contentContainerStyle={s.stepScroll}>
              <Text style={s.stepHint}>
                Paste an image URL of your product (optional).
              </Text>
              <TextInput
                style={s.input}
                placeholder="https://..."
                placeholderTextColor="#666"
                value={productImageUrl}
                onChangeText={setProductImageUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </ScrollView>
          )}

          {/* ─── Step 3: Visual Style ─── */}
          {step === 3 && (
            <View style={s.stepFlex}>
              <FlatList
                data={[...VISUAL_STYLES]}
                keyExtractor={(item) => item.id}
                numColumns={2}
                columnWrapperStyle={s.templateRow}
                renderItem={renderStyleCard}
                contentContainerStyle={s.listPad}
              />
            </View>
          )}

          {/* ─── Footer Nav ─── */}
          <View style={s.footer}>
            {step > 0 ? (
              <TouchableOpacity style={s.backBtn} onPress={() => setStep(step - 1)}>
                <Text style={s.backBtnText}>← Back</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            {step < STEP_COUNT - 1 ? (
              <TouchableOpacity style={s.nextBtn} onPress={() => setStep(step + 1)}>
                <Text style={s.nextBtnText}>Next →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.generateBtn} onPress={handleGenerate} activeOpacity={0.8}>
                <Text style={s.generateBtnText}>Generate Video</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}

      {/* ═══ LOADING ═══ */}
      {showLoading && (
        <View style={s.center}>
          <ActivityIndicator size="large" color={BRAND} />
          <Text style={s.statusTitle}>
            {job.phase === 'submitting' ? 'Submitting...' : 'Creating your video...'}
          </Text>
          {job.providerStatus && (
            <Text style={s.statusLabel}>Status: {job.providerStatus}</Text>
          )}
          <Text style={s.elapsed}>{job.elapsedSeconds}s</Text>
          <Text style={s.statusHint}>Usually ready in 30–90 seconds.</Text>
          {job.jobId && (
            <Text style={s.mono}>Job: {job.jobId.slice(0, 8)}...</Text>
          )}
        </View>
      )}

      {/* ═══ SUCCESS ═══ */}
      {showSuccess && (
        <View style={s.center}>
          <Text style={s.bigEmoji}>🎬</Text>
          <Text style={s.statusTitle}>Video Ready!</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={handleOpenVideo} activeOpacity={0.8}>
            <Text style={s.primaryBtnText}>▶ Open Video</Text>
          </TouchableOpacity>
          <Text style={s.urlText} numberOfLines={2}>{job.videoUrl}</Text>
          <TouchableOpacity style={s.secondaryBtn} onPress={handleMakeAnother}>
            <Text style={s.secondaryBtnText}>Make Another</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ═══ ERROR ═══ */}
      {showError && (
        <View style={s.center}>
          <Text style={s.bigEmoji}>⚠️</Text>
          <Text style={s.statusTitle}>Something Went Wrong</Text>
          <Text style={s.errorText}>{job.error}</Text>
          <TouchableOpacity style={s.secondaryBtn} onPress={handleMakeAnother}>
            <Text style={s.secondaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ═══ Zoom preview modal ═══ */}
      {previewItem?.imageUrl && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setPreviewItem(null)}>
          <TouchableOpacity
            style={s.previewBackdrop}
            activeOpacity={1}
            onPress={() => setPreviewItem(null)}
          >
            <Image source={{ uri: previewItem.imageUrl }} style={s.previewImage} resizeMode="contain" />
            <Text style={s.previewCaption}>{previewItem.label}</Text>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}

// ═════════════════════════════════════════════════════════════
// Styles
// ═════════════════════════════════════════════════════════════

const BRAND = '#6366F1';
const BG = '#0A0A0A';
const CARD = '#141414';
const BORDER = '#4a4a4a';

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingTop: 56 },

  // ─── Header ───
  header: { alignItems: 'center', paddingBottom: 16 },
  logo: {
    fontSize: 32, fontWeight: '800', color: '#fff',
    textAlign: 'center', letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13, color: '#666', fontWeight: '600',
    letterSpacing: 3, textAlign: 'center', marginTop: 6,
  },
  stepTitle: {
    fontSize: 19, color: BRAND, fontWeight: '400',
    textAlign: 'center', marginTop: 4,
  },
  dots: { flexDirection: 'row', gap: 8, marginTop: 10 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#666',
  },
  dotActive: { backgroundColor: BRAND },

  // ─── Step content ───
  stepContent: { flex: 1 },
  stepScroll: { padding: 20, paddingBottom: 20 },
  stepFlex: { flex: 1 },
  stepHint: {
    color: '#999', fontSize: 15, marginBottom: 16,
    textAlign: 'center',
  },

  // ─── Segment toggle ───
  segmentRow: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 12,
    backgroundColor: CARD, borderRadius: 10, padding: 3,
    borderWidth: 1, borderColor: BORDER,
  },
  segmentBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    alignItems: 'center',
  },
  segmentBtnActive: { backgroundColor: BRAND },
  segmentText: { color: '#aaa', fontSize: 16, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },

  // ─── Selection summary ───
  selectionSummary: {
    flexDirection: 'row', gap: 16, justifyContent: 'center',
    paddingHorizontal: 20, paddingBottom: 8,
  },
  selectionText: { color: '#bbb', fontSize: 14 },

  // ─── Lists ───
  listPad: { paddingBottom: 8 },
  listCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  listHint: { color: '#999', marginTop: 12, fontSize: 16 },
  separator: { height: 1, backgroundColor: BORDER, marginHorizontal: 20 },

  // ─── List rows (shared with avatar + voice) ───
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingRight: 20, paddingLeft: 16,
    backgroundColor: BG,
  },
  rowSelected: { backgroundColor: CARD },
  accentBar: {
    width: 3, alignSelf: 'stretch', borderRadius: 2,
    marginRight: 12, backgroundColor: 'transparent',
  },
  accentBarActive: { backgroundColor: BRAND },
  thumb: {
    width: 44, height: 44, borderRadius: 22,
    marginRight: 12, backgroundColor: CARD,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 17, color: '#e0e0e0' },
  rowLabelSelected: { color: '#fff', fontWeight: '600' },
  rowSublabel: { fontSize: 14, color: '#999', marginTop: 2 },
  rowSublabelSelected: { color: '#bbb' },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
  actionBtnSelected: { borderColor: BRAND },
  playIcon: { color: BRAND, fontSize: 18, fontWeight: '900' },
  zoomIcon: { color: BRAND, fontSize: 20 },

  // ─── Template grid ───
  templateRow: { gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  templateCard: {
    flex: 1, backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BORDER, overflow: 'hidden',
  },
  templateCardSelected: { borderColor: BRAND, borderWidth: 2 },
  templateThumb: {
    width: '100%', aspectRatio: 16 / 9,
    backgroundColor: '#1a1a1a',
  },
  templateThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  templateThumbIcon: { fontSize: 32 },
  templateName: {
    color: '#e0e0e0', fontSize: 15, fontWeight: '600',
    paddingHorizontal: 10, paddingTop: 8,
  },
  templateNameSelected: { color: '#fff' },
  templateDesc: {
    color: '#999', fontSize: 13, lineHeight: 17,
    paddingHorizontal: 10, paddingTop: 4, paddingBottom: 10,
  },

  // ─── Form inputs ───
  input: {
    backgroundColor: CARD, borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 17, borderWidth: 1, borderColor: BORDER,
  },
  textArea: {
    backgroundColor: CARD, borderRadius: 10, padding: 14,
    color: '#fff', fontSize: 17, borderWidth: 1, borderColor: BORDER,
    minHeight: 140, textAlignVertical: 'top',
  },

  // ─── Footer nav ───
  footer: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 16, borderTopWidth: 1, borderColor: BORDER,
  },
  backBtn: {
    paddingVertical: 12, paddingHorizontal: 20,
    borderWidth: 1, borderColor: '#666', borderRadius: 10,
  },
  backBtnText: { color: '#bbb', fontSize: 17 },
  nextBtn: {
    backgroundColor: BRAND, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  nextBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  generateBtn: {
    backgroundColor: BRAND, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 24,
  },
  generateBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // ─── Loading / Success / Error ───
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  bigEmoji: { fontSize: 56, marginBottom: 8 },
  statusTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 16 },
  statusLabel: { fontSize: 16, color: '#bbb', marginTop: 8 },
  statusHint: { fontSize: 15, color: '#999', marginTop: 16, textAlign: 'center' },
  elapsed: { fontSize: 40, fontWeight: '200', color: BRAND, marginTop: 16 },
  mono: { fontSize: 13, color: '#888', marginTop: 20, fontFamily: 'monospace' },
  primaryBtn: {
    backgroundColor: BRAND, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 36, marginTop: 24,
  },
  primaryBtnText: { color: '#fff', fontSize: 19, fontWeight: '600' },
  secondaryBtn: {
    borderWidth: 1, borderColor: '#666', borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 28, marginTop: 20,
  },
  secondaryBtnText: { color: '#bbb', fontSize: 17 },
  urlText: {
    fontSize: 13, color: '#888', marginTop: 12,
    textAlign: 'center', paddingHorizontal: 24,
  },
  errorText: {
    color: '#F87171', fontSize: 16, marginTop: 12,
    textAlign: 'center', paddingHorizontal: 24, lineHeight: 22,
  },

  // ─── Zoom preview ───
  previewBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  previewImage: { width: '100%', aspectRatio: 1, borderRadius: 16 },
  previewCaption: {
    color: '#fff', fontSize: 18, fontWeight: '600',
    marginTop: 16, textAlign: 'center',
  },
});
