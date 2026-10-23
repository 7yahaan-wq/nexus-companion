import { useRef, useState } from 'react';
import { Plus, Search, GripVertical, CalendarPlus, Timer, NotebookPen } from 'lucide-react';
import EntityForm from '../../components/EntityForm';
import { uid, today } from '../../domain/api';
import type { Entity } from '../../domain/types';
import type { WorkspaceActions } from '../../domain/useWorkspace';
import { L, useI18n } from '../../domain/i18n';
import '../../ui/tasks.css';
export const statuses = ['Inbox', 'Planned', 'In Progress', 'Waiting', 'Done', 'Cancelled'];
export interface TaskView {
  query: string;
  project: string;
  sort: 'manual' | 'due' | 'priority';
}
export function TaskEditor({
  task,
  workspace,
  onClose,
}: {
  task: Entity;
  workspace: WorkspaceActions;
  onClose: () => void;
}) {
  const { data, save, remove } = workspace;
  const timeEdit = useRef({
    id: uid(),
    revision: Number(task.actualTimeEditRevision) || 0,
    baseline: Number(task.actualTime) || 0,
  });
  return (
    <EntityForm
      title="任务"
      value={task}
      onClose={onClose}
      fields={[
        { key: 'title', label: '任务标题', required: true },
        { key: 'description', label: '描述', type: 'textarea', advanced: true },
        {
          key: 'project',
          label: '项目',
          options: [
            { value: '', label: '无项目' },
            ...data.projects.map((p) => ({ value: p.id, label: p.name })),
          ],
        },
        { key: 'status', label: '状态', options: statuses.map((s) => ({ value: s, label: s })) },
        {
          key: 'priority',
          label: '优先级',
          options: ['Low', 'Medium', 'High', 'Urgent'].map((s) => ({ value: s, label: s })),
        },
        { key: 'tags', label: '标签（逗号分隔）', advanced: true },
        { key: 'startDate', label: '开始日期', type: 'date', advanced: true },
        { key: 'dueDate', label: '截止日期', type: 'date' },
        { key: 'estimatedTime', label: '预计时长（分钟）', type: 'number' },
        { key: 'actualTime', label: '实际时长（分钟）', type: 'number', advanced: true },
        { key: 'relatedAgent', label: '关联 Agent', advanced: true },
        { key: 'relatedAgentTask', label: '关联 Agent Task ID', advanced: true },
      ]}
      onSave={async (t) => {
        if (t.startDate && t.dueDate && t.dueDate < t.startDate)
          throw Error('截止日期不能早于开始日期');
        await save('tasks', {
          ...t,
          actualTimeBaseline: timeEdit.current.baseline,
          actualTimeEditId: timeEdit.current.id,
          actualTimeEditRevision: timeEdit.current.revision,
          completedAt: t.status === 'Done' ? t.completedAt || new Date().toISOString() : null,
        });
      }}
      onDelete={
        data.tasks.some((t) => t.id === task.id) ? () => remove('tasks', task.id) : undefined
      }
    />
  );
}
export default function Tasks({
  workspace,
  view,
  onViewChange,
  onSchedule,
  onFocus,
  onNote,
}: {
  workspace: WorkspaceActions;
  view: TaskView;
  onViewChange: (view: TaskView) => void;
  onSchedule: (task: Entity) => void;
  onFocus?: (task: Entity) => void;
  onNote?: (id: string) => void;
}) {
  const { data, moveTask } = workspace;
  const { t } = useI18n();
  const { query: q, project, sort } = view;
  const [editing, setEditing] = useState<Entity | null>(null);
  const [moving, setMoving] = useState(false),
    [moveError, setMoveError] = useState(''),
    [notice, setNotice] = useState('');
  const movingRef = useRef(false);
  const updateView = (patch: Partial<TaskView>) => onViewChange({ ...view, ...patch });
  const sortHint = t(
    '当前按日期或优先级显示，拖动只改变状态。调整位置请切换手动排序。',
    'Dragging changes status in this sort. Choose Manual order to rearrange cards.',
  );
  const filtered = data.tasks
    .filter(
      (t) =>
        (!project || t.project === project) &&
        `${t.title} ${t.tags || ''}`.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'due'
        ? String(a.dueDate || '9999').localeCompare(b.dueDate || '9999')
        : sort === 'priority'
          ? ['Urgent', 'High', 'Medium', 'Low'].indexOf(a.priority) -
            ['Urgent', 'High', 'Medium', 'Low'].indexOf(b.priority)
          : (a.order || 0) - (b.order || 0),
    );
  async function move(task: Entity, status: string, beforeId: string | null = null) {
    if (movingRef.current) return;
    movingRef.current = true;
    setMoving(true);
    setMoveError('');
    setNotice('');
    try {
      const result = await moveTask({ id: task.id, status, beforeId });
      if (result.changed) setNotice(t('任务已更新。', 'Task updated.'));
    } catch (cause: any) {
      setMoveError(
        cause.message || t('未能移动任务，请重试。', 'Could not move the task. Try again.'),
      );
    } finally {
      movingRef.current = false;
      setMoving(false);
    }
  }
  function drop(e: React.DragEvent, status: string, before?: Entity) {
    e.preventDefault();
    if (movingRef.current) return;
    const id = e.dataTransfer.getData('nexus/task');
    const task = data.tasks.find((t) => t.id === id);
    if (!task) return;
    if (sort !== 'manual' && task.status === status) {
      setNotice(sortHint);
      return;
    }
    void move(task, status, sort === 'manual' ? before?.id || null : null);
  }
  return (
    <>
      <div className="toolbar wrap">
        <div className="search-field">
          <Search size={15} />
          <input
            aria-label={t('搜索任务或标签', 'Search tasks or tags')}
            placeholder={t('搜索任务或标签…', 'Search tasks or tags…')}
            value={q}
            disabled={moving}
            onChange={(e) => updateView({ query: e.target.value })}
          />
        </div>
        <select
          aria-label="项目过滤"
          value={project}
          disabled={moving}
          onChange={(e) => updateView({ project: e.target.value })}
        >
          <option value="">
            <L text="所有项目" />
          </option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          aria-label="任务排序"
          value={sort}
          disabled={moving}
          onChange={(e) => updateView({ sort: e.target.value as TaskView['sort'] })}
        >
          <option value="manual">
            <L text="手动排序" />
          </option>
          <option value="due">
            <L text="截止日期" />
          </option>
          <option value="priority">
            <L text="优先级" />
          </option>
        </select>
        <button
          className="primary"
          disabled={moving}
          onClick={() =>
            setEditing({
              id: uid(),
              status: 'Inbox',
              priority: 'Medium',
              dueDate: today(),
              project,
            })
          }
        >
          <Plus size={15} />
          <L text="新建任务" />
        </button>
      </div>
      <div className="task-board-feedback">
        {(q || project) && (
          <button disabled={moving} onClick={() => updateView({ query: '', project: '' })}>
            {t('清除筛选', 'Clear filters')}
          </button>
        )}
        {sort !== 'manual' && <p data-testid="task-sort-hint">{sortHint}</p>}
        <span role="status" aria-live="polite">
          {moving ? t('正在更新任务…', 'Updating task…') : notice}
        </span>
      </div>
      {moveError && (
        <div className="task-move-error" role="alert">
          {moveError}
        </div>
      )}
      {!filtered.length && (
        <div className="panel empty" data-testid="tasks-empty">
          <h3>
            {q || project
              ? t('没有符合筛选的任务', 'No tasks match these filters')
              : t('从一件小事开始', 'Start with one small task')}
          </h3>
          <p>
            {q || project
              ? t(
                  '试试其他关键词或清除筛选，任务仍保存在本地。',
                  'Try another search or clear filters. Your tasks are still saved locally.',
                )
              : t(
                  '点击上方“新建任务”，添加第一件要做的事。',
                  'Use New task above to add the first thing you want to do.',
                )}
          </p>
        </div>
      )}
      {filtered.length > 0 && (
        <div className="kanban">
          {statuses.map((status) => (
            <section
              className="kanban-column"
              key={status}
              data-status={status}
              onDragOver={(e) => {
                if (!moving) e.preventDefault();
              }}
              onDrop={(e) => drop(e, status)}
            >
              <h3>
                <i className={'status-dot ' + status.replaceAll(' ', '-')} />
                <L text={status} />
                <span>{filtered.filter((t) => t.status === status).length}</span>
              </h3>
              {filtered
                .filter((t) => t.status === status)
                .map((t) => (
                  <article
                    className="task-card"
                    draggable={!moving}
                    data-task-id={t.id}
                    key={t.id}
                    onDragStart={(e) => {
                      if (movingRef.current) e.preventDefault();
                      else e.dataTransfer.setData('nexus/task', t.id);
                    }}
                    onDragOver={(e) => {
                      if (!moving) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.stopPropagation();
                      drop(e, status, t);
                    }}
                  >
                    <div className="task-card-top">
                      <span className={'priority ' + t.priority}>
                        <L text={t.priority || 'Medium'} />
                      </span>
                      <GripVertical size={12} />
                    </div>
                    <select
                      className="task-status-select"
                      aria-label={`任务状态 ${t.title}`}
                      value={t.status}
                      disabled={moving}
                      onChange={(e) => void move(t, e.target.value)}
                    >
                      {statuses.map((state) => (
                        <option key={state} value={state}>
                          <L text={state} />
                        </option>
                      ))}
                    </select>
                    <div className="task-workflow-actions">
                      {!['Done', 'Cancelled'].includes(t.status) && onFocus && (
                        <button aria-label={`专注 ${t.title}`} onClick={() => onFocus(t)}>
                          <Timer size={13} />
                          <L text="专注" />
                        </button>
                      )}
                      {t.sourceNote && onNote && data.notes.some((n) => n.id === t.sourceNote) && (
                        <button
                          aria-label={`来源灵感 ${t.title}`}
                          onClick={() => onNote(t.sourceNote)}
                        >
                          <NotebookPen size={13} />
                          <L text="来源灵感" />
                        </button>
                      )}
                      {Number(t.actualTime) > 0 && (
                        <small>{Math.round(t.actualTime * 10) / 10} min</small>
                      )}
                    </div>
                    <button className="task-title" disabled={moving} onClick={() => setEditing(t)}>
                      {t.title}
                    </button>
                    <p>
                      {data.projects.find((p) => p.id === t.project)?.name || <L text="Personal" />}
                    </p>
                    <div className="task-meta">
                      <span className={t.dueDate < today() && status !== 'Done' ? 'overdue' : ''}>
                        {t.dueDate || '无截止日期'}
                      </span>
                      <button
                        title="安排到日历"
                        aria-label={`安排 ${t.title}`}
                        onClick={() => onSchedule(t)}
                      >
                        <CalendarPlus size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              <button
                className="add-task"
                disabled={moving}
                onClick={() => setEditing({ id: uid(), status, priority: 'Medium', project })}
              >
                <Plus size={13} />
                <L text="添加任务" />
              </button>
            </section>
          ))}
        </div>
      )}
      {editing && (
        <TaskEditor task={editing} workspace={workspace} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
