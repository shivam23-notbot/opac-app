import { nanoid } from 'nanoid/non-secure';
export { todayISO } from '@/lib/date';

export const generateId = () => nanoid();

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};
