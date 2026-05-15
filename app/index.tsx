import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import { COLORS } from '@/constants';

export default function Index() {
  const role = useAuthStore((s) => s.role);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  if (!hasHydrated) {
    return <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }} />;
  }

  if (role === 'worker') return <Redirect href="/(worker)/dashboard" />;
  if (role === 'admin') return <Redirect href="/(admin)/dashboard" />;
  return <Redirect href="/(auth)/login" />;
}
