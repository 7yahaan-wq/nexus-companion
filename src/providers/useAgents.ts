import { useEffect, useState, useCallback } from 'react';
import { api } from '../domain/api';
import type { AgentRun, AgentProvider } from '../domain/types';
export const codexProvider: AgentProvider = {
  id: 'codex-local',
  capabilities: { stop: false, retry: false, live: false },
  list: async () => {
    const r = await api('agents');
    return r.runs;
  },
};
export function useAgents() {
  const [runs, setRuns] = useState<AgentRun[]>([]),
    [info, setInfo] = useState<any>({
      availability: 'LOADING',
      message: '读取本地会话…',
      capabilities: codexProvider.capabilities,
    }),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async (force = false) => {
    try {
      const r = await api('agents', force);
      setRuns(r.runs);
      setInfo(r);
    } catch (e: any) {
      setInfo({
        availability: 'UNAVAILABLE',
        message: e.message,
        capabilities: codexProvider.capabilities,
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      await refresh();
      if (!stopped) timer = setTimeout(poll, 15000);
    };
    poll();
    const focus = () => {
      refresh(true);
    };
    window.addEventListener('focus', focus);
    window.addEventListener('nexus-connection-changed', focus);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener('focus', focus);
      window.removeEventListener('nexus-connection-changed', focus);
    };
  }, [refresh]);
  return { runs, info, loading, refresh };
}
