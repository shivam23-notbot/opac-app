import { View, Text } from 'react-native';
import type { PolymerType } from '@/types';
import { COLORS, FONTS } from '@/constants';

const POLYMER_COLORS: Record<PolymerType, string> = {
  HDPE: COLORS.polymerHDPE,
  PP: COLORS.polymerPP,
  LDPE: COLORS.polymerLDPE,
};

export function polymerColor(type: PolymerType): string {
  return POLYMER_COLORS[type];
}

interface PolymerBadgeProps {
  type: PolymerType;
  size?: 'sm' | 'md';
}

export function PolymerBadge({ type, size = 'sm' }: PolymerBadgeProps) {
  const color = POLYMER_COLORS[type];
  const isSm = size === 'sm';
  return (
    <View
      style={{
        paddingVertical: isSm ? 2 : 3,
        paddingHorizontal: isSm ? 8 : 10,
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
          fontSize: isSm ? 10 : 11,
          letterSpacing: 1,
        }}
      >
        {type}
      </Text>
    </View>
  );
}
