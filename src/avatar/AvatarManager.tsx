import { L } from '../domain/i18n';
import { useEffect, useState, useRef } from 'react';
import { Orbit, Timer, ListTodo, NotebookPen, Boxes, LayoutDashboard } from 'lucide-react';
import { api } from '../domain/api';
import type { AgentRun, AvatarState, Entity } from '../domain/types';
export function resolveAvatarState(runs: AgentRun[], focus = false): AvatarState {
  if (runs.some((r) => r.status === 'FAILED')) return 'error';
  if (runs.some((r) => r.status === 'WAITING_APPROVAL')) return 'warning';
  if (focus || runs.some((r) => r.status === 'RUNNING')) return 'working';
  if (runs.some((r) => ['WAITING', 'STARTING'].includes(r.status))) return 'thinking';
  const recent = runs.filter(
    (r) =>
      r.status === 'COMPLETED' && r.endTime && Date.now() - new Date(r.endTime).getTime() < 120000,
  );
  if (recent.length > 1) return 'celebrate';
  if (recent.length) return 'happy';
  if (new Date().getHours() >= 23 || new Date().getHours() < 6) return 'sleepy';
  return 'idle';
}
export const stateText: Record<AvatarState, string> = {
  idle: '慢慢来，我们一起完成。',
  working: '我在这里，陪你专注。',
  thinking: '留一点空间，让想法发生。',
  happy: '又向前一步，做得很好。',
  warning: '有一件事，需要你看一眼。',
  error: '遇到一点问题，我们一起看看。',
  sleepy: '夜深了，也记得照顾自己。',
  celebrate: '今天的努力，正在开花。',
};
export function Avatar({
  settings,
  state = 'idle',
  large = false,
}: {
  settings: Entity;
  state?: AvatarState;
  large?: boolean;
}) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let valid = true;
    const id = settings.avatar === 'custom' ? settings.avatarPack?.states?.[state] : null;
    if (id)
      api<string>('asset', id)
        .then((s) => {
          if (valid) setSrc(s);
        })
        .catch(() => {
          if (valid) setSrc('');
        });
    else setSrc('');
    return () => {
      valid = false;
    };
  }, [settings.avatar, settings.avatarPack, state]);
  return (
    <div className={`avatar-render ${state} ${large ? 'large' : ''}`} data-state={state}>
      {settings.avatar === 'orb' ? (
        <div className="avatar-orb">
          <Orbit size={110} strokeWidth={1} />
        </div>
      ) : (
        <img src={src || './assets/nia.png'} alt={`Nia · ${state}`} draggable={false} />
      )}
      <span className="avatar-state-mark">
        {
          {
            idle: '✧',
            working: '⌨',
            thinking: '…',
            happy: '♡',
            warning: '!',
            error: '!',
            sleepy: '☾',
            celebrate: '✦',
          }[state]
        }
      </span>
    </div>
  );
}
export default function Companion({
  settings,
  runs,
  focus,
  onAction,
}: {
  settings: Entity;
  runs: AgentRun[];
  focus?: boolean;
  onAction: (action: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const menuRoot = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => {
      if (!menuRoot.current?.contains(e.target as Node)) setMenu(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);
  const state = resolveAvatarState(runs, focus);
  return (
    <aside className="companion-rail" ref={menuRoot}>
      <div className="rail-title">
        <L text="YOUR COMPANION" />
        <span>✦</span>
      </div>
      <button className="companion-art" aria-label="Nia 快捷操作" onClick={() => setMenu(!menu)}>
        <Avatar settings={settings} state={state} />
        <span className="online-label">
          ●{' '}
          {settings.avatar === 'custom'
            ? settings.avatarPack?.name
            : settings.avatar === 'orb'
              ? 'NEXUS CORE'
              : 'NIA'}{' '}
          · {state.toUpperCase()}
        </span>
      </button>
      {menu && (
        <div className="companion-menu">
          {[
            ['Tasks', '今日任务', ListTodo],
            ['Agents', '运行 Agent', Boxes],
            ['note', '快速笔记', NotebookPen],
            ['Focus', '开始专注', Timer],
            ['Home', '工作台', LayoutDashboard],
          ].map(([id, label, Icon]: any) => (
            <button
              key={id}
              onClick={() => {
                setMenu(false);
                onAction(id);
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="speech">
        <span>“</span>
        <h3>{stateText[state]}</h3>
        <p>
          {state === 'error'
            ? '打开 Agent 面板查看真实错误记录。'
            : '把复杂的工作，变成一个个轻盈的小步骤。'}
        </p>
      </div>
      <div className="rail-section">
        <h3>
          今日节奏{' '}
          <span>
            <L text="YOUR PACE" />
          </span>
        </h3>
        <p className="quiet">
          {focus ? '你正在为重要的事情留出时间。' : '一次只做一件事，就很好。'}
        </p>
        <button className="focus-button" onClick={() => onAction('Focus')}>
          <Timer size={19} />
          {focus ? '返回专注' : '开始一段专注'}
          <span>↗</span>
        </button>
      </div>
      <div className="rail-footer">
        <span>✧</span> From ideas to reality.
        <br />
        Together.
      </div>
    </aside>
  );
}
