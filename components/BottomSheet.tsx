import { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { X } from 'lucide-react-native';
import { COLORS, FONTS } from '@/constants';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(800)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.bezier(0.2, 0.9, 0.3, 1.05),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(Dimensions.get('window').height);
      opacity.setValue(0);
    }
  }, [open, translateY, opacity]);

  if (Platform.OS === 'web') {
    return (
      <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
        <Animated.View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.35)',
            justifyContent: 'center',
            alignItems: 'center',
            opacity,
          }}
        >
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
          <View
            style={{
              backgroundColor: COLORS.bgSecondary,
              borderRadius: 20,
              maxWidth: 520,
              width: '90%',
              maxHeight: '85%',
              shadowColor: '#1f1e1c',
              shadowOpacity: 0.12,
              shadowRadius: 32,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 20,
                paddingHorizontal: 24,
                paddingBottom: 14,
              }}
            >
              <Text
                style={{
                  color: COLORS.textPrimary,
                  fontFamily: FONTS.sansExtraBold,
                  fontSize: 16,
                }}
              >
                {title}
              </Text>
              <Pressable onPress={onClose} hitSlop={12} style={{ padding: 4 }}>
                <X size={20} color={COLORS.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              style={{ paddingHorizontal: 24 }}
              contentContainerStyle={{ paddingBottom: 28 }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </View>
        </Animated.View>
      </Modal>
    );
  }

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15,23,42,0.35)',
          justifyContent: 'flex-end',
          opacity,
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View
            style={{
              transform: [{ translateY }],
              backgroundColor: COLORS.bgSecondary,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: '85%',
              shadowColor: '#1f1e1c',
              shadowOpacity: 0.08,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: -8 },
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 20,
                paddingHorizontal: 24,
                paddingBottom: 14,
              }}
            >
              <Text
                style={{
                  color: COLORS.textPrimary,
                  fontFamily: FONTS.sansExtraBold,
                  fontSize: 16,
                }}
              >
                {title}
              </Text>
              <Pressable onPress={onClose} hitSlop={12} style={{ padding: 4 }}>
                <X size={20} color={COLORS.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              style={{ paddingHorizontal: 24 }}
              contentContainerStyle={{ paddingBottom: 28 }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}
