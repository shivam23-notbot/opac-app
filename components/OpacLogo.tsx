import { View, Text } from 'react-native';
import { COLORS, FONTS } from '@/constants';

interface OpacLogoProps {
  size?: number;
}

export function OpacLogo({ size = 22 }: OpacLogoProps) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          backgroundColor: COLORS.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontFamily: FONTS.serifBold,
            fontSize: size * 0.55,
            lineHeight: size * 0.9,
            letterSpacing: -0.5,
          }}
        >
          O
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text
          style={{
            fontFamily: FONTS.serifBold,
            fontSize: size,
            color: COLORS.textPrimary,
            letterSpacing: -0.5,
          }}
        >
          Opac
        </Text>
        <Text
          style={{
            fontFamily: FONTS.sansSemibold,
            fontSize: size * 0.85,
            color: COLORS.textTertiary,
            marginLeft: 4,
            letterSpacing: 1,
          }}
        >
          OPS
        </Text>
      </View>
    </View>
  );
}
