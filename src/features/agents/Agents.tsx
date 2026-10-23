import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Terminal, Folder, Copy, ExternalLink } from 'lucide-react';
import type { AgentRun } from '../../domain/types';
import { api } from '../../domain/api';
import Modal from '../../components/Modal';
import EntityForm from '../../components/EntityForm';
import type { Entity } from '../../domain/types';
import VirtualLog from '../../components/VirtualLog';
import type { useAgents } from '../../providers/useAgents';
import { L, useI18n } from '../../domain/i18n';
import { AccountQuotaPanel, TokenSummary, UsageDetail } from './Usage';
export function Status({ status }: { status: string }) {
  return (
    <span className={'badge agent-status ' + status}>
      <L text={status} />
    </span>
  );
}
export function AgentCard({ run, onOpen }: { run: AgentRun; onOpen: () => void }) {
  const { language, t } = useI18n();
  return (
    <button className="agent-card" onClick={onOpen}>
      <div className="agent-card-heading">
        <div className="agent-symbol">
          <Terminal size={19} />
        </div>
        <div>
          <strong>
            {run.pinned ? '★ ' : ''}
            {run.agentName}
          </strong>
          <small>
            {run.role ? run.role + ' · ' : ''}
            {run.project || t('未关联项目', 'No linked project')}
          </small>
        </div>
        <Status status={run.status} />
      </div>
      <h3>{run.taskName}</h3>
      <p>{run.currentStep}</p>
      <div className="agent-output">
        {run.lastMessage || t('没有可用的公开输出', 'No public output available')}
      </div>
      <TokenSummary run={run} />
      <footer>
        <span>
          {run.duration !== null
            ? `${Math.round(run.duration / 60000)} min`
            : t('时长未知', 'Duration unknown')}
        </span>
        <span>
          {t('观测', 'Observed')}{' '}
          {new Date(run.observedAt).toLocaleTimeString(language === 'en' ? 'en-US' : 'zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <ExternalLink size={12} />
      </footer>
    </button>
  );
}
export default function Agents({
  agents,
  setError,
  onOpenConnections,
}: {
  agents: ReturnType<typeof useAgents>;
  setError: (s: string) => void;
  onOpenConnections: () => void;
}) {
  const { language, t } = useI18n();
  const [profile, setProfile] = useState<Entity | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null),
    [logs, setLogs] = useState<string[]>([]),
    [logsLoading, setLogsLoading] = useState(false),
    [logsError, setLogsError] = useState(false),
    [logRevision, setLogRevision] = useState(0),
    [enabling, setEnabling] = useState(false),
    [enableError, setEnableError] = useState(false),
    [q, setQ] = useState(''),
    [status, setStatus] = useState('');
  const logRequest = useRef(0);
  const enableRequest = useRef(0),
    enableBusy = useRef(false);
  useEffect(
    () => () => {
      ++enableRequest.current;
      enableBusy.current = false;
    },
    [],
  );
  async function enableReading() {
    if (enableBusy.current) return;
    enableBusy.current = true;
    const request = ++enableRequest.current;
    setEnabling(true);
    setEnableError(false);
    try {
      await api('configureConnection', 'enable');
      await agents.refresh(true);
    } catch {
      if (request === enableRequest.current) setEnableError(true);
    } finally {
      if (request === enableRequest.current) {
        enableBusy.current = false;
        setEnabling(false);
      }
    }
  }
  const selected = agents.runs.find((run) => run.id === selectedId);
  function open(run: AgentRun) {
    ++logRequest.current;
    setSelectedId(run.id);
    setLogs([]);
    setLogsError(false);
  }
  function closeSelected() {
    ++logRequest.current;
    setSelectedId(null);
  }
  useEffect(() => {
    if (!selectedId) return;
    const request = ++logRequest.current;
    setLogsLoading(true);
    setLogsError(false);
    api<string[]>('agentLogs', selectedId)
      .then((next) => {
        if (request === logRequest.current) setLogs(next);
      })
      .catch(() => {
        if (request === logRequest.current) setLogsError(true);
      })
      .finally(() => {
        if (request === logRequest.current) setLogsLoading(false);
      });
    return () => {
      ++logRequest.current;
    };
  }, [selectedId, selected?.observedAt, logRevision]);
  const filtered = agents.runs.filter(
    (r) =>
      (!status || r.status === status) &&
      `${r.taskName} ${r.project} ${r.agentName}`.toLowerCase().includes(q.toLowerCase()),
  );
  const emptyState =
    agents.loading || agents.info.availability === 'LOADING'
      ? 'loading'
      : agents.info.availability === 'DISABLED'
        ? 'paused'
        : agents.info.availability === 'UNAVAILABLE'
          ? 'unavailable'
          : !agents.runs.length
            ? 'no-records'
            : !filtered.length
              ? 'filtered'
              : null;
  const scanned = agents.info.scannedAt ? new Date(agents.info.scannedAt) : null;
  const emptyContent = {
    loading: [
      t('正在读取本地会话…', 'Reading local sessions…'),
      t('正在检查本机 Codex 记录，请稍候。', 'Checking local Codex records. Please wait.'),
    ],
    paused: [
      t('已暂停读取 Codex', 'Codex reading is paused'),
      t(
        '启用后会继续读取本地会话，已有记录不会被删除。',
        'Enable reading to resume local session discovery. Existing records are kept.',
      ),
    ],
    unavailable: [
      t('暂时无法读取本地会话', 'Local sessions are unavailable'),
      t(
        '请检查读取目录是否存在、可访问，且包含 sessions 文件夹。',
        'Check that the session directory exists, is accessible, and contains a sessions folder.',
      ),
    ],
    'no-records': [
      t('还没有本地会话记录', 'No local sessions yet'),
      t(
        '目录可以读取，但尚未发现会话。先在官方 Codex 中开始一次任务，或选择已有记录的目录，再重新检测。',
        'The directory is readable, but no sessions were found. Start a task in official Codex, or select a directory with existing sessions, then scan again.',
      ),
    ],
    filtered: [
      t('没有匹配的会话', 'No matching sessions'),
      t(
        `已读取 ${agents.runs.length} 个会话，当前关键词或状态没有匹配。`,
        `${agents.runs.length} sessions were found, but none match your search or status filter.`,
      ),
    ],
  };
  return (
    <>
      <div className="provider-banner">
        <span className="connection-dot" />
        <div>
          <strong>Codex Local · {agents.info.availability}</strong>
          <p>
            {language === 'en'
              ? agents.info.availability === 'UNAVAILABLE'
                ? 'Local sessions are unavailable. Check the Codex connection in Settings.'
                : agents.info.availability === 'DISABLED'
                  ? 'Local Codex reading is paused in Settings.'
                  : 'Read-only local session records. Status is based on the latest observation; live control is unavailable.'
              : agents.info.message}
          </p>
        </div>
        <button
          aria-label={t('刷新 Agent', 'Refresh agents')}
          disabled={agents.refreshing || enabling}
          onClick={() => agents.refresh(true)}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      <div className="agent-connection-meta" data-testid="agent-connection-meta">
        <div>
          <span>{t('读取目录', 'Session directory')}</span>
          <code>{agents.info.root || t('尚未获取目录', 'Directory not available yet')}</code>
        </div>
        <div>
          <span>{t('最近扫描', 'Last scan')}</span>
          {scanned && Number.isFinite(scanned.getTime()) ? (
            <time dateTime={agents.info.scannedAt}>
              {scanned.toLocaleString(language === 'en' ? 'en-US' : 'zh-CN')}
            </time>
          ) : (
            <span>{t('尚未扫描', 'Not scanned yet')}</span>
          )}
        </div>
      </div>
      <AccountQuotaPanel
        snapshot={agents.info.accountQuota}
        result={agents.quotaResult}
        pending={agents.quotaPending}
        error={agents.quotaError}
        onQuery={agents.queryQuota}
      />
      <div className="toolbar">
        <input
          placeholder={t('搜索 Agent、任务或项目…', 'Search agents, tasks or projects…')}
          aria-label={t('搜索 Agent、任务或项目', 'Search agents, tasks or projects')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label={t('Agent 状态过滤', 'Filter agent status')}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">{t('所有状态', 'All statuses')}</option>
          {[
            'RUNNING',
            'COMPLETED',
            'FAILED',
            'WAITING',
            'WAITING_APPROVAL',
            'CANCELLED',
            'UNAVAILABLE',
          ].map((s) => (
            <option key={s} value={s}>
              {t(s)}
            </option>
          ))}
        </select>
        <span className="quiet">
          {filtered.length} {t('个会话', 'sessions')}
        </span>
      </div>
      <div className="agent-grid">
        {filtered.map((r) => (
          <AgentCard key={r.id} run={r} onOpen={() => open(r)} />
        ))}
      </div>
      {emptyState && (
        <section
          className="panel empty agent-empty-state"
          data-testid="agent-empty-state"
          data-state={emptyState}
          aria-busy={emptyState === 'loading' || enabling}
        >
          <Terminal size={32} />
          <h3>{emptyContent[emptyState][0]}</h3>
          <p role="status">{emptyContent[emptyState][1]}</p>
          {emptyState === 'filtered' ? (
            <button
              className="primary"
              data-testid="agent-clear-filters"
              onClick={() => {
                setQ('');
                setStatus('');
              }}
            >
              {t('清除筛选', 'Clear filters')}
            </button>
          ) : (
            emptyState !== 'loading' && (
              <div className="agent-empty-actions">
                {emptyState === 'paused' ? (
                  <button
                    className="primary"
                    data-testid="agent-enable-reading"
                    disabled={enabling}
                    onClick={enableReading}
                  >
                    {enabling ? t('正在启用…', 'Enabling…') : t('启用读取', 'Enable reading')}
                  </button>
                ) : (
                  <button disabled={agents.refreshing} onClick={() => agents.refresh(true)}>
                    {agents.refreshing ? t('正在检测…', 'Scanning…') : t('重新检测', 'Scan again')}
                  </button>
                )}
                <button
                  data-testid="agent-open-connections"
                  disabled={enabling}
                  onClick={onOpenConnections}
                >
                  {t('打开连接设置', 'Open connection settings')}
                </button>
              </div>
            )
          )}
          {enableError && (
            <p className="usage-error" role="alert">
              {t(
                '未能启用读取，请重试或检查连接设置。',
                'Reading could not be enabled. Retry or check connection settings.',
              )}
            </p>
          )}
        </section>
      )}
      {selected && (
        <Modal title={selected.taskName} onClose={closeSelected} wide>
          <div className="toolbar wrap">
            <Status status={selected.status} />
            <button
              data-testid="agent-detail-refresh"
              disabled={agents.refreshing}
              onClick={async () => {
                await agents.refresh(true);
                setLogRevision((value) => value + 1);
              }}
            >
              <RefreshCw size={14} />
              {t('刷新当前会话', 'Refresh this session')}
            </button>
            <button
              onClick={() =>
                setProfile({
                  id: selected.id,
                  displayName: selected.agentName,
                  role: selected.role || '',
                  pinned: selected.pinned ? 'yes' : 'no',
                })
              }
            >
              {t('标注角色 / 置顶', 'Label / pin')}
            </button>
            <button
              onClick={() =>
                navigator.clipboard.writeText(logs.join('\n')).catch((e) => setError(e.message))
              }
            >
              <Copy size={14} />
              {t('复制日志', 'Copy logs')}
            </button>
            <button
              onClick={() =>
                api('projectOpen', selected.workingDirectory, 'folder').catch((e) =>
                  setError(e.message),
                )
              }
            >
              <Folder size={14} />
              {t('项目目录', 'Project folder')}
            </button>
            <button
              onClick={() =>
                api('projectOpen', selected.workingDirectory, 'vscode').catch((e) =>
                  setError(e.message),
                )
              }
            >
              VS Code
            </button>
            <button
              disabled
              title={t('本地只读 Provider 不支持', 'Not supported by the local read-only provider')}
            >
              {t('停止 · Unsupported', 'Stop · Unsupported')}
            </button>
            <button
              disabled
              title={t('本地只读 Provider 不支持', 'Not supported by the local read-only provider')}
            >
              {t('重试 · Unsupported', 'Retry · Unsupported')}
            </button>
          </div>
          <UsageDetail run={selected} />
          <p>{selected.currentStep} · Progress: Unavailable</p>
          <p className="path-text">{selected.workingDirectory}</p>
          <h3>{t('明确记录的修改文件', 'Recorded file changes')}</h3>
          <p>
            {selected.changedFiles.join(' · ') ||
              t(
                'Unavailable · 此记录没有结构化文件修改数据',
                'Unavailable · No structured file changes in this record',
              )}
          </p>
          <h3>
            {t('公开输出日志', 'Public output logs')}{' '}
            <span className="quiet">
              {t('最多末尾 2 MB / 1500 条 · 虚拟列表', 'Last 2 MB / 1500 entries · virtual list')}
            </span>
          </h3>
          {logsLoading && (
            <p className="usage-note" role="status">
              {t('正在读取日志…', 'Reading logs…')}
            </p>
          )}
          {logsError && (
            <p className="usage-error" role="alert">
              {t(
                '日志读取失败，请刷新当前会话重试。',
                'Logs could not be read. Refresh this session to retry.',
              )}
            </p>
          )}
          <VirtualLog logs={logs} />
        </Modal>
      )}
      {profile && (
        <EntityForm
          title="会话标注（仅本应用）"
          value={profile}
          fields={[
            { key: 'displayName', label: '显示名称', required: true },
            {
              key: 'role',
              label: '角色',
              options: [
                '',
                'Programmer',
                'QA',
                'Producer',
                'Game Designer',
                'Art',
                'Research',
                'Documentation',
              ].map((s) => ({ value: s, label: s || '未标注' })),
            },
            {
              key: 'pinned',
              label: '置顶',
              options: [
                { value: 'no', label: '否' },
                { value: 'yes', label: '是' },
              ],
            },
          ]}
          onClose={() => setProfile(null)}
          onSave={async (p) => {
            const rows = await api<Entity[]>('list', 'settings');
            const existing = rows.find((s) => s.id === 'agent-profiles') || {
              id: 'agent-profiles',
              profiles: {},
            };
            await api('save', 'settings', {
              ...existing,
              profiles: {
                ...existing.profiles,
                [p.id]: { displayName: p.displayName, role: p.role, pinned: p.pinned === 'yes' },
              },
            });
            await agents.refresh(true);
            closeSelected();
          }}
        />
      )}
    </>
  );
}
