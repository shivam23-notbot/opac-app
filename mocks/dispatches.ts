import type { DispatchEntry } from '@/types';
import { subtractDays } from '@/lib/date';

function d(n: number) { return subtractDays(n); }

export const SEED_DISPATCHES: DispatchEntry[] = [
  { id: 'disp-01', date: d(13), time: '10:30', productId: 'prod-001', productCode: 'HDPE-N-001', bags: 5,  recipient: 'Rajesh Trading Co.',      vehicleNumber: 'GJ-01-AB-1234', notes: '',              recordedBy: 'user-admin-1' },
  { id: 'disp-02', date: d(11), time: '14:15', productId: 'prod-002', productCode: 'PP-M-002',   bags: 8,  recipient: 'Shree Plastics',           vehicleNumber: 'GJ-05-CD-5678', notes: '',              recordedBy: 'user-admin-2' },
  { id: 'disp-03', date: d(10), time: '09:45', productId: 'prod-001', productCode: 'HDPE-N-001', bags: 10, recipient: 'Akshar Polymers Pvt Ltd',  vehicleNumber: 'GJ-18-EF-9012', notes: 'Urgent order', recordedBy: 'user-admin-1' },
  { id: 'disp-04', date: d(8),  time: '11:00', productId: 'prod-003', productCode: 'LDPE-B-003', bags: 6,  recipient: 'Om Sai Enterprises',       vehicleNumber: '',              notes: '',              recordedBy: 'user-worker-1' },
  { id: 'disp-05', date: d(7),  time: '15:30', productId: 'prod-002', productCode: 'PP-M-002',   bags: 4,  recipient: 'Shree Plastics',           vehicleNumber: 'GJ-05-CD-5678', notes: 'Partial lot',  recordedBy: 'user-admin-1' },
  { id: 'disp-06', date: d(5),  time: '08:30', productId: 'prod-004', productCode: 'HDPE-C-004', bags: 3,  recipient: 'Mahavir Industries',        vehicleNumber: 'GJ-22-GH-3456', notes: '',              recordedBy: 'user-admin-2' },
  { id: 'disp-07', date: d(4),  time: '13:00', productId: 'prod-001', productCode: 'HDPE-N-001', bags: 7,  recipient: 'Rajesh Trading Co.',       vehicleNumber: 'GJ-01-AB-1234', notes: '',              recordedBy: 'user-admin-1' },
  { id: 'disp-08', date: d(2),  time: '10:15', productId: 'prod-003', productCode: 'LDPE-B-003', bags: 5,  recipient: 'Akshar Polymers Pvt Ltd',  vehicleNumber: 'GJ-18-EF-9012', notes: '',              recordedBy: 'user-admin-1' },
  { id: 'disp-09', date: d(1),  time: '16:00', productId: 'prod-002', productCode: 'PP-M-002',   bags: 6,  recipient: 'Hari Om Traders',          vehicleNumber: 'GJ-09-IJ-7890', notes: '',              recordedBy: 'user-admin-2' },
];
