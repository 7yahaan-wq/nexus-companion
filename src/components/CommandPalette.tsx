import { useMemo, useState } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';
import Modal from './Modal';
import type { WorkspaceActions } from '../domain/useWorkspace';
import type { AgentRun, Entity } from '../domain/types';
export interface Command {
  id: string;
  label: string;
  keywords: string;
  action: string;
}
export const commands: Command[] = [
  { id: 'task', label: '创建任务', keywords: 'Create Task todo', action: 'task' },
  { id: 'note', label: '创建笔记', keywords: 'Create Note', action: 'note' },
  { id: 'projects', label: '打开项目', keywords: 'Open Project', action: 'Projects' },
  { id: 'calendar', label: '打开日历', keywords: 'Open Calendar', action: 'Calendar' },
  { id: 'focus', label: '开始专注', keywords: 'Start Focus', action: 'Focus' },
  { id: 'agents', label: '查看运行 Agent', keywords: 'Show Running Agents', action: 'Agents' },
  { id: 'settings', label: '打开设置', keywords: 'Open Settings', action: 'Settings' },
  { id: 'background', label: '更换背景', keywords: 'Change Background', action: 'Settings' },
];
export default function CommandPalette({
  workspace,
  runs,
  onAction,
  onSelect,
  onClose,
}: {
  workspace: WorkspaceActions;
  runs: AgentRun[];
  onAction: (s: string) => void;
  onSelect: (kind: string, e: Entity) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(''),
    [index, setIndex] = useState(0);
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const commandResults = commands
      .filter((c) => `${c.label} ${c.keywords}`.toLowerCase().includes(q))
      .map((c) => ({ id: c.id, label: c.label, kind: 'Command', run: () => onAction(c.action) }));
    const entities = Object.entries({ ...workspace.data, agents: runs })
      .filter(([k]) => ['projects', 'tasks', 'notes', 'events', 'agents'].includes(k))
      .flatMap(([kind, values]) =>
        values
          .filter(
            (v) =>
              q &&
              `${v.title || v.name || v.taskName} ${v.content || ''} ${v.tags || ''}`
                .toLowerCase()
                .includes(q),
          )
          .map((v) => ({
            id: v.id,
            label: v.title || v.name || v.taskName,
            kind,
            run: () => onSelect(kind, v),
          })),
      );
    return [...commandResults, ...entities].slice(0, 35);
  }, [query, workspace.data, runs, onAction, onSelect]);
  function choose(i: number) {
    results[i]?.run();
    onClose();
  }
  return (
    <Modal title="搜索与命令" onClose={onClose}>
      <div className="palette-input">
        <Search size={20} />
        <input
          autoFocus
          aria-label="全局搜索"
          placeholder="搜索项目、任务、日程、笔记、Agent…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIndex((i) => Math.min(results.length - 1, i + 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              choose(index);
            }
          }}
        />
      </div>
      <div className="command-results">
        {results.map((r, i) => (
          <button
            key={r.kind + r.id}
            className={i === index ? 'selected' : ''}
            onClick={() => choose(i)}
          >
            <span>{r.label}</span>
            <small>{r.kind}</small>
            <ArrowUpRight size={14} />
          </button>
        ))}
        {!results.length && <p>没有匹配结果。</p>}
      </div>
      <p className="quiet">↑ ↓ 选择 · Enter 打开 · Esc 关闭</p>
    </Modal>
  );
}
