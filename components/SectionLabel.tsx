import { Text } from 'react-native';
import type { TextStyle, StyleProp } from 'react-native';
import { COLORS, FONTS } from '@/constants';

interface SectionLabelProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export function SectionLabel({ children, style }: SectionLabelProps) {
  return (
    <Text
      style={[
        {
          fontFamily: FONTS.sansBold,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: COLORS.textSecondary,
          marginBottom: 12,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
