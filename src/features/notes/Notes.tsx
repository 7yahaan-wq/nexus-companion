import { L } from '../../domain/i18n';
import { useState } from 'react';
import { Plus, NotebookPen, Search } from 'lucide-react';
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
  onSaved?: () => void;
}) {
  return (
    <EntityForm
      title="灵感笔记"
      value={note}
      onClose={onClose}
      fields={[
        { key: 'title', label: '笔记标题', required: true },
        { key: 'content', label: '内容（Markdown）', type: 'textarea' },
        {
          key: 'project',
          label: '项目',
          options: [
            { value: '', label: '无项目' },
            ...workspace.data.projects.map((p) => ({ value: p.id, label: p.name })),
          ],
        },
        { key: 'tags', label: '标签（逗号分隔）' },
      ]}
      onSave={async (n) => {
        await workspace.save('notes', n);
        onSaved?.();
      }}
      onDelete={
        workspace.data.notes.some((n) => n.id === note.id)
          ? () => workspace.remove('notes', note.id)
          : undefined
      }
    />
  );
}
export default function Notes({ workspace }: { workspace: WorkspaceActions }) {
  const { data, setError } = workspace;
  const [q, setQ] = useState(''),
    [selected, setSelected] = useState(''),
    [editing, setEditing] = useState<Entity | null>(null);
  const notes = data.notes
    .filter((n) => `${n.title} ${n.content} ${n.tags}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => String(b.updatedAt).localeCompare(a.updatedAt));
  const note = notes.find((n) => n.id === selected) || notes[0];
  return (
    <>
      <p className="quiet">
        <L text="在主页记录的灵感都会保存在这里。" />
      </p>
      <div className="toolbar">
        <div className="search-field">
          <Search size={15} />
          <input
            placeholder="搜索笔记、内容、标签…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button
          className="primary"
          onClick={() => setEditing({ id: uid(), title: '', content: '' })}
        >
          <Plus size={15} />
          <L text="新建笔记" />
        </button>
      </div>
      <div className="notes-layout">
        <aside>
          {notes.map((n) => (
            <button
              className={'note-item ' + (note?.id === n.id ? 'active' : '')}
              key={n.id}
              onClick={() => setSelected(n.id)}
            >
              <strong>{n.title}</strong>
              <span>{(n.content || '').slice(0, 65)}</span>
              <small>{n.tags || '未标记'}</small>
            </button>
          ))}
        </aside>
        <section className="panel">
          {note ? (
            <>
              <div className="toolbar">
                <div>
                  <h2>{note.title}</h2>
                  <p>
                    {new Date(note.updatedAt).toLocaleString()} · {note.tags}
                  </p>
                </div>
                <button onClick={() => setEditing(note)}>编辑</button>
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
              <h3>让灵感有一个落脚点</h3>
              <p>轻量 Markdown 笔记，只保存在你的电脑。</p>
            </div>
          )}
        </section>
      </div>
      {editing && (
        <NoteEditor note={editing} workspace={workspace} onClose={() => setEditing(null)} />
      )}
    </>
  );
}
