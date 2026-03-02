import React, { useCallback, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Audio } from 'expo-av';
import { createThemedStyles, useTheme } from '@/src/theme';

export interface PickerItem {
  id: string;
  label: string;
  sublabel?: string;
  imageUrl?: string;
  previewUrl?: string;
}

interface Props {
  visible: boolean;
  title: string;
  items: PickerItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  loading: boolean;
  error: string | null;
}

export function PickerModal({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  loading,
  error,
}: Props) {
  const s = useStyles();
  const { colors } = useTheme();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<PickerItem | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const listRef = useRef<FlatList<PickerItem>>(null);

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

  const handleClose = useCallback(() => {
    stopPlayback();
    onClose();
  }, [onClose, stopPlayback]);

  const handleSelect = useCallback((id: string) => {
    stopPlayback();
    onSelect(id);
    onClose();
  }, [onSelect, onClose, stopPlayback]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={s.backdrop}
        activeOpacity={1}
        onPress={handleClose}
      />

      {/* Sheet */}
      <SafeAreaView style={s.sheet}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={12}>
            <Text style={s.done}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={colors.brand} />
            <Text style={s.hint}>Loading…</Text>
          </View>
        ) : error ? (
          <View style={s.center}>
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={handleClose}>
              <Text style={s.retryText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            onLayout={() => {
              if (!selectedId || !items.length) return;
              const idx = items.findIndex((i) => i.id === selectedId);
              if (idx > 0) {
                setTimeout(() => {
                  listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.3 });
                }, 300);
              }
            }}
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
              setTimeout(() => {
                listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.3 });
              }, 500);
            }}
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={[s.row, selected && s.rowSelected]}
                  onPress={() => handleSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={[s.accentBar, selected && s.accentBarActive]} />

                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={s.thumb} />
                  ) : null}

                  <View style={s.rowText}>
                    <Text style={[s.rowLabel, selected && s.rowLabelSelected]}>
                      {item.label}
                    </Text>
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
            }}
          />
        )}
      </SafeAreaView>

      {/* Enlarged image preview */}
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
    </Modal>
  );
}

const useStyles = createThemedStyles((c) => ({
  backdrop: {
    flex: 1,
    backgroundColor: c.overlayLight,
  },
  sheet: {
    backgroundColor: c.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '60%' as const,
    borderTopWidth: 1,
    borderColor: c.borderSubtle,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: c.borderSubtle,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: c.textPrimary,
  },
  done: {
    fontSize: 15,
    color: c.brand,
    fontWeight: '600' as const,
  },
  center: {
    alignItems: 'center' as const,
    paddingVertical: 40,
  },
  hint: {
    color: c.textDisabled,
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: c.errorText,
    fontSize: 14,
    textAlign: 'center' as const,
    paddingHorizontal: 24,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    borderRadius: 8,
  },
  retryText: {
    color: c.textFaint,
    fontSize: 14,
  },
  list: {
    paddingVertical: 8,
  },
  separator: {
    height: 1,
    backgroundColor: c.borderSubtle,
    marginHorizontal: 20,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    paddingRight: 20,
    paddingLeft: 16,
    backgroundColor: c.bg,
  },
  rowSelected: {
    backgroundColor: c.surface,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch' as const,
    borderRadius: 2,
    marginRight: 12,
    backgroundColor: c.transparent,
  },
  accentBarActive: {
    backgroundColor: c.brand,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: c.surface,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    color: c.textSecondary,
  },
  rowLabelSelected: {
    color: c.textPrimary,
    fontWeight: '600' as const,
  },
  rowSublabel: {
    fontSize: 12,
    color: c.textDisabled,
    marginTop: 2,
  },
  rowSublabelSelected: {
    color: c.textFaint,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 8,
  },
  actionBtnSelected: {
    borderColor: c.brand,
  },
  playIcon: {
    color: c.brand,
    fontSize: 18,
    fontWeight: '900' as const,
  },
  zoomIcon: {
    color: c.brand,
    fontSize: 20,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: c.overlayHeavy,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 32,
  },
  previewImage: {
    width: '100%' as const,
    aspectRatio: 1,
    borderRadius: 16,
  },
  previewCaption: {
    color: c.textPrimary,
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 16,
    textAlign: 'center' as const,
  },
}));
