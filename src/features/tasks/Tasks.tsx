import { useState } from 'react';
import { Plus, Search, GripVertical, CalendarPlus } from 'lucide-react';
import EntityForm from '../../components/EntityForm';
import { uid, today } from '../../domain/api';
import type { Entity } from '../../domain/types';
import type { WorkspaceActions } from '../../domain/useWorkspace';
import { L } from '../../domain/i18n';
export const statuses = ['Inbox', 'Planned', 'In Progress', 'Waiting', 'Done', 'Cancelled'];
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
  return (
    <EntityForm
      title="任务"
      value={task}
      onClose={onClose}
      fields={[
        { key: 'title', label: '任务标题', required: true },
        { key: 'description', label: '描述', type: 'textarea' },
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
        { key: 'tags', label: '标签（逗号分隔）' },
        { key: 'startDate', label: '开始日期', type: 'date' },
        { key: 'dueDate', label: '截止日期', type: 'date' },
        { key: 'estimatedTime', label: '预计时长（分钟）', type: 'number' },
        { key: 'actualTime', label: '实际时长（分钟）', type: 'number' },
        { key: 'relatedAgent', label: '关联 Agent' },
        { key: 'relatedAgentTask', label: '关联 Agent Task ID' },
      ]}
      onSave={async (t) => {
        if (t.startDate && t.dueDate && t.dueDate < t.startDate)
          throw Error('截止日期不能早于开始日期');
        await save('tasks', {
          ...t,
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
  onSchedule,
}: {
  workspace: WorkspaceActions;
  onSchedule: (task: Entity) => void;
}) {
  const { data, save, setError } = workspace;
  const [editing, setEditing] = useState<Entity | null>(null),
    [q, setQ] = useState(''),
    [project, setProject] = useState(''),
    [sort, setSort] = useState('manual');
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
  async function drop(e: React.DragEvent, status: string, before?: Entity) {
    e.preventDefault();
    const id = e.dataTransfer.getData('nexus/task');
    const task = data.tasks.find((t) => t.id === id);
    if (!task) return;
    try {
      const ordered = filtered.filter((t) => t.status === status && t.id !== id);
      const at = before ? ordered.findIndex((t) => t.id === before.id) : ordered.length;
      ordered.splice(at < 0 ? ordered.length : at, 0, task);
      for (let i = 0; i < ordered.length; i++)
        await save('tasks', {
          ...ordered[i],
          order: i,
          status,
          completedAt:
            status === 'Done' ? ordered[i].completedAt || new Date().toISOString() : null,
        });
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="toolbar wrap">
        <div className="search-field">
          <Search size={15} />
          <input placeholder="搜索任务或标签…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="项目过滤" value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">
            <L text="所有项目" />
          </option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select aria-label="任务排序" value={sort} onChange={(e) => setSort(e.target.value)}>
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
          onClick={() =>
            setEditing({ id: uid(), status: 'Inbox', priority: 'Medium', dueDate: today() })
          }
        >
          <Plus size={15} />
          <L text="新建任务" />
        </button>
      </div>
      <div className="kanban">
        {statuses.map((status) => (
          <section
            className="kanban-column"
            key={status}
            onDragOver={(e) => e.preventDefault()}
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
                  draggable
                  key={t.id}
                  onDragStart={(e) => e.dataTransfer.setData('nexus/task', t.id)}
                  onDragOver={(e) => e.preventDefault()}
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
                  <button className="task-title" onClick={() => setEditing(t)}>
                    {t.title}
                  </button>
                  <p>{data.projects.find((p) => p.id === t.project)?.name || 'Personal'}</p>
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
              onClick={() => setEditing({ id: uid(), status, priority: 'Medium', project })}
            >
              <Plus size={13} />
              <L text="添加任务" />
            </button>
          </section>
        ))}
      </div>
      {editing && (
        <TaskEditor task={editing} workspace={workspace} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
