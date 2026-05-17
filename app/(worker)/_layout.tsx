import { View, Text, Pressable, Platform } from 'react-native';
import { Tabs, Redirect, usePathname, useRouter } from 'expo-router';
import { Home, Users, Package, Truck, LogOut } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { COLORS, FONTS } from '@/constants';

function WorkerSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const items = [
    { label: 'Home', href: '/(worker)/dashboard', icon: Home },
    { label: 'Attendance', href: '/(worker)/attendance', icon: Users },
    { label: 'Stock', href: '/(worker)/production', icon: Package },
    { label: 'Dispatch', href: '/(worker)/dispatch', icon: Truck },
  ] as const;

  return (
    <View
      style={{
        width: 240,
        backgroundColor: COLORS.bgSecondary,
        borderRightWidth: 1,
        borderRightColor: COLORS.borderColor,
        paddingTop: 48,
        paddingHorizontal: 16,
      }}
    >
      <View style={{ marginBottom: 32, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text
            style={{
              fontFamily: FONTS.serifBold,
              fontSize: 22,
              color: COLORS.textPrimary,
              letterSpacing: -0.5,
            }}
          >
            Opac
          </Text>
          <Text
            style={{
              fontFamily: FONTS.sansSemibold,
              fontSize: 18,
              color: COLORS.textTertiary,
              marginLeft: 4,
              letterSpacing: 1,
            }}
          >
            OPS
          </Text>
        </View>
        <Text
          style={{
            color: COLORS.textTertiary,
            fontFamily: FONTS.sansSemibold,
            fontSize: 11,
            marginTop: 2,
            letterSpacing: 0.5,
          }}
        >
          Worker Portal
        </Text>
      </View>

      {items.map((item) => {
        const isActive = pathname.startsWith(item.href.replace('/(worker)', ''));
        const Icon = item.icon;
        return (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 12,
              paddingHorizontal: 12,
              borderRadius: 10,
              marginBottom: 4,
              backgroundColor: isActive ? COLORS.accentSoftBg : 'transparent',
              borderLeftWidth: 3,
              borderLeftColor: isActive ? COLORS.accent : 'transparent',
            }}
          >
            <Icon size={18} color={isActive ? COLORS.accent : COLORS.textSecondary} />
            <Text
              style={{
                marginLeft: 10,
                color: isActive ? COLORS.accent : COLORS.textSecondary,
                fontFamily: isActive ? FONTS.sansBold : FONTS.sansMedium,
                fontSize: 14,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}

      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: 32 }}>
        <Pressable
          onPress={() => {
            logout();
            router.replace('/(auth)/login');
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            paddingHorizontal: 12,
          }}
        >
          <LogOut size={18} color={COLORS.textTertiary} />
          <Text
            style={{
              marginLeft: 10,
              color: COLORS.textTertiary,
              fontFamily: FONTS.sansMedium,
              fontSize: 14,
            }}
          >
            Log out
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function WorkerLayout() {
  const role = useAuthStore((s) => s.role);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  if (!hasHydrated) return null;
  if (role !== 'worker' && role !== 'admin') {
    return <Redirect href="/(auth)/login" />;
  }

  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: COLORS.bgPrimary }}>
        <WorkerSidebar />
        <View style={{ flex: 1 }}>
          <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
            <Tabs.Screen name="dashboard" />
            <Tabs.Screen name="attendance" />
            <Tabs.Screen name="production" />
            <Tabs.Screen name="dispatch" />
          </Tabs>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.bgSecondary,
          borderTopColor: COLORS.borderColor,
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: 18,
          height: 64,
        },
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarLabelStyle: { fontSize: 10, fontFamily: FONTS.sansBold, letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="production"
        options={{
          title: 'Stock',
          tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dispatch"
        options={{
          title: 'Dispatch',
          tabBarIcon: ({ color, size }) => <Truck size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
