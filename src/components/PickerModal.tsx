import React, { useCallback, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Audio } from 'expo-av';

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
            <ActivityIndicator size="large" color={BRAND} />
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
              if (!selectedId) return;
              const idx = items.findIndex((i) => i.id === selectedId);
              if (idx > 0) {
                setTimeout(() => {
                  listRef.current?.scrollToIndex({ index: idx, animated: false, viewPosition: 0.3 });
                }, 100);
              }
            }}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => {
                listRef.current?.scrollToIndex({ index: info.index, animated: false, viewPosition: 0.3 });
              }, 200);
            }}
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={[s.row, selected && s.rowSelected]}
                  onPress={() => handleSelect(item.id)}
                  activeOpacity={0.7}
                >
                  {/* Selection indicator — left accent bar */}
                  <View style={[s.accentBar, selected && s.accentBarActive]} />

                  {/* Avatar thumbnail */}
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

                  {/* Audio preview button */}
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

                  {/* Zoom preview button */}
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

const BRAND = '#6366F1';
const BG = '#0A0A0A';
const CARD = '#141414';
const BORDER = '#262626';

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '60%',
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  done: {
    fontSize: 15,
    color: BRAND,
    fontWeight: '600',
  },
  center: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  hint: {
    color: '#555',
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
  },
  retryText: {
    color: '#888',
    fontSize: 14,
  },
  list: {
    paddingVertical: 8,
  },
  separator: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingRight: 20,
    paddingLeft: 16,
    backgroundColor: BG,
  },
  rowSelected: {
    backgroundColor: CARD,
  },
  accentBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 12,
    backgroundColor: 'transparent',
  },
  accentBarActive: {
    backgroundColor: BRAND,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: CARD,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    color: '#ccc',
  },
  rowLabelSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  rowSublabel: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },
  rowSublabelSelected: {
    color: '#888',
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  actionBtnSelected: {
    borderColor: BRAND,
  },
  playIcon: {
    color: BRAND,
    fontSize: 18,
    fontWeight: '900',
  },
  zoomIcon: {
    color: BRAND,
    fontSize: 20,
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
  },
  previewCaption: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
});
