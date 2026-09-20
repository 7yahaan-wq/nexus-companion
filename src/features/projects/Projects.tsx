import { L } from '../../domain/i18n';
import { useState } from 'react';
import { Plus, Folder, ArrowUpRight, GitBranch, Code2, Terminal, ExternalLink } from 'lucide-react';
import EntityForm from '../../components/EntityForm';
import { api, uid } from '../../domain/api';
import type { Entity, AgentRun } from '../../domain/types';
import type { WorkspaceActions } from '../../domain/useWorkspace';
export default function Projects({
  data,
  save,
  remove,
  setError,
  runs = [],
}: WorkspaceActions & { runs?: AgentRun[] }) {
  const [editing, setEditing] = useState<Entity | null>(null),
    [selected, setSelected] = useState<Entity | null>(null),
    [info, setInfo] = useState<any>(null);
  const fields = [
    { key: 'name', label: '项目名称', required: true },
    { key: 'description', label: '描述', type: 'textarea' },
    { key: 'projectPath', label: '项目目录', type: 'directory', required: true },
    { key: 'repository', label: '仓库网址', type: 'url' },
    { key: 'color', label: '标识颜色', type: 'color' },
    { key: 'icon', label: '图标 / Emoji' },
  ];
  async function inspect(p: Entity) {
    setSelected(p);
    setInfo(null);
    try {
      setInfo(await api('projectInspect', p.projectPath));
      await save('projects', { ...p, lastOpened: new Date().toISOString() });
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function action(p: Entity, a: string) {
    try {
      await api('projectOpen', p.projectPath, a);
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="toolbar">
        <span className="quiet">{data.projects.length} 个项目 · 每个想法都有自己的空间</span>
        <button
          className="primary"
          onClick={() => setEditing({ id: uid(), color: '#a6a2f5', icon: '◇' })}
        >
          <Plus size={16} />
          <L text="新建项目" />
        </button>
      </div>
      <div className="project-grid">
        {data.projects.map((p) => {
          const tasks = data.tasks.filter((t) => t.project === p.id),
            done = tasks.filter((t) => t.status === 'Done').length;
          return (
            <section
              className={'panel project-card ' + (selected?.id === p.id ? 'selected' : '')}
              key={p.id}
            >
              <div className="project-icon" style={{ color: p.color }}>
                {p.icon || <Folder />}
              </div>
              <button className="project-title" onClick={() => inspect(p)}>
                {p.name}
                <ArrowUpRight size={15} />
              </button>
              <p>{p.description || '等待下一个好想法。'}</p>
              <div className="path-text" title={p.projectPath}>
                {p.projectPath}
              </div>
              <div className="progress-track">
                <i
                  style={{
                    width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
                    background: p.color,
                  }}
                />
              </div>
              <small>
                {done} / {tasks.length} 任务已完成
              </small>
              <div className="card-actions">
                <button onClick={() => action(p, 'folder')}>
                  <Folder size={14} />
                  目录
                </button>
                <button onClick={() => setEditing(p)}>编辑</button>
              </div>
            </section>
          );
        })}
      </div>
      {!data.projects.length && (
        <div className="panel empty">
          <Folder size={40} />
          <h3>为你的下一个作品留个位置</h3>
          <p>选择已有目录，自动识别 Godot、Unity 与 Git。</p>
        </div>
      )}
      {selected && (
        <section className="panel project-detail">
          <h2>
            {selected.name}
            <span>{info?.engine || '检查项目中…'}</span>
          </h2>
          <div className="toolbar wrap">
            <button onClick={() => action(selected, 'vscode')}>
              <Code2 size={15} />
              VS Code
            </button>
            <button onClick={() => action(selected, 'terminal')}>
              <Terminal size={15} />
              终端
            </button>
            <button onClick={() => action(selected, 'launch')}>启动项目</button>
            {selected.repository && (
              <button
                onClick={() =>
                  api('openUrl', selected.repository).catch((e) => setError(e.message))
                }
              >
                <ExternalLink size={15} />
                仓库
              </button>
            )}
          </div>
          {info && (
            <>
              <h3>
                <GitBranch size={14} /> {info.git.available ? info.git.branch : info.git.error}
              </h3>
              <p>{info.git.lastCommit}</p>
              <pre className="git-files">{info.git.files.join('\n') || '没有已知的未提交更改'}</pre>
              <h3>重要文档</h3>
              {info.documents.map((f: string) => (
                <button
                  key={f}
                  onClick={() =>
                    api('openDocument', selected.projectPath, f).catch((e) => setError(e.message))
                  }
                >
                  {f}
                </button>
              ))}
              <h3>近期任务</h3>
              <p>
                今日任务：
                {
                  data.tasks.filter(
                    (t) =>
                      t.project === selected.id &&
                      t.dueDate === new Date().toLocaleDateString('sv-SE'),
                  ).length
                }
              </p>
              {data.tasks
                .filter((t) => t.project === selected.id)
                .slice(-5)
                .map((t) => (
                  <p key={t.id}>
                    {t.title} · {t.status}
                  </p>
                ))}
              <h3>关联 Agent · 最近观测</h3>
              {runs
                .filter(
                  (r) =>
                    r.workingDirectory.replaceAll('\\', '/').toLowerCase() ===
                    selected.projectPath.replaceAll('\\', '/').toLowerCase(),
                )
                .slice(0, 8)
                .map((r) => (
                  <p key={r.id}>
                    {r.agentName}
                    {r.role ? ' / ' + r.role : ''} · {r.taskName} · {r.status}
                  </p>
                ))}
              <h3>明确记录的近期修改文件</h3>
              <pre className="git-files">
                {[
                  ...new Set(
                    runs
                      .filter(
                        (r) =>
                          r.workingDirectory.replaceAll('\\', '/').toLowerCase() ===
                          selected.projectPath.replaceAll('\\', '/').toLowerCase(),
                      )
                      .flatMap((r) => r.changedFiles),
                  ),
                ]
                  .slice(0, 30)
                  .join('\n') || '没有可用的结构化文件修改记录'}
              </pre>
              <h3>项目动态</h3>
              {data.timeline
                .filter((t) => t.project === selected.id)
                .slice(-5)
                .reverse()
                .map((t) => (
                  <p key={t.id}>
                    {t.title} · {new Date(t.time).toLocaleString()}
                  </p>
                ))}
            </>
          )}
        </section>
      )}
      {editing && (
        <EntityForm
          title="项目"
          value={editing}
          fields={fields}
          onClose={() => setEditing(null)}
          onSave={async (p) => {
            const result = await api('projectInspect', p.projectPath);
            await save('projects', { ...p, engine: result.engine });
          }}
          onDelete={
            data.projects.some((p) => p.id === editing.id)
              ? async () => {
                  await remove('projects', editing.id);
                  setSelected(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
