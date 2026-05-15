import { View, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { COLORS, FONTS } from '@/constants';

interface TopBarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  subtitle?: string;
}

export function TopBar({ title, showBack = false, onBack, rightSlot, subtitle }: TopBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View
      style={{
        backgroundColor: COLORS.bgSecondary,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderColor,
        paddingTop: Math.max(insets.top, 12) + 8,
        paddingBottom: 12,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {showBack ? (
        <Pressable onPress={handleBack} hitSlop={12} style={{ padding: 4 }}>
          <ChevronLeft size={22} color={COLORS.textSecondary} />
        </Pressable>
      ) : null}

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: FONTS.sansBold,
            fontSize: 11,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: COLORS.textTertiary,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontFamily: FONTS.sansSemibold,
              fontSize: 13,
              color: COLORS.textPrimary,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {rightSlot}
    </View>
  );
}
