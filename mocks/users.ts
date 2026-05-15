import type { UserRole } from '@/types';

export const USERS = [
  {
    id: 'user-admin-1',
    email: 'admin@opac.in',
    password: 'admin123',
    name: 'Prakash Sharma',
    role: 'admin' as UserRole,
  },
  {
    id: 'user-admin-2',
    email: 'manager@opac.in',
    password: 'manager123',
    name: 'Nilesh Patel',
    role: 'admin' as UserRole,
  },
  {
    id: 'user-worker-1',
    email: 'supervisor@opac.in',
    password: 'worker123',
    name: 'Bharat Singh',
    role: 'worker' as UserRole,
  },
  {
    id: 'user-worker-2',
    email: 'operator@opac.in',
    password: 'worker123',
    name: 'Ramesh Patel',
    role: 'worker' as UserRole,
  },
];
