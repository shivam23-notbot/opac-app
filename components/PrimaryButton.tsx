import { useState } from 'react';
import { Pressable, Text, ActivityIndicator, Platform, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FONTS } from '@/constants';

type Size = 'sm' | 'md' | 'lg';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: Size;
  icon?: React.ReactNode;
}

const HEIGHTS: Record<Size, number> = { sm: 38, md: 46, lg: 52 };
const FONT_SIZES: Record<Size, number> = { sm: 13, md: 14, lg: 15 };

const ACCENT = '#D97757';
const ACCENT_PRESSED = '#C36548';
const DISABLED_BG = '#f4f2ea';
const DISABLED_FG = '#8e8b82';

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  size = 'md',
  icon,
}: PrimaryButtonProps) {
  const [pressed, setPressed] = useState(false);

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const isDisabled = disabled || loading;
  const height = HEIGHTS[size];
  const fontSize = FONT_SIZES[size];

  const bg = isDisabled ? DISABLED_BG : pressed ? ACCENT_PRESSED : ACCENT;
  const fg = isDisabled ? DISABLED_FG : '#ffffff';

  return (
    <View
      style={{
        height,
        width: '100%',
        borderRadius: 12,
        backgroundColor: bg,
        overflow: 'hidden',
        shadowColor: '#1f1e1c',
        shadowOpacity: isDisabled ? 0 : 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: isDisabled ? 0 : 4,
      }}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={isDisabled}
        android_ripple={{ color: ACCENT_PRESSED }}
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
        }}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
            <Text
              style={{
                color: fg,
                fontFamily: FONTS.sansBold,
                fontSize,
                letterSpacing: 0.4,
              }}
            >
              {label}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
