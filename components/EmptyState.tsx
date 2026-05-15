import { View, Text } from 'react-native';
import { COLORS, FONTS } from '@/constants';

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  hint?: string;
}

export function EmptyState({ icon, message, hint }: EmptyStateProps) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        paddingHorizontal: 24,
      }}
    >
      {icon ? <View style={{ marginBottom: 8, opacity: 0.7 }}>{icon}</View> : null}
      <Text
        style={{
          color: COLORS.textSecondary,
          fontFamily: FONTS.sansSemibold,
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
      {hint ? (
        <Text
          style={{
            color: COLORS.textTertiary,
            fontFamily: FONTS.sansMedium,
            fontSize: 12,
            textAlign: 'center',
            marginTop: 4,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
