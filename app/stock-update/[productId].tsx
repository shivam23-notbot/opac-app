import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { X, ArrowUp, ArrowDown, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PolymerBadge } from '@/components/PolymerBadge';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SectionLabel } from '@/components/SectionLabel';
import { InlineDatePicker } from '@/components/InlineDatePicker';
import { useInventoryStore } from '@/store/inventoryStore';
import { useAuthStore } from '@/store/authStore';
import { useAuditStore } from '@/store/auditStore';
import { useUiStore } from '@/store/uiStore';
import { RAW_MATERIALS } from '@/mocks/rawMaterials';
import { bagsToKg, formatBagsKg } from '@/lib/units';
import { todayISO, formatDateReadable } from '@/lib/date';
import type { MaterialUsage } from '@/types';
import { COLORS, FONTS } from '@/constants';

export default function StockUpdateScreen() {
  const today = todayISO();
  const { productId, date: initialDate } = useLocalSearchParams<{ productId: string; date?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const getProduct = useInventoryStore((s) => s.getProduct);
  const updateStock = useInventoryStore((s) => s.updateStock);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const logAudit = useAuditStore((s) => s.log);
  const showToast = useUiStore((s) => s.showToast);

  const [entryDate, setEntryDate] = useState(initialDate ?? today);
  const [closingBags, setClosingBags] = useState('');
  const [notes, setNotes] = useState('');
  const [materialsKg, setMaterialsKg] = useState<Record<string, string>>({});

  useEffect(() => {
    const existing = useInventoryStore.getState().getProduct(productId)?.stockHistory.find(
      (e) => e.date === entryDate
    );
    if (existing) {
      setClosingBags(String(existing.closingBags));
      setNotes(existing.notes ?? '');
      const matMap: Record<string, string> = {};
      existing.materialsUsed.forEach((mu) => { matMap[mu.materialId] = String(mu.kg); });
      setMaterialsKg(matMap);
    } else {
      setClosingBags('');
      setNotes('');
      setMaterialsKg({});
    }
  }, [entryDate, productId]);

  if (!hasHydrated) return null;
  if (role !== 'worker' && role !== 'admin') {
    return <Redirect href="/(auth)/login" />;
  }

  const product = getProduct(productId);

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

  const isToday = entryDate === today;
  const existingEntry = product.stockHistory.find((e) => e.date === entryDate);
  const openingBagsForDate = isToday ? product.currentBags : (existingEntry?.openingBags ?? 0);
  const closingNum = parseFloat(closingBags) || 0;
  const delta = closingBags !== '' ? closingNum - openingBagsForDate : null;

  const handleSave = () => {
    if (closingBags.trim() === '' || closingNum < 0 || isNaN(closingNum)) {
      showToast('error', isToday ? 'Closing stock is required' : 'Bags produced is required');
      return;
    }

    const parsedMaterials: MaterialUsage[] = RAW_MATERIALS.filter(
      (rm) => materialsKg[rm.id] && parseFloat(materialsKg[rm.id]) > 0
    ).map((rm) => ({ materialId: rm.id, kg: parseFloat(materialsKg[rm.id]) }));

    updateStock(productId, {
      closingBags: Math.round(closingNum),
      materialsUsed: parsedMaterials,
      notes,
      recordedBy: user?.id,
      date: entryDate,
    });
    logAudit({
      userId: user!.id,
      userName: user!.name,
      action: 'update_stock',
      entity: 'production',
      entityId: productId,
      detail: `${isToday ? 'Closing' : `Date ${entryDate} closing`}: ${Math.round(closingNum)} bags`,
    });

    showToast('success', 'Stock updated successfully');
    router.back();
  };

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
              fontFamily: 'ui-monospace',
              fontSize: 13,
              fontWeight: '700',
              color: COLORS.accent,
              letterSpacing: 0.4,
            }}
          >
            {product.code}
          </Text>
          <Text
            style={{
              fontFamily: FONTS.sansMedium,
              fontSize: 12,
              color: COLORS.textSecondary,
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {product.name}
          </Text>
        </View>
        <PolymerBadge type={product.polymer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          <InlineDatePicker
            label="Entry Date"
            value={entryDate}
            onChange={setEntryDate}
            maxDate={today}
          />

          <SectionLabel>Stock Entry</SectionLabel>

          <TextField
            label="Opening Stock"
            value={formatBagsKg(openingBagsForDate)}
            readOnly
          />
          <TextField
            label={isToday ? "Today's Closing Stock" : 'Closing Stock'}
            value={closingBags}
            onChangeText={setClosingBags}
            keyboardType="numeric"
            placeholder="0"
            suffix="bags"
            hint={
              closingBags !== ''
                ? `= ${bagsToKg(closingNum).toLocaleString('en-IN')} kg`
                : undefined
            }
            autoFocus={isToday}
          />

          {delta !== null && (
            <View
              style={{
                marginTop: -4,
                marginBottom: 16,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor:
                  delta > 0
                    ? COLORS.accentSoftBg
                    : delta < 0
                      ? COLORS.errorSoftBg
                      : COLORS.bgTertiary,
                borderWidth: 1,
                borderColor:
                  delta > 0
                    ? COLORS.accentSoftBorder
                    : delta < 0
                      ? 'rgba(192,76,54,0.30)'
                      : COLORS.borderColor,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {delta > 0 ? (
                <ArrowUp size={16} color={COLORS.accent} />
              ) : delta < 0 ? (
                <ArrowDown size={16} color={COLORS.error} />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: FONTS.sansBold,
                    fontSize: 11,
                    color: COLORS.textTertiary,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                  }}
                >
                  {isToday ? 'Production Today' : `Production · ${formatDateReadable(entryDate)}`}
                </Text>
                <Text
                  style={{
                    fontFamily: FONTS.sansBold,
                    fontSize: 14,
                    color:
                      delta > 0 ? COLORS.accent : delta < 0 ? COLORS.error : COLORS.textSecondary,
                    marginTop: 2,
                  }}
                >
                  {delta > 0
                    ? `+${delta} bags (+${bagsToKg(delta)} kg)`
                    : delta < 0
                      ? `${delta} bags (${bagsToKg(delta)} kg)`
                      : 'No change'}
                </Text>
              </View>
            </View>
          )}

          <TextField
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes..."
            multiline
          />

          <View style={{ marginTop: 8 }}>
            <SectionLabel>Materials Used</SectionLabel>
          </View>
          <Text
            style={{
              fontFamily: FONTS.sansMedium,
              fontSize: 12,
              color: COLORS.textSecondary,
              marginBottom: 14,
            }}
          >
            Enter weight for materials used in this batch
          </Text>

          {RAW_MATERIALS.map((rm) => (
            <View
              key={rm.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                marginBottom: 10,
                backgroundColor: COLORS.bgSecondary,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
                borderRadius: 10,
                padding: 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontFamily: FONTS.sansSemibold,
                    fontSize: 13,
                    color: COLORS.textPrimary,
                  }}
                >
                  {rm.name}
                </Text>
                <Text
                  style={{
                    fontFamily: 'ui-monospace',
                    fontSize: 11,
                    color: COLORS.textTertiary,
                    marginTop: 1,
                  }}
                >
                  {rm.code}
                </Text>
              </View>
              <View style={{ width: 100, position: 'relative' }}>
                <TextInput
                  value={materialsKg[rm.id] ?? ''}
                  onChangeText={(v) => setMaterialsKg((p) => ({ ...p, [rm.id]: v }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={COLORS.textTertiary}
                  style={{
                    backgroundColor: COLORS.bgTertiary,
                    borderWidth: 1,
                    borderColor: COLORS.borderColor,
                    borderRadius: 8,
                    paddingLeft: 10,
                    paddingRight: 32,
                    paddingVertical: 8,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 14,
                    color: COLORS.textPrimary,
                    textAlign: 'right',
                  }}
                />
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: 0,
                    bottom: 0,
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.sansSemibold,
                      fontSize: 11,
                      color: COLORS.textTertiary,
                    }}
                  >
                    kg
                  </Text>
                </View>
              </View>
            </View>
          ))}

          <View style={{ marginTop: 22 }}>
            <PrimaryButton
              label="Save Entry"
              onPress={handleSave}
              size="lg"
              icon={<Check size={18} color="#fff" />}
            />
          </View>
          <Pressable
            onPress={() => router.back()}
            style={{ paddingVertical: 14, alignItems: 'center' }}
          >
            <Text
              style={{
                color: COLORS.textSecondary,
                fontFamily: FONTS.sansSemibold,
                fontSize: 14,
              }}
            >
              Cancel
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
