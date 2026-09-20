import { L } from '../../domain/i18n';
import { useEffect, useState } from 'react';
import { Play, Pause, Square, Timer } from 'lucide-react';
import { api, today } from '../../domain/api';
import type { Entity, AgentRun } from '../../domain/types';
import type { WorkspaceActions } from '../../domain/useWorkspace';
import { Avatar } from '../../avatar/AvatarManager';
export function useFocus(refresh: () => Promise<void>) {
  const [session, setSession] = useState<Entity | null>(null);
  useEffect(() => {
    let stopped = false,
      previous = '';
    const poll = async () => {
      try {
        const value = await api('focusState');
        if (stopped) return;
        setSession(value);
        if (previous && !value) refresh();
        previous = value?.id || '';
      } catch {}
    };
    poll();
    const t = setInterval(poll, 1000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [refresh]);
  return { session, setSession };
}
export default function Focus({
  workspace,
  settings,
  runs,
  focus,
  onClose,
}: {
  workspace: WorkspaceActions;
  settings: Entity;
  runs: AgentRun[];
  focus: ReturnType<typeof useFocus>;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState(25),
    [task, setTask] = useState('');
  const { session, setSession } = focus;
  const remaining = session?.remainingSeconds ?? minutes * 60;
  const running = runs.filter((r) => r.status === 'RUNNING');
  async function control(action: string) {
    try {
      const value = await api(
        action,
        ...(action === 'focusStart'
          ? [minutes, task, workspace.data.tasks.find((t) => t.id === task)?.title || '自由专注']
          : []),
      );
      if (action === 'focusStop') {
        setSession(null);
        await workspace.refresh();
      } else setSession(value);
    } catch (e: any) {
      workspace.setError(e.message);
    }
  }
  const completed = workspace.data.focus.filter(
    (f) => f.endTime && new Date(f.endTime).toLocaleDateString('sv-SE') === today(),
  );
  return (
    <section className="panel focus-page">
      <button className="secondary" onClick={onClose}>
        <L text="← 返回工作台 · Esc" />
      </button>
      {session && (
        <p>
          <L text="返回后计时继续；结束本次专注请点击“结束并记录”。" />
        </p>
      )}
      <div className="eyebrow">
        <L text="ONE THING AT A TIME" />
      </div>
      <h2>{session?.title || '把这一刻，留给重要的事。'}</h2>
      <Avatar settings={settings} state={session && !session.paused ? 'working' : 'idle'} large />
      <div className="focus-clock" aria-label="专注剩余时间">
        {String(Math.floor(remaining / 60)).padStart(2, '0')}
        <span>:</span>
        {String(remaining % 60).padStart(2, '0')}
      </div>
      <p>
        {session
          ? session.paused
            ? '已暂停 · 休息一下也很好'
            : '保持专注，Nia 在这里陪你。'
          : '关掉一点杂音，让想法慢慢生长。'}
      </p>
      {!session && (
        <>
          <div className="focus-presets">
            <button className={minutes === 25 ? 'active' : ''} onClick={() => setMinutes(25)}>
              25 min
            </button>
            <button className={minutes === 50 ? 'active' : ''} onClick={() => setMinutes(50)}>
              50 min
            </button>
            <label>
              <L text="自定义" />
              <input
                aria-label="自定义专注分钟"
                type="number"
                min={1}
                max={480}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
              <span>min</span>
            </label>
          </div>
          <select aria-label="专注任务" value={task} onChange={(e) => setTask(e.target.value)}>
            <option value="">
              <L text="自由专注 · 不关联任务" />
            </option>
            {workspace.data.tasks
              .filter((t) => !['Done', 'Cancelled'].includes(t.status))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
        </>
      )}
      <div className="focus-controls">
        {session ? (
          <>
            <button className="primary" onClick={() => control('focusPause')}>
              {session.paused ? <Play size={16} /> : <Pause size={16} />}{' '}
              {session.paused ? '继续' : '暂停'}
            </button>
            <button className="secondary" onClick={() => control('focusStop')}>
              <Square size={15} />
              <L text="结束并记录" />
            </button>
          </>
        ) : (
          <button className="primary" onClick={() => control('focusStart')}>
            <Play size={16} />
            <L text="开始专注" />
          </button>
        )}
      </div>
      <div className="focus-summary">
        <span>
          <Timer size={14} /> 今日{' '}
          {Math.round(completed.reduce((s, f) => s + (f.actualSeconds || 0), 0) / 60)} min
        </span>
        <span>{running.length} 个 Agent 最近观测运行中</span>
      </div>
      {running.slice(0, 3).map((r) => (
        <p className="quiet" key={r.id}>
          {r.taskName}
        </p>
      ))}
    </section>
  );
}
