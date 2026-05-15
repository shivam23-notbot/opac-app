import { View, Text } from 'react-native';
import { FONTS } from '@/constants';

interface BadgeProps {
  label: string;
  color: string;
}

export function Badge({ label, color }: BadgeProps) {
  return (
    <View
      style={{
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: color + '1a',
        borderWidth: 1,
        borderColor: color + '33',
        alignSelf: 'flex-start',
      }}
    >
      <Text
        style={{
          color,
          fontFamily: FONTS.sansExtraBold,
          fontSize: 10,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
