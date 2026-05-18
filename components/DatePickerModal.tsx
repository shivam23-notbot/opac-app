import { useState, useEffect } from 'react';
import { View, Text, Modal, Pressable, TextInput } from 'react-native';
import { COLORS, FONTS } from '@/constants';

interface DatePickerModalProps {
  visible: boolean;
  value: string;
  label: string;
  maxDate?: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
}

export function DatePickerModal({
  visible,
  value,
  label,
  maxDate,
  onConfirm,
  onClose,
}: DatePickerModalProps) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  const isFormatValid =
    /^\d{4}-\d{2}-\d{2}$/.test(text) && !isNaN(Date.parse(text + 'T00:00:00'));
  const isValid = isFormatValid && (!maxDate || text <= maxDate);

  const handleConfirm = () => {
    if (isValid) {
      onConfirm(text);
      onClose();
    }
  };

  const shift = (days: number) => {
    const src = text || value;
    const [y, m, day] = src.split('-').map(Number);
    const d = new Date(y, m - 1, day + days);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!maxDate || next <= maxDate) setText(next);
  };

  const errorMsg = !isFormatValid && text.length > 0
    ? 'Use YYYY-MM-DD format'
    : isFormatValid && maxDate && text > maxDate
    ? `Date cannot be after ${maxDate}`
    : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.35)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: COLORS.bgSecondary,
            borderRadius: 16,
            padding: 24,
            width: 300,
            borderWidth: 1,
            borderColor: COLORS.borderColor,
          }}
        >
          <Text
            style={{
              color: COLORS.textTertiary,
              fontFamily: FONTS.sansBold,
              fontSize: 10,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            {label}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Pressable
              onPress={() => shift(-1)}
              style={{
                backgroundColor: COLORS.bgTertiary,
                borderRadius: 8,
                padding: 10,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
              }}
            >
              <Text style={{ color: COLORS.textPrimary, fontSize: 18, lineHeight: 18 }}>‹</Text>
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textTertiary}
              style={{
                flex: 1,
                backgroundColor: COLORS.bgTertiary,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isValid || text.length === 0 ? COLORS.borderColor : COLORS.error,
                color: COLORS.textPrimary,
                fontFamily: FONTS.sansMedium,
                fontSize: 15,
                padding: 10,
                textAlign: 'center',
              }}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <Pressable
              onPress={() => shift(1)}
              style={{
                backgroundColor: COLORS.bgTertiary,
                borderRadius: 8,
                padding: 10,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
              }}
            >
              <Text style={{ color: COLORS.textPrimary, fontSize: 18, lineHeight: 18 }}>›</Text>
            </Pressable>
          </View>

          {errorMsg && (
            <Text
              style={{
                color: COLORS.error,
                fontFamily: FONTS.sansMedium,
                fontSize: 11,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              {errorMsg}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: COLORS.textSecondary, fontFamily: FONTS.sansBold }}>
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 10,
                backgroundColor: isValid ? COLORS.accent : COLORS.bgTertiary,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: isValid ? '#fff' : COLORS.textTertiary,
                  fontFamily: FONTS.sansBold,
                }}
              >
                Set Date
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
