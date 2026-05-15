import { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { COLORS, FONTS } from '@/constants';

interface TextFieldProps {
  label?: string;
  value: string;
  onChangeText?: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  readOnly?: boolean;
  multiline?: boolean;
  suffix?: string;
  hint?: string;
  autoFocus?: boolean;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  readOnly = false,
  multiline = false,
  suffix,
  hint,
  autoFocus,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ marginBottom: 12 }}>
      {label ? (
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
      ) : null}
      <View
        style={{
          position: 'relative',
          backgroundColor: readOnly ? COLORS.bgTertiary : COLORS.bgSecondary,
          borderWidth: 1,
          borderColor: focused ? COLORS.accent : COLORS.borderColor,
          borderRadius: 10,
          shadowColor: COLORS.accent,
          shadowOpacity: focused ? 0.1 : 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
        }}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textTertiary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          editable={!readOnly}
          multiline={multiline}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            {
              paddingHorizontal: 12,
              paddingVertical: 10,
              fontSize: 15,
              fontFamily: FONTS.sansMedium,
              color: readOnly ? COLORS.textSecondary : COLORS.textPrimary,
              minHeight: 42,
            },
            multiline ? { minHeight: 84, textAlignVertical: 'top' as const, paddingTop: 10 } : null,
            suffix ? { paddingRight: 56 } : null,
          ]}
        />
        {suffix ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: 12,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.sansSemibold,
                fontSize: 13,
                color: COLORS.textTertiary,
              }}
            >
              {suffix}
            </Text>
          </View>
        ) : null}
      </View>
      {hint ? (
        <Text
          style={{
            fontFamily: FONTS.sansMedium,
            fontSize: 12,
            color: COLORS.textSecondary,
            marginTop: 6,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
