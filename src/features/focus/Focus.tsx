import { useI18n } from '../../domain/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Timer, Check, Coffee } from 'lucide-react';
import { api, today } from '../../domain/api';
import type { Entity, AgentRun } from '../../domain/types';
import type { WorkspaceActions } from '../../domain/useWorkspace';
import { Avatar } from '../../avatar/AvatarManager';

type FocusAction = 'focusStart' | 'focusPause' | 'focusStop';
const clock = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
};

export function useFocus(refresh: () => Promise<void>) {
  const [session, updateSession] = useState<Entity | null>(null);
  const [recent, setRecent] = useState<Entity | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const current = useRef<Entity | null>(null);
  const working = useRef(false);
  const revision = useRef(0);
  const notified = useRef('');
  const setSession = useCallback((value: Entity | null) => {
    current.current = value;
    updateSession(value);
  }, []);
  const remember = useCallback((record: Entity | undefined) => {
    if (record && record.id !== notified.current) {
      notified.current = record.id;
      setRecent(record);
    }
  }, []);
  useEffect(() => {
    let stopped = false,
      polling = false;
    const poll = async () => {
      if (working.current || polling) return;
      polling = true;
      const version = revision.current;
      try {
        const value = await api<Entity | null>('focusState');
        if (stopped || version !== revision.current || working.current) return;
        const previous = current.current;
        setSession(value);
        setConnectionError('');
        // Only observe transitions seen during this app visit; old records must not
        // greet the user again whenever the app is opened.
        if (previous && !value) {
          const records = await api<Entity[]>('list', 'focus');
          if (stopped || version !== revision.current) return;
          remember(records.find((record) => record.id === previous.id));
          await refresh();
        }
      } catch (e: any) {
        if (!stopped) setConnectionError(e.message);
      } finally {
        polling = false;
      }
    };
    void poll();
    const timer = setInterval(poll, 1000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [refresh, remember, setSession]);
  const control = useCallback(
    async (action: FocusAction, minutes?: number, task = '', title = '') => {
      if (working.current) return null;
      working.current = true;
      revision.current++;
      setPending(true);
      setError('');
      try {
        const previous = current.current;
        const value = await api<Entity | null>(
          action,
          ...(action === 'focusStart' ? [minutes, task, title] : []),
        );
        if (action === 'focusStop' || !value) {
          setSession(null);
          if (value) remember(value);
          else if (previous) {
            const records = await api<Entity[]>('list', 'focus');
            remember(records.find((record) => record.id === previous.id));
          }
          await refresh();
        } else {
          setSession(value);
          if (action === 'focusStart') setRecent(null);
        }
        return value;
      } catch (e: any) {
        setError(e.message);
        return null;
      } finally {
        working.current = false;
        setPending(false);
      }
    },
    [refresh, remember, setSession],
  );
  return {
    session,
    setSession,
    recent,
    pending,
    error: error || connectionError,
    control,
    dismissRecent: () => setRecent(null),
  };
}

type FocusContext = {
  workspace: WorkspaceActions;
  focus: ReturnType<typeof useFocus>;
  onOpen: () => void;
};

export function FocusBar({ workspace, focus, onOpen }: FocusContext) {
  const { t } = useI18n();
  const { session, pending, error, control } = focus;
  if (!session) return null;
  const task = workspace.data.tasks.find((item) => item.id === session.task);
  return (
    <section className="focus-bar" aria-label={t('专注计时条', 'Focus timer')} aria-busy={pending}>
      <button
        className="focus-bar-open"
        onClick={onOpen}
        aria-label={t('返回专注', 'Return to focus')}
      >
        <Timer size={18} />
        <span>
          <small>{session.paused ? t('已暂停', 'Paused') : t('正在专注', 'Focusing')}</small>
          <strong>{task?.title || session.title}</strong>
        </span>
      </button>
      <output className="focus-bar-clock" aria-label={t('专注剩余时间', 'Focus time remaining')}>
        {clock(session.remainingSeconds)}
      </output>
      <div className="focus-bar-controls">
        <button className="secondary" disabled={pending} onClick={() => control('focusPause')}>
          {session.paused ? <Play size={14} /> : <Pause size={14} />}
          {session.paused ? t('继续', 'Resume') : t('暂停', 'Pause')}
        </button>
        <button className="secondary" disabled={pending} onClick={() => control('focusStop')}>
          <Square size={14} />
          {t('结束并记录', 'Stop and save')}
        </button>
      </div>
      {error && (
        <p className="focus-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function FocusCompletion({ workspace, focus, onOpen }: FocusContext) {
  const { t } = useI18n();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const record = focus.recent;
  const task = workspace.data.tasks.find((item) => item.id === record?.task);
  const locked = saving || focus.pending;
  useEffect(() => setError(''), [record?.id]);
  if (!record || focus.session) return null;
  async function markDone() {
    if (!task || locked) return;
    setSaving(true);
    setError('');
    try {
      const current = (await api<Entity[]>('list', 'tasks')).find((item) => item.id === task.id);
      if (current)
        await workspace.save('tasks', {
          ...current,
          status: 'Done',
          completedAt: new Date().toISOString(),
          actualTime: Number(current.actualTime) || 0,
          actualTimeBaseline: Number(current.actualTime) || 0,
        });
      focus.dismissRecent();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function anotherRound() {
    if (!record || locked) return;
    const next = await focus.control(
      'focusStart',
      Math.max(1, Math.min(480, Number(record.plannedSeconds) / 60 || 25)),
      task?.id || '',
      task?.title || record.title,
    );
    if (next) onOpen();
  }
  return (
    <section
      className="focus-completion"
      aria-label={t('专注完成后续操作', 'After your focus session')}
      aria-busy={locked}
    >
      <div className="focus-completion-copy">
        <strong>
          {record.status === 'completed'
            ? t('专注完成，辛苦了。', 'Focus complete. Well done.')
            : t('本次专注已记录', 'Your focus session was saved')}
        </strong>
        <p>
          {record.title} · {clock(record.actualSeconds || 0)}
          {task && record.taskTimeCreditedSeconds > 0
            ? t('，已计入任务用时。', ' added to task time.')
            : ''}
        </p>
      </div>
      <div className="focus-completion-actions">
        {task && !['Done', 'Cancelled'].includes(task.status) && (
          <button className="primary" disabled={locked} onClick={markDone}>
            <Check size={15} />
            {t('完成任务', 'Mark task done')}
          </button>
        )}
        <button className="secondary" disabled={locked} onClick={anotherRound}>
          <Play size={15} />
          {t('再来一轮', 'Another round')}
        </button>
        <button className="secondary" disabled={locked} onClick={focus.dismissRecent}>
          <Coffee size={15} />
          {t('休息', 'Take a break')}
        </button>
      </div>
      {(error || focus.error) && (
        <p className="focus-error" role="alert">
          {error || focus.error}
        </p>
      )}
    </section>
  );
}

export default function Focus({
  workspace,
  settings,
  runs,
  focus,
  onClose,
  initialTaskId,
}: {
  workspace: WorkspaceActions;
  settings: Entity;
  runs: AgentRun[];
  focus: ReturnType<typeof useFocus>;
  onClose: () => void;
  initialTaskId?: string;
}) {
  const { t } = useI18n();
  const [minutes, setMinutes] = useState(25);
  const [task, setTask] = useState(initialTaskId || '');
  const { session, control, pending, error } = focus;
  useEffect(() => {
    if (initialTaskId !== undefined) setTask(initialTaskId);
  }, [initialTaskId]);
  const remaining = session?.remainingSeconds ?? minutes * 60;
  const running = runs.filter((r) => r.status === 'RUNNING');
  const eligibleTasks = workspace.data.tasks.filter(
    (item) => !['Done', 'Cancelled'].includes(item.status),
  );
  const selectedTask = eligibleTasks.find((item) => item.id === task);
  const validMinutes = Number.isFinite(minutes) && minutes >= 1 && minutes <= 480;
  const completed = workspace.data.focus.filter(
    (item) => item.endTime && new Date(item.endTime).toLocaleDateString('sv-SE') === today(),
  );
  return (
    <section className="panel focus-page" aria-busy={pending}>
      <button className="secondary" onClick={onClose}>
        {t('← 返回工作台 · Esc', '← Back to workspace · Esc')}
      </button>
      {session && (
        <p>
          {t(
            '返回后计时继续；结束本次专注请点击“结束并记录”。',
            'The timer keeps running when you leave. Choose Stop and save to end this session.',
          )}
        </p>
      )}
      <div className="eyebrow">{t('ONE THING AT A TIME')}</div>
      <h2>
        {session?.title ||
          selectedTask?.title ||
          t('把这一刻，留给重要的事。', 'Make room for what matters.')}
      </h2>
      <Avatar settings={settings} state={session && !session.paused ? 'working' : 'idle'} large />
      <div className="focus-clock" aria-label={t('专注剩余时间', 'Focus time remaining')}>
        {clock(remaining)}
      </div>
      <p>
        {session
          ? session.paused
            ? t('已暂停 · 休息一下也很好', 'Paused · It is okay to take a break')
            : t('保持专注，Nia 在这里陪你。', 'Stay focused. Nia is here with you.')
          : t(
              '关掉一点杂音，让想法慢慢生长。',
              'A little less noise, a little more space to think.',
            )}
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
              {t('自定义', 'Custom')}
              <input
                aria-label={t('自定义专注分钟', 'Custom focus minutes')}
                type="number"
                min={1}
                max={480}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
              <span>min</span>
            </label>
          </div>
          <select
            aria-label={t('专注任务', 'Focus task')}
            value={selectedTask?.id || ''}
            onChange={(e) => setTask(e.target.value)}
          >
            <option value="">{t('自由专注 · 不关联任务', 'Free focus · No linked task')}</option>
            {eligibleTasks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </>
      )}
      <div className="focus-controls">
        {session ? (
          <>
            <button className="primary" disabled={pending} onClick={() => control('focusPause')}>
              {session.paused ? <Play size={16} /> : <Pause size={16} />}
              {session.paused ? t('继续', 'Resume') : t('暂停', 'Pause')}
            </button>
            <button className="secondary" disabled={pending} onClick={() => control('focusStop')}>
              <Square size={15} />
              {t('结束并记录', 'Stop and save')}
            </button>
          </>
        ) : (
          <button
            className="primary"
            disabled={pending || !validMinutes}
            onClick={() =>
              control(
                'focusStart',
                minutes,
                selectedTask?.id || '',
                selectedTask?.title || t('自由专注', 'Free focus'),
              )
            }
          >
            <Play size={16} />
            {t('开始专注', 'Start focus')}
          </button>
        )}
      </div>
      {error && (
        <p className="focus-error" role="alert">
          {error}
        </p>
      )}
      <div className="focus-summary">
        <span>
          <Timer size={14} />
          {t('今日', 'Today')}{' '}
          {Math.round(completed.reduce((sum, item) => sum + (item.actualSeconds || 0), 0) / 60)} min
        </span>
        <span>
          {running.length} {t('个 Agent 最近观测运行中', 'agents recently observed running')}
        </span>
      </div>
      {running.slice(0, 3).map((run) => (
        <p className="quiet" key={run.id}>
          {run.taskName}
        </p>
      ))}
    </section>
  );
}
