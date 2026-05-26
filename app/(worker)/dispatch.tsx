import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { EmptyState } from '@/components/EmptyState';
import { PolymerBadge } from '@/components/PolymerBadge';
import { SectionLabel } from '@/components/SectionLabel';
import { SyncIndicator } from '@/components/SyncIndicator';
import { useInventoryStore } from '@/store/inventoryStore';
import { useDispatchStore } from '@/store/dispatchStore';
import { useAuthStore } from '@/store/authStore';
import { useAuditStore } from '@/store/auditStore';
import { useUiStore } from '@/store/uiStore';
import { todayISO, formatDateReadable, shiftDate } from '@/lib/date';
import { generateId } from '@/lib/utils';
import { bagsToKg } from '@/lib/units';
import type { DispatchEntry } from '@/types';
import { Pencil, Truck, Trash2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { COLORS, FONTS } from '@/constants';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export default function DispatchScreen() {
  const allProducts = useInventoryStore((s) => s.products);
  const products = allProducts.filter((p) => p.currentBags > 0);
  const allEntries = useDispatchStore((s) => s.entries);
  const record = useDispatchStore((s) => s.record);
  const editEntry = useDispatchStore((s) => s.editEntry);
  const deleteEntry = useDispatchStore((s) => s.deleteEntry);
  const getEntriesForDate = useDispatchStore((s) => s.getEntriesForDate);
  const syncStatus = useDispatchStore((s) => s.syncStatus);
  const retrySync = useDispatchStore((s) => s.retrySync);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const logAudit = useAuditStore((s) => s.log);
  const showToast = useUiStore((s) => s.showToast);

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [bags, setBags] = useState('');
  const [recipient, setRecipient] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DispatchEntry | null>(null);

  const selectedProduct = allProducts.find((p) => p.id === selectedProductId);
  const editingEntry = editingId ? allEntries.find((e) => e.id === editingId) : null;
  // When editing, the original bags for this product are logically "restored" before re-dispatching,
  // so the effective available is currentBags + originalBags (same product) or just currentBags (product switch).
  const editRestoreBags =
    editingEntry && editingEntry.productId === selectedProductId ? editingEntry.bags : 0;
  const effectiveAvailable = selectedProduct ? selectedProduct.currentBags + editRestoreBags : 0;
  const bagsNum = parseInt(bags) || 0;
  const remaining = effectiveAvailable - bagsNum;
  const wouldGoNegative = selectedProduct !== undefined && bagsNum > effectiveAvailable;
  const canSubmit =
    selectedProduct &&
    bags.trim() !== '' &&
    bagsNum > 0 &&
    !wouldGoNegative &&
    recipient.trim() !== '';

  const dateEntries = getEntriesForDate(selectedDate);

  const resetForm = () => {
    setBags('');
    setRecipient('');
    setVehicle('');
    setNotes('');
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!canSubmit || !selectedProduct) return;

    const now = new Date();
    const time = now.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    if (editingId) {
      editEntry(editingId, { bags: bagsNum, recipient, vehicleNumber: vehicle, notes });
      showToast('success', 'Dispatch updated');
    } else {
      const entry: DispatchEntry = {
        id: generateId(),
        date: selectedDate,
        time,
        productId: selectedProduct.id,
        productCode: selectedProduct.code,
        bags: bagsNum,
        recipient,
        vehicleNumber: vehicle || undefined,
        notes: notes || undefined,
        recordedBy: user?.id ?? 'unknown',
      };
      record(entry);
      logAudit({
        userId: user!.id,
        userName: user!.name,
        action: 'record_dispatch',
        entity: 'dispatch',
        entityId: entry.id,
        detail: `${bagsNum} bags of ${selectedProduct.code} to ${recipient}`,
      });
      showToast('success', 'Dispatch recorded');
    }

    resetForm();
    setSelectedProductId(null);
  };

  const handleDelete = (entry: DispatchEntry) => {
    deleteEntry(entry.id);
    logAudit({
      userId: user!.id,
      userName: user!.name,
      action: 'delete_dispatch',
      entity: 'dispatch',
      entityId: entry.id,
      detail: `${entry.bags} bags of ${entry.productCode} to ${entry.recipient}`,
    });
    showToast('success', 'Dispatch deleted');
  };

  const handleEdit = (entry: DispatchEntry) => {
    setSelectedProductId(entry.productId);
    setBags(String(entry.bags));
    setRecipient(entry.recipient);
    setVehicle(entry.vehicleNumber ?? '');
    setNotes(entry.notes ?? '');
    setEditingId(entry.id);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}>
      <TopBar title="Dispatch" subtitle={formatDateReadable(selectedDate)} />

      {/* Date stepper */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 18,
          paddingVertical: 10,
          backgroundColor: COLORS.bgSecondary,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.borderColor,
        }}
      >
        <Pressable
          onPress={() => {
            setSelectedDate(shiftDate(selectedDate, -1));
            resetForm();
            setSelectedProductId(null);
          }}
          hitSlop={12}
          style={{ padding: 6 }}
        >
          <ChevronLeft size={18} color={COLORS.textSecondary} />
        </Pressable>
        <Text
          style={{
            fontFamily: FONTS.sansBold,
            fontSize: 13,
            color: COLORS.textPrimary,
          }}
        >
          {selectedDate === todayISO() ? 'Today' : formatDateReadable(selectedDate)}
        </Text>
        <Pressable
          onPress={() => {
            if (selectedDate < todayISO()) {
              setSelectedDate(shiftDate(selectedDate, 1));
              resetForm();
              setSelectedProductId(null);
            }
          }}
          hitSlop={12}
          style={{ padding: 6, opacity: selectedDate >= todayISO() ? 0.3 : 1 }}
        >
          <ChevronRight size={18} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={{
              fontFamily: FONTS.sansMedium,
              fontSize: 13,
              color: COLORS.textSecondary,
              marginBottom: 12,
              lineHeight: 20,
            }}
          >
            Select a product and record bags dispatched. Stock updates automatically.
          </Text>

          {/* Product picker */}
          {products.length === 0 ? (
            <View
              style={{
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
                backgroundColor: COLORS.bgSecondary,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: FONTS.sansBold,
                  fontSize: 13,
                  color: COLORS.textPrimary,
                  marginBottom: 4,
                }}
              >
                No products in stock
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.sansMedium,
                  fontSize: 12,
                  color: COLORS.textSecondary,
                }}
              >
                Update stock before recording a dispatch.
              </Text>
            </View>
          ) : (
            <View style={{ marginBottom: 16 }}>
              {products.map((p) => {
                const sel = selectedProductId === p.id;
                // In edit mode the original bags for the edited product are logically restored,
                // so show the true ceiling rather than the already-decremented currentBags.
                const chipAvailable =
                  editingEntry && editingEntry.productId === p.id
                    ? p.currentBags + editingEntry.bags
                    : p.currentBags;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setSelectedProductId(p.id);
                      if (!sel) resetForm();
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: sel
                        ? COLORS.accentSoftBg
                        : pressed
                        ? COLORS.bgTertiary
                        : COLORS.bgSecondary,
                      borderWidth: 1,
                      borderColor: sel ? COLORS.accent : COLORS.borderColor,
                      borderRadius: 14,
                      paddingHorizontal: 14,
                      paddingVertical: 13,
                      marginBottom: 8,
                      gap: 12,
                    })}
                  >
                    <PolymerBadge type={p.polymer} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={{
                          fontFamily: FONTS.mono,
                          fontSize: 14,
                          fontWeight: '700',
                          color: COLORS.accent,
                          letterSpacing: 0.3,
                        }}
                        numberOfLines={1}
                      >
                        {p.code}
                      </Text>
                      <Text
                        style={{
                          fontFamily: FONTS.sansSemibold,
                          fontSize: 12,
                          color: COLORS.textSecondary,
                          marginTop: 2,
                        }}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 1 }}>
                      <Text
                        style={{
                          fontFamily: FONTS.sansExtraBold,
                          fontSize: 18,
                          color: sel ? COLORS.accent : COLORS.textPrimary,
                          letterSpacing: -0.5,
                        }}
                      >
                        {chipAvailable}
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
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Form */}
          {selectedProduct && (
            <Card padding={16} radius={16} style={{ marginBottom: 18 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  backgroundColor: COLORS.accentSoftBg,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: COLORS.accentSoftBorder,
                  marginBottom: 14,
                }}
              >
                <PolymerBadge type={selectedProduct.polymer} />
                <Text
                  style={{
                    color: COLORS.accent,
                    fontFamily: FONTS.sansBold,
                    fontSize: 13,
                  }}
                >
                  Available: {effectiveAvailable} bags
                </Text>
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 12,
                    marginLeft: 'auto',
                  }}
                >
                  ({bagsToKg(effectiveAvailable).toLocaleString('en-IN')} kg)
                </Text>
              </View>

              <TextField
                label="Bags Dispatched"
                value={bags}
                onChangeText={setBags}
                keyboardType="numeric"
                placeholder="0"
                suffix="bags"
              />

              {bags.trim() !== '' && (
                <View
                  style={{
                    marginTop: -4,
                    marginBottom: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: wouldGoNegative ? COLORS.errorSoftBg : COLORS.accentSoftBg,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.sansBold,
                      fontSize: 12,
                      color: wouldGoNegative ? COLORS.error : COLORS.accent,
                    }}
                  >
                    {wouldGoNegative
                      ? `⚠ Exceeds available stock by ${bagsNum - effectiveAvailable} bags`
                      : `Remaining: ${remaining} bags (${bagsToKg(remaining).toLocaleString('en-IN')} kg)`}
                  </Text>
                </View>
              )}

              <TextField
                label="Recipient / Party Name"
                value={recipient}
                onChangeText={setRecipient}
                placeholder="e.g. Mehta Pipes Ltd."
              />
              <TextField
                label="Vehicle / Lorry Number (optional)"
                value={vehicle}
                onChangeText={setVehicle}
                placeholder="e.g. GJ-03-AB-1234"
              />
              <TextField
                label="Notes (optional)"
                value={notes}
                onChangeText={setNotes}
                placeholder="Any additional notes..."
                multiline
              />

              <View style={{ marginTop: 8 }}>
                <PrimaryButton
                  label={editingId ? 'Update Dispatch' : 'Record Dispatch'}
                  onPress={handleSubmit}
                  disabled={!canSubmit}
                  size="lg"
                  icon={<Truck size={18} color={canSubmit ? '#fff' : COLORS.textTertiary} />}
                />
              </View>
            </Card>
          )}

          <SectionLabel>
            {selectedDate === todayISO() ? "Today's Dispatches" : `Dispatches — ${formatDateReadable(selectedDate)}`}
          </SectionLabel>

          {dateEntries.length === 0 ? (
            <EmptyState
              icon={<Truck size={32} color={COLORS.textTertiary} />}
              message="No dispatches recorded for this date"
            />
          ) : (
            dateEntries.map((entry) => {
              const entrySyncStatus = syncStatus[entry.id] ?? 'synced';
              return (
              <View key={entry.id} style={{ marginBottom: 10 }}>
                <Card padding={14} radius={14}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
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
                            color: COLORS.textPrimary,
                          }}
                        >
                          {entry.productCode}
                        </Text>
                        <Text
                          style={{
                            fontFamily: FONTS.sansMedium,
                            fontSize: 13,
                            color: COLORS.textSecondary,
                          }}
                        >
                          ·
                        </Text>
                        <Text
                          style={{
                            fontFamily: FONTS.sansExtraBold,
                            fontSize: 14,
                            color: COLORS.accent,
                          }}
                        >
                          {entry.bags} bags
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontFamily: FONTS.sansSemibold,
                          fontSize: 13,
                          color: COLORS.textPrimary,
                        }}
                      >
                        {entry.recipient}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          gap: 10,
                          marginTop: 4,
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: FONTS.sansMedium,
                            fontSize: 11,
                            color: COLORS.textTertiary,
                          }}
                        >
                          {entry.time}
                        </Text>
                        {entry.vehicleNumber && (
                          <Text
                            style={{
                              fontFamily: FONTS.sansMedium,
                              fontSize: 11,
                              color: COLORS.textTertiary,
                            }}
                          >
                            · {entry.vehicleNumber}
                          </Text>
                        )}
                        <SyncIndicator
                          status={entrySyncStatus}
                          onRetry={() => retrySync(entry.id)}
                        />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Pressable
                        onPress={() => handleEdit(entry)}
                        hitSlop={10}
                        style={{
                          backgroundColor: COLORS.bgTertiary,
                          borderRadius: 8,
                          padding: 8,
                        }}
                      >
                        <Pencil size={14} color={COLORS.textSecondary} />
                      </Pressable>
                      {role === 'admin' && (
                        <Pressable
                          onPress={() => setDeleteTarget(entry)}
                          hitSlop={10}
                          style={{
                            backgroundColor: COLORS.bgTertiary,
                            borderRadius: 8,
                            padding: 8,
                          }}
                        >
                          <Trash2 size={14} color={COLORS.error} />
                        </Pressable>
                      )}
                    </View>
                  </View>
                </Card>
              </View>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete dispatch?"
        message={
          deleteTarget
            ? `Delete dispatch of ${deleteTarget.bags} bags of ${deleteTarget.productCode} to ${deleteTarget.recipient}? Stock will be restored.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </View>
  );
}
