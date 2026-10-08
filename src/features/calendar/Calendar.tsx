import { useState } from 'react';
import { L } from '../../domain/i18n';
import { Plus, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import EntityForm from '../../components/EntityForm';
import type { Entity } from '../../domain/types';
import type { WorkspaceActions } from '../../domain/useWorkspace';
import { uid, localCalendar } from '../../domain/api';
import {
  addDays,
  dateKey,
  localInput,
  nextQuarterHour,
  occurrences,
  validateEvent,
  layoutDay,
  type CalendarEntry,
} from '../../domain/calendar';
export function EventEditor({
  event,
  workspace,
  onClose,
}: {
  event: Entity;
  workspace: WorkspaceActions;
  onClose: () => void;
}) {
  return (
    <EntityForm
      title={
        event.recurrence && event.recurrence !== 'none'
          ? '编辑重复系列（更改所有次数）'
          : '日程 / Time block'
      }
      value={event}
      onClose={onClose}
      fields={[
        { key: 'title', label: '日程标题', required: true },
        { key: 'description', label: '描述', type: 'textarea' },
        { key: 'start', label: '开始时间', type: 'datetime-local', required: true },
        { key: 'end', label: '结束时间', type: 'datetime-local', required: true },
        {
          key: 'project',
          label: '项目',
          options: [
            { value: '', label: '无项目' },
            ...workspace.data.projects.map((p) => ({ value: p.id, label: p.name })),
          ],
        },
        {
          key: 'type',
          label: '类型',
          options: ['Work', 'Meeting', 'Personal', 'Time Block'].map((s) => ({
            value: s,
            label: s,
          })),
        },
        { key: 'color', label: '颜色', type: 'color' },
        {
          key: 'relatedTask',
          label: '关联任务',
          options: [
            { value: '', label: '无任务' },
            ...workspace.data.tasks.map((t) => ({ value: t.id, label: t.title })),
          ],
        },
        {
          key: 'recurrence',
          label: '重复',
          options: [
            { value: 'none', label: '不重复' },
            { value: 'daily', label: '每天' },
            { value: 'weekly', label: '每周' },
            { value: 'monthly', label: '每月' },
          ],
        },
        { key: 'repeatUntil', label: '重复至（可选）', type: 'date' },
      ]}
      onSave={async (e) => {
        validateEvent(e as CalendarEntry);
        await localCalendar.save(e);
        await workspace.refresh();
      }}
      onDelete={
        workspace.data.events.some((e) => e.id === event.id)
          ? async () => {
              await localCalendar.remove(event.id);
              await workspace.refresh();
            }
          : undefined
      }
    />
  );
}
export function eventForTask(task: Entity, date?: Date) {
  const start = date ? new Date(date) : nextQuarterHour();
  start.setSeconds(0, 0);
  return {
    id: uid(),
    title: task.title,
    project: task.project,
    relatedTask: task.id,
    type: 'Time Block',
    color: '#a6a2f5',
    recurrence: 'none',
    start: localInput(start),
    end: localInput(new Date(start.getTime() + (task.estimatedTime || 60) * 60000)),
  };
}
export default function Calendar({ workspace }: { workspace: WorkspaceActions }) {
  const { data, save, setError } = workspace;
  const [date, setDate] = useState(new Date()),
    [view, setView] = useState('Week'),
    [editing, setEditing] = useState<Entity | null>(null);
  let start = new Date(date);
  start.setHours(0, 0, 0, 0);
  if (view === 'Month') {
    start.setDate(1);
    start = addDays(start, -((start.getDay() + 6) % 7));
  } else if (view === 'Week') start = addDays(start, -((start.getDay() + 6) % 7));
  const days = Array.from({ length: view === 'Month' ? 42 : view === 'Week' ? 7 : 1 }, (_, i) =>
    addDays(start, i),
  );
  const shown = occurrences(data.events as CalendarEntry[], start, addDays(start, days.length));
  function create(d: Date, hour = 9) {
    const time = new Date(d);
    time.setHours(hour, 0, 0, 0);
    setEditing(eventForTask({ id: '', title: '', estimatedTime: 60 }, time));
  }
  async function drop(e: React.DragEvent, d: Date, hour = 9) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('nexus/task');
    if (taskId) {
      const task = data.tasks.find((t) => t.id === taskId);
      if (task) {
        const time = new Date(d);
        time.setHours(hour, 0, 0, 0);
        setEditing(eventForTask(task, time));
      }
      return;
    }
    const eventId = e.dataTransfer.getData('nexus/event');
    const original = data.events.find((x) => x.id === eventId);
    if (!original) return;
    const oldOccurrence = e.dataTransfer.getData('nexus/occurrence') || original.start;
    const time = new Date(d);
    time.setHours(hour, new Date(oldOccurrence).getMinutes(), 0, 0);
    const delta = time.getTime() - new Date(oldOccurrence).getTime();
    try {
      await save('events', {
        ...original,
        start: localInput(new Date(new Date(original.start).getTime() + delta)),
        end: localInput(new Date(new Date(original.end).getTime() + delta)),
      });
    } catch (e: any) {
      setError(e.message);
    }
  }
  function resize(e: React.PointerEvent, event: CalendarEntry) {
    e.preventDefault();
    e.stopPropagation();
    const y = e.clientY;
    const end = new Date(event.end);
    const original = data.events.find((x) => x.id === event.id)!;
    const up = async (ev: PointerEvent) => {
      document.removeEventListener('pointerup', up);
      const minutes = Math.round((((ev.clientY - y) / 48) * 60) / 15) * 15;
      const newEnd = new Date(new Date(original.end).getTime() + minutes * 60000);
      if (newEnd <= new Date(original.start)) return;
      try {
        await save('events', { ...original, end: localInput(newEnd) });
      } catch (e: any) {
        setError(e.message);
      }
    };
    document.addEventListener('pointerup', up, { once: true });
  }
  function eventButton(
    e: CalendarEntry,
    timed = false,
    layout?: { top: number; height: number; lane: number; lanes: number },
  ) {
    const s = new Date(e.start),
      end = new Date(e.end),
      minutes = s.getHours() * 60 + s.getMinutes();
    return (
      <div
        role="button"
        tabIndex={0}
        key={e.occurrenceId}
        draggable
        className={'calendar-event ' + (timed ? 'timed-event' : '')}
        style={{
          borderColor: e.color || '#a6a2f5',
          background: `${e.color || '#a6a2f5'}22`,
          ...(timed
            ? {
                top: ((layout?.top ?? minutes) / 60) * 48,
                height: Math.max(
                  23,
                  ((layout?.height ?? (end.getTime() - s.getTime()) / 60000) / 60) * 48,
                ),
                left: layout ? `${(layout.lane / layout.lanes) * 100}%` : 2,
                width: layout ? `${100 / layout.lanes}%` : undefined,
                right: layout ? 'auto' : 2,
              }
            : {}),
        }}
        onClick={(ev) => {
          ev.stopPropagation();
          setEditing(data.events.find((x) => x.id === e.id)!);
        }}
        onKeyDown={(ev) => {
          if (ev.key === 'Enter') setEditing(data.events.find((x) => x.id === e.id)!);
        }}
        onDragStart={(ev) => {
          ev.dataTransfer.setData('nexus/event', e.id);
          ev.dataTransfer.setData('nexus/occurrence', e.start);
        }}
      >
        <strong>{e.title}</strong>
        <span>
          {s.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          {e.recurrence && e.recurrence !== 'none' ? ' ↻' : ''}
        </span>
        {timed && (
          <div
            className="resize-handle"
            title="拖动调整结束时间（15 分钟）"
            onClick={(ev) => ev.stopPropagation()}
            onPointerDown={(ev) => resize(ev, e)}
          />
        )}
      </div>
    );
  }
  return (
    <>
      <div className="toolbar wrap">
        <div className="calendar-nav">
          <button
            aria-label="上一页"
            onClick={() => {
              const next = new Date(date);
              if (view === 'Month') next.setMonth(next.getMonth() - 1, 1);
              else next.setDate(next.getDate() - (view === 'Week' ? 7 : 1));
              setDate(next);
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setDate(new Date())}>
            <L text="今天" />
          </button>
          <button
            aria-label="下一页"
            onClick={() => {
              const next = new Date(date);
              if (view === 'Month') next.setMonth(next.getMonth() + 1, 1);
              else next.setDate(next.getDate() + (view === 'Week' ? 7 : 1));
              setDate(next);
            }}
          >
            <ChevronRight size={16} />
          </button>
          <strong>
            {date.getFullYear()} 年 {date.getMonth() + 1} 月
          </strong>
        </div>
        <div className="segmented">
          {['Month', 'Week', 'Day'].map((v) => (
            <button className={v === view ? 'active' : ''} key={v} onClick={() => setView(v)}>
              <L text={v} />
            </button>
          ))}
        </div>
        <button className="primary" onClick={() => create(date)}>
          <Plus size={15} />
          <L text="新建日程" />
        </button>
      </div>
      <p className="quiet">
        拖入任务创建时间块。拖动日程可移动，周 /
        日视图底边可调整时长。重复日程的编辑与移动作用于整个系列。
      </p>
      <div className="calendar-layout">
        <aside className="calendar-tasks">
          <h3>
            <L text="任务 · 可多次安排" />
          </h3>
          {data.tasks
            .filter((t) => !['Done', 'Cancelled'].includes(t.status))
            .map((t) => (
              <div
                className="calendar-task"
                key={t.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('nexus/task', t.id)}
              >
                <GripVertical size={12} />
                <button
                  onClick={() => {
                    const start =
                      dateKey(date) === dateKey(new Date()) ? undefined : new Date(date);
                    if (start) start.setHours(9, 0, 0, 0);
                    setEditing(eventForTask(t, start));
                  }}
                >
                  {t.title}
                </button>
              </div>
            ))}
          {!data.tasks.length && <p>先创建一个任务，再拖入日历。</p>}
        </aside>
        <div className="calendar-body">
          {view === 'Month' ? (
            <>
              <div className="month-header">
                {['一', '二', '三', '四', '五', '六', '日'].map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              <div className="month-grid">
                {days.map((d) => (
                  <div
                    key={dateKey(d)}
                    className={
                      'month-cell ' +
                      (dateKey(d) === dateKey(new Date()) ? 'today' : '') +
                      (d.getMonth() !== date.getMonth() ? ' outside' : '')
                    }
                    onDoubleClick={() => create(d)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => drop(e, d)}
                  >
                    <button className="date-number" onClick={() => create(d)}>
                      {d.getDate()}
                    </button>
                    {shown
                      .filter((e) => new Date(e.start) < addDays(d, 1) && new Date(e.end) > d)
                      .map((e) => eventButton(e))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div
                className="time-header"
                style={{ gridTemplateColumns: `42px repeat(${days.length},1fr)` }}
              >
                <span />
                {days.map((d) => (
                  <button
                    key={dateKey(d)}
                    className={dateKey(d) === dateKey(new Date()) ? 'today' : ''}
                    onClick={() => {
                      setDate(d);
                      setView('Day');
                    }}
                  >
                    {['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}
                    <strong>{d.getDate()}</strong>
                  </button>
                ))}
              </div>
              <div className="time-scroll">
                <div
                  className="time-grid"
                  style={{ gridTemplateColumns: `42px repeat(${days.length},1fr)` }}
                >
                  <div className="hour-labels">
                    {Array.from({ length: 24 }, (_, h) => (
                      <span key={h}>{String(h).padStart(2, '0')}:00</span>
                    ))}
                  </div>
                  {days.map((d) => (
                    <div className="time-day" key={dateKey(d)}>
                      {Array.from({ length: 24 }, (_, h) => (
                        <div
                          className="hour-slot"
                          key={h}
                          onDoubleClick={() => create(d, h)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => drop(e, d, h)}
                        />
                      ))}
                      {layoutDay(shown, d).map((row) => eventButton(row.event, true, row))}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {editing && (
        <EventEditor event={editing} workspace={workspace} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
