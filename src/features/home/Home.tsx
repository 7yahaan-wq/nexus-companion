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
} from 'lucide-react';
import { today } from '../../domain/api';
import { L } from '../../domain/i18n';
import { occurrences, addDays, type CalendarEntry } from '../../domain/calendar';
import { AgentCard } from '../agents/Agents';
import type { WorkspaceActions } from '../../domain/useWorkspace';
import type { useAgents } from '../../providers/useAgents';
import type { Entity, WidgetDefinition } from '../../domain/types';
export const widgets: WidgetDefinition[] = [
  { id: 'agents', title: 'Agent 工作台', order: 0, visible: true },
  { id: 'tasks', title: '今日任务', order: 1, visible: true },
  { id: 'calendar', title: '日程', order: 2, visible: true },
  { id: 'projects', title: '项目进度', order: 3, visible: true },
];
export default function Home({
  workspace,
  agents,
  onAction,
  onTask,
}: {
  workspace: WorkspaceActions;
  agents: ReturnType<typeof useAgents>;
  onAction: (s: string) => void;
  onTask: (t?: Entity) => void;
}) {
  const { data, save, setError } = workspace;
  const day = today();
  const running = agents.runs.filter((a) => a.status === 'RUNNING');
  const tasks = data.tasks.filter((t) => t.dueDate === day || t.startDate === day);
  const completed = data.tasks.filter(
    (t) =>
      t.status === 'Done' &&
      t.completedAt &&
      new Date(t.completedAt).toLocaleDateString('sv-SE') === day,
  );
  const focus = Math.round(
    data.focus
      .filter((f) => f.endTime && new Date(f.endTime).toLocaleDateString('sv-SE') === day)
      .reduce((s, f) => s + (f.actualSeconds || 0), 0) / 60,
  );
  const waiting = agents.runs.filter((a) =>
    ['WAITING', 'WAITING_APPROVAL', 'FAILED'].includes(a.status),
  );
  const waitingTasks = data.tasks.filter((t) => t.status === 'Waiting');
  const start = new Date(day + 'T00:00');
  const events = occurrences(data.events as CalendarEntry[], start, addDays(start, 1));
  const recent = [...running, ...agents.runs.filter((a) => a.status !== 'RUNNING')].slice(0, 4);
  const doneAgents = agents.runs.filter(
    (a) =>
      a.status === 'COMPLETED' &&
      a.endTime &&
      new Date(a.endTime).toLocaleDateString('sv-SE') === day,
  );
  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">
            <L text="YOUR SPACE TO CREATE" />
          </div>
          <h2>
            <L text="专注创造，" />
            <br />
            <L text="其余的交给我们一起。" />
          </h2>
          <p>
            <L text="任务、Agent 与灵感，终于在同一个地方。" />
          </p>
          <button className="primary" onClick={() => onTask()}>
            <Plus size={16} />
            <L text="添加今日任务" />
            <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="hero-orbit">
          <Orbit size={155} strokeWidth={0.6} />
          <span>N</span>
        </div>
        <div className="hero-caption">
          <L text="NEXUS / WORK IN HARMONY" />
        </div>
      </section>
      <div className="stats">
        {[
          ['AI Running', agents.loading ? '…' : String(running.length), '最近观测 · 非实时 API'],
          [
            'Today’s tasks',
            String(tasks.filter((t) => !['Done', 'Cancelled'].includes(t.status)).length),
            '今天要迈出的小步骤',
          ],
          ['Focus time', `${focus}m`, '已完成的专注时间'],
          ['Completed', String(completed.length), '今天完成的个人任务'],
        ].map(([t, n, s]) => (
          <section className="stat" key={t}>
            <div>
              <L text={t} />
              <ArrowUpRight size={14} />
            </div>
            <strong>{n}</strong>
            <small>{s}</small>
          </section>
        ))}
      </div>
      {(waiting.length > 0 || waitingTasks.length > 0) && (
        <section className="panel waiting-panel">
          <h2>
            <AlertCircle size={17} />
            <L text="Waiting for me" /> <span>{waiting.length + waitingTasks.length}</span>
          </h2>
          {waiting.slice(0, 3).map((a) => (
            <button key={a.id} onClick={() => onAction('Agents')}>
              {a.taskName}
              <span>
                <L text={a.status} />
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
          {waitingTasks.slice(0, 3).map((t) => (
            <button key={t.id} onClick={() => onTask(t)}>
              {t.title}
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
            Agent 工作台{' '}
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
            {recent.map((r) => (
              <AgentCard key={r.id} run={r} onOpen={() => onAction('Agents')} />
            ))}
          </div>
        ) : (
          <section className="panel empty">
            <Orbit size={32} />
            <h3>{agents.loading ? '读取本地会话中…' : '等待你的下一次创造'}</h3>
            <p>{agents.info.message}</p>
          </section>
        )}
      </div>
      <div className="dashboard-grid home-bottom">
        <section className="panel">
          <h2>
            <ListTodo size={17} />
            <L text="今日任务" />
            <button className="icon-button" aria-label="添加今日任务" onClick={() => onTask()}>
              <Plus size={17} />
            </button>
          </h2>
          {tasks.length ? (
            tasks.slice(0, 6).map((t) => (
              <div className="home-task" key={t.id}>
                <button
                  aria-label={`完成 ${t.title}`}
                  className={'check-button ' + (t.status === 'Done' ? 'checked' : '')}
                  onClick={() =>
                    save('tasks', {
                      ...t,
                      status: t.status === 'Done' ? 'Planned' : 'Done',
                      completedAt: t.status === 'Done' ? null : new Date().toISOString(),
                    }).catch((e) => setError(e.message))
                  }
                >
                  {t.status === 'Done' && <Check size={12} />}
                </button>
                <button onClick={() => onTask(t)}>{t.title}</button>
                <span className={'priority ' + t.priority}>
                  <L text={t.priority || 'Medium'} />
                </span>
              </div>
            ))
          ) : (
            <div className="empty">
              <ListTodo size={28} />
              <h3>
                <L text="给今天一个清晰的起点" />
              </h3>
              <p>
                <L text="创建任务，然后安排属于它的时间。" />
              </p>
            </div>
          )}
        </section>
        <section className="panel">
          <h2>
            <CalendarDays size={17} />
            <L text="今天的日程" />
            <button className="icon-button" onClick={() => onAction('Calendar')}>
              <ArrowUpRight size={16} />
            </button>
          </h2>
          {events.length ? (
            events.slice(0, 5).map((e) => (
              <button
                className="agenda-row"
                key={e.occurrenceId}
                onClick={() => onAction('Calendar')}
              >
                <time>
                  {new Date(e.start).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
                <i style={{ background: e.color }} />
                <span>
                  {e.title}
                  <small>{e.type || 'Work'}</small>
                </span>
              </button>
            ))
          ) : (
            <div className="empty">
              <CalendarDays size={28} />
              <h3>
                <L text="今天，还有留白" />
              </h3>
              <p>
                <L text="安排一段时间，做一件重要的小事。" />
              </p>
            </div>
          )}
        </section>
      </div>
      <section className="panel home-projects">
        <h2>
          <FolderKanban size={17} />
          <L text="项目进度" />
          <button className="icon-button" onClick={() => onAction('Projects')}>
            <ArrowUpRight size={16} />
          </button>
        </h2>
        {data.projects.length ? (
          data.projects.map((p) => {
            const items = data.tasks.filter((t) => t.project === p.id),
              done = items.filter((t) => t.status === 'Done').length;
            return (
              <button
                className="project-progress-row"
                key={p.id}
                onClick={() => onAction('Projects')}
              >
                <span style={{ color: p.color }}>{p.icon || '◇'}</span>
                <strong>{p.name}</strong>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${items.length ? (done / items.length) * 100 : 0}%`,
                      background: p.color,
                    }}
                  />
                </div>
                <small>
                  {done}/{items.length}
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
      <div className="daily-strip">
        <span>
          <L text="DAILY SUMMARY" />
        </span>
        <p>
          个人完成 {completed.length} · AI 完成 {doneAgents.length} · 失败{' '}
          {agents.runs.filter((a) => a.status === 'FAILED').length} · 等待审批{' '}
          {agents.runs.filter((a) => a.status === 'WAITING_APPROVAL').length}
        </p>
        <button onClick={() => onAction('Timeline')}>
          <L text="查看日报 ↗" />
        </button>
      </div>
    </>
  );
}
