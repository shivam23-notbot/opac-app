import type {
  AttendanceRecord,
  AttendanceStatus,
  AdvancePayment,
  Worker,
  WageEntry,
} from '@/types';

// Returns the wage applicable on a given date by walking the worker's wage history.
// Falls back to worker.dailyWage when no history is present (backwards compat).
export function wageForDate(worker: Worker, dateISO: string): number {
  const history = worker.wageHistory;
  if (!history || history.length === 0) return worker.dailyWage;
  let applicable: WageEntry | undefined;
  for (const entry of history) {
    if (entry.effectiveFrom <= dateISO) {
      if (!applicable || entry.effectiveFrom > applicable.effectiveFrom) {
        applicable = entry;
      }
    }
  }
  // date is before all history entries — use the earliest wage
  if (!applicable) {
    return [...history].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0].wage;
  }
  return applicable.wage;
}

export interface SalaryDayLine {
  date: string;
  weekday: string;
  status: AttendanceStatus | null;
  statusLabel: string;
  calc: string;
  earned: number;
}

export interface MonthlySalary {
  monthKey: string;
  monthLabel: string;
  daysInMonth: number;
  openingBalance: number;
  openingBalanceLabel: string;
  dailyLines: SalaryDayLine[];
  presentDays: number;
  partialDays: number;
  absentDays: number;
  unmarkedDays: number;
  grossEarned: number;
  advances: AdvancePayment[];
  totalAdvances: number;
  netForMonth: number;
  closingBalance: number;
}

export function monthKeyFromISO(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function daysOfMonth(monthKey: string): string[] {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let day = 1; day <= last; day++) {
    out.push(`${monthKey}-${String(day).padStart(2, '0')}`);
  }
  return out;
}

export function statusLabel(status: AttendanceStatus | null, night?: boolean, overtimeHours?: number): string {
  if (status === null) return '—';
  if (status === 'absent') return 'Absent';
  if (status === 'night') return 'Night';
  const otPart = overtimeHours ? ` +${overtimeHours}h OT` : '';
  if (status === 'full') return night ? `Full Day${otPart} + Night` : `Full Day${otPart}`;
  return night ? `${status.hours}h + Night` : `${status.hours}h`;
}

export function earningsFor(
  status: AttendanceStatus | null,
  dailyWage: number,
  night?: boolean,
  overtimeHours?: number
): number {
  if (status === null || status === 'absent') return 0;
  const nightBonus = night ? dailyWage : 0;
  const overtimeBonus = overtimeHours ? (overtimeHours / 12) * dailyWage : 0;
  if (status === 'full') return dailyWage + nightBonus + overtimeBonus;
  if (status === 'night') return dailyWage;
  return (status.hours / 12) * dailyWage + nightBonus;
}

export function earningsCalcString(
  status: AttendanceStatus | null,
  dailyWage: number,
  night?: boolean,
  overtimeHours?: number
): string {
  if (status === null) return '—';
  if (status === 'absent') return '0';
  const nightPart = night ? ` + 1 × ₹${dailyWage}` : '';
  const otPart = overtimeHours ? ` + (${overtimeHours}/12) × ₹${dailyWage}` : '';
  if (status === 'full') return `1 × ₹${dailyWage}${otPart}${nightPart}`;
  if (status === 'night') return `1 × ₹${dailyWage} (night)`;
  return `(${status.hours}/12) × ₹${dailyWage}${nightPart}`;
}

function weekdayShort(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short' });
}

function buildSingleMonth(
  worker: Worker,
  monthKey: string,
  records: Record<string, Record<string, AttendanceRecord>>,
  allAdvances: AdvancePayment[]
): { gross: number; totalAdvances: number; net: number } {
  let gross = 0;
  daysOfMonth(monthKey).forEach((date) => {
    const dayRec = records[date];
    const rec = dayRec?.[worker.id];
    if (!rec) return;
    const wage = wageForDate(worker, date);
    gross += earningsFor(rec.status, wage, rec.night, rec.overtimeHours);
  });
  const totalAdvances = allAdvances
    .filter((a) => a.workerId === worker.id && monthKeyFromISO(a.date) === monthKey)
    .reduce((s, a) => s + a.amount, 0);
  return { gross, totalAdvances, net: gross - totalAdvances };
}

function startMonthKey(
  worker: Worker,
  records: Record<string, Record<string, AttendanceRecord>>,
  allAdvances: AdvancePayment[]
): string {
  let earliest = monthKeyFromISO(worker.createdAt);
  for (const date in records) {
    if (records[date]?.[worker.id]) {
      const mk = monthKeyFromISO(date);
      if (mk < earliest) earliest = mk;
    }
  }
  for (const a of allAdvances) {
    if (a.workerId === worker.id) {
      const mk = monthKeyFromISO(a.date);
      if (mk < earliest) earliest = mk;
    }
  }
  return earliest;
}

export function computeOpeningBalance(
  worker: Worker,
  targetMonthKey: string,
  records: Record<string, Record<string, AttendanceRecord>>,
  allAdvances: AdvancePayment[]
): number {
  let balance = worker.previousBalance ?? 0;
  let cursor = startMonthKey(worker, records, allAdvances);
  while (cursor < targetMonthKey) {
    const { net } = buildSingleMonth(worker, cursor, records, allAdvances);
    balance += net;
    cursor = shiftMonthKey(cursor, 1);
  }
  return balance;
}

export interface CarryInLine {
  monthKey: string;
  monthLabel: string;
  gross: number;
  advance: number;
  net: number;
  runningBalance: number;
}

// Returns the full month-by-month chain that produced the opening balance for
// `targetMonthKey`. Skips months with zero activity (gross + advance both 0)
// EXCEPT keeps the seed previousBalance row if it's non-zero.
export function computeCarryInBreakdown(
  worker: Worker,
  targetMonthKey: string,
  records: Record<string, Record<string, AttendanceRecord>>,
  allAdvances: AdvancePayment[]
): { seed: number; lines: CarryInLine[]; opening: number } {
  const seed = worker.previousBalance ?? 0;
  let running = seed;
  const lines: CarryInLine[] = [];
  let cursor = startMonthKey(worker, records, allAdvances);
  while (cursor < targetMonthKey) {
    const { gross, totalAdvances, net } = buildSingleMonth(worker, cursor, records, allAdvances);
    running += net;
    if (gross !== 0 || totalAdvances !== 0) {
      lines.push({
        monthKey: cursor,
        monthLabel: monthLabel(cursor),
        gross,
        advance: totalAdvances,
        net,
        runningBalance: running,
      });
    }
    cursor = shiftMonthKey(cursor, 1);
  }
  return { seed, lines, opening: running };
}

export function computeMonthlySalary(
  worker: Worker,
  monthKey: string,
  records: Record<string, Record<string, AttendanceRecord>>,
  allAdvances: AdvancePayment[]
): MonthlySalary {
  const days = daysOfMonth(monthKey);
  const openingBalance = computeOpeningBalance(worker, monthKey, records, allAdvances);

  let presentDays = 0;
  let partialDays = 0;
  let absentDays = 0;
  let unmarkedDays = 0;
  let grossEarned = 0;

  const dailyLines: SalaryDayLine[] = days.map((date) => {
    const rec = records[date]?.[worker.id];
    const status = rec?.status ?? null;
    const night = rec?.night ?? false;
    const overtimeHours = rec?.overtimeHours;
    const wage = wageForDate(worker, date);
    const earned = earningsFor(status, wage, night, overtimeHours);
    grossEarned += earned;
    if (status === 'full') presentDays++;
    else if (status === 'absent') absentDays++;
    else if (status === null) unmarkedDays++;
    else partialDays++;
    return {
      date,
      weekday: weekdayShort(date),
      status,
      statusLabel: statusLabel(status, night, overtimeHours),
      calc: earningsCalcString(status, wage, night, overtimeHours),
      earned,
    };
  });

  const advances = allAdvances
    .filter((a) => a.workerId === worker.id && monthKeyFromISO(a.date) === monthKey)
    .sort((a, b) => a.date.localeCompare(b.date));
  const totalAdvances = advances.reduce((s, a) => s + a.amount, 0);

  const netForMonth = grossEarned - totalAdvances;
  const closingBalance = openingBalance + netForMonth;

  return {
    monthKey,
    monthLabel: monthLabel(monthKey),
    daysInMonth: days.length,
    openingBalance,
    openingBalanceLabel:
      openingBalance === 0
        ? '₹0'
        : openingBalance > 0
          ? `+₹${openingBalance.toFixed(0)}`
          : `−₹${Math.abs(openingBalance).toFixed(0)}`,
    dailyLines,
    presentDays,
    partialDays,
    absentDays,
    unmarkedDays,
    grossEarned,
    advances,
    totalAdvances,
    netForMonth,
    closingBalance,
  };
}
