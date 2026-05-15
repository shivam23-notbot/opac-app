import type { Worker, AdvancePayment } from '@/types';
import { subtractDays } from '@/lib/date';

function d(daysAgo: number) {
  return subtractDays(daysAgo);
}

export const SEED_WORKERS: Worker[] = [
  { id: 'w-01', name: 'Ramesh Patel',    dailyWage: 550, previousBalance: 0,    active: true, createdAt: d(60) },
  { id: 'w-02', name: 'Suresh Mehta',    dailyWage: 500, previousBalance: 200,  active: true, createdAt: d(60) },
  { id: 'w-03', name: 'Kamlesh Joshi',   dailyWage: 500, previousBalance: 0,    active: true, createdAt: d(60) },
  { id: 'w-04', name: 'Dinesh Solanki',  dailyWage: 600, previousBalance: 0,    active: true, createdAt: d(45) },
  { id: 'w-05', name: 'Vinod Kumar',     dailyWage: 500, previousBalance: 0,    active: true, createdAt: d(45) },
  { id: 'w-06', name: 'Mahesh Rathod',   dailyWage: 500, previousBalance: 500,  active: true, createdAt: d(30) },
  { id: 'w-07', name: 'Bharat Singh',    dailyWage: 650, previousBalance: 0,    active: true, createdAt: d(60) },
  { id: 'w-08', name: 'Hardik Vyas',     dailyWage: 550, previousBalance: 0,    active: true, createdAt: d(60) },
  { id: 'w-09', name: 'Jignesh Parmar',  dailyWage: 500, previousBalance: 0,    active: true, createdAt: d(20) },
  { id: 'w-10', name: 'Naresh Thakor',   dailyWage: 480, previousBalance: 0,    active: false, createdAt: d(60), removedAt: new Date(Date.now() - 10 * 86400000).toISOString() },
];

export const SEED_ADVANCES: AdvancePayment[] = [
  { id: 'adv-01', workerId: 'w-01', amount: 1000, date: d(20), note: 'Festival advance',    recordedBy: 'user-admin-1' },
  { id: 'adv-02', workerId: 'w-02', amount: 500,  date: d(15), note: 'Medical',             recordedBy: 'user-admin-1' },
  { id: 'adv-03', workerId: 'w-03', amount: 800,  date: d(10), note: '',                    recordedBy: 'user-admin-2' },
  { id: 'adv-04', workerId: 'w-07', amount: 1500, date: d(25), note: 'Home repair',         recordedBy: 'user-admin-1' },
  { id: 'adv-05', workerId: 'w-08', amount: 600,  date: d(8),  note: '',                    recordedBy: 'user-admin-2' },
  { id: 'adv-06', workerId: 'w-06', amount: 1000, date: d(5),  note: 'Personal',            recordedBy: 'user-admin-1' },
];
