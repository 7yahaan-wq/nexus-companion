import { useI18n } from '../../domain/i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, NotebookPen, Search, ListTodo } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import EntityForm from '../../components/EntityForm';
import { uid, api } from '../../domain/api';
import type { Entity } from '../../domain/types';
import type { WorkspaceActions } from '../../domain/useWorkspace';
export function NoteEditor({
  note,
  workspace,
  onClose,
  onSaved,
}: {
  note: Entity;
  workspace: WorkspaceActions;
  onClose: () => void;
  onSaved?: (saved: Entity) => void;
}) {
  const { t } = useI18n();
  // Saving refreshes workspace before the form closes; keep the original draft key stable.
  const existing = useMemo(() => workspace.data.notes.some((n) => n.id === note.id), [note.id]);
  return (
    <EntityForm
      key={note.id}
      title={t('灵感笔记', 'Ideas & notes')}
      value={note}
      draftKey={`draft:note:${existing ? note.id : 'new'}`}
      onClose={onClose}
      fields={[
        { key: 'title', label: t('笔记标题', 'Note title'), required: true },
        { key: 'content', label: t('内容（Markdown）', 'Content (Markdown)'), type: 'textarea' },
        {
          key: 'project',
          label: t('项目', 'Project'),
          options: [
            { value: '', label: t('无项目', 'No project') },
            ...workspace.data.projects.map((p) => ({ value: p.id, label: p.name })),
          ],
        },
        { key: 'tags', label: t('标签（逗号分隔）', 'Tags (comma separated)') },
      ]}
      onSave={async (n) => {
        await workspace.save('notes', n);
        onSaved?.(n);
      }}
      onDelete={
        workspace.data.notes.some((n) => n.id === note.id)
          ? () => workspace.remove('notes', note.id)
          : undefined
      }
    />
  );
}
export default function Notes({
  workspace,
  selectedNoteId,
  selectionRevision = 0,
  onSelectNote,
  onTask,
}: {
  workspace: WorkspaceActions;
  selectedNoteId?: string;
  selectionRevision?: number;
  onSelectNote?: (id: string) => void;
  onTask?: (task: Entity) => void;
}) {
  const { t, language } = useI18n();
  const { data, setError } = workspace;
  const [q, setQ] = useState(''),
    [selected, setSelected] = useState(selectedNoteId || ''),
    [editing, setEditing] = useState<Entity | null>(null),
    [converting, setConverting] = useState(false),
    [message, setMessage] = useState('');
  const conversionBusy = useRef(false);
  useEffect(() => {
    if (selectedNoteId) {
      setSelected(selectedNoteId);
      setQ('');
    }
  }, [selectedNoteId, selectionRevision]);
  function select(id: string) {
    setSelected(id);
    onSelectNote?.(id);
  }
  const notes = data.notes
    .filter((n) => `${n.title} ${n.content} ${n.tags}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => String(b.updatedAt).localeCompare(a.updatedAt));
  const note = notes.find((n) => n.id === selected) || notes[0];
  const linkedTask = note && data.tasks.find((task) => task.sourceNote === note.id);
  async function convert() {
    if (!note || conversionBusy.current) return;
    conversionBusy.current = true;
    setConverting(true);
    setMessage('');
    try {
      // Recheck persisted tasks so a retry after a refresh failure cannot duplicate the task.
      const tasks = await api<Entity[]>('list', 'tasks');
      const existingTask = tasks.find((task) => task.sourceNote === note.id);
      if (existingTask) {
        onTask?.(existingTask);
      } else {
        const now = new Date().toISOString();
        const task: Entity = {
          id: uid(),
          title: note.title,
          description: note.content || '',
          project: note.project || '',
          tags: note.tags || '',
          sourceNote: note.id,
          status: 'Inbox',
          priority: 'Medium',
          createdAt: now,
          updatedAt: now,
        };
        await workspace.save('tasks', task);
        setMessage(
          t('已创建任务，原灵感仍保存在这里。', 'Task created. Your original idea is kept here.'),
        );
        onTask?.(task);
      }
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      conversionBusy.current = false;
      setConverting(false);
    }
  }
  return (
    <>
      <p className="quiet">
        {t('在主页记录的灵感都会保存在这里。', 'Ideas captured on Home are saved here.')}
      </p>
      <div className="toolbar">
        <div className="search-field">
          <Search size={15} />
          <input
            aria-label={t('搜索灵感', 'Search ideas')}
            placeholder={t('搜索笔记、内容、标签…', 'Search notes, content, tags…')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          className="primary"
          onClick={() => setEditing({ id: uid(), title: '', content: '' })}
        >
          <Plus size={15} />
          {t('新建笔记')}
        </button>
      </div>
      {message && (
        <p role="status" className="notes-feedback">
          {message}
        </p>
      )}
      <div className="notes-layout">
        <aside>
          {notes.map((n) => (
            <button
              className={'note-item ' + (note?.id === n.id ? 'active' : '')}
              key={n.id}
              onClick={() => select(n.id)}
            >
              <strong>{n.title}</strong>
              <span>{(n.content || '').slice(0, 65)}</span>
              <small>{n.tags || t('未标记', 'No tags')}</small>
            </button>
          ))}
        </aside>
        <section className="panel">
          {note ? (
            <>
              <div className="toolbar note-heading">
                <div>
                  <h2>{note.title}</h2>
                  <p>
                    {new Date(note.updatedAt).toLocaleString(language === 'en' ? 'en-US' : 'zh-CN')}
                    {note.tags ? ` · ${note.tags}` : ''}
                  </p>
                </div>
                <div className="note-actions">
                  <button disabled={converting} onClick={convert}>
                    <ListTodo size={15} />
                    {converting
                      ? t('正在准备…', 'Preparing…')
                      : linkedTask
                        ? t('查看关联任务', 'Open linked task')
                        : t('转为任务', 'Create task')}
                  </button>
                  <button onClick={() => setEditing(note)}>{t('编辑', 'Edit')}</button>
                </div>
              </div>
              <div className="markdown">
                <ReactMarkdown
                  skipHtml
                  components={{
                    a: ({ href, children }) => (
                      <button
                        className="inline-link"
                        onClick={() =>
                          href && api('openUrl', href).catch((e) => setError(e.message))
                        }
                      >
                        {children}
                      </button>
                    ),
                    img: () => null,
                  }}
                >
                  {note.content}
                </ReactMarkdown>
              </div>
            </>
          ) : (
            <div className="empty">
              <NotebookPen size={35} />
              <h3>{t('让灵感有一个落脚点', 'Give your ideas a home')}</h3>
              <p>
                {t(
                  '轻量 Markdown 笔记，只保存在你的电脑。',
                  'Lightweight Markdown notes, stored on your computer.',
                )}
              </p>
            </div>
          )}
        </section>
      </div>
      {editing && (
        <NoteEditor
          note={editing}
          workspace={workspace}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setQ('');
            select(saved.id);
            setMessage(t('灵感已保存', 'Idea saved'));
          }}
        />
      )}
    </>
  );
}
