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
import * as ImagePicker from 'expo-image-picker';
import { useVideoJob } from '@/src/hooks/useVideoJob';
import { EZVIDS_DEFAULTS } from '@/src/config/defaults';
import { api } from '@/src/api/client';
import type { PickerItem } from '@/src/components/PickerModal';

// ─── Visual Styles (from Creatify lipsyncs_v2 API) ───────────
type AspectRatio = '9:16' | '16:9';

const VISUAL_STYLES = [
  { id: 'FullAvatar', name: 'Full Avatar', desc: 'Full-screen avatar presentation', ratios: ['9:16', '16:9'] as AspectRatio[] },
  { id: 'GreenScreenEffect', name: 'Green Screen', desc: 'Avatar on custom background', ratios: ['9:16', '16:9'] as AspectRatio[] },
  { id: 'FullAvatarScreenProductOverlay', name: 'Avatar + Product', desc: 'Avatar with product overlay', ratios: ['9:16', '16:9'] as AspectRatio[] },
  { id: 'UpAndDown', name: 'Up & Down', desc: 'Avatar above, product below', ratios: ['9:16'] as AspectRatio[] },
  { id: 'SideBySide', name: 'Side by Side', desc: 'Avatar and product side by side', ratios: ['16:9'] as AspectRatio[] },
  { id: 'FullProduct', name: 'Full Product', desc: 'Full-screen product showcase', ratios: ['9:16', '16:9'] as AspectRatio[] },
  { id: 'MagnifyingGlassCircle', name: 'Magnifying Glass', desc: 'Avatar in magnifying glass circle', ratios: ['9:16', '16:9'] as AspectRatio[] },
  { id: 'ReverseMagnifyingGlassCircle', name: 'Reverse Glass', desc: 'Product in magnifying glass circle', ratios: ['9:16', '16:9'] as AspectRatio[] },
  { id: 'TwitterFrame', name: 'Twitter Frame', desc: 'Social media frame layout', ratios: ['9:16', '16:9'] as AspectRatio[] },
  { id: 'DramaticFullProduct', name: 'Dramatic Product', desc: 'Dramatic full-screen product', ratios: ['9:16'] as AspectRatio[] },
  { id: 'Dramatic', name: 'Dramatic', desc: 'Dramatic avatar presentation', ratios: ['9:16'] as AspectRatio[] },
  { id: 'Vanilla', name: 'Vanilla', desc: 'Clean, simple layout', ratios: ['9:16', '16:9'] as AspectRatio[] },
  { id: 'Vlog', name: 'Vlog', desc: 'Vlog-style vertical layout', ratios: ['9:16'] as AspectRatio[] },
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
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);

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
  const handlePickImage = async () => {
    setUploadError(null);

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to upload product images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      setUploadError('Could not read image data.');
      return;
    }

    setPickedImageUri(asset.uri);
    setUploadingImage(true);

    try {
      const { url } = await api.uploadProductImage(asset.base64, asset.mimeType || 'image/jpeg');
      setProductImageUrl(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
      setPickedImageUri(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setAspectRatio(ratio);
    // Clear visual style if it's incompatible with the new ratio
    if (visualStyle) {
      const style = VISUAL_STYLES.find((s) => s.id === visualStyle);
      if (style && !style.ratios.includes(ratio)) {
        setVisualStyle('');
      }
    }
  };

  const handleGenerate = () => {
    job.submit({
      voiceMode: 'tts',
      scriptText:      scriptText.trim()      || undefined,
      avatarId:        avatarId.trim()         || undefined,
      voiceId:         voiceId.trim()          || undefined,
      productImageUrl: productImageUrl.trim()  || undefined,
      visualStyle:     visualStyle.trim()      || undefined,
      aspectRatio,
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
    setAspectRatio('9:16');
    setPickedImageUri(null);
    setUploadError(null);
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
                Upload a product image or paste a URL (optional).
              </Text>

              {/* Upload button */}
              <TouchableOpacity
                style={s.uploadBtn}
                onPress={handlePickImage}
                disabled={uploadingImage}
                activeOpacity={0.7}
              >
                {uploadingImage ? (
                  <ActivityIndicator size="small" color={BRAND} />
                ) : (
                  <Text style={s.uploadBtnText}>Choose from Camera Roll</Text>
                )}
              </TouchableOpacity>

              {/* Upload error */}
              {uploadError && (
                <Text style={s.uploadError}>{uploadError}</Text>
              )}

              {/* Image preview */}
              {(pickedImageUri || productImageUrl) && (
                <View style={s.previewContainer}>
                  <Image
                    source={{ uri: pickedImageUri || productImageUrl }}
                    style={s.productPreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={s.removeBtn}
                    onPress={() => {
                      setPickedImageUri(null);
                      setProductImageUrl('');
                    }}
                  >
                    <Text style={s.removeBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Divider */}
              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>OR</Text>
                <View style={s.dividerLine} />
              </View>

              {/* URL input */}
              <TextInput
                style={s.input}
                placeholder="https://..."
                placeholderTextColor="#666"
                value={productImageUrl}
                onChangeText={(text) => {
                  setProductImageUrl(text);
                  setPickedImageUri(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </ScrollView>
          )}

          {/* ─── Step 3: Visual Style ─── */}
          {step === 3 && (
            <View style={s.stepFlex}>
              {/* Aspect ratio toggle */}
              <View style={s.ratioRow}>
                <TouchableOpacity
                  style={[s.ratioBtn, aspectRatio === '9:16' && s.ratioBtnActive]}
                  onPress={() => handleAspectRatioChange('9:16')}
                >
                  <View style={[s.ratioIcon, s.ratioPortrait, aspectRatio === '9:16' && s.ratioIconActive]} />
                  <Text style={[s.ratioLabel, aspectRatio === '9:16' && s.ratioLabelActive]}>Portrait</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.ratioBtn, aspectRatio === '16:9' && s.ratioBtnActive]}
                  onPress={() => handleAspectRatioChange('16:9')}
                >
                  <View style={[s.ratioIcon, s.ratioLandscape, aspectRatio === '16:9' && s.ratioIconActive]} />
                  <Text style={[s.ratioLabel, aspectRatio === '16:9' && s.ratioLabelActive]}>Landscape</Text>
                </TouchableOpacity>
              </View>

              <FlatList
                data={VISUAL_STYLES.filter((st) => st.ratios.includes(aspectRatio))}
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

  // ─── Aspect ratio toggle ───
  ratioRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 14,
  },
  ratioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 10, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD,
  },
  ratioBtnActive: { borderColor: BRAND, backgroundColor: '#1a1a2e' },
  ratioIcon: {
    borderRadius: 3, borderWidth: 2, borderColor: '#666',
  },
  ratioIconActive: { borderColor: BRAND },
  ratioPortrait: { width: 14, height: 22 },
  ratioLandscape: { width: 22, height: 14 },
  ratioLabel: { color: '#999', fontSize: 15, fontWeight: '600' },
  ratioLabelActive: { color: '#fff' },

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

  // ─── Product upload ───
  uploadBtn: {
    backgroundColor: CARD, borderRadius: 12,
    borderWidth: 1, borderColor: BRAND, borderStyle: 'dashed' as const,
    paddingVertical: 16, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  uploadBtnText: { color: BRAND, fontSize: 17, fontWeight: '600' },
  uploadError: {
    color: '#F87171', fontSize: 14, textAlign: 'center', marginBottom: 8,
  },
  previewContainer: { alignItems: 'center', marginBottom: 12 },
  productPreview: {
    width: 160, height: 160, borderRadius: 12,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  removeBtn: {
    marginTop: 8, paddingVertical: 6, paddingHorizontal: 16,
    borderRadius: 8, borderWidth: 1, borderColor: '#666',
  },
  removeBtnText: { color: '#999', fontSize: 14 },
  dividerRow: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: {
    color: '#666', fontSize: 14, fontWeight: '600', marginHorizontal: 12,
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
