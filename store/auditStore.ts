import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuditLog } from '@/types';
import { generateId } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export const AUDIT_LOG_RETENTION_DAYS = 90;

interface AuditState {
  logs: AuditLog[];
  hydrate: () => Promise<void>;
  log: (entry: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  getLogsForEntity: (entity: AuditLog['entity'], entityId: string) => AuditLog[];
  getRecentLogs: (days: number) => AuditLog[];
  pruneOldLogs: () => void;
}

function isWithinRetention(timestamp: string, retentionDays: number): boolean {
  const cutoff = Date.now() - retentionDays * 86400000;
  return new Date(timestamp).getTime() >= cutoff;
}

export const useAuditStore = create<AuditState>()(
  persist(
    (set, get) => ({
      logs: [],

      hydrate: async () => {
        const cutoff = new Date(Date.now() - AUDIT_LOG_RETENTION_DAYS * 86400000).toISOString();
        const { data } = await supabase
          .from('audit_logs')
          .select('*')
          .gte('timestamp', cutoff)
          .order('timestamp', { ascending: false });
        if (!data) return;
        set({
          logs: data.map((row) => ({
            id: row.id as string,
            timestamp: row.timestamp as string,
            userId: row.user_id as string,
            userName: row.user_name as string,
            action: row.action as string,
            entity: row.entity as AuditLog['entity'],
            entityId: row.entity_id as string,
            detail: row.detail as string,
          })),
        });
      },

      log: (entry) => {
        const id = generateId();
        const timestamp = new Date().toISOString();
        const newLog: AuditLog = { ...entry, id, timestamp };
        set((s) => ({ logs: [...s.logs, newLog] }));
        supabase.from('audit_logs').insert({
          id,
          timestamp,
          user_id: entry.userId,
          user_name: entry.userName,
          action: entry.action,
          entity: entry.entity,
          entity_id: entry.entityId,
          detail: entry.detail,
        });
      },

      getLogsForEntity: (entity, entityId) =>
        get().logs.filter((l) => l.entity === entity && l.entityId === entityId),
      getRecentLogs: (days) => get().logs.filter((l) => isWithinRetention(l.timestamp, days)),
      pruneOldLogs: () => {
        set((s) => ({
          logs: s.logs.filter((l) => isWithinRetention(l.timestamp, AUDIT_LOG_RETENTION_DAYS)),
        }));
      },
    }),
    {
      name: 'opac-audit-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
