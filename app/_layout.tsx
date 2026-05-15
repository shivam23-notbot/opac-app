import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useUsersStore } from '@/store/usersStore';
import { useWorkersStore } from '@/store/workersStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { useDispatchStore } from '@/store/dispatchStore';
import { useAuditStore } from '@/store/auditStore';
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import {
  SourceSerif4_500Medium,
  SourceSerif4_600SemiBold,
  SourceSerif4_700Bold,
} from '@expo-google-fonts/source-serif-4';
import '../global.css';
import Toast from '@/components/Toast';
import { COLORS } from '@/constants';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const hydrateUsers = useUsersStore((s) => s.hydrate);
  const hydrateWorkers = useWorkersStore((s) => s.hydrate);
  const hydrateAttendance = useAttendanceStore((s) => s.hydrate);
  const hydrateInventory = useInventoryStore((s) => s.hydrate);
  const hydrateDispatch = useDispatchStore((s) => s.hydrate);
  const hydrateAudit = useAuditStore((s) => s.hydrate);

  useEffect(() => {
    Promise.all([
      hydrateUsers(),
      hydrateWorkers(),
      hydrateAttendance(),
      hydrateInventory(),
      hydrateDispatch(),
      hydrateAudit(),
    ]).catch(() => {});
  }, []);

  const [fontsLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    SourceSerif4_500Medium,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.bgPrimary } }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(worker)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="stock-update/[productId]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="product-detail/[productId]" options={{ presentation: 'modal' }} />
      </Stack>
      <Toast />
    </SafeAreaProvider>
  );
}
