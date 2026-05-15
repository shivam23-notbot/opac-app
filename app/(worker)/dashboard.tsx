import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, LogOut, Users, Package, Truck, Bell } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { OpacLogo } from '@/components/OpacLogo';
import { SectionLabel } from '@/components/SectionLabel';
import { useAuthStore } from '@/store/authStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { useDispatchStore } from '@/store/dispatchStore';
import { useWorkersStore } from '@/store/workersStore';
import { formatDateReadable, getGreeting, todayISO } from '@/lib/date';
import { COLORS, FONTS } from '@/constants';
import { polymerColor } from '@/components/PolymerBadge';

function MiniStat({
  label,
  value,
  sub,
  color = COLORS.textPrimary,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.bgSecondary,
        borderWidth: 1,
        borderColor: COLORS.borderColor,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.sansBold,
          fontSize: 10,
          color: COLORS.textTertiary,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <Text style={{ fontFamily: FONTS.sansExtraBold, fontSize: 20, color }}>{value}</Text>
        {sub ? (
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, color: COLORS.textTertiary }}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function ActivityRow({
  icon,
  title,
  sub,
  time,
  last,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  time: string;
  last?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: COLORS.borderColor,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: COLORS.bgTertiary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontFamily: FONTS.sansSemibold, fontSize: 13, color: COLORS.textPrimary }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: FONTS.sansMedium,
            fontSize: 12,
            color: COLORS.textSecondary,
            marginTop: 1,
          }}
          numberOfLines={1}
        >
          {sub}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: FONTS.sansSemibold,
          fontSize: 11,
          color: COLORS.textTertiary,
        }}
      >
        {time}
      </Text>
    </View>
  );
}

interface ActivityItem {
  key: string;
  kind: 'dispatch' | 'stock' | 'attendance';
  time: string;
  sortKey: string;
  color: string;
  title: string;
  sub: string;
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const records = useAttendanceStore((s) => s.records);
  const products = useInventoryStore((s) => s.products);
  const entries = useDispatchStore((s) => s.entries);
  const workers = useWorkersStore((s) => s.workers);

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const greeting = getGreeting();
  const today = todayISO();

  const activeWorkers = workers.filter((w) => w.active);
  const todayRecords = records[today] ?? {};
  const markedCount = Object.keys(todayRecords).length;
  const totalWorkers = activeWorkers.length;
  const totalStock = products.reduce((s, p) => s + p.currentBags, 0);
  const todayDispatches = entries.filter((d) => d.date === today);
  const dispatchedBags = todayDispatches.reduce((s, d) => s + d.bags, 0);

  // Build live activity feed
  const activity: ActivityItem[] = [];
  todayDispatches.forEach((d) => {
    const p = products.find((x) => x.id === d.productId);
    activity.push({
      key: `dsp-${d.id}`,
      kind: 'dispatch',
      time: d.time,
      sortKey: d.time,
      color: p ? polymerColor(p.polymer) : COLORS.textSecondary,
      title: `Dispatched ${d.bags} bags · ${d.productCode}`,
      sub: d.recipient,
    });
  });
  products.forEach((p) => {
    const todayEntry = p.stockHistory.find((h) => h.date === today);
    if (todayEntry) {
      const time = new Date(p.lastUpdated).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      activity.push({
        key: `stk-${p.id}-${todayEntry.id}`,
        kind: 'stock',
        time,
        sortKey: p.lastUpdated,
        color: COLORS.accent,
        title: `Stock updated · ${p.code}`,
        sub: `${todayEntry.closingBags} bags closing`,
      });
    }
  });
  const attMarks = Object.entries(todayRecords);
  if (attMarks.length) {
    const sortedMarks = [...attMarks].sort((a, b) =>
      b[1].recordedAt.localeCompare(a[1].recordedAt)
    );
    const [, latest] = sortedMarks[0];
    activity.push({
      key: 'att-latest',
      kind: 'attendance',
      time: new Date(latest.recordedAt).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
      sortKey: latest.recordedAt,
      color: COLORS.textSecondary,
      title: 'Attendance marked',
      sub: `${markedCount} of ${totalWorkers} workers`,
    });
  }
  activity.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  const features = [
    {
      icon: Users,
      title: 'ATTENDANCE',
      subtitle: "Mark today's attendance",
      route: '/(worker)/attendance' as const,
    },
    {
      icon: Package,
      title: 'PRODUCTION & STOCK',
      subtitle: "Update today's stock",
      route: '/(worker)/production' as const,
    },
    {
      icon: Truck,
      title: 'DISPATCH',
      subtitle: "Record today's dispatches",
      route: '/(worker)/dispatch' as const,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: COLORS.bgSecondary,
          paddingTop: insets.top + 12,
          paddingBottom: 12,
          paddingHorizontal: 18,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.borderColor,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <OpacLogo size={18} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ position: 'relative' }}>
            <Bell size={20} color={COLORS.textSecondary} />
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: COLORS.accent,
                borderWidth: 2,
                borderColor: COLORS.bgSecondary,
              }}
            />
          </View>
          <Pressable onPress={handleLogout} hitSlop={12}>
            <LogOut size={20} color={COLORS.textSecondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Text
          style={{
            fontFamily: FONTS.serifSemibold,
            fontSize: 28,
            color: COLORS.textPrimary,
            letterSpacing: -0.6,
            lineHeight: 34,
          }}
        >
          Good {greeting}, {firstName}
        </Text>
        <Text
          style={{
            fontFamily: FONTS.sansMedium,
            fontSize: 13,
            color: COLORS.textSecondary,
            marginTop: 6,
            marginBottom: 22,
          }}
        >
          {formatDateReadable()}
        </Text>

        {/* Quick stats */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 22 }}>
          <MiniStat
            label="Marked"
            value={`${markedCount}/${totalWorkers}`}
            color={
              totalWorkers > 0 && markedCount === totalWorkers ? COLORS.accent : COLORS.textPrimary
            }
          />
          <MiniStat label="Stock" value={String(totalStock)} sub="bags" />
          <MiniStat label="Dispatched" value={String(dispatchedBags)} sub="bags" />
        </View>

        <SectionLabel>Quick Actions</SectionLabel>
        <View style={{ gap: 12 }}>
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <Card
                key={f.title}
                pressable
                onPress={() => router.push(f.route)}
                padding={16}
                radius={16}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: COLORS.accentSoftBg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={22} color={COLORS.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.sansExtraBold,
                        fontSize: 14,
                        color: COLORS.textPrimary,
                        letterSpacing: 0.3,
                      }}
                    >
                      {f.title}
                    </Text>
                    <Text
                      style={{
                        fontFamily: FONTS.sansMedium,
                        fontSize: 13,
                        color: COLORS.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      {f.subtitle}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={COLORS.accent} />
                </View>
              </Card>
            );
          })}
        </View>

        {/* Activity */}
        <View style={{ marginTop: 28 }}>
          <SectionLabel>Today's Activity</SectionLabel>
          <Card padding={0} radius={14}>
            {activity.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text
                  style={{
                    fontFamily: FONTS.sansMedium,
                    fontSize: 13,
                    color: COLORS.textTertiary,
                  }}
                >
                  Nothing recorded yet today
                </Text>
              </View>
            ) : (
              activity.map((a, i) => {
                const iconEl =
                  a.kind === 'dispatch' ? (
                    <Truck size={16} color={a.color} />
                  ) : a.kind === 'stock' ? (
                    <Package size={16} color={a.color} />
                  ) : (
                    <Users size={16} color={a.color} />
                  );
                return (
                  <ActivityRow
                    key={a.key}
                    icon={iconEl}
                    title={a.title}
                    sub={a.sub}
                    time={a.time}
                    last={i === activity.length - 1}
                  />
                );
              })
            )}
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
