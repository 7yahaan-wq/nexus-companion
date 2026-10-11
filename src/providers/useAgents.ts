import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../domain/api';
import type { AgentRun, AgentProvider, AgentsSnapshot, CodexQuotaResult } from '../domain/types';
export const codexProvider: AgentProvider = {
  id: 'codex-local',
  capabilities: { stop: false, retry: false, live: false },
  list: async () => {
    const r = await api<AgentsSnapshot>('agents');
    return r.runs;
  },
};
export function useAgents() {
  const [runs, setRuns] = useState<AgentRun[]>([]),
    [info, setInfo] = useState<AgentsSnapshot>({
      runs: [],
      availability: 'LOADING',
      message: '读取本地会话…',
      capabilities: codexProvider.capabilities,
      accountQuota: null,
    }),
    [loading, setLoading] = useState(true),
    [refreshing, setRefreshing] = useState(false),
    [quotaResult, setQuotaResult] = useState<CodexQuotaResult | null>(null),
    [quotaPending, setQuotaPending] = useState(false),
    [quotaError, setQuotaError] = useState<string | null>(null);
  const refreshRequest = useRef(0),
    quotaRequest = useRef(0),
    quotaBusy = useRef(false);
  const refresh = useCallback(async (force = false) => {
    const request = ++refreshRequest.current;
    setRefreshing(true);
    try {
      const r = await api<AgentsSnapshot>('agents', force);
      if (request !== refreshRequest.current) return;
      setRuns(r.runs);
      setInfo({ ...r, accountQuota: r.accountQuota ?? null });
    } catch (e: any) {
      if (request !== refreshRequest.current) return;
      setInfo((previous) => ({
        ...previous,
        availability: 'UNAVAILABLE',
        message: e.message,
        capabilities: codexProvider.capabilities,
      }));
    } finally {
      if (request === refreshRequest.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);
  const queryQuota = useCallback(async () => {
    if (quotaBusy.current) return;
    quotaBusy.current = true;
    const request = ++quotaRequest.current;
    setQuotaPending(true);
    setQuotaError(null);
    try {
      const result = await api<CodexQuotaResult>('codexQuota');
      if (request !== quotaRequest.current) return;
      if (result.status === 'AVAILABLE' && result.quota) setQuotaResult(result);
      else setQuotaError(result.reason || 'QUERY_FAILED');
    } catch {
      if (request === quotaRequest.current) setQuotaError('QUERY_FAILED');
    } finally {
      if (request === quotaRequest.current) {
        quotaBusy.current = false;
        setQuotaPending(false);
      }
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
    const connectionChanged = () => {
      ++quotaRequest.current;
      quotaBusy.current = false;
      setQuotaResult(null);
      setQuotaPending(false);
      setQuotaError(null);
      setRuns([]);
      setInfo((previous) => ({ ...previous, runs: [], accountQuota: null }));
      refresh(true);
    };
    window.addEventListener('focus', focus);
    window.addEventListener('nexus-connection-changed', connectionChanged);
    return () => {
      stopped = true;
      ++refreshRequest.current;
      ++quotaRequest.current;
      quotaBusy.current = false;
      clearTimeout(timer);
      window.removeEventListener('focus', focus);
      window.removeEventListener('nexus-connection-changed', connectionChanged);
    };
  }, [refresh]);
  return {
    runs,
    info,
    loading,
    refreshing,
    refresh,
    quotaResult,
    quotaPending,
    quotaError,
    queryQuota,
  };
}
