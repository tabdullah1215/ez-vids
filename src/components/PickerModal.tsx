import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

export interface PickerItem {
  id: string;
  label: string;
  sublabel?: string;
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
  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        style={s.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sheet */}
      <SafeAreaView style={s.sheet}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
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
            <TouchableOpacity style={s.retryBtn} onPress={onClose}>
              <Text style={s.retryText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            ItemSeparatorComponent={() => <View style={s.separator} />}
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              return (
                <TouchableOpacity
                  style={[s.row, selected && s.rowSelected]}
                  onPress={() => handleSelect(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={s.rowText}>
                    <Text style={[s.rowLabel, selected && s.rowLabelSelected]}>
                      {item.label}
                    </Text>
                    {item.sublabel ? (
                      <Text style={s.rowSublabel}>{item.sublabel}</Text>
                    ) : null}
                  </View>
                  {selected && <Text style={s.check}>✓</Text>}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </SafeAreaView>
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
    paddingHorizontal: 20,
    backgroundColor: BG,
  },
  rowSelected: {
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
  check: {
    fontSize: 16,
    color: BRAND,
    fontWeight: '700',
    marginLeft: 12,
  },
});
