import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Plus,
  Orbit,
  Boxes,
  ListTodo,
  CalendarDays,
  Check,
  AlertCircle,
  FolderKanban,
  NotebookPen,
  Play,
  Star,
} from 'lucide-react';
import { api, today } from '../../domain/api';
import { L, useI18n } from '../../domain/i18n';
import { occurrences, addDays, dateKey, type CalendarEntry } from '../../domain/calendar';
import {
  dailyPlan,
  overdue,
  planLoad,
  unfinished,
  workForDay,
  type DailyPlan,
} from '../../domain/planning';
import { AgentCard } from '../agents/Agents';
import type { WorkspaceActions } from '../../domain/useWorkspace';
import type { useAgents } from '../../providers/useAgents';
import type { Entity, WidgetDefinition } from '../../domain/types';
export const widgets: WidgetDefinition[] = [
  { id: 'tasks', title: '今日任务', order: 0, visible: true },
  { id: 'calendar', title: '日程', order: 1, visible: true },
  { id: 'agents', title: 'Agent 工作台', order: 2, visible: true },
  { id: 'projects', title: '项目进度', order: 3, visible: true },
];
// Keep writes ordered across Home remounts so navigating away cannot drop a review.
let dailyPlanWrites: Promise<unknown> = Promise.resolve();
function writeDailyPlan(value: DailyPlan) {
  const result = dailyPlanWrites.then(() => api('save', 'settings', value));
  dailyPlanWrites = result.catch(() => undefined);
  return result;
}
export default function Home({
  workspace,
  agents,
  onAction,
  onTask,
  onFocus,
  onNote,
}: {
  workspace: WorkspaceActions;
  agents: ReturnType<typeof useAgents>;
  onAction: (s: string) => void;
  onTask: (t?: Entity) => void;
  onFocus?: (task: Entity) => void;
  onNote?: (id: string) => void;
}) {
  const { data, save, setError } = workspace;
  const { t, language } = useI18n();
  const [day, setDay] = useState(today);
  const [plan, setPlan] = useState<DailyPlan>(() => dailyPlan(day));
  const [yesterdayPlan, setYesterdayPlan] = useState<DailyPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const planningRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (planning) planningRef.current?.scrollIntoView({ block: 'start' });
  }, [planning]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const mounted = useRef(true);
  const planRef = useRef(plan);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setDay(today());
      setNow(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    let valid = true;
    setLoaded(false);
    setPlanning(false);
    const yesterday = dateKey(addDays(new Date(day + 'T12:00'), -1));
    dailyPlanWrites
      .then(() => api<Entity[]>('list', 'settings'))
      .then((records) => {
        if (!valid) return;
        const saved = dailyPlan(
          day,
          records.find((r) => r.id === `daily-plan:${day}`),
        );
        planRef.current = saved;
        setPlan(saved);
        const previous = records.find((r) => r.id === `daily-plan:${yesterday}`);
        setYesterdayPlan(previous ? dailyPlan(yesterday, previous) : null);
        setLoaded(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      valid = false;
    };
  }, [day, setError]);
  async function persist(next: DailyPlan, message = '', automatic = false) {
    if (!loaded || (saving && !automatic)) return;
    if (!automatic) setSaving(true);
    try {
      const normalized = dailyPlan(day, {
        ...next,
        topTaskIds: next.topTaskIds.filter((id) => data.tasks.some((task) => task.id === id)),
      });
      planRef.current = normalized;
      setPlan(normalized);
      await writeDailyPlan(normalized);
      if (mounted.current && message) setNotice(message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      if (mounted.current && !automatic) setSaving(false);
    }
  }
  function toggleTop(id: string) {
    const current = planRef.current;
    const validIds = current.topTaskIds.filter((taskId) =>
      data.tasks.some((task) => task.id === taskId),
    );
    const chosen = validIds.includes(id);
    if (!chosen && validIds.length >= 3) return;
    void persist({
      ...current,
      topTaskIds: chosen ? validIds.filter((x) => x !== id) : [...validIds, id],
    });
  }
  const running = agents.runs.filter((a) => a.status === 'RUNNING');
  const work = workForDay(data.tasks, day, plan.topTaskIds);
  const late = work.filter((task) => overdue(task, day));
  const completed = data.tasks.filter(
    (task) =>
      task.status === 'Done' &&
      task.completedAt &&
      new Date(task.completedAt).toLocaleDateString('sv-SE') === day,
  );
  const focus = Math.round(
    data.focus
      .filter((f) => f.endTime && new Date(f.endTime).toLocaleDateString('sv-SE') === day)
      .reduce((sum, f) => sum + (f.actualSeconds || 0), 0) / 60,
  );
  const start = new Date(day + 'T00:00');
  const upcoming = occurrences(data.events as CalendarEntry[], start, addDays(start, 8)).filter(
    (event) => new Date(event.end).getTime() > now,
  );
  const next = upcoming[0];
  const todayEvents = upcoming.filter((event) => event.start.slice(0, 10) === day).slice(0, 3);
  const recent = [...running, ...agents.runs.filter((a) => a.status !== 'RUNNING')].slice(0, 3);
  const waiting = agents.runs.filter((a) =>
    ['WAITING', 'WAITING_APPROVAL', 'FAILED'].includes(a.status),
  );
  const waitingTasks = data.tasks.filter((task) => task.status === 'Waiting');
  const load = planLoad(data.tasks, plan.topTaskIds);
  const leftovers = data.tasks.filter(
    (task) =>
      unfinished(task) && (overdue(task, day) || yesterdayPlan?.topTaskIds.includes(task.id)),
  );
  const chosen = data.tasks.filter((task) => plan.topTaskIds.includes(task.id));
  const available = data.tasks.filter(
    (task) => unfinished(task) && !plan.topTaskIds.includes(task.id),
  );
  const minutes = (n: number) => `${n} ${t('分钟', 'min')}`;
  const time = (value: string) =>
    new Date(value).toLocaleTimeString(language === 'en' ? 'en-US' : 'zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  async function moveToday(task: Entity) {
    try {
      await save('tasks', { ...task, dueDate: day });
      setNotice(t('已移到今天', 'Moved to today'));
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <>
      <section className="hero home-hero">
        <div>
          <div className="eyebrow">
            <L text="YOUR SPACE TO CREATE" />
          </div>
          <h2>{t('今天，从一件重要的事开始。', 'Start with one thing that matters.')}</h2>
          <p>{t('把想法记下来，把时间留给创造。', 'Capture your ideas. Make room to create.')}</p>
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={() => onTask()}>
            <Plus size={16} />
            <L text="添加今日任务" />
          </button>
          <button className="idea-button" onClick={() => onAction('note')}>
            <NotebookPen size={16} />
            <L text="记录灵感" />
          </button>
          <button onClick={() => onAction('Notes')}>
            <L text="查看灵感" />
            <ArrowUpRight size={14} />
          </button>
        </div>
      </section>
      <div className="day-start">
        <span>
          <strong>{t('Nia · 今日节奏', 'Nia · Your day')}</strong>{' '}
          {plan.closedAt
            ? t(
                '今天辛苦了，留好下一步就安心休息。',
                'Your day is wrapped up. Leave a next step and rest.',
              )
            : plan.startedAt
              ? t('一次专注一件事，留一点余量。', 'One thing at a time. Leave yourself some room.')
              : t(
                  '先看看昨日遗留，再选今天最重要的三件事。',
                  'Review what is left, then choose up to three priorities.',
                )}
        </span>
        <button
          className="day-plan-toggle"
          disabled={!loaded || saving}
          onClick={() => setPlanning(!planning)}
          aria-expanded={planning}
        >
          {t('每日计划与回顾', 'Daily plan & review')}
        </button>
        {!plan.startedAt ? (
          <button
            className="primary"
            disabled={!loaded || saving}
            onClick={async () => {
              await persist({ ...plan, startedAt: new Date().toISOString() });
              setPlanning(true);
            }}
          >
            {t('开始今天', 'Start today')}
          </button>
        ) : (
          <small>{plan.closedAt ? t('已收工', 'Day closed') : t('已开工', 'Day started')}</small>
        )}
      </div>
      {notice && (
        <p className="planning-notice" role="status">
          {notice}
        </p>
      )}
      <div className="dashboard-grid home-work">
        <section className="panel today-work">
          <h2>
            <ListTodo size={17} />
            {t('今天与逾期任务', 'Today & overdue')}
            <span>{work.length}</span>
            <button
              className="icon-button"
              aria-label={t('添加今日任务', 'Add today’s task')}
              onClick={() => onTask()}
            >
              <Plus size={16} />
            </button>
          </h2>
          {late.length > 0 && (
            <p className="overdue-hint">
              <AlertCircle size={13} />
              {t(
                `${late.length} 件逾期任务仍在这里，完成或重新安排即可。`,
                `${late.length} overdue task(s). Complete or reschedule when ready.`,
              )}
            </p>
          )}
          {work.length ? (
            <div className="today-work-list">
              {work.map((task) => (
                <div
                  className={'home-task ' + (overdue(task, day) ? 'is-overdue' : '')}
                  key={task.id}
                >
                  <button
                    aria-label={t(`完成 ${task.title}`, `Complete ${task.title}`)}
                    className="check-button"
                    onClick={() =>
                      save('tasks', {
                        ...task,
                        status: 'Done',
                        completedAt: new Date().toISOString(),
                      }).catch((e) => setError(e.message))
                    }
                  />
                  <button onClick={() => onTask(task)}>
                    <span>
                      {plan.topTaskIds.includes(task.id) && <Star size={12} fill="currentColor" />}
                      {task.title}
                      <small>
                        {overdue(task, day)
                          ? `${t('逾期', 'Overdue')} · ${task.dueDate}`
                          : task.estimatedTime
                            ? minutes(Number(task.estimatedTime))
                            : t(task.status || 'Planned')}
                      </small>
                    </span>
                  </button>
                  {overdue(task, day) && (
                    <button
                      className="reschedule-today"
                      onClick={() => moveToday(task)}
                      aria-label={t(`移到今天：${task.title}`, `Move to today: ${task.title}`)}
                    >
                      {t('移到今天', 'Today')}
                    </button>
                  )}
                  {onFocus && (
                    <button
                      className="icon-button"
                      aria-label={t(`专注：${task.title}`, `Focus: ${task.title}`)}
                      title={t('开始专注', 'Start focus')}
                      onClick={() => onFocus(task)}
                    >
                      <Play size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty compact-empty">
              <Check size={24} />
              <h3>{t('今天的清单很清爽', 'A clear list for today')}</h3>
              <p>
                {t(
                  '添加任务，或从每日计划中选一件想推进的事。',
                  'Add a task or pick one from your daily plan.',
                )}
              </p>
            </div>
          )}
          <button className="panel-link" onClick={() => onAction('Tasks')}>
            {t('查看全部任务', 'View all tasks')}
            <ArrowUpRight size={13} />
          </button>
        </section>
        <section className="panel next-agenda">
          <h2>
            <CalendarDays size={17} />
            {t('下一项日程', 'Up next')}
            <button
              className="icon-button"
              aria-label={t('打开日程', 'Open calendar')}
              onClick={() => onAction('Calendar')}
            >
              <ArrowUpRight size={16} />
            </button>
          </h2>
          {next ? (
            <>
              <button className="next-event" onClick={() => onAction('Calendar')}>
                <small>
                  {next.start.slice(0, 10) === day ? t('今天', 'Today') : next.start.slice(0, 10)} ·{' '}
                  {new Date(next.start).getTime() <= now
                    ? t('进行中', 'In progress')
                    : time(next.start)}
                </small>
                <strong>{next.title}</strong>
                <span>
                  {time(next.start)} — {time(next.end)}
                </span>
              </button>
              {todayEvents
                .filter((event) => event.occurrenceId !== next.occurrenceId)
                .map((event) => (
                  <button
                    className="agenda-row"
                    key={event.occurrenceId}
                    onClick={() => onAction('Calendar')}
                  >
                    <time>{time(event.start)}</time>
                    <i style={{ background: event.color || 'var(--accent)' }} />
                    <span>{event.title}</span>
                  </button>
                ))}
            </>
          ) : (
            <div className="empty compact-empty">
              <CalendarDays size={24} />
              <h3>{t('接下来一周还有留白', 'Room in the week ahead')}</h3>
              <p>{t('为重要任务安排一段时间。', 'Give an important task a time slot.')}</p>
            </div>
          )}
          <button className="panel-link" onClick={() => onAction('Calendar')}>
            {t('安排时间', 'Plan time')}
            <ArrowUpRight size={13} />
          </button>
        </section>
      </div>
      {planning && (
        <section
          ref={planningRef}
          className="panel daily-planning"
          aria-label={t('每日计划', 'Daily plan')}
        >
          <h2>
            {t('每日计划与回顾', 'Daily plan & review')}
            <span>{day}</span>
          </h2>
          <div className="planning-columns">
            <div>
              <h3>
                {t('今天最重要的三件事', 'Up to three priorities')} <small>{chosen.length}/3</small>
              </h3>
              {chosen.map((task) => (
                <div className="priority-choice" key={task.id}>
                  <button onClick={() => onTask(task)}>
                    {task.status === 'Done' && <Check size={13} />}
                    {task.title}
                  </button>
                  <button
                    disabled={saving}
                    aria-label={t(`取消重点：${task.title}`, `Unpin: ${task.title}`)}
                    onClick={() => toggleTop(task.id)}
                  >
                    {t('移除', 'Remove')}
                  </button>
                </div>
              ))}
              <label>
                {t('加入今日重点', 'Add a priority')}
                <select
                  aria-label={t('加入今日重点', 'Add a priority')}
                  value=""
                  disabled={saving || chosen.length >= 3}
                  onChange={(e) => toggleTop(e.target.value)}
                >
                  <option value="">
                    {chosen.length >= 3
                      ? t('已选满三件，给自己留一点余量', 'Three selected. Leave some room.')
                      : t('选择未完成的任务', 'Choose an unfinished task')}
                  </option>
                  {available.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t('今天可专注的分钟数', 'Available focus minutes')}
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={plan.capacityMinutes}
                  disabled={saving}
                  onChange={(e) =>
                    void persist(
                      { ...planRef.current, capacityMinutes: Number(e.target.value) },
                      '',
                      true,
                    )
                  }
                />
              </label>
              <p className={load.minutes > plan.capacityMinutes ? 'capacity-warning' : 'quiet'}>
                {t('剩余重点预计', 'Remaining priorities')} {minutes(load.minutes)} /{' '}
                {minutes(plan.capacityMinutes)}
                {load.unestimated
                  ? ` · ${t(`${load.unestimated} 件未估时`, `${load.unestimated} unestimated`)}`
                  : ''}
              </p>
              {load.minutes > plan.capacityMinutes && (
                <p className="capacity-warning">
                  {t(
                    '超过今天的余量了，可以少选一件，或拆成更小的步骤。',
                    'Over your capacity. Choose less or break work into smaller steps.',
                  )}
                </p>
              )}
            </div>
            <div>
              <h3>{t('昨日遗留', 'Left from yesterday')}</h3>
              {leftovers.length ? (
                leftovers.map((task) => (
                  <div className="leftover-row" key={task.id}>
                    <button onClick={() => onTask(task)}>{task.title}</button>
                    {task.dueDate !== day && (
                      <button disabled={saving} onClick={() => moveToday(task)}>
                        {t('移到今天', 'Move to today')}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="quiet">
                  {t(
                    '没有昨日遗留。按自己的节奏安排今天。',
                    'Nothing left from yesterday. Plan at your pace.',
                  )}
                </p>
              )}
              <h3>{t('收工回顾', 'Wrap up')}</h3>
              <p className="quiet">
                {t(
                  `今天完成 ${completed.length} 件任务，专注 ${focus} 分钟。`,
                  `${completed.length} tasks completed, ${focus} minutes focused today.`,
                )}
              </p>
              <label>
                {t('今天的收获 / 下次第一步', 'What went well / Next first step')}
                <textarea
                  aria-label={t('今天的收获 / 下次第一步', 'What went well / Next first step')}
                  rows={3}
                  maxLength={4000}
                  value={plan.reflection}
                  disabled={saving}
                  onChange={(e) =>
                    void persist({ ...planRef.current, reflection: e.target.value }, '', true)
                  }
                />
              </label>
              <p className="quiet">
                {t(
                  '计划与回顾会自动保存在本机。',
                  'Your plan and review are saved automatically on this device.',
                )}
              </p>
              <div className="planning-actions">
                <button
                  disabled={saving}
                  onClick={() =>
                    void persist(plan, t('今日计划与回顾已保存', 'Daily plan and reflection saved'))
                  }
                >
                  {t('保存计划与回顾', 'Save plan & review')}
                </button>
                {plan.closedAt ? (
                  <button
                    disabled={saving}
                    onClick={() =>
                      void persist(
                        { ...plan, closedAt: null },
                        t('可以继续调整今天的安排', 'Today is open for adjustments'),
                      )
                    }
                  >
                    {t('重新开工', 'Reopen day')}
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={saving}
                    onClick={() =>
                      void persist(
                        {
                          ...plan,
                          startedAt: plan.startedAt || new Date().toISOString(),
                          closedAt: new Date().toISOString(),
                        },
                        t(
                          '已收工，未完成任务会继续保留',
                          'Day closed. Unfinished tasks stay on your list.',
                        ),
                      )
                    }
                  >
                    {t('收工并保存', 'Close day & save')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
      <div className="stats home-stats">
        {[
          [
            t('AI Running'),
            agents.loading ? '…' : String(running.length),
            t('最近观测 · 非实时 API', 'Recent observations · not live'),
          ],
          [
            t('待推进任务', 'Open work'),
            String(work.length),
            t(`含 ${late.length} 件逾期`, `Including ${late.length} overdue`),
          ],
          [t('Focus time'), `${focus}m`, t('已完成的专注时间', 'Recorded focus time')],
          [
            t('Completed'),
            String(completed.length),
            t('今天完成的个人任务', 'Tasks finished today'),
          ],
        ].map(([title, value, help]) => (
          <section className="stat" key={title}>
            <div>{title}</div>
            <strong>{value}</strong>
            <small>{help}</small>
          </section>
        ))}
      </div>
      {(waiting.length > 0 || waitingTasks.length > 0) && (
        <section className="panel waiting-panel">
          <h2>
            <AlertCircle size={17} />
            <L text="Waiting for me" />
            <span>{waiting.length + waitingTasks.length}</span>
          </h2>
          {waiting.slice(0, 3).map((agent) => (
            <button key={agent.id} onClick={() => onAction('Agents')}>
              {agent.taskName}
              <span>
                <L text={agent.status} />
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
          {waitingTasks.slice(0, 3).map((task) => (
            <button key={task.id} onClick={() => onTask(task)}>
              {task.title}
              <span>
                <L text="Waiting" />
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
        </section>
      )}
      <div className="home-agents">
        <div className="section-title">
          <h2>
            <Boxes size={17} />
            {t('Agent 工作台', 'Agent workspace')}
            <span>
              <L text="LOCAL OBSERVATIONS" />
            </span>
          </h2>
          <button onClick={() => onAction('Agents')}>
            <L text="全部会话" />
            <ArrowUpRight size={13} />
          </button>
        </div>
        {recent.length ? (
          <div className="agent-grid">
            {recent.map((run) => (
              <AgentCard key={run.id} run={run} onOpen={() => onAction('Agents')} />
            ))}
          </div>
        ) : (
          <section className="panel agent-empty-inline">
            <Orbit size={22} />
            <span>
              {agents.loading
                ? t('读取本地会话中…', 'Reading local sessions…')
                : t(
                    '还没有本地 Agent 会话，先推进自己的任务。',
                    'No local Agent sessions yet. Your own work is ready above.',
                  )}
            </span>
            <button onClick={() => onAction('Settings')}>
              {t('检查连接', 'Check connection')}
              <ArrowUpRight size={13} />
            </button>
          </section>
        )}
      </div>
      <section className="panel home-projects">
        <h2>
          <FolderKanban size={17} />
          <L text="项目进度" />
          <button
            className="icon-button"
            aria-label={t('打开项目', 'Open projects')}
            onClick={() => onAction('Projects')}
          >
            <ArrowUpRight size={16} />
          </button>
        </h2>
        {data.projects.length ? (
          data.projects.map((project) => {
            const tasks = data.tasks.filter((task) => task.project === project.id),
              done = tasks.filter((task) => task.status === 'Done').length;
            return (
              <button
                className="project-progress-row"
                key={project.id}
                onClick={() => onAction('Projects')}
              >
                <span style={{ color: project.color }}>{project.icon || '◇'}</span>
                <strong>{project.name}</strong>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
                      background: project.color,
                    }}
                  />
                </div>
                <small>
                  {done}/{tasks.length}
                </small>
              </button>
            );
          })
        ) : (
          <p>
            <L text="在项目页面创建你的第一个项目。" />
          </p>
        )}
      </section>
      {onNote && data.notes.length > 0 && (
        <section className="home-recent-notes">
          <span>{t('最近灵感', 'Recent ideas')}</span>
          {[...data.notes]
            .sort((a, b) =>
              String(b.updatedAt || b.createdAt || '').localeCompare(
                String(a.updatedAt || a.createdAt || ''),
              ),
            )
            .slice(0, 3)
            .map((note) => (
              <button key={note.id} onClick={() => onNote(note.id)}>
                <NotebookPen size={13} />
                {note.title}
              </button>
            ))}
        </section>
      )}
      <div className="daily-strip">
        <span>
          <L text="DAILY SUMMARY" />
        </span>
        <p>
          {t(
            `个人完成 ${completed.length} · 专注 ${focus} 分钟`,
            `${completed.length} tasks completed · ${focus} minutes focused`,
          )}
        </p>
        <button onClick={() => onAction('Timeline')}>
          <L text="查看日报 ↗" />
        </button>
      </div>
    </>
  );
}
