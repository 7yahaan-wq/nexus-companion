import { useState } from 'react';
import { RefreshCw, Terminal, Folder, Copy, ExternalLink } from 'lucide-react';
import type { AgentRun } from '../../domain/types';
import { api } from '../../domain/api';
import Modal from '../../components/Modal';
import EntityForm from '../../components/EntityForm';
import type { Entity } from '../../domain/types';
import VirtualLog from '../../components/VirtualLog';
import type { useAgents } from '../../providers/useAgents';
import { L } from '../../domain/i18n';
export function Status({ status }: { status: string }) {
  return (
    <span className={'badge agent-status ' + status}>
      <L text={status} />
    </span>
  );
}
export function AgentCard({ run, onOpen }: { run: AgentRun; onOpen: () => void }) {
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
            {run.project || '未关联项目'}
          </small>
        </div>
        <Status status={run.status} />
      </div>
      <h3>{run.taskName}</h3>
      <p>{run.currentStep}</p>
      <div className="agent-output">{run.lastMessage || '没有可用的公开输出'}</div>
      <footer>
        <span>
          {run.duration !== null ? `${Math.round(run.duration / 60000)} min` : '时长未知'}
        </span>
        <span>
          观测{' '}
          {new Date(run.observedAt).toLocaleTimeString('zh-CN', {
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
}: {
  agents: ReturnType<typeof useAgents>;
  setError: (s: string) => void;
}) {
  const [profile, setProfile] = useState<Entity | null>(null);
  const [selected, setSelected] = useState<AgentRun | null>(null),
    [logs, setLogs] = useState<string[]>([]),
    [q, setQ] = useState(''),
    [status, setStatus] = useState('');
  async function open(run: AgentRun) {
    setSelected(run);
    setLogs([]);
    try {
      setLogs(await api('agentLogs', run.id));
    } catch (e: any) {
      setError(e.message);
    }
  }
  const filtered = agents.runs.filter(
    (r) =>
      (!status || r.status === status) &&
      `${r.taskName} ${r.project} ${r.agentName}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="provider-banner">
        <span className="connection-dot" />
        <div>
          <strong>Codex Local · {agents.info.availability}</strong>
          <p>{agents.info.message}</p>
        </div>
        <button aria-label="刷新 Agent" onClick={() => agents.refresh(true)}>
          <RefreshCw size={15} />
        </button>
      </div>
      <div className="toolbar">
        <input
          placeholder="搜索 Agent、任务或项目…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Agent 状态过滤"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">所有状态</option>
          {[
            'RUNNING',
            'COMPLETED',
            'FAILED',
            'WAITING',
            'WAITING_APPROVAL',
            'CANCELLED',
            'UNAVAILABLE',
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="quiet">{filtered.length} 个会话</span>
      </div>
      <div className="agent-grid">
        {filtered.map((r) => (
          <AgentCard key={r.id} run={r} onOpen={() => open(r)} />
        ))}
      </div>
      {!filtered.length && (
        <section className="panel empty">
          <Terminal size={32} />
          <h3>{agents.loading ? '正在读取本地会话…' : '没有符合条件的本地记录'}</h3>
          <p>不会把未知状态显示为成功或运行中。</p>
        </section>
      )}
      {selected && (
        <Modal title={selected.taskName} onClose={() => setSelected(null)} wide>
          <div className="toolbar wrap">
            <Status status={selected.status} />
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
              标注角色 / 置顶
            </button>
            <button
              onClick={() =>
                navigator.clipboard.writeText(logs.join('\n')).catch((e) => setError(e.message))
              }
            >
              <Copy size={14} />
              复制日志
            </button>
            <button
              onClick={() =>
                api('projectOpen', selected.workingDirectory, 'folder').catch((e) =>
                  setError(e.message),
                )
              }
            >
              <Folder size={14} />
              项目目录
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
            <button disabled title="本地只读 Provider 不支持">
              停止 · Unsupported
            </button>
            <button disabled title="本地只读 Provider 不支持">
              重试 · Unsupported
            </button>
          </div>
          <p>{selected.currentStep} · Progress: Unavailable</p>
          <p className="path-text">{selected.workingDirectory}</p>
          <h3>明确记录的修改文件</h3>
          <p>{selected.changedFiles.join(' · ') || 'Unavailable · 此记录没有结构化文件修改数据'}</p>
          <h3>
            公开输出日志 <span className="quiet">最多末尾 2 MB / 1500 条 · 虚拟列表</span>
          </h3>
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
            setSelected(null);
          }}
        />
      )}
    </>
  );
}
