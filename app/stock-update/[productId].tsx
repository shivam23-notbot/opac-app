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
  // entryId is present when editing an existing entry; date pre-selects the picker in add mode.
  const { productId, date: initialDate, entryId } = useLocalSearchParams<{
    productId: string;
    date?: string;
    entryId?: string;
  }>();
  const isEditMode = !!entryId;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const getProduct = useInventoryStore((s) => s.getProduct);
  const addProductionEntry = useInventoryStore((s) => s.addProductionEntry);
  const editProductionEntry = useInventoryStore((s) => s.editProductionEntry);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const logAudit = useAuditStore((s) => s.log);
  const showToast = useUiStore((s) => s.showToast);

  const [entryDate, setEntryDate] = useState(initialDate ?? today);
  const [closingBags, setClosingBags] = useState('');
  const [notes, setNotes] = useState('');
  const [materialsKg, setMaterialsKg] = useState<Record<string, string>>({});

  // In edit mode, find the entry being edited and pre-fill the form.
  // In add mode, re-compute when entryDate changes to show correct opening.
  useEffect(() => {
    const product = useInventoryStore.getState().getProduct(productId);
    if (!product) return;

    if (isEditMode) {
      const existing = product.stockHistory.find((e) => e.id === entryId);
      if (existing) {
        setEntryDate(existing.date);
        setClosingBags(String(existing.closingBags));
        setNotes(existing.notes ?? '');
        const matMap: Record<string, string> = {};
        existing.materialsUsed.forEach((mu) => { matMap[mu.materialId] = String(mu.kg); });
        setMaterialsKg(matMap);
      }
    } else {
      // Add mode: clear form when date changes.
      setClosingBags('');
      setNotes('');
      setMaterialsKg({});
    }
  }, [entryDate, entryId, isEditMode, productId]);

  if (!hasHydrated) return null;
  if (role !== 'worker' && role !== 'admin') {
    return <Redirect href="/(auth)/login" />;
  }

  const product = getProduct(productId);

  if (!product) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: COLORS.textSecondary, fontFamily: FONTS.sansMedium }}>Product not found</Text>
      </View>
    );
  }

  // Compute opening bags for display:
  // Edit mode → use the entry's stored openingBags.
  // Add mode today → product.currentBags.
  // Add mode past → closing of the last entry on or before entryDate.
  let openingBagsForDate: number;
  if (isEditMode) {
    const existing = product.stockHistory.find((e) => e.id === entryId);
    openingBagsForDate = existing?.openingBags ?? 0;
  } else {
    const isToday = entryDate === today;
    if (isToday) {
      openingBagsForDate = product.currentBags;
    } else {
      const sorted = [...product.stockHistory].sort((a, b) =>
        a.date !== b.date ? a.date.localeCompare(b.date) : a.recordedAt.localeCompare(b.recordedAt)
      );
      const prev = [...sorted].reverse().find((e) => e.date <= entryDate);
      openingBagsForDate = prev?.closingBags ?? 0;
    }
  }

  const isToday = entryDate === today;
  const closingNum = parseFloat(closingBags) || 0;
  const delta = closingBags !== '' ? closingNum - openingBagsForDate : null;

  const handleSave = () => {
    if (closingBags.trim() === '' || closingNum < 0 || isNaN(closingNum)) {
      showToast('error', 'Closing stock is required');
      return;
    }

    const parsedMaterials: MaterialUsage[] = RAW_MATERIALS.filter(
      (rm) => materialsKg[rm.id] && parseFloat(materialsKg[rm.id]) > 0
    ).map((rm) => ({ materialId: rm.id, kg: parseFloat(materialsKg[rm.id]) }));

    if (isEditMode) {
      editProductionEntry(productId, entryId!, {
        closingBags: Math.round(closingNum),
        materialsUsed: parsedMaterials,
        notes,
      });
      logAudit({
        userId: user!.id,
        userName: user!.name,
        action: 'edit_production',
        entity: 'production',
        entityId: productId,
        detail: `Edited ${entryDate} entry: closing → ${Math.round(closingNum)} bags`,
      });
      showToast('success', 'Production entry updated');
    } else {
      addProductionEntry(productId, {
        closingBags: Math.round(closingNum),
        materialsUsed: parsedMaterials,
        notes,
        date: entryDate,
      });
      logAudit({
        userId: user!.id,
        userName: user!.name,
        action: 'add_production',
        entity: 'production',
        entityId: productId,
        detail: `${isToday ? 'Today' : entryDate} closing: ${Math.round(closingNum)} bags`,
      });
      showToast('success', 'Production recorded');
    }

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
              fontFamily: FONTS.sansBold,
              fontSize: 11,
              color: COLORS.textTertiary,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            {isEditMode ? 'Edit Production' : 'Add Production'}
          </Text>
          <Text
            style={{
              fontFamily: 'ui-monospace',
              fontSize: 13,
              fontWeight: '700',
              color: COLORS.accent,
              letterSpacing: 0.4,
              marginTop: 2,
            }}
          >
            {product.code}
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
          {/* Date picker only in add mode; edit mode shows a read-only date chip */}
          {isEditMode ? (
            <View
              style={{
                marginBottom: 16,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: COLORS.bgTertiary,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
              }}
            >
              <Text style={{ fontFamily: FONTS.sansBold, fontSize: 10, color: COLORS.textTertiary, letterSpacing: 1, textTransform: 'uppercase' }}>
                Entry Date
              </Text>
              <Text style={{ fontFamily: FONTS.sansSemibold, fontSize: 14, color: COLORS.textPrimary, marginTop: 4 }}>
                {formatDateReadable(entryDate)}
              </Text>
            </View>
          ) : (
            <InlineDatePicker
              label="Entry Date"
              value={entryDate}
              onChange={setEntryDate}
              maxDate={today}
            />
          )}

          <SectionLabel>Stock Entry</SectionLabel>

          <TextField
            label="Opening Stock"
            value={formatBagsKg(openingBagsForDate)}
            readOnly
          />
          <TextField
            label={isToday && !isEditMode ? "Today's Closing Stock" : 'Closing Stock'}
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
            autoFocus={isToday && !isEditMode}
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
                  {isToday && !isEditMode
                    ? 'Production Today'
                    : `Production · ${formatDateReadable(entryDate)}`}
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
                <Text style={{ fontFamily: FONTS.sansSemibold, fontSize: 13, color: COLORS.textPrimary }}>
                  {rm.name}
                </Text>
                <Text style={{ fontFamily: 'ui-monospace', fontSize: 11, color: COLORS.textTertiary, marginTop: 1 }}>
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
                  style={{ position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' }}
                >
                  <Text style={{ fontFamily: FONTS.sansSemibold, fontSize: 11, color: COLORS.textTertiary }}>
                    kg
                  </Text>
                </View>
              </View>
            </View>
          ))}

          <View style={{ marginTop: 22 }}>
            <PrimaryButton
              label={isEditMode ? 'Save Changes' : 'Save Entry'}
              onPress={handleSave}
              size="lg"
              icon={<Check size={18} color="#fff" />}
            />
          </View>
          <Pressable
            onPress={() => router.back()}
            style={{ paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: COLORS.textSecondary, fontFamily: FONTS.sansSemibold, fontSize: 14 }}>
              Cancel
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
