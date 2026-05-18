import { View, Text, Pressable, TextInput } from 'react-native';
import { COLORS, FONTS } from '@/constants';

interface InlineDatePickerProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
  maxDate?: string;
}

export function InlineDatePicker({ label, value, onChange, maxDate }: InlineDatePickerProps) {
  const isFormatValid =
    /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value + 'T00:00:00'));
  const isValid = isFormatValid && (!maxDate || value <= maxDate);

  const shift = (days: number) => {
    if (!isFormatValid) return;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d + days);
    const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (!maxDate || next <= maxDate) onChange(next);
  };

  const errorMsg =
    !isFormatValid && value.length > 0
      ? 'Use YYYY-MM-DD format'
      : isFormatValid && maxDate && value > maxDate
        ? `Date cannot be after ${maxDate}`
        : null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontFamily: FONTS.sansBold,
          fontSize: 11,
          letterSpacing: 1,
          textTransform: 'uppercase',
          color: COLORS.textSecondary,
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          onPress={() => shift(-1)}
          style={{
            backgroundColor: COLORS.bgTertiary,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: COLORS.borderColor,
          }}
        >
          <Text style={{ color: COLORS.textPrimary, fontSize: 16, lineHeight: 18 }}>‹</Text>
        </Pressable>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={COLORS.textTertiary}
          style={{
            flex: 1,
            backgroundColor: COLORS.bgTertiary,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: isValid || value.length === 0 ? COLORS.borderColor : COLORS.error,
            color: COLORS.textPrimary,
            fontFamily: FONTS.sansMedium,
            fontSize: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
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
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: COLORS.borderColor,
          }}
        >
          <Text style={{ color: COLORS.textPrimary, fontSize: 16, lineHeight: 18 }}>›</Text>
        </Pressable>
      </View>
      {errorMsg && (
        <Text
          style={{
            color: COLORS.error,
            fontFamily: FONTS.sansMedium,
            fontSize: 11,
            marginTop: 4,
          }}
        >
          {errorMsg}
        </Text>
      )}
    </View>
  );
}
