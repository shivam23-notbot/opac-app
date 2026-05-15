import { useRef } from 'react';
import { View, Pressable, Animated } from 'react-native';
import type { ViewProps, PressableProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  pressable?: boolean;
  onPress?: PressableProps['onPress'];
  radius?: number;
  padding?: number;
}

const CARD_SHADOW = {
  shadowColor: '#1f1e1c',
  shadowOpacity: 0.05,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
};

export function Card({
  children,
  className = '',
  style,
  pressable = false,
  onPress,
  radius = 14,
  padding = 16,
  ...props
}: CardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const baseStyle = {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e4d6',
    borderRadius: radius,
    padding,
    ...CARD_SHADOW,
  };

  if (pressable && onPress) {
    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            Animated.timing(scale, {
              toValue: 0.985,
              duration: 120,
              useNativeDriver: true,
            }).start();
          }}
          onPressOut={() => {
            Animated.timing(scale, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            }).start();
          }}
          style={[baseStyle, style as any]}
          className={className}
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View style={[baseStyle, style as any]} className={className} {...props}>
      {children}
    </View>
  );
}
