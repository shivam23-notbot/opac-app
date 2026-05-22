import { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Platform, Modal } from 'react-native';
import { DatePickerModal } from '@/components/DatePickerModal';
import {
  currentMonthKey,
  monthLabel,
  shiftMonthKey,
  computeMonthlySalary,
  computeCarryInBreakdown,
  daysOfMonth,
  earningsFor,
  statusLabel,
  wageForDate,
} from '@/lib/salary';
import { generateWorkerMonthlyPDF } from '@/lib/salaryPdf';
import { generateProductionMonthlyPDF } from '@/lib/productionPdf';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInventoryStore } from '@/store/inventoryStore';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useDispatchStore } from '@/store/dispatchStore';
import { useWorkersStore } from '@/store/workersStore';
import { useAuditStore } from '@/store/auditStore';
import { useAuthStore } from '@/store/authStore';
import { useUsersStore } from '@/store/usersStore';
import { useUiStore } from '@/store/uiStore';
import { bagsToKg } from '@/lib/units';
import { subtractDays, todayISO } from '@/lib/date';
import type { Worker } from '@/types';
import { COLORS, FONTS } from '@/constants';
import {
  Lock,
  Unlock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  X as XIcon,
  FileText,
} from 'lucide-react-native';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useIsMobile } from '@/hooks/useIsMobile';

type ReportTab = 'salary' | 'production' | 'dispatch' | 'audit';

function TabBtn({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 20,
        backgroundColor: active ? COLORS.accent : COLORS.bgSecondary,
        borderWidth: 1,
        borderColor: active ? COLORS.accent : COLORS.borderColor,
        marginRight: 8,
      }}
    >
      <Text
        style={{
          color: active ? '#fff' : COLORS.textSecondary,
          fontFamily: FONTS.sansBold,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: COLORS.bgTertiary,
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.borderColor,
      }}
    >
      {cols.map((c) => (
        <Text
          key={c}
          style={{
            flex: 1,
            color: COLORS.textTertiary,
            fontFamily: FONTS.sansBold,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          {c}
        </Text>
      ))}
    </View>
  );
}

function ProductionMonthStepper({
  month,
  isMobile,
  onPrev,
  onNext,
  onSave,
}: {
  month: string;
  isMobile: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSave: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.bgSecondary,
        borderWidth: 1,
        borderColor: COLORS.borderColor,
        borderRadius: 12,
        padding: 10,
        marginBottom: isMobile ? 10 : 12,
        gap: 8,
      }}
    >
      <Pressable
        onPress={onPrev}
        hitSlop={10}
        style={{ padding: 6, borderRadius: 8, backgroundColor: COLORS.bgTertiary }}
      >
        <ChevronLeft size={16} color={COLORS.textSecondary} />
      </Pressable>
      <View style={{ alignItems: 'center', flex: 1 }}>
        <Text
          style={{
            color: COLORS.textTertiary,
            fontFamily: FONTS.sansBold,
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
          }}
        >
          PDF month
        </Text>
        <Text
          style={{
            color: COLORS.textPrimary,
            fontFamily: FONTS.sansExtraBold,
            fontSize: isMobile ? 14 : 15,
            marginTop: 2,
          }}
        >
          {monthLabel(month)}
        </Text>
      </View>
      <Pressable
        onPress={onNext}
        hitSlop={10}
        style={{
          padding: 6,
          borderRadius: 8,
          backgroundColor: COLORS.bgTertiary,
          opacity: month >= currentMonthKey() ? 0.35 : 1,
        }}
      >
        <ChevronRight size={16} color={COLORS.textSecondary} />
      </Pressable>
      <Pressable
        onPress={onSave}
        style={{
          backgroundColor: COLORS.accent,
          paddingHorizontal: isMobile ? 12 : 16,
          paddingVertical: isMobile ? 8 : 9,
          borderRadius: isMobile ? 8 : 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: isMobile ? 5 : 6,
        }}
      >
        <FileText size={isMobile ? 13 : 14} color="#fff" />
        <Text style={{ color: '#fff', fontFamily: FONTS.sansBold, fontSize: isMobile ? 11 : 12 }}>
          {isMobile ? 'PDF' : `Save PDF (${monthLabel(month)})`}
        </Text>
      </Pressable>
    </View>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<ReportTab>('salary');
  const [dateFrom, setDateFrom] = useState(subtractDays(30));
  const [dateTo, setDateTo] = useState(todayISO());
  const [pickerTarget, setPickerTarget] = useState<'from' | 'to' | null>(null);
  const [detailWorkerId, setDetailWorkerId] = useState<string | null>(null);
  const [showSettled, setShowSettled] = useState(true);
  const [showRemoved, setShowRemoved] = useState(false);
  const [settleTarget, setSettleTarget] = useState<Worker | null>(null);
  const [reopenTarget, setReopenTarget] = useState<Worker | null>(null);
  const [salaryMonth, setSalaryMonth] = useState(currentMonthKey());
  const [productionMonth, setProductionMonth] = useState(currentMonthKey());

  const products = useInventoryStore((s) => s.products);
  const records = useAttendanceStore((s) => s.records);
  const attendanceHydrated = useAttendanceStore((s) => s._hasHydrated);
  const workersHydrated = useWorkersStore((s) => s._hasHydrated);
  const entries = useDispatchStore((s) => s.entries);
  const workers = useWorkersStore((s) => s.workers);
  const allAdvances = useWorkersStore((s) => s.advances);
  const auditLogs = useAuditStore((s) => s.logs);
  const settleWorker = useWorkersStore((s) => s.settleWorker);
  const unsettleWorker = useWorkersStore((s) => s.unsettleWorker);
  const logAudit = useAuditStore((s) => s.log);
  const authUser = useAuthStore((s) => s.user);
  const displayNameFor = useUsersStore((s) => s.displayNameFor);
  const showToast = useUiStore((s) => s.showToast);

  const makeRow = (worker: Worker) => {
    const s = computeMonthlySalary(worker, salaryMonth, records, allAdvances);
    return {
      worker,
      opening: s.openingBalance,
      totalEarned: s.grossEarned,
      totalAdvance: s.totalAdvances,
      daysPresent: s.presentDays,
      partialDays: s.partialDays,
      daysAbsent: s.absentDays,
      net: s.closingBalance,
    };
  };

  const salaryRows = workers
    .filter((w) => w.active)
    .filter((w) => salaryMonth >= w.createdAt.slice(0, 7))
    .map(makeRow);
  const removedRows = workers
    .filter((w) => !w.active)
    .filter((w) => salaryMonth >= w.createdAt.slice(0, 7))
    .filter((w) => !w.removedAt || salaryMonth <= w.removedAt.slice(0, 7))
    .map(makeRow);

  const openRows = salaryRows.filter((r) => !r.worker.settled);
  const settledRows = salaryRows.filter((r) => r.worker.settled);

  const handleSettle = (worker: Worker) => {
    settleWorker(worker.id);
    if (authUser) {
      logAudit({
        userId: authUser.id,
        userName: authUser.name,
        action: 'settle_worker',
        entity: 'worker',
        entityId: worker.id,
        detail: `Settled account for ${worker.name}`,
      });
    }
    showToast('success', `${worker.name} account settled`);
  };

  const handleReopen = (worker: Worker) => {
    unsettleWorker(worker.id);
    if (authUser) {
      logAudit({
        userId: authUser.id,
        userName: authUser.name,
        action: 'reopen_worker',
        entity: 'worker',
        entityId: worker.id,
        detail: `Reopened account for ${worker.name}`,
      });
    }
    showToast('success', `${worker.name} account reopened`);
  };

  const saveWorkerReport = async (workerId: string) => {
    const worker = workers.find((w) => w.id === workerId);
    if (!worker) return;
    try {
      await generateWorkerMonthlyPDF(worker, salaryMonth, records, allAdvances);
      showToast('success', `${worker.name} · ${monthLabel(salaryMonth)} PDF ready`);
    } catch {
      showToast('error', 'Could not generate PDF');
    }
  };

  const saveAllSalaryReports = async () => {
    if (salaryRows.length === 0) {
      showToast('error', 'No workers to export');
      return;
    }
    let ok = 0;
    for (const row of salaryRows) {
      try {
        await generateWorkerMonthlyPDF(row.worker, salaryMonth, records, allAdvances);
        ok++;
      } catch {
        // PDF generation failed for this worker; reflected in ok/total count below.
      }
    }
    showToast(
      ok === salaryRows.length ? 'success' : 'error',
      `Generated ${ok}/${salaryRows.length} salary PDFs for ${monthLabel(salaryMonth)}`
    );
  };

  const saveProductionReport = async () => {
    try {
      await generateProductionMonthlyPDF(products, productionMonth, monthLabel(productionMonth), displayNameFor);
      showToast('success', `Production PDF · ${monthLabel(productionMonth)} ready`);
    } catch {
      showToast('error', 'Could not generate PDF');
    }
  };

  const detailWorker = detailWorkerId ? workers.find((w) => w.id === detailWorkerId) : null;
  const allSalaryRows = [...salaryRows, ...removedRows];
  const detailRow = detailWorkerId
    ? allSalaryRows.find((r) => r.worker.id === detailWorkerId)
    : null;
  const monthDays = daysOfMonth(salaryMonth);
  const monthStart = monthDays[0];
  const monthEnd = monthDays[monthDays.length - 1];
  const detailAttendance =
    detailWorkerId && detailWorker
      ? Object.entries(records)
          .filter(([d]) => d >= monthStart && d <= monthEnd)
          .map(([date, dayRec]) => ({ date, rec: dayRec[detailWorkerId] }))
          .filter((x) => x.rec !== undefined)
          .sort((a, b) => b.date.localeCompare(a.date))
      : [];
  const detailAdvances = detailWorkerId
    ? allAdvances
        .filter((a) => a.workerId === detailWorkerId && a.date >= monthStart && a.date <= monthEnd)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const detailBreakdown = detailWorker
    ? computeCarryInBreakdown(detailWorker, salaryMonth, records, allAdvances)
    : null;

  const productionRows = products
    .flatMap((p) =>
      p.stockHistory
        .filter((h) => h.date >= dateFrom && h.date <= dateTo)
        .map((h) => ({
          date: h.date,
          productCode: p.code,
          productName: p.name,
          openingBags: h.openingBags,
          closingBags: h.closingBags,
          delta: h.closingBags - h.openingBags,
          deltaKg: bagsToKg(h.closingBags - h.openingBags),
          recordedBy: h.recordedBy ? displayNameFor(h.recordedBy) : '—',
        }))
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const productionByDate = useMemo(() => {
    const map = new Map<string, (typeof productionRows)[0][]>();
    for (const r of productionRows) {
      if (!map.has(r.date)) map.set(r.date, []);
      map.get(r.date)!.push(r);
    }
    return [...map.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, rows]) => ({
        date,
        totalDelta: rows.reduce((s, r) => s + r.delta, 0),
        totalKg: rows.reduce((s, r) => s + r.deltaKg, 0),
        rows,
      }));
  }, [productionRows]);

  const dispatchRows = entries
    .filter((e) => e.date >= dateFrom && e.date <= dateTo)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => ({ ...e, recordedBy: e.recordedBy ? displayNameFor(e.recordedBy) : '—' }));

  const auditRows = [...auditLogs]
    .filter((l) => l.timestamp.slice(0, 10) >= dateFrom && l.timestamp.slice(0, 10) <= dateTo)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const exportCSV = () => {
    if (Platform.OS !== 'web') return;
    let csv = '';
    if (activeTab === 'salary') {
      csv =
        'Worker,Daily Wage,Days Present,Partial Days,Days Absent,Gross Earned,Advance,Prev Balance,Net Payable\n';
      csv += salaryRows
        .map(
          (r) =>
            `"${r.worker.name}",${r.worker.dailyWage},${r.daysPresent},${r.partialDays},${r.daysAbsent},${r.totalEarned.toFixed(2)},${r.totalAdvance},${r.worker.previousBalance},${r.net.toFixed(2)}`
        )
        .join('\n');
    } else if (activeTab === 'production') {
      csv = 'Date,Code,Product,Delta (bags),Delta (kg),Open,Close,Recorded By\n';
      csv += productionRows
        .map(
          (r) =>
            `${r.date},${r.productCode},"${r.productName}",${r.delta},${r.deltaKg},${r.openingBags},${r.closingBags},"${r.recordedBy}"`
        )
        .join('\n');
    } else if (activeTab === 'dispatch') {
      csv = 'Date,Time,Product,Bags,Recipient,Vehicle,Recorded By\n';
      csv += dispatchRows
        .map(
          (r) =>
            `${r.date},${r.time},${r.productCode},${r.bags},"${r.recipient}","${r.vehicleNumber ?? ''}","${r.recordedBy ?? ''}"`
        )
        .join('\n');
    } else {
      csv = 'Timestamp,User,Action,Entity,Detail\n';
      csv += auditRows
        .map((l) => `${l.timestamp},"${l.userName}","${l.action}","${l.entity}","${l.detail}"`)
        .join('\n');
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opac-${activeTab}-report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const altRow = (i: number) => (i % 2 === 0 ? COLORS.bgSecondary : COLORS.bgTertiary);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        padding: isMobile ? 16 : 20,
        paddingBottom: isMobile ? 100 : 40,
      }}
    >
      <Text
        style={{
          color: COLORS.textPrimary,
          fontFamily: FONTS.serifSemibold,
          fontSize: isMobile ? 24 : 28,
          letterSpacing: -0.6,
          marginBottom: isMobile ? 16 : 20,
        }}
      >
        Reports
      </Text>

      <DatePickerModal
        visible={pickerTarget === 'from'}
        value={dateFrom}
        label="From Date"
        onConfirm={setDateFrom}
        onClose={() => setPickerTarget(null)}
      />
      <DatePickerModal
        visible={pickerTarget === 'to'}
        value={dateTo}
        label="To Date"
        onConfirm={setDateTo}
        onClose={() => setPickerTarget(null)}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Text
            style={{
              color: COLORS.textTertiary,
              fontFamily: FONTS.sansBold,
              fontSize: 11,
              marginBottom: 6,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            From
          </Text>
          <Pressable
            style={{
              backgroundColor: COLORS.bgSecondary,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: COLORS.borderColor,
              padding: 10,
            }}
            onPress={() => setPickerTarget('from')}
          >
            <Text
              style={{
                color: COLORS.textPrimary,
                fontFamily: FONTS.sansMedium,
                fontSize: 13,
              }}
            >
              {dateFrom}
            </Text>
          </Pressable>
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Text
            style={{
              color: COLORS.textTertiary,
              fontFamily: FONTS.sansBold,
              fontSize: 11,
              marginBottom: 6,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            To
          </Text>
          <Pressable
            style={{
              backgroundColor: COLORS.bgSecondary,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: COLORS.borderColor,
              padding: 10,
            }}
            onPress={() => setPickerTarget('to')}
          >
            <Text
              style={{
                color: COLORS.textPrimary,
                fontFamily: FONTS.sansMedium,
                fontSize: 13,
              }}
            >
              {dateTo}
            </Text>
          </Pressable>
        </View>
        {Platform.OS === 'web' && (
          <View style={{ justifyContent: 'flex-end' }}>
            <Pressable
              onPress={exportCSV}
              style={{
                backgroundColor: COLORS.accent,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: '#fff', fontFamily: FONTS.sansBold, fontSize: 13 }}>
                Export CSV
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: 'row' }}>
          <TabBtn
            label="Salary"
            active={activeTab === 'salary'}
            onPress={() => setActiveTab('salary')}
          />
          <TabBtn
            label="Production"
            active={activeTab === 'production'}
            onPress={() => setActiveTab('production')}
          />
          <TabBtn
            label="Dispatch"
            active={activeTab === 'dispatch'}
            onPress={() => setActiveTab('dispatch')}
          />
          <TabBtn
            label="Audit Log"
            active={activeTab === 'audit'}
            onPress={() => setActiveTab('audit')}
          />
        </View>
      </ScrollView>

      {activeTab === 'salary' && (
        <View>
          <Text
            style={{
              color: COLORS.textSecondary,
              fontFamily: FONTS.sansMedium,
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            On-screen totals follow the date range above. PDF salary slips are generated per month — pick the month below.
          </Text>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: COLORS.bgSecondary,
              borderWidth: 1,
              borderColor: COLORS.borderColor,
              borderRadius: 12,
              padding: 10,
              marginBottom: 12,
            }}
          >
            <Pressable
              onPress={() => setSalaryMonth(shiftMonthKey(salaryMonth, -1))}
              hitSlop={10}
              style={{
                padding: 6,
                borderRadius: 8,
                backgroundColor: COLORS.bgTertiary,
              }}
            >
              <ChevronLeft size={16} color={COLORS.textSecondary} />
            </Pressable>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text
                style={{
                  color: COLORS.textTertiary,
                  fontFamily: FONTS.sansBold,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                }}
              >
                PDF month
              </Text>
              <Text
                style={{
                  color: COLORS.textPrimary,
                  fontFamily: FONTS.sansExtraBold,
                  fontSize: 15,
                  marginTop: 2,
                }}
              >
                {monthLabel(salaryMonth)}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                const next = shiftMonthKey(salaryMonth, 1);
                if (next <= currentMonthKey()) setSalaryMonth(next);
              }}
              hitSlop={10}
              style={{
                padding: 6,
                borderRadius: 8,
                backgroundColor: COLORS.bgTertiary,
                opacity: salaryMonth >= currentMonthKey() ? 0.35 : 1,
              }}
            >
              <ChevronRight size={16} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() => saveAllSalaryReports()}
              style={{
                backgroundColor: COLORS.accent,
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 10,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <FileText size={14} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: FONTS.sansBold, fontSize: 12 }}>
                Save All PDFs ({monthLabel(salaryMonth)})
              </Text>
            </Pressable>
            {settledRows.length > 0 && (
              <Pressable
                onPress={() => setShowSettled((v) => !v)}
                style={{
                  backgroundColor: COLORS.bgSecondary,
                  borderWidth: 1,
                  borderColor: COLORS.borderColor,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {showSettled ? (
                  <ChevronUp size={14} color={COLORS.textSecondary} />
                ) : (
                  <ChevronDown size={14} color={COLORS.textSecondary} />
                )}
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontFamily: FONTS.sansBold,
                    fontSize: 12,
                  }}
                >
                  {showSettled ? 'Hide' : 'Show'} settled ({settledRows.length})
                </Text>
              </Pressable>
            )}
            {removedRows.length > 0 && (
              <Pressable
                onPress={() => setShowRemoved((v) => !v)}
                style={{
                  backgroundColor: COLORS.bgSecondary,
                  borderWidth: 1,
                  borderColor: COLORS.borderColor,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {showRemoved ? (
                  <ChevronUp size={14} color={COLORS.textSecondary} />
                ) : (
                  <ChevronDown size={14} color={COLORS.textSecondary} />
                )}
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontFamily: FONTS.sansBold,
                    fontSize: 12,
                  }}
                >
                  {showRemoved ? 'Hide' : 'Show'} removed ({removedRows.length})
                </Text>
              </Pressable>
            )}
          </View>

          {(!workersHydrated || !attendanceHydrated) && (
            <Text
              style={{
                color: COLORS.textTertiary,
                fontFamily: FONTS.sansMedium,
                textAlign: 'center',
                marginTop: 24,
              }}
            >
              Loading...
            </Text>
          )}
          {workersHydrated && attendanceHydrated && salaryRows.length === 0 && (
            <Text
              style={{
                color: COLORS.textTertiary,
                fontFamily: FONTS.sansMedium,
                textAlign: 'center',
                marginTop: 24,
              }}
            >
              No workers found
            </Text>
          )}
          {openRows.map((r) => (
            <Pressable
              key={r.worker.id}
              onPress={() => setDetailWorkerId(r.worker.id)}
              style={{
                backgroundColor: COLORS.bgSecondary,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}
              >
                <Text
                  style={{
                    color: COLORS.textPrimary,
                    fontFamily: FONTS.sansBold,
                    fontSize: 15,
                  }}
                >
                  {r.worker.name}
                </Text>
                <Text
                  style={{
                    color: COLORS.accent,
                    fontFamily: FONTS.sansExtraBold,
                    fontSize: 16,
                  }}
                >
                  ₹{r.net.toFixed(0)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: COLORS.bgTertiary,
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <Text
                    style={{ color: COLORS.textTertiary, fontFamily: FONTS.sansBold, fontSize: 10 }}
                  >
                    PRESENT
                  </Text>
                  <Text style={{ color: COLORS.accent, fontFamily: FONTS.sansBold }}>
                    {r.daysPresent}d
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: COLORS.bgTertiary,
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <Text
                    style={{ color: COLORS.textTertiary, fontFamily: FONTS.sansBold, fontSize: 10 }}
                  >
                    PARTIAL
                  </Text>
                  <Text style={{ color: COLORS.warning, fontFamily: FONTS.sansBold }}>
                    {r.partialDays}d
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    backgroundColor: COLORS.bgTertiary,
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <Text
                    style={{ color: COLORS.textTertiary, fontFamily: FONTS.sansBold, fontSize: 10 }}
                  >
                    ABSENT
                  </Text>
                  <Text style={{ color: COLORS.error, fontFamily: FONTS.sansBold }}>
                    {r.daysAbsent}d
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 12,
                  }}
                >
                  Gross:{' '}
                  <Text style={{ color: COLORS.textPrimary, fontFamily: FONTS.sansSemibold }}>
                    ₹{r.totalEarned.toFixed(0)}
                  </Text>
                </Text>
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 12,
                  }}
                >
                  Advance:{' '}
                  <Text style={{ color: COLORS.error, fontFamily: FONTS.sansSemibold }}>
                    −₹{r.totalAdvance}
                  </Text>
                </Text>
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 12,
                  }}
                >
                  Carry-in:{' '}
                  <Text
                    style={{
                      color: r.opening >= 0 ? COLORS.textPrimary : COLORS.error,
                      fontFamily: FONTS.sansSemibold,
                    }}
                  >
                    {r.opening >= 0 ? '+' : '−'}₹{Math.abs(r.opening).toFixed(0)}
                  </Text>
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: COLORS.borderColor,
                }}
              >
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    saveWorkerReport(r.worker.id);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: COLORS.bgTertiary,
                    paddingVertical: 9,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <FileText size={13} color={COLORS.textSecondary} />
                  <Text
                    style={{
                      color: COLORS.textSecondary,
                      fontFamily: FONTS.sansBold,
                      fontSize: 11,
                    }}
                  >
                    PDF · {monthLabel(salaryMonth)}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setSettleTarget(r.worker);
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: COLORS.accentSoftBg,
                    borderWidth: 1,
                    borderColor: COLORS.accentSoftBorder,
                    paddingVertical: 9,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Lock size={13} color={COLORS.accent} />
                  <Text
                    style={{ color: COLORS.accent, fontFamily: FONTS.sansBold, fontSize: 11 }}
                  >
                    Settle Account
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          ))}

          {showSettled &&
            settledRows.map((r) => (
              <View
                key={r.worker.id}
                style={{
                  backgroundColor: COLORS.bgTertiary,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: COLORS.borderColor,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Lock size={13} color={COLORS.textTertiary} />
                  <Text
                    style={{
                      color: COLORS.textSecondary,
                      fontFamily: FONTS.sansSemibold,
                      fontSize: 13,
                    }}
                  >
                    {r.worker.name}
                  </Text>
                  <Text
                    style={{
                      color: COLORS.textTertiary,
                      fontFamily: FONTS.sansMedium,
                      fontSize: 11,
                    }}
                  >
                    settled
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable
                    onPress={() => setDetailWorkerId(r.worker.id)}
                    hitSlop={6}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: COLORS.borderColor,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.textSecondary,
                        fontFamily: FONTS.sansBold,
                        fontSize: 11,
                      }}
                    >
                      View
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setReopenTarget(r.worker)}
                    hitSlop={6}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 6,
                      backgroundColor: COLORS.accentSoftBg,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Unlock size={11} color={COLORS.accent} />
                    <Text
                      style={{ color: COLORS.accent, fontFamily: FONTS.sansBold, fontSize: 11 }}
                    >
                      Reopen
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}

          {showRemoved &&
            removedRows.map((r) => (
              <View
                key={r.worker.id}
                style={{
                  backgroundColor: COLORS.bgTertiary,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: COLORS.borderColor,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  opacity: 0.8,
                }}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text
                    style={{
                      color: COLORS.textSecondary,
                      fontFamily: FONTS.sansSemibold,
                      fontSize: 13,
                    }}
                  >
                    {r.worker.name}
                  </Text>
                  <Text
                    style={{
                      color: COLORS.textTertiary,
                      fontFamily: FONTS.sansMedium,
                      fontSize: 11,
                    }}
                  >
                    removed
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Pressable
                    onPress={() => setDetailWorkerId(r.worker.id)}
                    hitSlop={6}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: COLORS.borderColor,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.textSecondary,
                        fontFamily: FONTS.sansBold,
                        fontSize: 11,
                      }}
                    >
                      View
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      saveWorkerReport(r.worker.id);
                    }}
                    hitSlop={6}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: COLORS.borderColor,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <FileText size={11} color={COLORS.textSecondary} />
                    <Text
                      style={{
                        color: COLORS.textSecondary,
                        fontFamily: FONTS.sansBold,
                        fontSize: 11,
                      }}
                    >
                      PDF
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
        </View>
      )}

      {activeTab === 'production' && isMobile && (
        <View>
          <ProductionMonthStepper
            month={productionMonth}
            isMobile
            onPrev={() => setProductionMonth(shiftMonthKey(productionMonth, -1))}
            onNext={() => {
              const next = shiftMonthKey(productionMonth, 1);
              if (next <= currentMonthKey()) setProductionMonth(next);
            }}
            onSave={saveProductionReport}
          />

          {productionByDate.length === 0 && (
            <View
              style={{
                padding: 24,
                alignItems: 'center',
                backgroundColor: COLORS.bgSecondary,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
              }}
            >
              <Text style={{ color: COLORS.textTertiary, fontFamily: FONTS.sansMedium }}>
                No production records in range
              </Text>
            </View>
          )}
          {productionByDate.map((group) => (
            <View
              key={group.date}
              style={{
                backgroundColor: COLORS.bgSecondary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
                marginBottom: 10,
                overflow: 'hidden',
              }}
            >
              {/* Date group header */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: COLORS.bgTertiary,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.borderColor,
                }}
              >
                <Text
                  style={{
                    color: COLORS.textPrimary,
                    fontFamily: FONTS.sansBold,
                    fontSize: 13,
                  }}
                >
                  {group.date}
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      color: COLORS.accent,
                      fontFamily: FONTS.sansExtraBold,
                      fontSize: 14,
                    }}
                  >
                    +{group.totalDelta} bags
                  </Text>
                  <Text
                    style={{
                      color: COLORS.textTertiary,
                      fontFamily: FONTS.sansMedium,
                      fontSize: 10,
                    }}
                  >
                    {group.totalKg} kg · {group.rows.length} product{group.rows.length !== 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
              {/* Product rows */}
              {group.rows.map((r, i) => (
                <View
                  key={i}
                  style={{
                    padding: 10,
                    paddingLeft: 14,
                    backgroundColor: i % 2 === 0 ? COLORS.bgSecondary : COLORS.bgPrimary,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: COLORS.borderColor,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.textPrimary,
                        fontFamily: 'ui-monospace',
                        fontSize: 12,
                        fontWeight: '700',
                      }}
                    >
                      {r.productCode}
                    </Text>
                    <Text
                      style={{
                        color: r.delta >= 0 ? COLORS.accent : COLORS.error,
                        fontFamily: FONTS.sansBold,
                        fontSize: 14,
                      }}
                    >
                      {r.delta >= 0 ? '+' : ''}
                      {r.delta} bags
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      <Text
                        style={{
                          color: COLORS.textTertiary,
                          fontFamily: FONTS.sansMedium,
                          fontSize: 11,
                        }}
                      >
                        {r.openingBags} → {r.closingBags}
                      </Text>
                      <Text
                        style={{
                          color: COLORS.textTertiary,
                          fontFamily: FONTS.sansMedium,
                          fontSize: 11,
                        }}
                      >
                        {r.deltaKg} kg
                      </Text>
                    </View>
                    <Text
                      style={{
                        color: COLORS.textTertiary,
                        fontFamily: FONTS.sansMedium,
                        fontSize: 10,
                      }}
                    >
                      {r.recordedBy}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      {activeTab === 'production' && !isMobile && (
        <View>
          <ProductionMonthStepper
            month={productionMonth}
            isMobile={false}
            onPrev={() => setProductionMonth(shiftMonthKey(productionMonth, -1))}
            onNext={() => {
              const next = shiftMonthKey(productionMonth, 1);
              if (next <= currentMonthKey()) setProductionMonth(next);
            }}
            onSave={saveProductionReport}
          />

          {/* Grouped production table */}
          <View
            style={{
              backgroundColor: COLORS.bgSecondary,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: COLORS.borderColor,
              overflow: 'hidden',
            }}
          >
            <TableHeader cols={['Date', 'Code', 'Δ bags', 'Open', 'Close', 'Δ kg', 'By']} />
            {productionByDate.length === 0 && (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: COLORS.textTertiary, fontFamily: FONTS.sansMedium }}>
                  No production records in range
                </Text>
              </View>
            )}
            {productionByDate.map((group, gi) => (
              <View key={group.date}>
                {/* Date group header row */}
                <View
                  style={{
                    flexDirection: 'row',
                    padding: 10,
                    backgroundColor: COLORS.bgTertiary,
                    borderTopWidth: gi > 0 ? 2 : 1,
                    borderTopColor: COLORS.borderStrong,
                  }}
                >
                  <Text
                    style={{
                      flex: 1,
                      color: COLORS.textPrimary,
                      fontFamily: FONTS.sansBold,
                      fontSize: 11,
                    }}
                  >
                    {group.date}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      color: COLORS.textTertiary,
                      fontFamily: FONTS.sansMedium,
                      fontSize: 10,
                    }}
                  >
                    {group.rows.length} product{group.rows.length !== 1 ? 's' : ''}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      color: COLORS.accent,
                      fontFamily: FONTS.sansBold,
                      fontSize: 11,
                    }}
                  >
                    +{group.totalDelta} total
                  </Text>
                  <Text
                    style={{ flex: 1, color: COLORS.textTertiary, fontFamily: FONTS.sansMedium, fontSize: 10 }}
                  />
                  <Text
                    style={{ flex: 1, color: COLORS.textTertiary, fontFamily: FONTS.sansMedium, fontSize: 10 }}
                  />
                  <Text
                    style={{
                      flex: 1,
                      color: COLORS.accent,
                      fontFamily: FONTS.sansMedium,
                      fontSize: 11,
                    }}
                  >
                    {group.totalKg} kg
                  </Text>
                  <Text
                    style={{ flex: 1, color: COLORS.textTertiary, fontFamily: FONTS.sansMedium, fontSize: 10 }}
                  />
                </View>
                {/* Product sub-rows */}
                {group.rows.map((r, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      padding: 10,
                      paddingLeft: 16,
                      backgroundColor: i % 2 === 0 ? COLORS.bgSecondary : COLORS.bgPrimary,
                      borderTopWidth: 1,
                      borderTopColor: COLORS.borderColor,
                    }}
                  >
                    <Text
                      style={{ flex: 1, color: COLORS.textTertiary, fontFamily: FONTS.sansMedium, fontSize: 11 }}
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: COLORS.textPrimary,
                        fontFamily: 'ui-monospace',
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      {r.productCode}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        color: r.delta >= 0 ? COLORS.accent : COLORS.error,
                        fontFamily: FONTS.sansSemibold,
                        fontSize: 11,
                      }}
                    >
                      {r.delta >= 0 ? '+' : ''}
                      {r.delta}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        color: COLORS.textSecondary,
                        fontFamily: FONTS.sansMedium,
                        fontSize: 11,
                      }}
                    >
                      {r.openingBags}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        color: COLORS.textSecondary,
                        fontFamily: FONTS.sansMedium,
                        fontSize: 11,
                      }}
                    >
                      {r.closingBags}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        color: r.deltaKg >= 0 ? COLORS.accent : COLORS.error,
                        fontFamily: FONTS.sansSemibold,
                        fontSize: 11,
                      }}
                    >
                      {r.deltaKg}
                    </Text>
                    <Text
                      style={{
                        flex: 1,
                        color: COLORS.textTertiary,
                        fontFamily: FONTS.sansMedium,
                        fontSize: 10,
                      }}
                    >
                      {r.recordedBy}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      )}

      {activeTab === 'dispatch' && isMobile && (
        <View>
          {dispatchRows.length === 0 && (
            <View
              style={{
                padding: 24,
                alignItems: 'center',
                backgroundColor: COLORS.bgSecondary,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
              }}
            >
              <Text style={{ color: COLORS.textTertiary, fontFamily: FONTS.sansMedium }}>
                No dispatch records in range
              </Text>
            </View>
          )}
          {dispatchRows.map((r) => (
            <View
              key={r.id}
              style={{
                backgroundColor: COLORS.bgSecondary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 6,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text
                    style={{
                      color: COLORS.textPrimary,
                      fontFamily: 'ui-monospace',
                      fontSize: 13,
                      fontWeight: '700',
                    }}
                  >
                    {r.productCode}
                  </Text>
                  <Text
                    style={{
                      color: COLORS.textPrimary,
                      fontFamily: FONTS.sansBold,
                      fontSize: 13,
                    }}
                  >
                    · {r.bags} bags
                  </Text>
                </View>
                <Text
                  style={{
                    color: COLORS.textTertiary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 11,
                  }}
                >
                  {r.date}
                </Text>
              </View>
              <Text
                style={{
                  color: COLORS.textSecondary,
                  fontFamily: FONTS.sansSemibold,
                  fontSize: 12,
                  marginBottom: 2,
                }}
                numberOfLines={1}
              >
                {r.recipient}
              </Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text
                  style={{
                    color: COLORS.textTertiary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 11,
                  }}
                >
                  {r.vehicleNumber ?? '—'}
                </Text>
                <Text
                  style={{
                    color: COLORS.textTertiary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 10,
                  }}
                >
                  By {r.recordedBy ?? '—'}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {activeTab === 'dispatch' && !isMobile && (
        <View
          style={{
            backgroundColor: COLORS.bgSecondary,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: COLORS.borderColor,
            overflow: 'hidden',
          }}
        >
          <TableHeader cols={['Date', 'Product', 'Bags', 'Recipient', 'Vehicle', 'By']} />
          {dispatchRows.length === 0 && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: COLORS.textTertiary, fontFamily: FONTS.sansMedium }}>
                No dispatch records in range
              </Text>
            </View>
          )}
          {dispatchRows.map((r, i) => (
            <View
              key={r.id}
              style={{
                flexDirection: 'row',
                padding: 10,
                backgroundColor: altRow(i),
                borderTopWidth: 1,
                borderTopColor: COLORS.borderColor,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  color: COLORS.textSecondary,
                  fontFamily: FONTS.sansMedium,
                  fontSize: 11,
                }}
              >
                {r.date}
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: COLORS.textPrimary,
                  fontFamily: 'ui-monospace',
                  fontSize: 11,
                  fontWeight: '700',
                }}
              >
                {r.productCode}
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: COLORS.textPrimary,
                  fontFamily: FONTS.sansSemibold,
                  fontSize: 11,
                }}
              >
                {r.bags}
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: COLORS.textSecondary,
                  fontFamily: FONTS.sansMedium,
                  fontSize: 11,
                }}
                numberOfLines={1}
              >
                {r.recipient}
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: COLORS.textTertiary,
                  fontFamily: FONTS.sansMedium,
                  fontSize: 11,
                }}
              >
                {r.vehicleNumber ?? '—'}
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: COLORS.textTertiary,
                  fontFamily: FONTS.sansMedium,
                  fontSize: 10,
                }}
              >
                {r.recordedBy ?? '—'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {activeTab === 'audit' && isMobile && (
        <View>
          {auditRows.length === 0 && (
            <View
              style={{
                padding: 24,
                alignItems: 'center',
                backgroundColor: COLORS.bgSecondary,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
              }}
            >
              <Text style={{ color: COLORS.textTertiary, fontFamily: FONTS.sansMedium }}>
                No audit entries in range
              </Text>
            </View>
          )}
          {auditRows.map((l) => (
            <View
              key={l.id}
              style={{
                backgroundColor: COLORS.bgSecondary,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
                padding: 12,
                marginBottom: 8,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}
              >
                <Text
                  style={{
                    color: COLORS.textPrimary,
                    fontFamily: FONTS.sansBold,
                    fontSize: 12,
                  }}
                >
                  {l.action.replace(/_/g, ' ')}
                </Text>
                <Text
                  style={{
                    color: COLORS.textTertiary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 10,
                  }}
                >
                  {l.timestamp.slice(0, 16).replace('T', ' ')}
                </Text>
              </View>
              <Text
                style={{
                  color: COLORS.textSecondary,
                  fontFamily: FONTS.sansMedium,
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                {l.detail}
              </Text>
              <Text
                style={{
                  color: COLORS.textTertiary,
                  fontFamily: FONTS.sansSemibold,
                  fontSize: 10,
                }}
              >
                by {l.userName}
              </Text>
            </View>
          ))}
        </View>
      )}

      {activeTab === 'audit' && !isMobile && (
        <View
          style={{
            backgroundColor: COLORS.bgSecondary,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: COLORS.borderColor,
            overflow: 'hidden',
          }}
        >
          <TableHeader cols={['Time', 'User', 'Action', 'Detail']} />
          {auditRows.length === 0 && (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: COLORS.textTertiary, fontFamily: FONTS.sansMedium }}>
                No audit entries in range
              </Text>
            </View>
          )}
          {auditRows.map((l, i) => (
            <View
              key={l.id}
              style={{
                flexDirection: 'row',
                padding: 10,
                backgroundColor: altRow(i),
                borderTopWidth: 1,
                borderTopColor: COLORS.borderColor,
              }}
            >
              <Text
                style={{
                  flex: 1.2,
                  color: COLORS.textTertiary,
                  fontFamily: FONTS.sansMedium,
                  fontSize: 10,
                }}
              >
                {l.timestamp.slice(0, 16).replace('T', ' ')}
              </Text>
              <Text
                style={{
                  flex: 0.8,
                  color: COLORS.textSecondary,
                  fontFamily: FONTS.sansSemibold,
                  fontSize: 11,
                }}
              >
                {l.userName}
              </Text>
              <Text
                style={{
                  flex: 1,
                  color: COLORS.textSecondary,
                  fontFamily: FONTS.sansMedium,
                  fontSize: 11,
                }}
              >
                {l.action.replace(/_/g, ' ')}
              </Text>
              <Text
                style={{
                  flex: 1.5,
                  color: COLORS.textPrimary,
                  fontFamily: FONTS.sansMedium,
                  fontSize: 11,
                }}
                numberOfLines={2}
              >
                {l.detail}
              </Text>
            </View>
          ))}
        </View>
      )}

      <Modal
        visible={detailWorker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailWorkerId(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(15,23,42,0.4)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: COLORS.bgSecondary,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: COLORS.borderColor,
              width: '100%',
              maxWidth: 560,
              maxHeight: '90%',
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: COLORS.borderColor,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: COLORS.textPrimary,
                    fontFamily: FONTS.sansExtraBold,
                    fontSize: 16,
                  }}
                >
                  {detailWorker?.name}
                </Text>
                <Text
                  style={{
                    color: COLORS.textTertiary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 11,
                    marginTop: 2,
                  }}
                >
                  {monthLabel(salaryMonth)} · ₹{detailWorker?.dailyWage}/day
                  {detailWorker?.settled ? ' · SETTLED' : ''}
                </Text>
              </View>
              <Pressable
                onPress={() => setDetailWorkerId(null)}
                hitSlop={8}
                style={{ padding: 4 }}
              >
                <XIcon size={20} color={COLORS.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ padding: 16 }}>
              {detailRow && (
                <View
                  style={{
                    backgroundColor: COLORS.bgTertiary,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 14,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.textSecondary,
                        fontFamily: FONTS.sansSemibold,
                        fontSize: 12,
                      }}
                    >
                      Net Payable
                    </Text>
                    <Text
                      style={{
                        color: COLORS.accent,
                        fontFamily: FONTS.sansExtraBold,
                        fontSize: 18,
                      }}
                    >
                      ₹{detailRow.net.toFixed(0)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    <Text
                      style={{
                        color: COLORS.textSecondary,
                        fontFamily: FONTS.sansMedium,
                        fontSize: 11,
                      }}
                    >
                      Present {detailRow.daysPresent}d · Partial {detailRow.partialDays}d ·
                      Absent {detailRow.daysAbsent}d
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: COLORS.textSecondary,
                      fontFamily: FONTS.sansMedium,
                      fontSize: 11,
                      marginTop: 4,
                    }}
                  >
                    Gross ₹{detailRow.totalEarned.toFixed(0)} − Advances ₹
                    {detailRow.totalAdvance} {detailRow.opening >= 0 ? '+' : '−'} Carry-in ₹
                    {Math.abs(detailRow.opening).toFixed(0)}
                  </Text>
                </View>
              )}

              {detailBreakdown && (detailBreakdown.lines.length > 0 || detailBreakdown.seed !== 0) && (
                <View style={{ marginBottom: 14 }}>
                  <Text
                    style={{
                      color: COLORS.textTertiary,
                      fontFamily: FONTS.sansBold,
                      fontSize: 11,
                      letterSpacing: 1,
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    Carry-in Chain (months before {monthLabel(salaryMonth)})
                  </Text>
                  {detailBreakdown.seed !== 0 && (
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        padding: 8,
                        backgroundColor: COLORS.bgSecondary,
                        borderRadius: 6,
                        marginBottom: 2,
                      }}
                    >
                      <Text style={{ color: COLORS.textSecondary, fontFamily: FONTS.sansMedium, fontSize: 12 }}>
                        Seed (worker.previousBalance)
                      </Text>
                      <Text style={{ color: COLORS.textPrimary, fontFamily: FONTS.sansBold, fontSize: 12 }}>
                        {detailBreakdown.seed >= 0 ? '+' : '−'}₹{Math.abs(detailBreakdown.seed).toFixed(0)}
                      </Text>
                    </View>
                  )}
                  {detailBreakdown.lines.map((line, i) => (
                    <View
                      key={line.monthKey}
                      style={{
                        padding: 8,
                        backgroundColor: i % 2 === 0 ? COLORS.bgSecondary : COLORS.bgTertiary,
                        borderRadius: 6,
                        marginBottom: 2,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: COLORS.textPrimary, fontFamily: FONTS.sansSemibold, fontSize: 12 }}>
                          {line.monthLabel}
                        </Text>
                        <Text
                          style={{
                            color: line.net >= 0 ? COLORS.accent : COLORS.error,
                            fontFamily: FONTS.sansBold,
                            fontSize: 12,
                          }}
                        >
                          {line.net >= 0 ? '+' : '−'}₹{Math.abs(line.net).toFixed(0)}
                        </Text>
                      </View>
                      <Text
                        style={{
                          color: COLORS.textTertiary,
                          fontFamily: FONTS.sansMedium,
                          fontSize: 10,
                          marginTop: 2,
                        }}
                      >
                        Gross ₹{line.gross.toFixed(0)} − Advances ₹{line.advance.toFixed(0)} · running ₹
                        {line.runningBalance.toFixed(0)}
                      </Text>
                    </View>
                  ))}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      padding: 8,
                      marginTop: 4,
                      borderTopWidth: 1,
                      borderTopColor: COLORS.borderColor,
                    }}
                  >
                    <Text style={{ color: COLORS.textPrimary, fontFamily: FONTS.sansBold, fontSize: 12 }}>
                      Opening balance entering {monthLabel(salaryMonth)}
                    </Text>
                    <Text
                      style={{
                        color: detailBreakdown.opening >= 0 ? COLORS.accent : COLORS.error,
                        fontFamily: FONTS.sansExtraBold,
                        fontSize: 13,
                      }}
                    >
                      {detailBreakdown.opening >= 0 ? '+' : '−'}₹
                      {Math.abs(detailBreakdown.opening).toFixed(0)}
                    </Text>
                  </View>
                </View>
              )}

              <Text
                style={{
                  color: COLORS.textTertiary,
                  fontFamily: FONTS.sansBold,
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Attendance
              </Text>
              {detailAttendance.length === 0 ? (
                <Text
                  style={{
                    color: COLORS.textTertiary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 12,
                    marginBottom: 14,
                  }}
                >
                  No attendance records in range.
                </Text>
              ) : (
                <View style={{ marginBottom: 14 }}>
                  {detailAttendance.map((e, i) => {
                    const status = e.rec!.status;
                    const night = e.rec!.night ?? false;
                    const overtime = e.rec!.overtimeHours;
                    const label = statusLabel(status, night, overtime);
                    const color =
                      status === 'absent'
                        ? COLORS.error
                        : status === 'full' || status === 'night'
                          ? COLORS.accent
                          : COLORS.warning;
                    const earned = detailWorker
                      ? earningsFor(status, wageForDate(detailWorker, e.date), night, overtime)
                      : 0;
                    return (
                      <View
                        key={e.date}
                        style={{
                          flexDirection: 'row',
                          padding: 8,
                          backgroundColor: i % 2 === 0 ? COLORS.bgSecondary : COLORS.bgTertiary,
                          borderRadius: 6,
                          marginBottom: 2,
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{
                            flex: 1,
                            color: COLORS.textSecondary,
                            fontFamily: FONTS.sansMedium,
                            fontSize: 12,
                          }}
                        >
                          {e.date}
                        </Text>
                        <Text
                          style={{
                            flex: 1,
                            color,
                            fontFamily: FONTS.sansBold,
                            fontSize: 12,
                          }}
                        >
                          {label}
                        </Text>
                        <Text
                          style={{
                            color: COLORS.textPrimary,
                            fontFamily: FONTS.sansSemibold,
                            fontSize: 12,
                          }}
                        >
                          ₹{earned.toFixed(0)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <Text
                style={{
                  color: COLORS.textTertiary,
                  fontFamily: FONTS.sansBold,
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Advance Payments
              </Text>
              {detailAdvances.length === 0 ? (
                <Text
                  style={{
                    color: COLORS.textTertiary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 12,
                    marginBottom: 14,
                  }}
                >
                  No advances in range.
                </Text>
              ) : (
                <View style={{ marginBottom: 14 }}>
                  {detailAdvances.map((a, i) => (
                    <View
                      key={a.id}
                      style={{
                        padding: 8,
                        backgroundColor: i % 2 === 0 ? COLORS.bgSecondary : COLORS.bgTertiary,
                        borderRadius: 6,
                        marginBottom: 2,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: COLORS.textSecondary,
                            fontFamily: FONTS.sansMedium,
                            fontSize: 12,
                          }}
                        >
                          {a.date}
                        </Text>
                        <Text
                          style={{
                            color: COLORS.error,
                            fontFamily: FONTS.sansBold,
                            fontSize: 12,
                          }}
                        >
                          −₹{a.amount}
                        </Text>
                      </View>
                      {a.note ? (
                        <Text
                          style={{
                            color: COLORS.textTertiary,
                            fontFamily: FONTS.sansMedium,
                            fontSize: 11,
                            marginTop: 2,
                          }}
                        >
                          {a.note}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View
              style={{
                flexDirection: 'row',
                gap: 8,
                padding: 12,
                borderTopWidth: 1,
                borderTopColor: COLORS.borderColor,
              }}
            >
              <Pressable
                onPress={() => detailWorker && saveWorkerReport(detailWorker.id)}
                style={{
                  flex: 1,
                  backgroundColor: COLORS.accent,
                  paddingVertical: 11,
                  borderRadius: 10,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <FileText size={14} color="#fff" />
                <Text style={{ color: '#fff', fontFamily: FONTS.sansBold, fontSize: 13 }}>
                  Save PDF · {monthLabel(salaryMonth)}
                </Text>
              </Pressable>
              {detailWorker?.settled ? (
                <Pressable
                  onPress={() => {
                    if (detailWorker) {
                      setReopenTarget(detailWorker);
                      setDetailWorkerId(null);
                    }
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: COLORS.bgTertiary,
                    paddingVertical: 11,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Unlock size={14} color={COLORS.textSecondary} />
                  <Text
                    style={{
                      color: COLORS.textSecondary,
                      fontFamily: FONTS.sansBold,
                      fontSize: 13,
                    }}
                  >
                    Reopen
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    if (detailWorker) {
                      setSettleTarget(detailWorker);
                      setDetailWorkerId(null);
                    }
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: COLORS.bgTertiary,
                    paddingVertical: 11,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Lock size={14} color={COLORS.textSecondary} />
                  <Text
                    style={{
                      color: COLORS.textSecondary,
                      fontFamily: FONTS.sansBold,
                      fontSize: 13,
                    }}
                  >
                    Settle
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        open={settleTarget !== null}
        title="Settle worker account?"
        message={
          settleTarget
            ? `Mark ${settleTarget.name}'s account as settled? They will move to the settled list and stop appearing on the active payroll. You can reopen later.`
            : ''
        }
        confirmLabel="Settle"
        onCancel={() => setSettleTarget(null)}
        onConfirm={() => {
          if (settleTarget) handleSettle(settleTarget);
          setSettleTarget(null);
        }}
      />

      <ConfirmDialog
        open={reopenTarget !== null}
        title="Reopen worker account?"
        message={
          reopenTarget
            ? `Reopen ${reopenTarget.name}'s account? They will move back to the active salary list.`
            : ''
        }
        confirmLabel="Reopen"
        onCancel={() => setReopenTarget(null)}
        onConfirm={() => {
          if (reopenTarget) handleReopen(reopenTarget);
          setReopenTarget(null);
        }}
      />
    </ScrollView>
  );
}
