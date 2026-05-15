import { Pressable, Text } from 'react-native';
import { COLORS, FONTS } from '@/constants';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export function SecondaryButton({ label, onPress, disabled = false }: SecondaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        borderWidth: 1,
        borderColor: COLORS.borderColor,
        backgroundColor: COLORS.bgSecondary,
        opacity: disabled ? 0.5 : 1,
      }}
      android_ripple={{ color: COLORS.bgTertiary }}
    >
      <Text
        style={{
          color: COLORS.textPrimary,
          fontFamily: FONTS.sansSemibold,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
