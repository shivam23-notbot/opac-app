import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { COLORS, FONTS, APP_FOOTER } from '@/constants';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const login = useAuthStore((s) => s.login);
  const showToast = useUiStore((s) => s.showToast);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      showToast('error', 'Please enter email and password');
      return;
    }
    const success = login(email, password);
    if (!success) {
      showToast('error', 'Invalid email or password');
      return;
    }
    const role = useAuthStore.getState().role;
    if (role === 'admin') {
      router.replace('/(admin)/dashboard');
    } else {
      router.replace('/(worker)/dashboard');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={{
            padding: 24,
            paddingTop: insets.top + 48,
            paddingBottom: 120,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Brand */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                backgroundColor: COLORS.accent,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: COLORS.accent,
                shadowOpacity: 0.3,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 8 },
                elevation: 12,
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontFamily: FONTS.serifBold,
                  fontSize: 36,
                  letterSpacing: -1,
                  lineHeight: 42,
                }}
              >
                O
              </Text>
            </View>
            <Text
              style={{
                marginTop: 16,
                fontFamily: FONTS.serifSemibold,
                fontSize: 26,
                color: COLORS.textPrimary,
                letterSpacing: -0.6,
              }}
            >
              Opac Polymers
            </Text>
            <Text
              style={{
                marginTop: 6,
                color: COLORS.textSecondary,
                fontFamily: FONTS.sansSemibold,
                fontSize: 12,
                letterSpacing: 1.5,
              }}
            >
              OPS · INTERNAL PORTAL
            </Text>
          </View>

          <Card padding={22} radius={20}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="worker@opac.in"
              keyboardType="email-address"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />
            <View style={{ marginTop: 8 }}>
              <PrimaryButton label="Log In" onPress={handleLogin} size="lg" />
            </View>
          </Card>

        </ScrollView>
      </KeyboardAvoidingView>

      <View style={{ paddingBottom: Math.max(insets.bottom, 16) + 8, alignItems: 'center' }}>
        <Text
          style={{
            color: COLORS.textTertiary,
            fontFamily: FONTS.sansSemibold,
            fontSize: 11,
            letterSpacing: 1,
          }}
        >
          {APP_FOOTER}
        </Text>
      </View>
    </View>
  );
}
