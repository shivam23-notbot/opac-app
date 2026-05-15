import { Pressable, Text, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants';

interface PillButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}

export function PillButton({ label, selected, onPress, color = COLORS.accent }: PillButtonProps) {
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={{
        flex: 1,
        paddingVertical: 9,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: selected ? color : COLORS.borderColor,
        backgroundColor: selected ? color + '14' : COLORS.bgSecondary,
      }}
      android_ripple={{ color: COLORS.bgTertiary }}
    >
      <Text
        style={{
          fontFamily: FONTS.sansBold,
          fontSize: 12,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: selected ? color : COLORS.textSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
