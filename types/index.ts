export type PolymerType = 'HDPE' | 'PP' | 'LDPE';
export type AttendanceStatus = 'absent' | 'full' | 'night' | { hours: number };
export type UserRole = 'worker' | 'admin';
export type ToastType = 'success' | 'error';
export type SyncStatus = 'synced' | 'syncing' | 'error';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface WageEntry {
  wage: number;
  effectiveFrom: string; // ISO date YYYY-MM-DD
}

export interface Worker {
  id: string;
  name: string;
  dailyWage: number; // current effective wage (kept in sync with latest wageHistory entry)
  wageHistory?: WageEntry[]; // ascending by effectiveFrom
  previousBalance: number;
  active: boolean;
  settled?: boolean;
  settledAt?: string;
  removedAt?: string;
  createdAt: string;
}

export interface AdvancePayment {
  id: string;
  workerId: string;
  amount: number;
  date: string;
  note?: string;
  recordedBy: string;
}

export interface AttendanceRecord {
  employeeId: string;
  status: AttendanceStatus;
  night: boolean;
  overtimeHours?: number;
  recordedBy: string;
  recordedByName?: string;
  recordedAt: string;
}

export interface MaterialUsage {
  materialId: string;
  kg: number;
}

export interface StockEntry {
  id: string;
  date: string;
  openingBags: number;
  closingBags: number;
  materialsUsed: MaterialUsage[];
  notes?: string;
  recordedBy: string;
  recordedAt: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  polymer: PolymerType;
  currentBags: number;
  lastUpdated: string;
  stockHistory: StockEntry[];
  active?: boolean;
}

export interface RawMaterial {
  id: string;
  code: string;
  name: string;
}

export interface DispatchEntry {
  id: string;
  date: string;
  time: string;
  productId: string;
  productCode: string;
  bags: number;
  recipient: string;
  vehicleNumber?: string;
  notes?: string;
  recordedBy: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  entity: 'attendance' | 'production' | 'dispatch' | 'worker' | 'advance';
  entityId: string;
  detail: string;
}
