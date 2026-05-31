import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Plus, Package, Truck, Clock, Pencil, Trash2 } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { PolymerBadge, polymerColor } from '@/components/PolymerBadge';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useInventoryStore } from '@/store/inventoryStore';
import { useDispatchStore } from '@/store/dispatchStore';
import { useAuthStore } from '@/store/authStore';
import { useUsersStore } from '@/store/usersStore';
import { RAW_MATERIALS } from '@/mocks/rawMaterials';
import { COLORS, FONTS } from '@/constants';

interface StockEvent {
  kind: 'stock';
  entryId: string;
  date: string;
  sortKey: string;
  title: string;
  sub: string;
  meta: { materialId: string; kg: number }[] | null;
  by: string;
  color: string;
}

interface DispatchEvent {
  kind: 'dispatch';
  date: string;
  sortKey: string;
  title: string;
  sub: string;
  by: string;
  color: string;
}

type Event = StockEvent | DispatchEvent;

function DetailStat({
  label,
  value,
  sub,
  color = COLORS.textPrimary,
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.bgTertiary,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text
        style={{
          fontFamily: FONTS.sansBold,
          fontSize: 10,
          color: COLORS.textTertiary,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: FONTS.sansExtraBold,
          fontSize: 18,
          color,
          marginTop: 4,
          letterSpacing: -0.4,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: FONTS.sansMedium,
          fontSize: 10,
          color: COLORS.textTertiary,
          marginTop: 2,
        }}
      >
        {sub}
      </Text>
    </View>
  );
}

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const product = useInventoryStore((s) => s.getProduct(productId));
  const deleteStockEntry = useInventoryStore((s) => s.deleteStockEntry);
  const getDispatchesByProduct = useDispatchStore((s) => s.getDispatchesByProduct);
  const role = useAuthStore((s) => s.role);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const displayNameFor = useUsersStore((s) => s.displayNameFor);
  const [deleteTarget, setDeleteTarget] = useState<{ entryId: string; date: string } | null>(null);

  if (!hasHydrated) return null;
  if (role !== 'worker' && role !== 'admin') {
    return <Redirect href="/(auth)/login" />;
  }

  if (!product) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.bgPrimary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: COLORS.textSecondary, fontFamily: FONTS.sansMedium }}>
          Product not found
        </Text>
      </View>
    );
  }

  const productDispatches = getDispatchesByProduct(productId);
  const retired = product.currentBags === 0;
  const totalProduced = product.stockHistory.reduce(
    (s, h) => s + Math.max(0, h.closingBags - h.openingBags),
    0
  );
  const totalDispatched = productDispatches.reduce((s, d) => s + d.bags, 0);

  const events: Event[] = [];
  product.stockHistory.forEach((h) => {
    const delta = h.closingBags - h.openingBags;
    events.push({
      kind: 'stock',
      entryId: h.id,
      date: h.date,
      sortKey: h.recordedAt,
      title:
        delta === 0
          ? 'Stock adjusted'
          : delta > 0
            ? `Produced +${delta} bags`
            : `Adjusted ${delta} bags`,
      sub: `${h.openingBags} → ${h.closingBags} bags${h.notes ? ` · ${h.notes}` : ''}`,
      meta: h.materialsUsed && h.materialsUsed.length ? h.materialsUsed : null,
      by: h.recordedBy ? displayNameFor(h.recordedBy) : '—',
      color: delta > 0 ? COLORS.accent : delta < 0 ? COLORS.warning : COLORS.textSecondary,
    });
  });
  productDispatches.forEach((d) => {
    events.push({
      kind: 'dispatch',
      date: d.date,
      sortKey: `${d.date}T${d.time ?? ''}`,
      title: `Dispatched ${d.bags} bags`,
      sub: `${d.recipient}${d.vehicleNumber ? ` · ${d.vehicleNumber}` : ''}${d.time ? ` · ${d.time}` : ''}`,
      by: d.recordedBy ? displayNameFor(d.recordedBy) : '—',
      color: polymerColor(product.polymer),
    });
  });
  events.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const rawMatById = Object.fromEntries(RAW_MATERIALS.map((rm) => [rm.id, rm]));

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: COLORS.bgSecondary,
          paddingTop: Math.max(insets.top, 12) + 8,
          paddingBottom: 14,
          paddingHorizontal: 18,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.borderColor,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ padding: 4 }}>
          <X size={22} color={COLORS.textSecondary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: FONTS.sansBold,
              fontSize: 11,
              color: COLORS.textTertiary,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Product Detail
          </Text>
          <Text
            style={{
              fontFamily: 'ui-monospace',
              fontSize: 13,
              fontWeight: '700',
              color: COLORS.textPrimary,
              marginTop: 2,
              letterSpacing: 0.4,
            }}
          >
            {product.code}
          </Text>
        </View>
        <PolymerBadge type={product.polymer} />
      </View>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete Production Entry"
        message={`Remove the production entry for ${deleteTarget?.date}? This will adjust opening stock for all subsequent production days.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteTarget) {
            deleteStockEntry(productId, deleteTarget.entryId);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {/* Hero */}
        <Card padding={18} radius={16} style={{ marginBottom: 16 }}>
          <Text
            style={{
              fontFamily: FONTS.serifSemibold,
              fontSize: 22,
              color: COLORS.textPrimary,
              letterSpacing: -0.4,
              lineHeight: 28,
            }}
          >
            {product.name}
          </Text>

          {retired && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 6,
                backgroundColor: COLORS.bgTertiary,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
                alignSelf: 'flex-start',
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: COLORS.textTertiary,
                }}
              />
              <Text
                style={{
                  fontFamily: FONTS.sansBold,
                  fontSize: 11,
                  color: COLORS.textSecondary,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                Retired · Zero stock
              </Text>
            </View>
          )}

          <View
            style={{
              marginTop: 14,
              paddingVertical: 14,
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: COLORS.borderColor,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text
                style={{
                  fontFamily: FONTS.sansExtraBold,
                  fontSize: 36,
                  color: retired ? COLORS.textSecondary : COLORS.textPrimary,
                  letterSpacing: -1,
                }}
              >
                {product.currentBags}
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.sansSemibold,
                  fontSize: 15,
                  color: COLORS.textSecondary,
                }}
              >
                bags
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.sansMedium,
                  fontSize: 13,
                  color: COLORS.textTertiary,
                  marginLeft: 'auto',
                }}
              >
                {(product.currentBags * 25).toLocaleString('en-IN')} kg
              </Text>
            </View>
            <Text
              style={{
                fontFamily: FONTS.sansMedium,
                fontSize: 11,
                color: COLORS.textTertiary,
                marginTop: 4,
              }}
            >
              Current stock
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <DetailStat
              label="Total Produced"
              value={`+${totalProduced}`}
              sub="bags lifetime"
              color={COLORS.accent}
            />
            <DetailStat
              label="Total Dispatched"
              value={String(totalDispatched)}
              sub={`${productDispatches.length} orders`}
            />
          </View>

          <View style={{ marginTop: 14 }}>
            <PrimaryButton
              label="Add Production"
              onPress={() => router.push(`/stock-update/${product.id}`)}
              icon={<Plus size={16} color="#fff" />}
            />
          </View>
        </Card>

        <SectionLabel>History · {events.length} events</SectionLabel>

        {events.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Clock size={28} color={COLORS.textTertiary} />
            <Text
              style={{
                fontFamily: FONTS.sansMedium,
                fontSize: 13,
                color: COLORS.textTertiary,
                marginTop: 8,
              }}
            >
              No history yet
            </Text>
          </View>
        ) : (
          <View style={{ position: 'relative', paddingLeft: 22 }}>
            <View
              style={{
                position: 'absolute',
                left: 9,
                top: 6,
                bottom: 6,
                width: 2,
                backgroundColor: COLORS.borderColor,
                borderRadius: 1,
              }}
            />
            {events.map((e, i) => {
              const IconEl = e.kind === 'dispatch' ? Truck : Package;
              return (
                <View key={i} style={{ position: 'relative', marginBottom: 16 }}>
                  <View
                    style={{
                      position: 'absolute',
                      left: -22,
                      top: 10,
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: COLORS.bgSecondary,
                      borderWidth: 2,
                      borderColor: e.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconEl size={10} color={e.color} />
                  </View>
                  <Card padding={12} radius={12}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            fontFamily: FONTS.sansBold,
                            fontSize: 13,
                            color: COLORS.textPrimary,
                          }}
                        >
                          {e.title}
                        </Text>
                        <Text
                          style={{
                            fontFamily: FONTS.sansMedium,
                            fontSize: 12,
                            color: COLORS.textSecondary,
                            marginTop: 2,
                          }}
                        >
                          {e.sub}
                        </Text>
                        {e.kind === 'stock' && e.meta && e.meta.length > 0 && (
                          <View
                            style={{
                              flexDirection: 'row',
                              flexWrap: 'wrap',
                              gap: 4,
                              marginTop: 8,
                            }}
                          >
                            {e.meta.map((m, j) => (
                              <View
                                key={j}
                                style={{
                                  paddingHorizontal: 8,
                                  paddingVertical: 2,
                                  borderRadius: 6,
                                  backgroundColor: COLORS.bgTertiary,
                                  borderWidth: 1,
                                  borderColor: COLORS.borderColor,
                                }}
                              >
                                <Text
                                  style={{
                                    fontFamily: FONTS.sansSemibold,
                                    fontSize: 10,
                                    color: COLORS.textSecondary,
                                  }}
                                >
                                  {rawMatById[m.materialId]?.name ?? m.materialId} · {m.kg} kg
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                      <Text
                        style={{
                          fontFamily: FONTS.sansSemibold,
                          fontSize: 10,
                          color: COLORS.textTertiary,
                        }}
                      >
                        {e.date}
                      </Text>
                    </View>
                    {e.by && (
                      <View
                        style={{
                          marginTop: 6,
                          paddingTop: 6,
                          borderTopWidth: 1,
                          borderTopColor: COLORS.borderColor,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: FONTS.sansMedium,
                            fontSize: 10,
                            color: COLORS.textTertiary,
                          }}
                        >
                          By {e.by}
                        </Text>
                        {e.kind === 'stock' && role === 'admin' && (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              onPress={() =>
                                router.push(
                                  `/stock-update/${productId}?entryId=${e.entryId}` as `/${string}`
                                )
                              }
                              hitSlop={8}
                              style={{ padding: 4 }}
                            >
                              <Pencil size={14} color={COLORS.accent} />
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                setDeleteTarget({ entryId: e.entryId, date: e.date })
                              }
                              hitSlop={8}
                              style={{ padding: 4 }}
                            >
                              <Trash2 size={14} color={COLORS.error} />
                            </Pressable>
                          </View>
                        )}
                      </View>
                    )}
                  </Card>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
