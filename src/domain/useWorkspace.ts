import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Entity } from './types';
const collections = [
  'projects',
  'tasks',
  'events',
  'notes',
  'focus',
  'timeline',
  'reports',
] as const;
export type Workspace = Record<(typeof collections)[number], Entity[]>;
const empty: Workspace = {
  projects: [],
  tasks: [],
  events: [],
  notes: [],
  focus: [],
  timeline: [],
  reports: [],
};
export function useWorkspace() {
  const [data, setData] = useState<Workspace>(empty),
    [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      const records = await Promise.all(collections.map((k) => api<Entity[]>('list', k)));
      setData(Object.fromEntries(collections.map((k, i) => [k, records[i]])) as Workspace);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const save = useCallback(
    async (kind: string, value: Entity) => {
      // Structural task updates must preserve focus time accrued since the UI snapshot.
      const payload =
        kind === 'tasks'
          ? {
              ...value,
              actualTime: Number(value.actualTime) || 0,
              actualTimeBaseline: value.actualTimeBaseline ?? (Number(value.actualTime) || 0),
            }
          : value;
      await api('save', kind, payload);
      await refresh();
    },
    [refresh],
  );
  const remove = useCallback(
    async (kind: string, id: string) => {
      await api('delete', kind, id);
      await refresh();
    },
    [refresh],
  );
  return { data, save, remove, refresh, error, setError };
}
export type WorkspaceActions = ReturnType<typeof useWorkspace>;
