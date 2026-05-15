import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { Card } from '@/components/ui/Card';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { EmptyState } from '@/components/EmptyState';
import { PolymerBadge } from '@/components/PolymerBadge';
import { SectionLabel } from '@/components/SectionLabel';
import { useInventoryStore } from '@/store/inventoryStore';
import { useDispatchStore } from '@/store/dispatchStore';
import { useAuthStore } from '@/store/authStore';
import { useAuditStore } from '@/store/auditStore';
import { useUiStore } from '@/store/uiStore';
import { todayISO, formatDateReadable } from '@/lib/date';
import { generateId } from '@/lib/utils';
import type { DispatchEntry } from '@/types';
import { Pencil, Truck, Trash2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { COLORS, FONTS } from '@/constants';
import { ConfirmDialog } from '@/components/ConfirmDialog';

function offsetDate(base: string, days: number): string {
  const [y, m, d] = base.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function DispatchScreen() {
  const allProducts = useInventoryStore((s) => s.products);
  const products = allProducts.filter((p) => p.currentBags > 0);
  const record = useDispatchStore((s) => s.record);
  const editEntry = useDispatchStore((s) => s.editEntry);
  const deleteEntry = useDispatchStore((s) => s.deleteEntry);
  const getEntriesForDate = useDispatchStore((s) => s.getEntriesForDate);
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
  const bagsNum = parseInt(bags) || 0;
  const remaining = selectedProduct ? selectedProduct.currentBags - bagsNum : 0;
  const wouldGoNegative = selectedProduct !== undefined && bagsNum > selectedProduct.currentBags;
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
            setSelectedDate(offsetDate(selectedDate, -1));
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
              setSelectedDate(offsetDate(selectedDate, 1));
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
          ) : null}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginBottom: 16 }}
          >
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {products.map((p) => {
                const sel = selectedProductId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setSelectedProductId(p.id);
                      resetForm();
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: sel ? COLORS.accent : COLORS.borderColor,
                      backgroundColor: sel ? COLORS.accentSoftBg : COLORS.bgSecondary,
                      minWidth: 130,
                      shadowColor: sel ? COLORS.accent : 'transparent',
                      shadowOpacity: sel ? 0.1 : 0,
                      shadowRadius: 3,
                      shadowOffset: { width: 0, height: 0 },
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'ui-monospace',
                          fontSize: 11,
                          fontWeight: '700',
                          color: sel ? COLORS.accent : COLORS.textPrimary,
                        }}
                      >
                        {p.code}
                      </Text>
                      <PolymerBadge type={p.polymer} size="sm" />
                    </View>
                    <Text
                      style={{
                        fontFamily: FONTS.sansMedium,
                        fontSize: 11,
                        color: COLORS.textSecondary,
                      }}
                    >
                      {p.currentBags} bags
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

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
                  Stock: {selectedProduct.currentBags} bags
                </Text>
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 12,
                    marginLeft: 'auto',
                  }}
                >
                  ({(selectedProduct.currentBags * 25).toLocaleString('en-IN')} kg)
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
                      ? `⚠ Exceeds current stock by ${bagsNum - selectedProduct.currentBags} bags`
                      : `Remaining: ${remaining} bags (${remaining * 25} kg)`}
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
            dateEntries.map((entry) => (
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
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
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
            ))
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
