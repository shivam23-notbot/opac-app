import { useEffect, useRef } from 'react';
import { Text, Platform, Animated, View, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useUiStore } from '@/store/uiStore';
import { COLORS, FONTS } from '@/constants';

export default function Toast() {
  const toast = useUiStore((s) => s.toast);
  const hideToast = useUiStore((s) => s.hideToast);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-12)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          toast.type === 'error'
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Success
        );
      }
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.bezier(0.2, 0.9, 0.3, 1.2),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -12,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 220,
            useNativeDriver: true,
          }),
        ]).start(() => {
          hideToast();
        });
      }, 2200);
      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-12);
      opacity.setValue(0);
    }
  }, [toast, translateY, opacity, hideToast]);

  if (!toast) return null;

  const isError = toast.type === 'error';
  const bg = isError ? '#fdf2ef' : '#f3f0e8';
  const borderColor = isError ? 'rgba(192,76,54,0.30)' : COLORS.borderStrong;
  const textColor = isError ? COLORS.error : COLORS.textPrimary;

  return (
    <Animated.View
      style={{
        transform: [{ translateY }],
        opacity,
        position: 'absolute',
        top: insets.top + 12,
        left: 16,
        right: 16,
        borderRadius: 12,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor,
        paddingVertical: 12,
        paddingHorizontal: 14,
        zIndex: 9999,
        elevation: 10,
        shadowColor: '#1f1e1c',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ color: textColor, fontFamily: FONTS.sansBold, fontSize: 14 }}>
          {isError ? '⚠' : '✓'}
        </Text>
        <Text
          style={{
            color: textColor,
            fontFamily: FONTS.sansSemibold,
            fontSize: 13,
            flex: 1,
          }}
          numberOfLines={2}
        >
          {toast.message}
        </Text>
      </View>
    </Animated.View>
  );
}
