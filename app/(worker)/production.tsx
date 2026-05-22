import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Animated, Easing } from 'react-native';
import { InlineDatePicker } from '@/components/InlineDatePicker';
import { useRouter } from 'expo-router';
import { TopBar } from '@/components/TopBar';
import { PolymerBadge } from '@/components/PolymerBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useInventoryStore } from '@/store/inventoryStore';
import { useAuthStore } from '@/store/authStore';
import { useAuditStore } from '@/store/auditStore';
import { useUiStore } from '@/store/uiStore';
import { relativeTime, formatDateReadable, todayISO } from '@/lib/date';
import { currentMonthKey, shiftMonthKey, monthLabel, daysOfMonth } from '@/lib/salary';
import { bagsToKg } from '@/lib/units';
import { generateId } from '@/lib/utils';
import type { PolymerType, Product } from '@/types';
import { Plus, ChevronRight, ChevronLeft, Package, Archive, RefreshCw } from 'lucide-react-native';
import { COLORS, FONTS } from '@/constants';

const POLYMER_OPTIONS: PolymerType[] = ['HDPE', 'PP', 'LDPE'];
const POLYMER_FILTERS = ['All', ...POLYMER_OPTIONS] as ReadonlyArray<'All' | PolymerType>;
type PolymerFilter = 'All' | PolymerType;

function TotalCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.bgSecondary,
        borderWidth: 1,
        borderColor: COLORS.borderColor,
        borderRadius: 12,
        padding: 12,
        shadowColor: '#1f1e1c',
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
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
        <Text style={{ fontFamily: FONTS.sansExtraBold, fontSize: 22, color: COLORS.textPrimary }}>
          {value}
        </Text>
        <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12, color: COLORS.textTertiary }}>
          {sub}
        </Text>
      </View>
    </View>
  );
}

function deltaColor(n: number): string {
  if (n > 0) return COLORS.success;
  if (n < 0) return COLORS.error;
  return COLORS.textTertiary;
}

const CompactProductRow = React.memo(function CompactProductRow({
  product,
  monthStart,
  monthEnd,
  onTap,
  onUpdate,
  onRetire,
}: {
  product: Product;
  monthStart: string;
  monthEnd: string;
  onTap: () => void;
  onUpdate: () => void;
  onRetire?: () => void;
}) {
  const monthEntries = product.stockHistory.filter(
    (e) => e.date >= monthStart && e.date <= monthEnd
  );
  const monthProduced = monthEntries.reduce((s, e) => s + (e.closingBags - e.openingBags), 0);
  const hasMonthData = monthEntries.length > 0;

  return (
    <Pressable
      onPress={onTap}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: pressed ? COLORS.bgTertiary : COLORS.bgSecondary,
        borderWidth: 1,
        borderColor: COLORS.borderColor,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 13,
        marginBottom: 8,
        gap: 12,
      })}
    >
      <PolymerBadge type={product.polymer} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontFamily: FONTS.sansSemibold, fontSize: 14, color: COLORS.textPrimary }}
          numberOfLines={1}
        >
          {product.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
          <Text
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: '700',
              color: COLORS.accent,
              letterSpacing: 0.3,
            }}
          >
            {product.code}
          </Text>
          {hasMonthData && (
            <>
              <Text style={{ color: COLORS.borderStrong, fontSize: 10 }}>·</Text>
              <Text
                style={{
                  fontFamily: FONTS.sansMedium,
                  fontSize: 11,
                  color: deltaColor(monthProduced),
                }}
              >
                {monthProduced >= 0 ? `+${monthProduced}` : monthProduced} bags
              </Text>
            </>
          )}
        </View>
        <Text
          style={{
            fontFamily: FONTS.sansMedium,
            fontSize: 10,
            color: COLORS.textTertiary,
            marginTop: 2,
          }}
        >
          {relativeTime(product.lastUpdated)}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 1, marginRight: 4 }}>
        <Text
          style={{
            fontFamily: FONTS.sansExtraBold,
            fontSize: 20,
            color: COLORS.textPrimary,
            letterSpacing: -0.5,
          }}
        >
          {product.currentBags}
        </Text>
        <Text
          style={{
            fontFamily: FONTS.sansMedium,
            fontSize: 9,
            color: COLORS.textTertiary,
            textTransform: 'uppercase',
            letterSpacing: 0.8,
          }}
        >
          bags
        </Text>
      </View>

      {/* stopPropagation prevents the outer row's onTap from also firing on web */}
      <Pressable
        onPress={(e) => { e.stopPropagation(); onUpdate(); }}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: pressed ? COLORS.accentPressed : COLORS.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: COLORS.accent,
          shadowOpacity: 0.28,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        })}
      >
        <Plus size={16} color="#fff" />
      </Pressable>

      {onRetire && (
        <Pressable
          onPress={(e) => { e.stopPropagation(); onRetire(); }}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: pressed ? COLORS.bgTertiary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Archive size={14} color={COLORS.textTertiary} />
        </Pressable>
      )}

      <ChevronRight size={16} color={COLORS.borderStrong} />
    </Pressable>
  );
});

function RetiredSection({
  products,
  onTap,
  onUnretire,
}: {
  products: Product[];
  onTap: (id: string) => void;
  onUnretire?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotate, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [expanded, rotate]);

  const rotation = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View style={{ marginTop: 8 }}>
      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 4,
          paddingVertical: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text
            style={{
              fontFamily: FONTS.sansBold,
              fontSize: 11,
              letterSpacing: 2,
              color: COLORS.textSecondary,
              textTransform: 'uppercase',
            }}
          >
            Retired Products
          </Text>
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 1,
              backgroundColor: COLORS.bgTertiary,
              borderRadius: 10,
            }}
          >
            <Text
              style={{
                fontFamily: FONTS.sansBold,
                fontSize: 11,
                color: COLORS.textTertiary,
              }}
            >
              {products.length}
            </Text>
          </View>
        </View>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <ChevronRight size={16} color={COLORS.textTertiary} />
        </Animated.View>
      </Pressable>

      {expanded &&
        products.map((p) => (
          <View
            key={p.id}
            style={{
              backgroundColor: COLORS.bgSecondary,
              borderWidth: 1,
              borderColor: COLORS.borderColor,
              borderRadius: 12,
              padding: 14,
              marginBottom: 8,
              opacity: 0.85,
            }}
          >
            <Pressable
              onPress={() => onTap(p.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'ui-monospace',
                      fontSize: 12,
                      fontWeight: '700',
                      color: COLORS.textSecondary,
                    }}
                  >
                    {p.code}
                  </Text>
                  <PolymerBadge type={p.polymer} />
                </View>
                <Text
                  style={{
                    fontFamily: FONTS.sansSemibold,
                    fontSize: 13,
                    color: COLORS.textSecondary,
                  }}
                >
                  {p.name}
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.sansMedium,
                    fontSize: 11,
                    color: COLORS.textTertiary,
                    marginTop: 4,
                  }}
                >
                  Retired · {p.currentBags} bags · {p.stockHistory.length} historical entries
                </Text>
              </View>
              <ChevronRight size={16} color={COLORS.textTertiary} />
            </Pressable>
            {onUnretire && (
              <Pressable
                onPress={() => onUnretire(p.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  marginTop: 10,
                  paddingVertical: 7,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: COLORS.accentSoftBorder,
                  backgroundColor: COLORS.accentSoftBg,
                }}
              >
                <Archive size={12} color={COLORS.accent} />
                <Text style={{ color: COLORS.accent, fontFamily: FONTS.sansBold, fontSize: 11 }}>
                  Unretire
                </Text>
              </Pressable>
            )}
          </View>
        ))}
    </View>
  );
}

export default function ProductionScreen() {
  const router = useRouter();
  const products = useInventoryStore((s) => s.products);
  const addProduct = useInventoryStore((s) => s.addProduct);
  const retireProduct = useInventoryStore((s) => s.retireProduct);
  const unretireProduct = useInventoryStore((s) => s.unretireProduct);
  const hydrate = useInventoryStore((s) => s.hydrate);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const logAudit = useAuditStore((s) => s.log);
  const showToast = useUiStore((s) => s.showToast);

  const [showAdd, setShowAdd] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newPolymer, setNewPolymer] = useState<PolymerType>('HDPE');
  const [newCode, setNewCode] = useState('');
  const [newBags, setNewBags] = useState('');
  const [newEntryDate, setNewEntryDate] = useState(todayISO());
  const [retireTarget, setRetireTarget] = useState<Product | null>(null);
  const [unretireTarget, setUnretireTarget] = useState<Product | null>(null);
  const [reportMonth, setReportMonth] = useState(currentMonthKey());
  const [refreshing, setRefreshing] = useState(false);
  const [polymerFilter, setPolymerFilter] = useState<PolymerFilter>('All');

  const today = todayISO();

  const { active, retired, filteredActive, totalStock, polymerCounts } = useMemo(() => {
    const active: Product[] = [];
    const retired: Product[] = [];
    let totalStock = 0;
    const polymerCounts: Record<string, number> = {};
    for (const p of products) {
      totalStock += p.currentBags;
      if (p.active !== false) {
        active.push(p);
        polymerCounts[p.polymer] = (polymerCounts[p.polymer] ?? 0) + 1;
      } else {
        retired.push(p);
      }
    }
    active.sort((a, b) => b.lastUpdated.localeCompare(a.lastUpdated));
    const filteredActive =
      polymerFilter === 'All' ? active : active.filter((p) => p.polymer === polymerFilter);
    return { active, retired, filteredActive, totalStock, polymerCounts };
  }, [products, polymerFilter]);

  const { monthStart, monthEnd } = useMemo(() => {
    const days = daysOfMonth(reportMonth);
    return { monthStart: days[0], monthEnd: days[days.length - 1] };
  }, [reportMonth]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await hydrate();
      showToast('success', 'Production data refreshed');
    } catch {
      showToast('error', 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddProduct = () => {
    if (!newDesc.trim()) {
      showToast('error', 'Description is required');
      return;
    }
    const bags = parseInt(newBags) || 0;
    if (bags < 0) {
      showToast('error', 'Opening stock cannot be negative');
      return;
    }
    const code =
      newCode.trim() ||
      `${newPolymer}-${newDesc.trim().slice(0, 3).toUpperCase()}-${String(products.length + 1).padStart(3, '0')}`;
    const id = generateId();
    addProduct({
      id,
      code,
      name: newDesc.trim(),
      polymer: newPolymer,
      currentBags: bags,
      entryDate: newEntryDate,
      recordedBy: user?.name ?? 'unknown',
    });
    logAudit({
      userId: user!.id,
      userName: user!.name,
      action: 'add_product',
      entity: 'production',
      entityId: id,
      detail: newDesc.trim(),
    });
    setNewDesc('');
    setNewPolymer('HDPE');
    setNewCode('');
    setNewBags('');
    setNewEntryDate(todayISO());
    setShowAdd(false);
    showToast('success', 'Product added');
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}>
      <TopBar title="Production & Stock" subtitle={formatDateReadable(today)} />

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
          <TotalCard label="Total Stock" value={String(totalStock)} sub="bags" />
          <TotalCard
            label="Approx Weight"
            value={(bagsToKg(totalStock) / 1000).toFixed(1)}
            sub="tonnes"
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.bgSecondary,
            borderWidth: 1,
            borderColor: COLORS.borderColor,
            borderRadius: 12,
            padding: 10,
            marginBottom: 14,
          }}
        >
          <Pressable
            onPress={() => setReportMonth(shiftMonthKey(reportMonth, -1))}
            hitSlop={10}
            style={{ padding: 6, borderRadius: 8, backgroundColor: COLORS.bgTertiary }}
          >
            <ChevronLeft size={16} color={COLORS.textSecondary} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text
              style={{
                color: COLORS.textTertiary,
                fontFamily: FONTS.sansBold,
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}
            >
              Report Month
            </Text>
            <Text
              style={{
                color: COLORS.textPrimary,
                fontFamily: FONTS.sansExtraBold,
                fontSize: 15,
                marginTop: 2,
              }}
            >
              {monthLabel(reportMonth)}
            </Text>
          </View>
          <Pressable
            onPress={() => setReportMonth(shiftMonthKey(reportMonth, 1))}
            hitSlop={10}
            style={{
              padding: 6,
              borderRadius: 8,
              backgroundColor: COLORS.bgTertiary,
              marginRight: 8,
            }}
          >
            <ChevronRight size={16} color={COLORS.textSecondary} />
          </Pressable>
          <Pressable
            onPress={handleRefresh}
            hitSlop={10}
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: refreshing ? COLORS.accentSoftBg : COLORS.bgTertiary,
              borderWidth: 1,
              borderColor: refreshing ? COLORS.accentSoftBorder : COLORS.borderColor,
            }}
          >
            <RefreshCw size={16} color={refreshing ? COLORS.accent : COLORS.textSecondary} />
          </Pressable>
        </View>

        {active.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 12 }}
            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          >
            {POLYMER_FILTERS.map((f) => {
              const sel = polymerFilter === f;
              const count = f === 'All' ? active.length : (polymerCounts[f] ?? 0);
              if (f !== 'All' && count === 0) return null;
              return (
                <Pressable
                  key={f}
                  onPress={() => setPolymerFilter(f)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: sel ? COLORS.accent : COLORS.borderColor,
                    backgroundColor: sel ? COLORS.accentSoftBg : COLORS.bgSecondary,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.sansBold,
                      fontSize: 12,
                      color: sel ? COLORS.accent : COLORS.textSecondary,
                      letterSpacing: 0.3,
                    }}
                  >
                    {f}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.sansBold,
                      fontSize: 11,
                      color: sel ? COLORS.accent : COLORS.textTertiary,
                    }}
                  >
                    {count}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {active.length === 0 && retired.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Package size={32} color={COLORS.textTertiary} />
            <Text
              style={{
                fontFamily: FONTS.sansSemibold,
                fontSize: 14,
                color: COLORS.textSecondary,
                marginTop: 8,
              }}
            >
              No products yet
            </Text>
            <Text
              style={{
                fontFamily: FONTS.sansMedium,
                fontSize: 12,
                color: COLORS.textTertiary,
                marginTop: 4,
              }}
            >
              Tap + to add your first product
            </Text>
          </View>
        )}

        {filteredActive.length === 0 && active.length > 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 20 }}>
            <Text
              style={{
                fontFamily: FONTS.sansMedium,
                fontSize: 13,
                color: COLORS.textTertiary,
              }}
            >
              No {polymerFilter} products
            </Text>
          </View>
        )}

        {filteredActive.map((p) => (
          <CompactProductRow
            key={p.id}
            product={p}
            monthStart={monthStart}
            monthEnd={monthEnd}
            onTap={() => router.push(`/product-detail/${p.id}`)}
            onUpdate={() => router.push(`/stock-update/${p.id}`)}
            onRetire={role === 'admin' ? () => setRetireTarget(p) : undefined}
          />
        ))}

        {retired.length > 0 && (
          <RetiredSection
            products={retired}
            onTap={(id) => router.push(`/product-detail/${id}`)}
            onUnretire={
              role === 'admin'
                ? (id) => setUnretireTarget(products.find((p) => p.id === id) ?? null)
                : undefined
            }
          />
        )}
      </ScrollView>

      <Pressable
        onPress={() => setShowAdd(true)}
        style={{
          position: 'absolute',
          bottom: 90,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: COLORS.accent,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: COLORS.accent,
          shadowOpacity: 0.35,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <Plus size={24} color="#fff" />
      </Pressable>

      <BottomSheet
        open={showAdd}
        onClose={() => {
          setShowAdd(false);
          setNewEntryDate(todayISO());
        }}
        title="Add Product"
      >
        <TextField
          label="Description"
          value={newDesc}
          onChangeText={setNewDesc}
          placeholder="e.g. Natural HDPE Granules — Grade N"
          multiline
        />

        <View style={{ marginBottom: 12 }}>
          <Text
            style={{
              fontFamily: FONTS.sansBold,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: COLORS.textSecondary,
              marginBottom: 6,
            }}
          >
            Polymer Type
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {POLYMER_OPTIONS.map((p) => {
              const sel = newPolymer === p;
              return (
                <Pressable
                  key={p}
                  onPress={() => setNewPolymer(p)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: sel ? COLORS.accent : COLORS.borderColor,
                    backgroundColor: sel ? COLORS.accentSoftBg : COLORS.bgSecondary,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.sansBold,
                      fontSize: 13,
                      color: sel ? COLORS.accent : COLORS.textSecondary,
                      letterSpacing: 0.3,
                    }}
                  >
                    {p}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextField
          label="Product Code (optional)"
          value={newCode}
          onChangeText={setNewCode}
          placeholder="auto-generated if blank"
        />
        <TextField
          label="Opening Stock"
          value={newBags}
          onChangeText={setNewBags}
          keyboardType="numeric"
          placeholder="0"
          suffix="bags"
          hint={newBags ? `= ${(parseInt(newBags) || 0) * 25} kg` : '1 bag = 25 kg'}
        />

        <InlineDatePicker
          label="Start Date"
          value={newEntryDate}
          onChange={setNewEntryDate}
          maxDate={todayISO()}
        />

        <View style={{ marginTop: 8 }}>
          <PrimaryButton
            label="Add Product"
            onPress={handleAddProduct}
            size="lg"
            icon={<Plus size={18} color="#fff" />}
          />
        </View>
      </BottomSheet>

      <ConfirmDialog
        open={retireTarget !== null}
        title="Retire product?"
        message={
          retireTarget
            ? `Retire "${retireTarget.name}"? It will move to the retired list. Stock data is preserved. You can unretire it at any time.`
            : ''
        }
        confirmLabel="Retire"
        destructive
        onCancel={() => setRetireTarget(null)}
        onConfirm={() => {
          if (retireTarget) {
            retireProduct(retireTarget.id);
            logAudit({
              userId: user!.id,
              userName: user!.name,
              action: 'retire_product',
              entity: 'production',
              entityId: retireTarget.id,
              detail: retireTarget.name,
            });
            showToast('success', `${retireTarget.name} retired`);
          }
          setRetireTarget(null);
        }}
      />

      <ConfirmDialog
        open={unretireTarget !== null}
        title="Unretire product?"
        message={
          unretireTarget
            ? `Restore "${unretireTarget.name}" to active products? It will reappear on the production screen.`
            : ''
        }
        confirmLabel="Unretire"
        onCancel={() => setUnretireTarget(null)}
        onConfirm={() => {
          if (unretireTarget) {
            unretireProduct(unretireTarget.id);
            logAudit({
              userId: user!.id,
              userName: user!.name,
              action: 'unretire_product',
              entity: 'production',
              entityId: unretireTarget.id,
              detail: unretireTarget.name,
            });
            showToast('success', `${unretireTarget.name} restored`);
          }
          setUnretireTarget(null);
        }}
      />
    </View>
  );
}
