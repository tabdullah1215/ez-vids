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
  Switch,
} from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useVideoJob } from '@/src/hooks/useVideoJob';
import { EZVIDS_DEFAULTS } from '@/src/config/defaults';
import { api } from '@/src/api/client';
import Animated, {
  SlideInRight, SlideInLeft, SlideOutLeft, SlideOutRight,
  useSharedValue, useAnimatedStyle, withSequence, withTiming,
} from 'react-native-reanimated';
import { AppHeader } from '@/src/components/AppHeader';
import { createThemedStyles, useTheme } from '@/src/theme';
import type { PickerItem } from '@/src/components/PickerModal';

// ─── Visual Styles (from Creatify lipsyncs_v2 API) ───────────
type AspectRatio = '9:16' | '16:9';

const STYLE_IMG = 'https://dpbavq092lwjh.cloudfront.net/visual_styles';

const VISUAL_STYLES = [
  { id: 'FullAvatar', name: 'Full Avatar', desc: 'Full-screen avatar presentation', ratios: ['9:16', '16:9'] as AspectRatio[], img: `${STYLE_IMG}/FullAvatar.png` },
  { id: 'GreenScreenEffect', name: 'Green Screen', desc: 'Avatar on custom background', ratios: ['9:16', '16:9'] as AspectRatio[], img: `${STYLE_IMG}/GreenScreenEffect.png` },
  { id: 'FullAvatarScreenProductOverlay', name: 'Avatar + Product', desc: 'Avatar with product overlay', ratios: ['9:16', '16:9'] as AspectRatio[], img: `${STYLE_IMG}/FullAvatarScreenProductOverlay.png` },
  { id: 'UpAndDown', name: 'Up & Down', desc: 'Avatar above, product below', ratios: ['9:16'] as AspectRatio[], img: `${STYLE_IMG}/UpAndDown.png` },
  { id: 'SideBySide', name: 'Side by Side', desc: 'Avatar and product side by side', ratios: ['16:9'] as AspectRatio[], img: `${STYLE_IMG}/SideBySide.png` },
  { id: 'FullProduct', name: 'Full Product', desc: 'Full-screen product showcase', ratios: ['9:16', '16:9'] as AspectRatio[], img: `${STYLE_IMG}/FullProduct.png` },
  { id: 'MagnifyingGlassCircle', name: 'Magnifying Glass', desc: 'Product in magnifying glass circle', ratios: ['9:16', '16:9'] as AspectRatio[], img: `${STYLE_IMG}/MagnifyingGlassCircle.png` },
  { id: 'ReverseMagnifyingGlassCircle', name: 'Reverse Glass', desc: 'Avatar in magnifying glass circle', ratios: ['9:16', '16:9'] as AspectRatio[], img: `${STYLE_IMG}/ReverseMagnifyingGlassCircle.png` },
  { id: 'TwitterFrame', name: 'Twitter Frame', desc: 'Social media frame layout', ratios: ['9:16', '16:9'] as AspectRatio[], img: `${STYLE_IMG}/TwitterFrame.png` },
  { id: 'DramaticFullProduct', name: 'Dramatic Product', desc: 'Dramatic full-screen product', ratios: ['9:16'] as AspectRatio[], img: `${STYLE_IMG}/DramaticFullProduct.png` },
  { id: 'Dramatic', name: 'Dramatic', desc: 'Dramatic avatar presentation', ratios: ['9:16'] as AspectRatio[], img: `${STYLE_IMG}/Dramatic.png` },
  { id: 'Vanilla', name: 'Vanilla', desc: 'Clean, simple layout', ratios: ['9:16', '16:9'] as AspectRatio[], img: `${STYLE_IMG}/Vanilla.png` },
  { id: 'Vlog', name: 'Vlog', desc: 'Vlog-style vertical layout', ratios: ['9:16'] as AspectRatio[], img: `${STYLE_IMG}/Vlog.png` },
] as const;

// ─── Constants ───────────────────────────────────────────────
const STEPS = ['voice over', 'avatar', 'product', 'style'] as const;
const STEP_COUNT = STEPS.length;

// ─── Main Component ─────────────────────────────────────────
export default function GenerateScreen() {
  const s = useStyles();
  const { colors } = useTheme();

  // --- Wizard step ---
  const [step, setStep] = useState(0);
  const directionRef = useRef<'forward' | 'back'>('forward');

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
  const [testMode, setTestMode] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pickedImageUri, setPickedImageUri] = useState<string | null>(null);
  const [highlightedStyleId, setHighlightedStyleId] = useState<string | null>(null);

  // --- Segment toggle for step 1 ---
  const [avatarSegment, setAvatarSegment] = useState<'avatar' | 'voice'>('avatar');

  // --- Flash animation for missing avatar/voice ---
  const avatarFlash = useSharedValue(0);
  const voiceFlash = useSharedValue(0);
  const avatarFlashStyle = useAnimatedStyle(() => ({ opacity: avatarFlash.value }));
  const voiceFlashStyle = useAnimatedStyle(() => ({ opacity: voiceFlash.value }));

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
      setAvatarSegment('avatar');
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

  const flashStyleTiles = useCallback(() => {
    const visibleIds = VISUAL_STYLES
      .filter((st) => st.ratios.includes(aspectRatio))
      .map((st) => st.id);
    // Shuffle
    for (let i = visibleIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [visibleIds[i], visibleIds[j]] = [visibleIds[j], visibleIds[i]];
    }
    visibleIds.forEach((id, i) => {
      setTimeout(() => setHighlightedStyleId(id), i * 80);
    });
    setTimeout(() => setHighlightedStyleId(null), visibleIds.length * 80);
  }, [aspectRatio]);

  const TEST_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

  const handleGenerate = () => {
    if (!visualStyle) {
      flashStyleTiles();
      return;
    }
    if (testMode) {
      job.mockComplete(TEST_VIDEO_URL);
      return;
    }
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
    const highlighted = item.id === highlightedStyleId;
    return (
      <TouchableOpacity
        style={[s.templateCard, selected && s.templateCardSelected, highlighted && s.templateCardHighlighted]}
        onPress={() => setVisualStyle(item.id)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: item.img }}
          style={s.templateThumb}
          resizeMode="contain"
        />
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
          <ActivityIndicator size="large" color={colors.brand} />
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
      <AppHeader subtitle={showWizard ? 'GENERATE VIDEO' : undefined}>
        {showWizard && (
          <>
            <Text style={s.stepTitle}>{'· ' + STEPS[step] + ' ·'}</Text>
            <View style={s.stepsRow}>
              {STEPS.map((_, i) => {
                const done = i < step;
                const active = i === step;
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <View style={[s.stepLine, (done || active) && s.stepLineDone]} />}
                    <View style={[s.stepCircle, active && s.stepCircleActive, done && s.stepCircleDone]}>
                      <Text style={[s.stepNum, (active || done) && s.stepNumActive]}>
                        {i + 1}
                      </Text>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>
          </>
        )}
      </AppHeader>

      {/* ═══ WIZARD STEPS ═══ */}
      {showWizard && (
        <>
          {/* ─── Step 0: Voice Over (Script) ─── */}
          {step === 0 && (
            <Animated.View
              key="step0"
              entering={directionRef.current === 'forward' ? SlideInRight.duration(250) : SlideInLeft.duration(250)}
              exiting={directionRef.current === 'forward' ? SlideOutLeft.duration(250) : SlideOutRight.duration(250)}
              style={s.stepContent}
            >
            <ScrollView contentContainerStyle={s.stepScroll}>
              <Text style={s.stepHint}>
                Write your script or leave empty for a default.
              </Text>
              <TextInput
                style={s.textArea}
                multiline
                numberOfLines={6}
                placeholder={EZVIDS_DEFAULTS.scriptText}
                placeholderTextColor={colors.textDisabled}
                value={scriptText}
                onChangeText={setScriptText}
              />

              {/* Test mode toggle */}
              <View style={s.testRow}>
                <Text style={s.testLabel}>Test mode</Text>
                <Switch
                  value={testMode}
                  onValueChange={setTestMode}
                  trackColor={{ false: colors.switchTrackOff, true: colors.brand }}
                  thumbColor={testMode ? colors.textPrimary : colors.textFaint}
                />
              </View>
              {testMode && (
                <Text style={s.testHint}>
                  Skips Creatify API — returns a sample video instantly.
                </Text>
              )}
            </ScrollView>
            </Animated.View>
          )}

          {/* ─── Step 1: Avatar + Voice (segment toggle) ─── */}
          {step === 1 && (
            <Animated.View
              key="step1"
              entering={directionRef.current === 'forward' ? SlideInRight.duration(250) : SlideInLeft.duration(250)}
              exiting={directionRef.current === 'forward' ? SlideOutLeft.duration(250) : SlideOutRight.duration(250)}
              style={s.stepFlex}
            >
              {/* Segment toggle */}
              <View style={s.segmentRow}>
                <View style={[s.segmentBtn, avatarSegment === 'avatar' && s.segmentBtnActive]}>
                  <Animated.View style={[s.flashOverlay, avatarFlashStyle]} pointerEvents="none" />
                  <TouchableOpacity
                    style={s.segmentBtnInner}
                    onPress={() => setAvatarSegment('avatar')}
                  >
                    <Text style={[s.segmentText, avatarSegment === 'avatar' && s.segmentTextActive]}>
                      Avatar
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={[s.segmentBtn, avatarSegment === 'voice' && s.segmentBtnActive]}>
                  <Animated.View style={[s.flashOverlay, voiceFlashStyle]} pointerEvents="none" />
                  <TouchableOpacity
                    style={s.segmentBtnInner}
                    onPress={() => setAvatarSegment('voice')}
                  >
                    <Text style={[s.segmentText, avatarSegment === 'voice' && s.segmentTextActive]}>
                      Voice
                    </Text>
                  </TouchableOpacity>
                </View>
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
            </Animated.View>
          )}

          {/* ─── Step 2: Product ─── */}
          {step === 2 && (
            <Animated.View
              key="step2"
              entering={directionRef.current === 'forward' ? SlideInRight.duration(250) : SlideInLeft.duration(250)}
              exiting={directionRef.current === 'forward' ? SlideOutLeft.duration(250) : SlideOutRight.duration(250)}
              style={s.stepContent}
            >
            <ScrollView contentContainerStyle={s.stepScroll}>
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
                  <ActivityIndicator size="small" color={colors.brand} />
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
                placeholderTextColor={colors.textDisabled}
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
            </Animated.View>
          )}

          {/* ─── Step 3: Visual Style ─── */}
          {step === 3 && (
            <Animated.View
              key="step3"
              entering={directionRef.current === 'forward' ? SlideInRight.duration(250) : SlideInLeft.duration(250)}
              exiting={directionRef.current === 'forward' ? SlideOutLeft.duration(250) : SlideOutRight.duration(250)}
              style={s.stepFlex}
            >
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
            </Animated.View>
          )}

          {/* ─── Footer Nav ─── */}
          <View style={s.footer}>
            {step > 0 ? (
              <TouchableOpacity style={s.backBtn} onPress={() => { directionRef.current = 'back'; setStep(step - 1); }}>
                <Text style={s.backBtnText}>{'‹  Back'}</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            {step < STEP_COUNT - 1 ? (
              <TouchableOpacity style={s.nextBtn} onPress={() => {
                if (step === 1) {
                  const needAvatar = !avatarId;
                  const needVoice = !voiceId;
                  if (needAvatar || needVoice) {
                    const flash = (sv: typeof avatarFlash) => {
                      sv.value = withSequence(
                        withTiming(1, { duration: 120 }),
                        withTiming(0, { duration: 120 }),
                        withTiming(1, { duration: 120 }),
                        withTiming(0, { duration: 120 }),
                      );
                    };
                    if (needAvatar) flash(avatarFlash);
                    if (needVoice) flash(voiceFlash);
                    return;
                  }
                }
                directionRef.current = 'forward';
                setStep(step + 1);
              }}>
                <Text style={s.nextBtnText}>{'Next  ›'}</Text>
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
          <ActivityIndicator size="large" color={colors.brand} />
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
            <Text style={s.secondaryBtnText}>Make Another</Text>
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

const useStyles = createThemedStyles((c) => ({
  container: { flex: 1, backgroundColor: c.bg, paddingTop: 56 },

  // ─── Wizard header extras ───
  stepTitle: {
    fontSize: 19, color: c.brand, fontWeight: '400' as const,
    textAlign: 'center' as const,
    backgroundColor: c.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderRadius: 20,
    overflow: 'hidden' as const,
  },
  stepsRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    marginTop: 6,
  },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: c.textMuted,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  stepCircleActive: {
    borderColor: c.brand, backgroundColor: c.brand,
  },
  stepCircleDone: {
    borderColor: c.brand,
  },
  stepNum: {
    fontSize: 14, fontWeight: '700' as const, color: c.textMuted,
  },
  stepNumActive: {
    color: c.textPrimary,
    textShadowColor: c.brand,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  stepLine: {
    width: 24, height: 2, backgroundColor: c.textMuted,
  },
  stepLineDone: { backgroundColor: c.brand },

  // ─── Step content ───
  stepContent: { flex: 1 },
  stepScroll: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 20 },
  stepFlex: { flex: 1 },
  stepHint: {
    color: c.textMuted, fontSize: 15, marginBottom: 16,
    textAlign: 'center' as const,
  },

  // ─── Segment toggle ───
  segmentRow: {
    flexDirection: 'row' as const, marginHorizontal: 20, marginTop: 16, marginBottom: 12,
    backgroundColor: c.surface, borderRadius: 10, padding: 3,
    borderWidth: 1, borderColor: c.border,
  },
  segmentBtn: {
    flex: 1, borderRadius: 8,
    overflow: 'hidden' as const,
  },
  segmentBtnInner: {
    paddingVertical: 10,
    alignItems: 'center' as const,
  },
  segmentBtnActive: { backgroundColor: c.brand },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.error,
    borderRadius: 8,
  },
  segmentText: { color: c.textInactive, fontSize: 16, fontWeight: '600' as const },
  segmentTextActive: { color: c.textPrimary },

  // ─── Selection summary ───
  selectionSummary: {
    flexDirection: 'row' as const, gap: 16, justifyContent: 'center' as const,
    paddingHorizontal: 20, paddingBottom: 8,
  },
  selectionText: { color: c.textTertiary, fontSize: 14 },

  // ─── Lists ───
  listPad: { paddingBottom: 8 },
  listCenter: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 40 },
  listHint: { color: c.textMuted, marginTop: 12, fontSize: 16 },
  separator: { height: 1, backgroundColor: c.border, marginHorizontal: 20 },

  // ─── List rows (shared with avatar + voice) ───
  row: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    paddingVertical: 14, paddingRight: 20, paddingLeft: 16,
    backgroundColor: c.bg,
  },
  rowSelected: { backgroundColor: c.surface },
  accentBar: {
    width: 3, alignSelf: 'stretch' as const, borderRadius: 2,
    marginRight: 12, backgroundColor: c.transparent,
  },
  accentBarActive: { backgroundColor: c.brand },
  thumb: {
    width: 44, height: 44, borderRadius: 22,
    marginRight: 12, backgroundColor: c.surface,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 17, color: c.textSecondary },
  rowLabelSelected: { color: c.textPrimary, fontWeight: '600' as const },
  rowSublabel: { fontSize: 14, color: c.textMuted, marginTop: 2 },
  rowSublabelSelected: { color: c.textTertiary },
  actionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    alignItems: 'center' as const, justifyContent: 'center' as const, marginLeft: 8,
  },
  actionBtnSelected: { borderColor: c.brand },
  playIcon: { color: c.brand, fontSize: 18, fontWeight: '900' as const },
  zoomIcon: { color: c.brand, fontSize: 20 },

  // ─── Aspect ratio toggle ───
  ratioRow: {
    flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 12,
    marginHorizontal: 20, marginTop: 16, marginBottom: 14,
  },
  ratioBtn: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8,
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 10, borderWidth: 1, borderColor: c.border,
    backgroundColor: c.surface,
  },
  ratioBtnActive: { borderColor: c.brand, backgroundColor: c.surfaceBrandTint },
  ratioIcon: {
    borderRadius: 3, borderWidth: 2, borderColor: c.borderMuted,
  },
  ratioIconActive: { borderColor: c.brand },
  ratioPortrait: { width: 14, height: 22 },
  ratioLandscape: { width: 22, height: 14 },
  ratioLabel: { color: c.textMuted, fontSize: 15, fontWeight: '600' as const },
  ratioLabelActive: { color: c.textPrimary },

  // ─── Template grid ───
  templateRow: { gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  templateCard: {
    flex: 1, backgroundColor: c.surface, borderRadius: 12,
    borderWidth: 1, borderColor: c.border, overflow: 'hidden' as const,
  },
  templateCardSelected: { borderColor: c.brand, borderWidth: 2 },
  templateCardHighlighted: { borderColor: c.brand, borderWidth: 2 },
  templateThumb: {
    width: '100%' as const, aspectRatio: 1,
    backgroundColor: c.surfaceAlt,
  },
  templateName: {
    color: c.textSecondary, fontSize: 15, fontWeight: '600' as const,
    paddingHorizontal: 10, paddingTop: 8,
  },
  templateNameSelected: { color: c.textPrimary },
  templateDesc: {
    color: c.textMuted, fontSize: 13, lineHeight: 17,
    paddingHorizontal: 10, paddingTop: 4, paddingBottom: 10,
  },

  // ─── Form inputs ───
  input: {
    backgroundColor: c.surface, borderRadius: 10, padding: 14,
    color: c.textPrimary, fontSize: 17, borderWidth: 1, borderColor: c.border,
  },
  textArea: {
    backgroundColor: c.surface, borderRadius: 10, padding: 14,
    color: c.textPrimary, fontSize: 17, borderWidth: 1, borderColor: c.border,
    minHeight: 140, textAlignVertical: 'top' as const,
  },

  // ─── Test mode ───
  testRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    marginTop: 24, paddingVertical: 8,
  },
  testLabel: { color: c.textFaint, fontSize: 15 },
  testHint: {
    color: c.textDisabled, fontSize: 13, marginTop: 4, fontStyle: 'italic' as const,
  },

  // ─── Product upload ───
  uploadBtn: {
    backgroundColor: c.surface, borderRadius: 12,
    borderWidth: 1, borderColor: c.brand, borderStyle: 'dashed' as const,
    paddingVertical: 16, alignItems: 'center' as const, justifyContent: 'center' as const,
    marginBottom: 12,
  },
  uploadBtnText: { color: c.brand, fontSize: 17, fontWeight: '600' as const },
  uploadError: {
    color: c.errorText, fontSize: 14, textAlign: 'center' as const, marginBottom: 8,
  },
  previewContainer: { alignItems: 'center' as const, marginBottom: 12 },
  productPreview: {
    width: 160, height: 160, borderRadius: 12,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
  },
  removeBtn: {
    marginTop: 8, paddingVertical: 6, paddingHorizontal: 16,
    borderRadius: 8, borderWidth: 1, borderColor: c.borderMuted,
  },
  removeBtnText: { color: c.textMuted, fontSize: 14 },
  dividerRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: c.border },
  dividerText: {
    color: c.textDisabled, fontSize: 14, fontWeight: '600' as const, marginHorizontal: 12,
  },

  // ─── Footer nav ───
  footer: {
    flexDirection: 'row' as const, justifyContent: 'space-between' as const,
    alignItems: 'center' as const, paddingHorizontal: 20,
    paddingVertical: 16, borderTopWidth: 1, borderColor: c.border,
  },
  backBtn: {
    paddingVertical: 12, paddingHorizontal: 28,
    borderWidth: 1, borderColor: c.borderMuted, borderRadius: 12,
  },
  backBtnText: { color: c.textTertiary, fontSize: 17, fontWeight: '600' as const },
  nextBtn: {
    backgroundColor: c.brand, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  nextBtnText: { color: c.textPrimary, fontSize: 17, fontWeight: '600' as const },
  generateBtn: {
    backgroundColor: c.brand, borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 24,
  },
  generateBtnText: { color: c.textPrimary, fontSize: 18, fontWeight: '700' as const },

  // ─── Loading / Success / Error ───
  center: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 20 },
  bigEmoji: { fontSize: 56, marginBottom: 8 },
  statusTitle: { fontSize: 24, fontWeight: '700' as const, color: c.textPrimary, marginTop: 16 },
  statusLabel: { fontSize: 16, color: c.textTertiary, marginTop: 8 },
  statusHint: { fontSize: 15, color: c.textMuted, marginTop: 16, textAlign: 'center' as const },
  elapsed: { fontSize: 40, fontWeight: '200' as const, color: c.brand, marginTop: 16 },
  mono: { fontSize: 13, color: c.textFaint, marginTop: 20, fontFamily: 'monospace' },
  primaryBtn: {
    backgroundColor: c.brand, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 36, marginTop: 24,
  },
  primaryBtnText: { color: c.textPrimary, fontSize: 19, fontWeight: '600' as const },
  secondaryBtn: {
    borderWidth: 1, borderColor: c.borderMuted, borderRadius: 10,
    paddingVertical: 12, paddingHorizontal: 28, marginTop: 20,
  },
  secondaryBtnText: { color: c.textTertiary, fontSize: 17 },
  urlText: {
    fontSize: 13, color: c.textFaint, marginTop: 12,
    textAlign: 'center' as const, paddingHorizontal: 24,
  },
  errorText: {
    color: c.errorText, fontSize: 16, marginTop: 12,
    textAlign: 'center' as const, paddingHorizontal: 24, lineHeight: 22,
  },

  // ─── Zoom preview ───
  previewBackdrop: {
    flex: 1, backgroundColor: c.overlayHeavy,
    alignItems: 'center' as const, justifyContent: 'center' as const, padding: 32,
  },
  previewImage: { width: '100%' as const, aspectRatio: 1, borderRadius: 16 },
  previewCaption: {
    color: c.textPrimary, fontSize: 18, fontWeight: '600' as const,
    marginTop: 16, textAlign: 'center' as const,
  },
}));
