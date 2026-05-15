import { View, Text, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { useDispatchStore } from '@/store/dispatchStore';
import { useWorkersStore } from '@/store/workersStore';
import { useAuthStore } from '@/store/authStore';
import { subtractDays } from '@/lib/date';
import type { AttendanceStatus } from '@/types';
import { COLORS, FONTS } from '@/constants';

function statusLabel(status: AttendanceStatus): string {
  if (status === 'full') return 'Full Day';
  if (status === 'absent') return 'Absent';
  if (typeof status === 'object') return `${status.hours}h`;
  return String(status);
}

function statusColor(status: AttendanceStatus): string {
  if (status === 'full') return COLORS.accent;
  if (status === 'absent') return COLORS.error;
  return COLORS.warning;
}

function StatCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 160,
        backgroundColor: COLORS.bgSecondary,
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.borderColor,
        margin: 6,
        shadowColor: '#1f1e1c',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <Text
        style={{
          color: COLORS.textTertiary,
          fontFamily: FONTS.sansBold,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>
      <Text style={{ color: COLORS.textPrimary, fontFamily: FONTS.sansExtraBold, fontSize: 28 }}>
        {value}
      </Text>
      {sub ? (
        <Text
          style={{
            color: COLORS.textTertiary,
            fontFamily: FONTS.sansMedium,
            fontSize: 12,
            marginTop: 4,
          }}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const getTodayRecords = useAttendanceStore((s) => s.getTodayRecords);
  const products = useInventoryStore((s) => s.products);
  const getTodayEntries = useDispatchStore((s) => s.getTodayEntries);
  const dispatchEntries = useDispatchStore((s) => s.entries);
  const getActiveWorkers = useWorkersStore((s) => s.getActiveWorkers);

  const workers = getActiveWorkers();
  const todayRecords = getTodayRecords();
  const markedCount = Object.keys(todayRecords).length;
  const total = workers.length;
  const todayDispatches = getTodayEntries();

  const totalStockBags = products.reduce((s, p) => s + p.currentBags, 0);
  const totalStockTonnes = (totalStockBags * 25) / 1000;

  const todayDispatchedBags = todayDispatches.reduce((s, d) => s + d.bags, 0);

  const cutoffDate = subtractDays(30);
  const last30Produced = products.reduce((sum, p) => {
    return (
      sum +
      p.stockHistory
        .filter((h) => h.date >= cutoffDate)
        .reduce((acc, h) => acc + Math.max(0, h.closingBags - h.openingBags), 0)
    );
  }, 0);
  const last30Dispatched = dispatchEntries
    .filter((e) => e.date >= cutoffDate)
    .reduce((s, e) => s + e.bags, 0);

  const recentAttendance = Object.entries(todayRecords)
    .slice(-5)
    .map(([wId, rec]) => {
      const w = workers.find((e) => e.id === wId);
      return { name: w?.name ?? wId, status: rec.status };
    });

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.borderColor,
          backgroundColor: COLORS.bgSecondary,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <Text
              style={{
                fontFamily: FONTS.serifBold,
                fontSize: 20,
                color: COLORS.textPrimary,
                letterSpacing: -0.5,
              }}
            >
              Opac
            </Text>
            <Text
              style={{
                fontFamily: FONTS.sansSemibold,
                fontSize: 17,
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
              fontFamily: FONTS.sansMedium,
              fontSize: 11,
              marginTop: 1,
            }}
          >
            Admin Portal
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text
            style={{
              color: COLORS.textSecondary,
              fontFamily: FONTS.sansSemibold,
              fontSize: 13,
            }}
          >
            {user?.name?.split(' ')[0]}
          </Text>
          <Pressable onPress={handleLogout} hitSlop={12}>
            <LogOut size={20} color={COLORS.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={{ padding: 20 }}>
        <Text
          style={{
            color: COLORS.textPrimary,
            fontFamily: FONTS.serifSemibold,
            fontSize: 28,
            letterSpacing: -0.6,
            marginBottom: 20,
          }}
        >
          Dashboard
        </Text>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', margin: -6, marginBottom: 20 }}>
          <StatCard
            title="Total Stock"
            value={String(totalStockBags)}
            sub={`bags · ${totalStockTonnes.toFixed(1)} tonnes`}
          />
          <StatCard
            title="Workers · Attendance"
            value={`${markedCount}/${total}`}
            sub={
              total > 0
                ? `${total} active · ${Math.round((markedCount / total) * 100)}% marked`
                : 'No active workers'
            }
          />
          <StatCard
            title="Today's Dispatch"
            value={String(todayDispatches.length)}
            sub={`${todayDispatchedBags} bags dispatched`}
          />
          <StatCard
            title="Last 30 Days"
            value={`+${last30Produced} / −${last30Dispatched}`}
            sub="produced / dispatched (bags)"
          />
        </View>

        <View style={{ gap: 16 }}>
          <View
            style={{
              backgroundColor: COLORS.bgSecondary,
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor: COLORS.borderColor,
              shadowColor: '#1f1e1c',
              shadowOpacity: 0.04,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <Text
              style={{
                color: COLORS.textTertiary,
                fontFamily: FONTS.sansBold,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              Today's Attendance
            </Text>
            {recentAttendance.length === 0 ? (
              <Text
                style={{
                  color: COLORS.textTertiary,
                  fontFamily: FONTS.sansMedium,
                  fontSize: 13,
                }}
              >
                No records today
              </Text>
            ) : (
              recentAttendance.map((r, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderBottomWidth: i < recentAttendance.length - 1 ? 1 : 0,
                    borderBottomColor: COLORS.borderColor,
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.textPrimary,
                      fontFamily: FONTS.sansSemibold,
                      fontSize: 13,
                    }}
                  >
                    {r.name}
                  </Text>
                  <View
                    style={{
                      backgroundColor: statusColor(r.status) + '1a',
                      borderRadius: 6,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <Text
                      style={{
                        color: statusColor(r.status),
                        fontFamily: FONTS.sansExtraBold,
                        fontSize: 10,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                      }}
                    >
                      {statusLabel(r.status)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View
            style={{
              backgroundColor: COLORS.bgSecondary,
              borderRadius: 16,
              padding: 18,
              borderWidth: 1,
              borderColor: COLORS.borderColor,
              shadowColor: '#1f1e1c',
              shadowOpacity: 0.04,
              shadowRadius: 2,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }}
          >
            <Text
              style={{
                color: COLORS.textTertiary,
                fontFamily: FONTS.sansBold,
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
                marginBottom: 14,
              }}
            >
              Today's Dispatches
            </Text>
            {todayDispatches.length === 0 ? (
              <Text
                style={{
                  color: COLORS.textTertiary,
                  fontFamily: FONTS.sansMedium,
                  fontSize: 13,
                }}
              >
                No dispatches today
              </Text>
            ) : (
              todayDispatches.slice(-5).map((d, i) => (
                <View
                  key={d.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 10,
                    borderBottomWidth: i < Math.min(todayDispatches.length, 5) - 1 ? 1 : 0,
                    borderBottomColor: COLORS.borderColor,
                  }}
                >
                  <View>
                    <Text
                      style={{
                        color: COLORS.textPrimary,
                        fontFamily: 'ui-monospace',
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                    >
                      {d.productCode} · {d.bags} bags
                    </Text>
                    <Text
                      style={{
                        color: COLORS.textSecondary,
                        fontFamily: FONTS.sansMedium,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      {d.recipient}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: COLORS.textTertiary,
                      fontFamily: FONTS.sansMedium,
                      fontSize: 11,
                    }}
                  >
                    {d.time}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
