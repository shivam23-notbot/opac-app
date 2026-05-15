import type { Product } from '@/types';
import { subtractDays } from '@/lib/date';

function d(n: number) { return subtractDays(n); }

export const PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    code: 'HDPE-N-001',
    name: 'Natural HDPE Granules',
    polymer: 'HDPE',
    currentBags: 118,
    active: true,
    lastUpdated: d(0) + 'T08:00:00.000Z',
    stockHistory: [
      { id: 'sh-001-1', date: d(14), openingBags: 100, closingBags: 108, materialsUsed: [{ materialId: 'rm-001', kg: 220 }], notes: '',                   recordedBy: 'user-admin-1', recordedAt: d(14) + 'T08:00:00.000Z' },
      { id: 'sh-001-2', date: d(13), openingBags: 108, closingBags: 115, materialsUsed: [{ materialId: 'rm-001', kg: 190 }, { materialId: 'rm-002', kg: 100 }], notes: '', recordedBy: 'user-admin-1', recordedAt: d(13) + 'T08:00:00.000Z' },
      { id: 'sh-001-3', date: d(12), openingBags: 115, closingBags: 112, materialsUsed: [{ materialId: 'rm-002', kg: 80  }], notes: 'Machine downtime half day', recordedBy: 'user-admin-2', recordedAt: d(12) + 'T08:00:00.000Z' },
      { id: 'sh-001-4', date: d(11), openingBags: 112, closingBags: 120, materialsUsed: [{ materialId: 'rm-001', kg: 210 }], notes: '',                   recordedBy: 'user-admin-1', recordedAt: d(11) + 'T08:00:00.000Z' },
      { id: 'sh-001-5', date: d(8),  openingBags: 120, closingBags: 126, materialsUsed: [{ materialId: 'rm-001', kg: 160 }], notes: '',                   recordedBy: 'user-worker-1', recordedAt: d(8)  + 'T08:00:00.000Z' },
      { id: 'sh-001-6', date: d(5),  openingBags: 126, closingBags: 122, materialsUsed: [{ materialId: 'rm-002', kg: 110 }], notes: 'Short batch',        recordedBy: 'user-worker-1', recordedAt: d(5)  + 'T08:00:00.000Z' },
      { id: 'sh-001-7', date: d(2),  openingBags: 122, closingBags: 118, materialsUsed: [{ materialId: 'rm-001', kg: 130 }], notes: '',                   recordedBy: 'user-admin-1', recordedAt: d(2)  + 'T08:00:00.000Z' },
    ],
  },
  {
    id: 'prod-002',
    code: 'PP-M-002',
    name: 'Mixed PP Granules',
    polymer: 'PP',
    currentBags: 74,
    active: true,
    lastUpdated: d(1) + 'T09:00:00.000Z',
    stockHistory: [
      { id: 'sh-002-1', date: d(14), openingBags: 60, closingBags: 65, materialsUsed: [{ materialId: 'rm-003', kg: 170 }], notes: '',             recordedBy: 'user-admin-1', recordedAt: d(14) + 'T09:00:00.000Z' },
      { id: 'sh-002-2', date: d(12), openingBags: 65, closingBags: 70, materialsUsed: [{ materialId: 'rm-003', kg: 140 }, { materialId: 'rm-004', kg: 90 }], notes: '', recordedBy: 'user-admin-2', recordedAt: d(12) + 'T09:00:00.000Z' },
      { id: 'sh-002-3', date: d(9),  openingBags: 70, closingBags: 68, materialsUsed: [{ materialId: 'rm-003', kg: 60  }], notes: 'Low material', recordedBy: 'user-worker-1', recordedAt: d(9)  + 'T09:00:00.000Z' },
      { id: 'sh-002-4', date: d(6),  openingBags: 68, closingBags: 75, materialsUsed: [{ materialId: 'rm-003', kg: 190 }], notes: '',             recordedBy: 'user-admin-1', recordedAt: d(6)  + 'T09:00:00.000Z' },
      { id: 'sh-002-5', date: d(1),  openingBags: 75, closingBags: 74, materialsUsed: [{ materialId: 'rm-004', kg: 40  }], notes: 'End of day',   recordedBy: 'user-admin-1', recordedAt: d(1)  + 'T09:00:00.000Z' },
    ],
  },
  {
    id: 'prod-003',
    code: 'LDPE-B-003',
    name: 'Black LDPE Granules',
    polymer: 'LDPE',
    currentBags: 49,
    active: true,
    lastUpdated: d(3) + 'T07:30:00.000Z',
    stockHistory: [
      { id: 'sh-003-1', date: d(14), openingBags: 35, closingBags: 40, materialsUsed: [{ materialId: 'rm-007', kg: 140 }], notes: '',          recordedBy: 'user-admin-1', recordedAt: d(14) + 'T07:30:00.000Z' },
      { id: 'sh-003-2', date: d(11), openingBags: 40, closingBags: 45, materialsUsed: [{ materialId: 'rm-007', kg: 150 }], notes: '',          recordedBy: 'user-worker-1', recordedAt: d(11) + 'T07:30:00.000Z' },
      { id: 'sh-003-3', date: d(8),  openingBags: 45, closingBags: 43, materialsUsed: [{ materialId: 'rm-007', kg: 60  }], notes: 'Partial',   recordedBy: 'user-worker-1', recordedAt: d(8)  + 'T07:30:00.000Z' },
      { id: 'sh-003-4', date: d(5),  openingBags: 43, closingBags: 50, materialsUsed: [{ materialId: 'rm-007', kg: 180 }], notes: '',          recordedBy: 'user-admin-2', recordedAt: d(5)  + 'T07:30:00.000Z' },
      { id: 'sh-003-5', date: d(3),  openingBags: 50, closingBags: 49, materialsUsed: [{ materialId: 'rm-007', kg: 30  }], notes: 'Cleanup batch', recordedBy: 'user-admin-1', recordedAt: d(3)  + 'T07:30:00.000Z' },
    ],
  },
  {
    id: 'prod-004',
    code: 'HDPE-C-004',
    name: 'Colour HDPE Granules',
    polymer: 'HDPE',
    currentBags: 32,
    active: true,
    lastUpdated: d(4) + 'T08:00:00.000Z',
    stockHistory: [
      { id: 'sh-004-1', date: d(12), openingBags: 20, closingBags: 26, materialsUsed: [{ materialId: 'rm-001', kg: 160 }], notes: '',    recordedBy: 'user-admin-1', recordedAt: d(12) + 'T08:00:00.000Z' },
      { id: 'sh-004-2', date: d(4),  openingBags: 26, closingBags: 32, materialsUsed: [{ materialId: 'rm-002', kg: 160 }], notes: '',    recordedBy: 'user-admin-1', recordedAt: d(4)  + 'T08:00:00.000Z' },
    ],
  },
  {
    id: 'prod-005',
    code: 'PP-R-005',
    name: 'Raffia PP Granules',
    polymer: 'PP',
    currentBags: 0,
    active: false,
    lastUpdated: d(20) + 'T08:00:00.000Z',
    stockHistory: [
      { id: 'sh-005-1', date: d(30), openingBags: 0,  closingBags: 40, materialsUsed: [{ materialId: 'rm-003', kg: 260 }], notes: 'Opening stock', recordedBy: 'user-admin-1', recordedAt: d(30) + 'T08:00:00.000Z' },
      { id: 'sh-005-2', date: d(20), openingBags: 40, closingBags: 0,  materialsUsed: [],                                   notes: 'Fully dispatched — retired', recordedBy: 'user-admin-1', recordedAt: d(20) + 'T08:00:00.000Z' },
    ],
  },
];
