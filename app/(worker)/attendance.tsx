import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, Animated, ActivityIndicator } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { TextField } from '@/components/TextField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { InlineDatePicker } from '@/components/InlineDatePicker';
import { useAttendanceStore } from '@/store/attendanceStore';
import { useWorkersStore } from '@/store/workersStore';
import { useAuthStore } from '@/store/authStore';
import { useUsersStore } from '@/store/usersStore';
import { useAuditStore } from '@/store/auditStore';
import { useUiStore } from '@/store/uiStore';
import { todayISO, formatDateReadable, shiftDate } from '@/lib/date';
import type { AttendanceStatus } from '@/types';
import { computeMonthlySalary, shiftMonthKey, currentMonthKey } from '@/lib/salary';
import {
  CheckCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
  DollarSign,
  WifiOff,
  Pencil,
  TrendingUp,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '@/constants';


function statusLabel(status: AttendanceStatus | undefined, night?: boolean, overtimeHours?: number): string {
  if (!status) return night ? 'Night' : '';
  if (status === 'absent') return 'Absent';
  if (status === 'night') return 'Night';
  const otPart = overtimeHours ? ` +${overtimeHours}h OT` : '';
  if (status === 'full') return night ? `Full Day${otPart} + Night` : `Full Day${otPart}`;
  if (typeof status === 'object') return night ? `${status.hours}h + Night` : `${status.hours}h`;
  return '';
}

function statusColor(status: AttendanceStatus | undefined): string {
  if (!status) return COLORS.textTertiary;
  if (status === 'absent') return COLORS.error;
  if (status === 'full' || status === 'night') return COLORS.accent;
  return COLORS.warning;
}

export default function AttendanceScreen() {
  const mark = useAttendanceStore((s) => s.mark);
  const unmark = useAttendanceStore((s) => s.unmark);
  const toggleNight = useAttendanceStore((s) => s.toggleNight);
  const getRecordsForDate = useAttendanceStore((s) => s.getRecordsForDate);
  const canEdit = useAttendanceStore((s) => s.canEdit);
  const getSyncStatus = useAttendanceStore((s) => s.getSyncStatus);
  const syncStatus = useAttendanceStore((s) => s.syncStatus);
  const allRecords = useAttendanceStore((s) => s.records);
  const retrySync = useAttendanceStore((s) => s.retrySync);
  const getActiveWorkers = useWorkersStore((s) => s.getActiveWorkers);
  const getWorkersForDate = useWorkersStore((s) => s.getWorkersForDate);
  const addWorker = useWorkersStore((s) => s.addWorker);
  const removeWorker = useWorkersStore((s) => s.removeWorker);
  const addAdvance = useWorkersStore((s) => s.addAdvance);
  const editAdvance = useWorkersStore((s) => s.editAdvance);
  const deleteAdvance = useWorkersStore((s) => s.deleteAdvance);
  const updateWorkerWage = useWorkersStore((s) => s.updateWorkerWage);
  const allWorkersStore = useWorkersStore((s) => s.workers);
  const allAdvances = useWorkersStore((s) => s.advances);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const displayNameFor = useUsersStore((s) => s.displayNameFor);
  const logAudit = useAuditStore((s) => s.log);
  const showToast = useUiStore((s) => s.showToast);

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [hoursInput, setHoursInput] = useState<Record<string, string>>({});
  // Track whether the hours input is for overtime (present already selected) vs partial hours
  const [hoursIsOvertime, setHoursIsOvertime] = useState<Record<string, boolean>>({});
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [showAdvance, setShowAdvance] = useState(false);
  const [advanceWorkerId, setAdvanceWorkerId] = useState('');

  const [newName, setNewName] = useState('');
  const [newWage, setNewWage] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [newJoinDate, setNewJoinDate] = useState(todayISO());

  const [advAmt, setAdvAmt] = useState('');
  const [advDate, setAdvDate] = useState(todayISO());
  const [advNote, setAdvNote] = useState('');
  const [editAdvanceId, setEditAdvanceId] = useState<string | null>(null);
  const [deleteAdvanceTarget, setDeleteAdvanceTarget] = useState<{ id: string; workerName: string; amount: number } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [showWageSheet, setShowWageSheet] = useState(false);
  const [wageWorkerId, setWageWorkerId] = useState('');
  const [newWageAmt, setNewWageAmt] = useState('');
  const [newWageDate, setNewWageDate] = useState(todayISO());

  const records = getRecordsForDate(selectedDate);
  const workers = getWorkersForDate(selectedDate);
  const markedCount = Object.keys(records).length;
  const total = workers.length;
  const allMarked = total > 0 && markedCount >= total;
  const editable = canEdit(selectedDate, role === 'admin');

  const progressAnim = useRef(new Animated.Value(total > 0 ? markedCount / total : 0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: total > 0 ? markedCount / total : 0,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [markedCount, total, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const handleMark = (workerId: string, status: AttendanceStatus, overtimeHours?: number) => {
    if (!editable) {
      showToast('error', 'Cannot edit entries older than 3 days');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mark(selectedDate, workerId, status, user!.id, user!.name, overtimeHours);
    const workerName = workers.find((w) => w.id === workerId)?.name ?? workerId;
    const currentNightAfter = status === 'absent' ? false : (records[workerId]?.night ?? false);
    logAudit({
      userId: user!.id,
      userName: user!.name,
      action: 'mark_attendance',
      entity: 'attendance',
      entityId: `${selectedDate}:${workerId}`,
      detail: `${workerName}: ${statusLabel(status, currentNightAfter, overtimeHours)} on ${selectedDate}`,
    });
  };

  const handleUnmark = (workerId: string) => {
    if (!editable) {
      showToast('error', 'Cannot edit entries older than 3 days');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    unmark(selectedDate, workerId);
    const workerName = workers.find((w) => w.id === workerId)?.name ?? workerId;
    logAudit({
      userId: user!.id,
      userName: user!.name,
      action: 'mark_attendance',
      entity: 'attendance',
      entityId: `${selectedDate}:${workerId}`,
      detail: `${workerName}: unmarked on ${selectedDate}`,
    });
  };

  const handleToggleNight = (workerId: string) => {
    if (!editable) {
      showToast('error', 'Cannot edit entries older than 3 days');
      return;
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleNight(selectedDate, workerId, user!.id, user!.name);
    const workerName = workers.find((w) => w.id === workerId)?.name ?? workerId;
    const rec = records[workerId];
    const wasNight = (rec?.night ?? false) || rec?.status === 'night';
    logAudit({
      userId: user!.id,
      userName: user!.name,
      action: 'mark_attendance',
      entity: 'attendance',
      entityId: `${selectedDate}:${workerId}`,
      detail: `${workerName}: Night shift ${wasNight ? 'removed' : 'added'} on ${selectedDate}`,
    });
  };

  const handleHoursSubmit = (workerId: string) => {
    const h = parseFloat(hoursInput[workerId] ?? '');
    if (isNaN(h) || h <= 0 || h > 24) {
      showToast('error', 'Enter valid hours (1-24)');
      return;
    }
    const isOvertime = hoursIsOvertime[workerId] ?? false;
    if (isOvertime) {
      // Overtime on top of full day
      handleMark(workerId, 'full', h);
    } else {
      // Partial hours (replaces full day)
      handleMark(workerId, { hours: h });
    }
    setHoursInput((prev) => { const n = { ...prev }; delete n[workerId]; return n; });
    setHoursIsOvertime((prev) => { const n = { ...prev }; delete n[workerId]; return n; });
  };

  const handleAddWorker = () => {
    if (!newName.trim() || !newWage.trim()) {
      showToast('error', 'Name and daily wage are required');
      return;
    }
    const wage = parseFloat(newWage);
    const balance = parseFloat(newBalance) || 0;
    if (isNaN(wage) || wage <= 0) {
      showToast('error', 'Enter a valid daily wage');
      return;
    }
    addWorker({ name: newName.trim(), dailyWage: wage, previousBalance: balance, createdAt: newJoinDate }, user!.id);
    logAudit({
      userId: user!.id,
      userName: user!.name,
      action: 'add_worker',
      entity: 'worker',
      entityId: 'new',
      detail: newName.trim(),
    });
    setNewName('');
    setNewWage('');
    setNewBalance('');
    setNewJoinDate(todayISO());
    setShowAddWorker(false);
    showToast('success', 'Worker added');
  };

  const handleRemoveWorker = (id: string, name: string) => {
    removeWorker(id);
    logAudit({
      userId: user!.id,
      userName: user!.name,
      action: 'remove_worker',
      entity: 'worker',
      entityId: id,
      detail: name,
    });
    showToast('success', 'Worker removed');
  };

  const closeAdvanceSheet = () => {
    setShowAdvance(false);
    setEditAdvanceId(null);
    setAdvAmt('');
    setAdvDate(todayISO());
    setAdvNote('');
  };

  const handleSaveAdvance = () => {
    const amt = parseFloat(advAmt);
    if (isNaN(amt) || amt <= 0) {
      showToast('error', 'Enter a valid amount');
      return;
    }
    if (editAdvanceId) {
      editAdvance(editAdvanceId, { amount: amt, date: advDate, note: advNote || undefined });
      logAudit({
        userId: user!.id,
        userName: user!.name,
        action: 'edit_advance',
        entity: 'advance',
        entityId: editAdvanceId,
        detail: `Updated to ₹${amt} on ${advDate}`,
      });
      closeAdvanceSheet();
      showToast('success', 'Advance updated');
    } else {
      addAdvance(
        { workerId: advanceWorkerId, amount: amt, date: advDate, note: advNote || undefined },
        user!.id
      );
      logAudit({
        userId: user!.id,
        userName: user!.name,
        action: 'add_advance',
        entity: 'advance',
        entityId: advanceWorkerId,
        detail: `₹${amt} on ${advDate}`,
      });
      const recordedFor = advDate;
      closeAdvanceSheet();
      setSelectedDate(recordedFor);
      showToast('success', `Advance recorded on ${recordedFor}`);
    }
  };

  const handleDeleteAdvance = () => {
    if (!deleteAdvanceTarget) return;
    deleteAdvance(deleteAdvanceTarget.id);
    logAudit({
      userId: user!.id,
      userName: user!.name,
      action: 'delete_advance',
      entity: 'advance',
      entityId: deleteAdvanceTarget.id,
      detail: `Deleted ₹${deleteAdvanceTarget.amount} advance for ${deleteAdvanceTarget.workerName}`,
    });
    setDeleteAdvanceTarget(null);
    showToast('success', 'Advance deleted');
  };

  const handleUpdateWage = () => {
    const wage = parseFloat(newWageAmt);
    if (isNaN(wage) || wage <= 0) {
      showToast('error', 'Enter a valid wage amount');
      return;
    }
    const wageWorker = allWorkersStore.find((w) => w.id === wageWorkerId);
    if (!wageWorker) return;
    updateWorkerWage(wageWorkerId, wage, newWageDate);
    logAudit({
      userId: user!.id,
      userName: user!.name,
      action: 'update_wage',
      entity: 'worker',
      entityId: wageWorkerId,
      detail: `${wageWorker.name}: wage updated to ₹${wage}/day effective ${newWageDate}`,
    });
    setShowWageSheet(false);
    setNewWageAmt('');
    setNewWageDate(todayISO());
    showToast('success', `Wage updated to ₹${wage} from ${newWageDate}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bgPrimary }}>
      <TopBar title="Attendance" subtitle={formatDateReadable(selectedDate)} />

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
          onPress={() => setSelectedDate(shiftDate(selectedDate, -1))}
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
          {formatDateReadable(selectedDate)}
        </Text>
        <Pressable
          onPress={() => {
            if (selectedDate < todayISO()) setSelectedDate(shiftDate(selectedDate, 1));
          }}
          hitSlop={12}
          style={{ padding: 6, opacity: selectedDate >= todayISO() ? 0.3 : 1 }}
        >
          <ChevronRight size={18} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* Progress card */}
      <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 4 }}>
        <View
          style={{
            backgroundColor: allMarked ? COLORS.accentSoftBg : COLORS.bgSecondary,
            borderWidth: 1,
            borderColor: allMarked ? COLORS.accentSoftBorder : COLORS.borderColor,
            borderRadius: 12,
            padding: 12,
          }}
        >
          {allMarked ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} color={COLORS.accent} />
              <Text
                style={{
                  color: COLORS.accent,
                  fontFamily: FONTS.sansBold,
                  fontSize: 14,
                }}
              >
                All {total} marked
              </Text>
            </View>
          ) : (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    color: COLORS.accent,
                    fontFamily: FONTS.sansExtraBold,
                    fontSize: 17,
                  }}
                >
                  {markedCount}
                </Text>
                <Text
                  style={{
                    color: COLORS.textSecondary,
                    fontFamily: FONTS.sansMedium,
                    fontSize: 13,
                  }}
                >
                  of {total} marked today
                </Text>
                {!editable && (
                  <Text
                    style={{
                      color: COLORS.error,
                      fontFamily: FONTS.sansSemibold,
                      fontSize: 11,
                      marginLeft: 4,
                    }}
                  >
                    (read-only)
                  </Text>
                )}
              </View>
              <View
                style={{
                  height: 6,
                  backgroundColor: COLORS.bgTertiary,
                  borderRadius: 99,
                  overflow: 'hidden',
                }}
              >
                <Animated.View
                  style={{
                    height: 6,
                    backgroundColor: COLORS.accent,
                    borderRadius: 99,
                    width: progressWidth,
                  }}
                />
              </View>
            </>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
        {workers.map((worker) => {
          const rec = records[worker.id];
          const currentStatus = rec?.status;
          const currentNight = (rec?.night ?? false) || currentStatus === 'night';
          const isNightOnly = currentStatus === 'night';
          // hasDayShift: true only for full or hours-based (not night-only or absent)
          const isHoursMode = typeof currentStatus === 'object';
          const hasDayShift = currentStatus === 'full' || isHoursMode;
          const isAbsent = currentStatus === 'absent';
          const hoursOpen = hoursInput[worker.id] !== undefined;
          const isOvertime = hoursIsOvertime[worker.id] ?? false;
          const currentOvertime = rec?.overtimeHours;

          const workerSyncStatus = getSyncStatus(selectedDate, worker.id);

          const dayAdvances = allAdvances.filter(
            (a) => a.workerId === worker.id && a.date === selectedDate
          );
          const dayAdvanceTotal = dayAdvances.reduce((s, a) => s + a.amount, 0);

          return (
            <View
              key={worker.id}
              style={{
                backgroundColor: COLORS.bgSecondary,
                borderRadius: 14,
                padding: 14,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: COLORS.borderColor,
                shadowColor: '#1f1e1c',
                shadowOpacity: 0.04,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <Pressable
                  style={{ flex: 1 }}
                  onPress={() => {
                    setWageWorkerId(worker.id);
                    setNewWageAmt('');
                    setNewWageDate(todayISO());
                    setShowWageSheet(true);
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.sansBold,
                      fontSize: 15,
                      color: COLORS.accent,
                    }}
                  >
                    {worker.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.sansMedium,
                      fontSize: 12,
                      color: COLORS.textTertiary,
                      marginTop: 2,
                    }}
                  >
                    ₹{worker.dailyWage}/day
                    {worker.previousBalance ? ` · bal ₹${worker.previousBalance}` : ''}
                  </Text>
                </Pressable>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {/* Sync status indicator */}
                  {rec && workerSyncStatus === 'syncing' && (
                    <ActivityIndicator size="small" color={COLORS.textTertiary} />
                  )}
                  {rec && workerSyncStatus === 'error' && (
                    <WifiOff size={13} color={COLORS.error} />
                  )}

                  {(currentStatus || currentNight) && (
                    <View
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 6,
                        backgroundColor: statusColor(currentStatus) + '1a',
                      }}
                    >
                      <Text
                        style={{
                          color: statusColor(currentStatus),
                          fontFamily: FONTS.sansExtraBold,
                          fontSize: 11,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}
                      >
                        {statusLabel(currentStatus, currentNight, currentOvertime)}
                      </Text>
                    </View>
                  )}
                  {editable && (
                    <>
                      <Pressable
                        onPress={() => {
                          setAdvanceWorkerId(worker.id);
                          setAdvDate(selectedDate);
                          setShowAdvance(true);
                        }}
                        hitSlop={10}
                        style={{ padding: 4 }}
                      >
                        <DollarSign size={15} color={COLORS.textTertiary} />
                      </Pressable>
                      {role === 'admin' && (
                        <Pressable
                          onPress={() => setRemoveTarget({ id: worker.id, name: worker.name })}
                          hitSlop={10}
                          style={{ padding: 4 }}
                        >
                          <Trash2 size={15} color={COLORS.textTertiary} />
                        </Pressable>
                      )}
                    </>
                  )}
                </View>
              </View>

              {/* Pills */}
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(
                  [
                    { key: 'present', label: 'Present', color: COLORS.accent },
                    { key: 'night', label: 'Night', color: '#6366f1' },
                    { key: 'absent', label: 'Absent', color: COLORS.error },
                    { key: 'hours', label: 'Hours', color: COLORS.warning },
                  ] as const
                ).map((btn) => {
                  // Night selected: night boolean OR night-only status
                  // Present selected: full day (not hours-only, not absent, not night-only)
                  // Hours selected: hours-based status OR hours input open
                  // Absent selected: absent status
                  const selected =
                    btn.key === 'present'
                      ? hasDayShift && !isHoursMode
                      : btn.key === 'night'
                        ? currentNight
                        : btn.key === 'absent'
                          ? isAbsent
                          : isHoursMode || hoursOpen;

                  return (
                    <Pressable
                      key={btn.key}
                      onPress={() => {
                        if (!editable) {
                          showToast('error', 'Cannot edit entries older than 3 days');
                          return;
                        }
                        if (btn.key === 'present') {
                          if (hasDayShift && !isHoursMode) {
                            // Toggle present OFF
                            if (currentNight) {
                              // Keep night-only
                              handleMark(worker.id, 'night');
                            } else {
                              handleUnmark(worker.id);
                            }
                          } else if (isHoursMode) {
                            // Switch from hours to full day, keep overtime if any
                            handleMark(worker.id, 'full');
                          } else {
                            // Toggle present ON (clears absent, night-only stays as day+night)
                            handleMark(worker.id, 'full');
                          }
                          setHoursInput((prev) => { const n = { ...prev }; delete n[worker.id]; return n; });
                          setHoursIsOvertime((prev) => { const n = { ...prev }; delete n[worker.id]; return n; });
                        } else if (btn.key === 'night') {
                          handleToggleNight(worker.id);
                        } else if (btn.key === 'absent') {
                          if (isAbsent) {
                            handleUnmark(worker.id);
                          } else {
                            handleMark(worker.id, 'absent');
                            setHoursInput((prev) => { const n = { ...prev }; delete n[worker.id]; return n; });
                            setHoursIsOvertime((prev) => { const n = { ...prev }; delete n[worker.id]; return n; });
                          }
                        } else {
                          // Hours button
                          if (hasDayShift && !isHoursMode) {
                            // Present is active → open overtime input
                            setHoursIsOvertime((prev) => ({ ...prev, [worker.id]: true }));
                            setHoursInput((prev) => ({
                              ...prev,
                              [worker.id]: currentOvertime ? String(currentOvertime) : '',
                            }));
                          } else if (isHoursMode) {
                            // Already in hours mode → edit existing hours
                            setHoursIsOvertime((prev) => ({ ...prev, [worker.id]: false }));
                            setHoursInput((prev) => ({
                              ...prev,
                              [worker.id]: String((currentStatus as { hours: number }).hours),
                            }));
                          } else {
                            // No day shift → open partial hours input
                            setHoursIsOvertime((prev) => ({ ...prev, [worker.id]: false }));
                            setHoursInput((prev) => ({
                              ...prev,
                              [worker.id]: prev[worker.id] ?? '',
                            }));
                          }
                        }
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 9,
                        borderRadius: 10,
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: selected ? btn.color : COLORS.borderColor,
                        backgroundColor: selected ? btn.color + '14' : COLORS.bgSecondary,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: FONTS.sansBold,
                          fontSize: 11,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                          color: selected ? btn.color : COLORS.textSecondary,
                        }}
                      >
                        {btn.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {hoursOpen && (
                <View
                  style={{
                    marginTop: 10,
                  }}
                >
                  {isOvertime && (
                    <Text style={{
                      fontFamily: FONTS.sansMedium,
                      fontSize: 11,
                      color: COLORS.textTertiary,
                      marginBottom: 6,
                    }}>
                      Overtime hours (on top of full day)
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      style={{
                        flex: 1,
                        backgroundColor: COLORS.bgTertiary,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: COLORS.borderColor,
                        color: COLORS.textPrimary,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        fontFamily: FONTS.sansMedium,
                        fontSize: 14,
                      }}
                      placeholder={isOvertime ? 'Overtime hours (e.g. 2)' : 'Hours worked (e.g. 6)'}
                      placeholderTextColor={COLORS.textTertiary}
                      keyboardType="numeric"
                      value={hoursInput[worker.id]}
                      onChangeText={(v) => setHoursInput((prev) => ({ ...prev, [worker.id]: v }))}
                    />
                    <Pressable
                      onPress={() => handleHoursSubmit(worker.id)}
                      style={{
                        backgroundColor: COLORS.accent,
                        borderRadius: 10,
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                      }}
                    >
                      <Text style={{ color: '#fff', fontFamily: FONTS.sansBold, fontSize: 13 }}>
                        Save
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setHoursInput((prev) => {
                          const n = { ...prev };
                          delete n[worker.id];
                          return n;
                        });
                        setHoursIsOvertime((prev) => {
                          const n = { ...prev };
                          delete n[worker.id];
                          return n;
                        });
                      }}
                      hitSlop={10}
                    >
                      <X size={18} color={COLORS.textTertiary} />
                    </Pressable>
                  </View>
                </View>
              )}

              {rec && (
                <Pressable
                  onPress={workerSyncStatus === 'error' ? () => retrySync(selectedDate, worker.id) : undefined}
                  disabled={workerSyncStatus !== 'error'}
                  style={{ marginTop: 8 }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.sansMedium,
                      fontSize: 11,
                      color: COLORS.textTertiary,
                    }}
                  >
                    By {rec.recordedBy === user?.id ? 'you' : (rec.recordedByName ?? displayNameFor(rec.recordedBy))} ·{' '}
                    {new Date(rec.recordedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {workerSyncStatus === 'error' && (
                      <Text style={{ color: COLORS.error }}>{' '}· Upload failed — tap to retry</Text>
                    )}
                  </Text>
                </Pressable>
              )}

              {dayAdvances.length > 0 && (
                <View
                  style={{
                    marginTop: 10,
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: COLORS.borderColor,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <DollarSign size={12} color={COLORS.warning} />
                      <Text
                        style={{
                          fontFamily: FONTS.sansBold,
                          fontSize: 10,
                          color: COLORS.textTertiary,
                          letterSpacing: 1,
                          textTransform: 'uppercase',
                        }}
                      >
                        Advance today
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontFamily: FONTS.sansExtraBold,
                        fontSize: 12,
                        color: COLORS.warning,
                      }}
                    >
                      −₹{dayAdvanceTotal}
                    </Text>
                  </View>
                  {dayAdvances.map((a) => (
                    <View
                      key={a.id}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 3,
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: FONTS.sansMedium,
                          fontSize: 11,
                          color: COLORS.textSecondary,
                          flex: 1,
                        }}
                        numberOfLines={1}
                      >
                        {a.note ? a.note : 'Advance payment'}
                      </Text>
                      <Text
                        style={{
                          fontFamily: FONTS.sansSemibold,
                          fontSize: 11,
                          color: COLORS.textSecondary,
                        }}
                      >
                        ₹{a.amount}
                      </Text>
                      <Pressable
                        hitSlop={8}
                        onPress={() => {
                          setEditAdvanceId(a.id);
                          setAdvAmt(String(a.amount));
                          setAdvDate(a.date);
                          setAdvNote(a.note ?? '');
                          setShowAdvance(true);
                        }}
                        style={{ padding: 2 }}
                      >
                        <Pencil size={12} color={COLORS.textTertiary} />
                      </Pressable>
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          setDeleteAdvanceTarget({ id: a.id, workerName: worker.name, amount: a.amount })
                        }
                        style={{ padding: 2 }}
                      >
                        <Trash2 size={12} color={COLORS.error} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => setShowAddWorker(true)}
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
        open={showAddWorker}
        onClose={() => {
          setShowAddWorker(false);
          setNewJoinDate(todayISO());
        }}
        title="Add Worker"
      >
        <TextField
          label="Worker Name"
          value={newName}
          onChangeText={setNewName}
          placeholder="e.g. Ramesh Patel"
        />
        <TextField
          label="Daily Wage (₹)"
          value={newWage}
          onChangeText={setNewWage}
          keyboardType="numeric"
          placeholder="500"
        />
        <TextField
          label="Previous Balance (₹)"
          value={newBalance}
          onChangeText={setNewBalance}
          keyboardType="numeric"
          placeholder="0"
        />

        <InlineDatePicker
          label="Join Date"
          value={newJoinDate}
          onChange={setNewJoinDate}
          maxDate={todayISO()}
        />

        <View style={{ marginTop: 8 }}>
          <PrimaryButton label="Add Worker" onPress={handleAddWorker} size="lg" />
        </View>
      </BottomSheet>

      <BottomSheet
        open={showWageSheet}
        onClose={() => { setShowWageSheet(false); setNewWageAmt(''); setNewWageDate(todayISO()); }}
        title="Wage Details"
      >
        {(() => {
          const wageWorker = allWorkersStore.find((w) => w.id === wageWorkerId);
          if (!wageWorker) return null;
          const history = wageWorker.wageHistory ?? [{ wage: wageWorker.dailyWage, effectiveFrom: wageWorker.createdAt.slice(0, 10) }];
          const prevMK = shiftMonthKey(currentMonthKey(), -1);
          const prevSalary = computeMonthlySalary(wageWorker, prevMK, allRecords, allAdvances);
          return (
            <>
              <View style={{ backgroundColor: COLORS.bgTertiary, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <Text style={{ fontFamily: FONTS.sansBold, fontSize: 11, color: COLORS.textTertiary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
                  {wageWorker.name}
                </Text>
                <Text style={{ fontFamily: FONTS.sansExtraBold, fontSize: 20, color: COLORS.textPrimary }}>
                  ₹{wageWorker.dailyWage}<Text style={{ fontFamily: FONTS.sansMedium, fontSize: 13, color: COLORS.textSecondary }}>/day (current)</Text>
                </Text>
                {history.length > 0 && (
                  <View style={{ marginTop: 10 }}>
                    {[...history].reverse().map((e, i) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                        <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12, color: COLORS.textSecondary }}>
                          From {e.effectiveFrom}
                        </Text>
                        <Text style={{ fontFamily: FONTS.sansSemibold, fontSize: 12, color: COLORS.textPrimary }}>
                          ₹{e.wage}/day
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View style={{ backgroundColor: COLORS.bgTertiary, borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <Text style={{ fontFamily: FONTS.sansBold, fontSize: 11, color: COLORS.textTertiary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  {prevSalary.monthLabel} Summary
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12, color: COLORS.textSecondary }}>Gross Earned</Text>
                  <Text style={{ fontFamily: FONTS.sansSemibold, fontSize: 12, color: COLORS.accent }}>₹{prevSalary.grossEarned}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12, color: COLORS.textSecondary }}>Advances</Text>
                  <Text style={{ fontFamily: FONTS.sansSemibold, fontSize: 12, color: COLORS.warning }}>−₹{prevSalary.totalAdvances}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: COLORS.borderColor, marginVertical: 6 }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ fontFamily: FONTS.sansBold, fontSize: 13, color: COLORS.textPrimary }}>Net</Text>
                  <Text style={{ fontFamily: FONTS.sansExtraBold, fontSize: 13, color: prevSalary.netForMonth >= 0 ? COLORS.accent : COLORS.error }}>
                    {prevSalary.netForMonth >= 0 ? '₹' : '−₹'}{Math.abs(prevSalary.netForMonth)}
                  </Text>
                </View>
                <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 11, color: COLORS.textTertiary, marginTop: 4 }}>
                  Present {prevSalary.presentDays}d · Absent {prevSalary.absentDays}d · Partial {prevSalary.partialDays}d
                </Text>
              </View>
              {role === 'admin' && (
                <>
                  <TextField
                    label="New Daily Wage (₹)"
                    value={newWageAmt}
                    onChangeText={setNewWageAmt}
                    keyboardType="numeric"
                    placeholder={String(wageWorker.dailyWage)}
                  />
                  <InlineDatePicker
                    label="Effective From"
                    value={newWageDate}
                    onChange={setNewWageDate}
                    maxDate={todayISO()}
                  />
                  <View style={{ marginTop: 8 }}>
                    <PrimaryButton label="Save Wage" onPress={handleUpdateWage} size="lg" icon={<TrendingUp size={16} color="#fff" />} />
                  </View>
                </>
              )}
            </>
          );
        })()}
      </BottomSheet>

      <ConfirmDialog
        open={deleteAdvanceTarget !== null}
        title="Delete advance?"
        message={
          deleteAdvanceTarget
            ? `Delete ₹${deleteAdvanceTarget.amount} advance for ${deleteAdvanceTarget.workerName}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteAdvanceTarget(null)}
        onConfirm={handleDeleteAdvance}
      />

      <ConfirmDialog
        open={removeTarget !== null}
        title="Remove worker?"
        message={
          removeTarget
            ? `Remove ${removeTarget.name} from the active worker list? Past attendance records remain. This action is logged.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) handleRemoveWorker(removeTarget.id, removeTarget.name);
          setRemoveTarget(null);
        }}
      />

      <BottomSheet
        open={showAdvance}
        onClose={closeAdvanceSheet}
        title={editAdvanceId ? 'Edit Advance' : 'Record Advance'}
      >
        <TextField
          label="Amount (₹)"
          value={advAmt}
          onChangeText={setAdvAmt}
          keyboardType="numeric"
          placeholder="500"
        />
        <InlineDatePicker
          label="Date"
          value={advDate}
          onChange={setAdvDate}
          maxDate={todayISO()}
        />
        <TextField
          label="Note (optional)"
          value={advNote}
          onChangeText={setAdvNote}
          placeholder="e.g. festival advance"
        />
        <View style={{ marginTop: 8 }}>
          <PrimaryButton
            label={editAdvanceId ? 'Save Changes' : 'Record Advance'}
            onPress={handleSaveAdvance}
            size="lg"
          />
        </View>
      </BottomSheet>
    </View>
  );
}
