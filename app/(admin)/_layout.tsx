import { View, Text, Pressable } from 'react-native';
import { Tabs, Redirect, usePathname, useRouter } from 'expo-router';
import { useAuthStore } from '@/store/authStore';
import {
  LayoutDashboard,
  FileBarChart2,
  LogOut,
  Users,
  Package,
  Truck,
  UserCog,
} from 'lucide-react-native';
import { COLORS, FONTS } from '@/constants';
import { useIsMobile } from '@/hooks/useIsMobile';

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const items = [
    { label: 'Dashboard', href: '/(admin)/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', href: '/(admin)/attendance', icon: Users },
    { label: 'Production', href: '/(admin)/production', icon: Package },
    { label: 'Dispatch', href: '/(admin)/dispatch', icon: Truck },
    { label: 'Reports', href: '/(admin)/reports', icon: FileBarChart2 },
    { label: 'Users', href: '/(admin)/users', icon: UserCog },
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
          Admin Portal
        </Text>
      </View>

      {items.map((item) => {
        const isActive = pathname.startsWith(item.href.replace('/(admin)', ''));
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

export default function AdminLayout() {
  const role = useAuthStore((s) => s.role);
  const isMobile = useIsMobile();

  if (role !== 'admin') {
    return <Redirect href="/(auth)/login" />;
  }

  if (!isMobile) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: COLORS.bgPrimary }}>
        <Sidebar />
        <View style={{ flex: 1 }}>
          <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
            <Tabs.Screen name="dashboard" />
            <Tabs.Screen name="attendance" />
            <Tabs.Screen name="production" />
            <Tabs.Screen name="dispatch" />
            <Tabs.Screen name="reports" />
            <Tabs.Screen name="users" />
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
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
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
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color, size }) => <FileBarChart2 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          tabBarIcon: ({ color, size }) => <UserCog size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
