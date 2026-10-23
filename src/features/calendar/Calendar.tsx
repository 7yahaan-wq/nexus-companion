import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { L, useI18n } from '../../domain/i18n';
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
  const { language, t } = useI18n();
  const weekdays =
    language === 'en'
      ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      : ['日', '一', '二', '三', '四', '五', '六'];
  const { data, save, setError } = workspace;
  const [date, setDate] = useState(new Date()),
    [view, setView] = useState('Week'),
    [editing, setEditing] = useState<Entity | null>(null),
    [now, setNow] = useState(new Date()),
    [scrollRevision, setScrollRevision] = useState(0);
  const timeScroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 30000);
    window.addEventListener('focus', update);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);
  let start = new Date(date);
  start.setHours(0, 0, 0, 0);
  if (view === 'Month') {
    start.setDate(1);
    start = addDays(start, -((start.getDay() + 6) % 7));
  } else if (view === 'Week') start = addDays(start, -((start.getDay() + 6) % 7));
  const days = Array.from({ length: view === 'Month' ? 42 : view === 'Week' ? 7 : 1 }, (_, i) =>
    addDays(start, i),
  );
  useLayoutEffect(() => {
    const scroller = timeScroll.current;
    if (!scroller) return;
    const resizeViewport = () => {
      const top = scroller.getBoundingClientRect().top + window.scrollY;
      scroller.style.height = `${Math.max(240, Math.min(565, window.innerHeight - top - 24))}px`;
    };
    resizeViewport();
    window.addEventListener('resize', resizeViewport);
    return () => window.removeEventListener('resize', resizeViewport);
  }, [view, language]);
  // Reposition only when entering a timed view or explicitly returning to today.
  // Clock ticks, data refreshes and date browsing must preserve manual scrolling.
  useLayoutEffect(() => {
    const scroller = timeScroll.current;
    if (!scroller || view === 'Month') return;
    const current = new Date();
    const todayVisible = days.some((day) => dateKey(day) === dateKey(current));
    const minutes = todayVisible ? current.getHours() * 60 + current.getMinutes() : 9 * 60;
    scroller.scrollTop = Math.max(0, (minutes / 60) * 48 - scroller.clientHeight / 3);
  }, [view, scrollRevision]);
  const shown = occurrences(data.events as CalendarEntry[], start, addDays(start, days.length));
  function create(d: Date, hour?: number) {
    const task = { id: '', title: '', estimatedTime: 60 };
    if (hour === undefined && dateKey(d) === dateKey(new Date())) {
      setEditing(eventForTask(task));
      return;
    }
    const time = new Date(d);
    time.setHours(hour ?? 9, 0, 0, 0);
    setEditing(eventForTask(task, time));
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
          {s.toLocaleTimeString(language === 'en' ? 'en-GB' : 'zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          })}
          {e.recurrence && e.recurrence !== 'none' ? ' ↻' : ''}
        </span>
        {timed && (
          <div
            className="resize-handle"
            title={t('拖动调整结束时间（15 分钟）', 'Drag to adjust the end time (15 minutes)')}
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
            aria-label={t('上一页', 'Previous')}
            onClick={() => {
              const next = new Date(date);
              if (view === 'Month') next.setMonth(next.getMonth() - 1, 1);
              else next.setDate(next.getDate() - (view === 'Week' ? 7 : 1));
              setDate(next);
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => {
              const current = new Date();
              setNow(current);
              setDate(current);
              setScrollRevision((revision) => revision + 1);
            }}
          >
            <L text="今天" />
          </button>
          <button
            aria-label={t('下一页', 'Next')}
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
            {date.toLocaleDateString(language === 'en' ? 'en-GB' : 'zh-CN', {
              year: 'numeric',
              month: 'long',
            })}
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
        {t(
          '拖入任务创建时间块。拖动日程可移动，周 / 日视图底边可调整时长。重复日程的编辑与移动作用于整个系列。',
          'Drag in tasks to create time blocks. Move events by dragging; resize their lower edge in Week / Day views. Editing a recurring event changes the whole series.',
        )}
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
          {!data.tasks.length && (
            <p>
              {t('先创建一个任务，再拖入日历。', 'Create a task, then drag it into the calendar.')}
            </p>
          )}
        </aside>
        <div className="calendar-body">
          {view === 'Month' ? (
            <>
              <div className="month-header">
                {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                  <span key={day}>{weekdays[day]}</span>
                ))}
              </div>
              <div className="month-grid">
                {days.map((d) => (
                  <div
                    key={dateKey(d)}
                    className={
                      'month-cell ' +
                      (dateKey(d) === dateKey(now) ? 'today' : '') +
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
                    className={dateKey(d) === dateKey(now) ? 'today' : ''}
                    onClick={() => {
                      setDate(d);
                      setView('Day');
                    }}
                  >
                    {weekdays[d.getDay()]}
                    <strong>{d.getDate()}</strong>
                  </button>
                ))}
              </div>
              <div className="time-scroll" ref={timeScroll}>
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
                      {dateKey(d) === dateKey(now) && (
                        <div
                          className={
                            'calendar-now' +
                            (now.getHours() === 0 && now.getMinutes() < 30 ? ' at-start' : '')
                          }
                          data-testid="calendar-now"
                          role="img"
                          aria-label={`${t('当前时间', 'Current time')} ${now.toLocaleTimeString(language === 'en' ? 'en-GB' : 'zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}`}
                          style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * 48 }}
                        >
                          <time dateTime={now.toISOString()}>
                            {now.toLocaleTimeString(language === 'en' ? 'en-GB' : 'zh-CN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })}
                          </time>
                        </div>
                      )}
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
