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
  const refresh = useCallback(async (throwOnError = false) => {
    try {
      const records = await Promise.all(collections.map((k) => api<Entity[]>('list', k)));
      setData(Object.fromEntries(collections.map((k, i) => [k, records[i]])) as Workspace);
    } catch (e: any) {
      if (throwOnError) throw e;
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
  const moveTask = useCallback(
    async (request: { id: string; status: string; beforeId?: string | null }) => {
      const result = await api<{ changed: boolean; task: Entity }>('taskMove', request);
      try {
        // Even a no-op can be a retry after a committed move whose response was lost.
        await refresh(true);
      } catch (cause: any) {
        throw Error(`任务请求已处理，但列表刷新失败，请重试。${cause.message || ''}`);
      }
      return result;
    },
    [refresh],
  );
  return { data, save, remove, moveTask, refresh, error, setError };
}
export type WorkspaceActions = ReturnType<typeof useWorkspace>;
