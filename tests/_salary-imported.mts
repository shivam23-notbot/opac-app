// Local type stubs so this can be imported by Node's strip-types loader
// without going through the bundler's "@/types" alias.
type AttendanceStatus = 'absent' | 'full' | { hours: number };
interface AttendanceRecord {
  employeeId: string;
  status: AttendanceStatus;
  recordedBy: string;
  recordedAt: string;
}
interface AdvancePayment {
  id: string;
  workerId: string;
  amount: number;
  date: string;
  note?: string;
  recordedBy: string;
}
interface Worker {
  id: string;
  name: string;
  dailyWage: number;
  previousBalance: number;
  active: boolean;
  settled?: boolean;
  settledAt?: string;
  createdAt: string;
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

export function statusLabel(status: AttendanceStatus | null): string {
  if (status === null) return '—';
  if (status === 'full') return 'Full Day';
  if (status === 'absent') return 'Absent';
  return `${status.hours}h`;
}

export function earningsFor(status: AttendanceStatus | null, dailyWage: number): number {
  if (status === null || status === 'absent') return 0;
  if (status === 'full') return dailyWage;
  return (status.hours / 12) * dailyWage;
}

export function earningsCalcString(
  status: AttendanceStatus | null,
  dailyWage: number
): string {
  if (status === null) return '—';
  if (status === 'absent') return '0';
  if (status === 'full') return `1 × ₹${dailyWage}`;
  return `(${status.hours}/12) × ₹${dailyWage}`;
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
    gross += earningsFor(rec.status, worker.dailyWage);
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
    const earned = earningsFor(status, worker.dailyWage);
    grossEarned += earned;
    if (status === 'full') presentDays++;
    else if (status === 'absent') absentDays++;
    else if (status === null) unmarkedDays++;
    else partialDays++;
    return {
      date,
      weekday: weekdayShort(date),
      status,
      statusLabel: statusLabel(status),
      calc: earningsCalcString(status, worker.dailyWage),
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
