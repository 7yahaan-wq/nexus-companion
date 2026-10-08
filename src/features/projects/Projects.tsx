import { L, useI18n } from '../../domain/i18n';
import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Folder,
  ArrowUpRight,
  GitBranch,
  Code2,
  Terminal,
  ExternalLink,
  Play,
  NotebookPen,
} from 'lucide-react';
import EntityForm from '../../components/EntityForm';
import { api, uid } from '../../domain/api';
import type { Entity, AgentRun } from '../../domain/types';
import type { WorkspaceActions } from '../../domain/useWorkspace';
let projectWrites: Promise<unknown> = Promise.resolve();
function writeNextStep(id: string, nextStep: string) {
  const result = projectWrites.then(async () => {
    const project = (await api<Entity[]>('list', 'projects')).find((item) => item.id === id);
    if (!project) throw Error('项目已不存在，未保存下一步。');
    await api('save', 'projects', { ...project, nextStep });
  });
  projectWrites = result.catch(() => undefined);
  return result;
}
export default function Projects({
  data,
  save,
  remove,
  setError,
  refresh,
  runs = [],
  onTask,
  onNote,
  onFocus,
}: WorkspaceActions & {
  runs?: AgentRun[];
  onTask?: (task: Entity) => void;
  onNote?: (id: string) => void;
  onFocus?: (task: Entity) => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState<Entity | null>(null),
    [selection, setSelected] = useState<Entity | null>(null),
    [info, setInfo] = useState<any>(null);
  const [nextStep, setNextStep] = useState(''),
    [savedStep, setSavedStep] = useState(false),
    [savingStep, setSavingStep] = useState(false);
  const inspection = useRef(0);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selection) detailRef.current?.scrollIntoView({ block: 'start' });
  }, [selection]);
  const mounted = useRef(false);
  const draftStep = useRef<{ id: string; value: string; revision: number } | null>(null);
  const stepRevision = useRef(0);
  const stepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void flushNextStep();
    };
  }, []);
  const selected = data.projects.find((project) => project.id === selection?.id) || selection;
  const byRecent = (a: Entity, b: Entity) =>
    String(b.updatedAt || b.createdAt || '').localeCompare(
      String(a.updatedAt || a.createdAt || ''),
    );
  const projectTasks = data.tasks.filter((task) => task.project === selected?.id).sort(byRecent);
  const projectNotes = data.notes.filter((note) => note.project === selected?.id).sort(byRecent);
  const resumeTask = projectTasks.find((task) => !['Done', 'Cancelled'].includes(task.status));
  const fields = [
    { key: 'name', label: '项目名称', required: true },
    { key: 'description', label: '描述', type: 'textarea' },
    { key: 'projectPath', label: '项目目录', type: 'directory', required: true },
    { key: 'repository', label: '仓库网址', type: 'url' },
    { key: 'color', label: '标识颜色', type: 'color' },
    { key: 'icon', label: '图标 / Emoji' },
  ];
  async function flushNextStep() {
    clearTimeout(stepTimer.current);
    const draft = draftStep.current;
    if (!draft) return;
    draftStep.current = null;
    if (mounted.current) setSavingStep(true);
    try {
      await writeNextStep(draft.id, draft.value);
      await refresh();
      if (mounted.current && stepRevision.current === draft.revision) setSavedStep(true);
    } catch (e: any) {
      if (!draftStep.current) draftStep.current = draft;
      setError(e.message);
    } finally {
      if (mounted.current) setSavingStep(false);
    }
  }
  function changeNextStep(value: string) {
    if (!selected) return;
    setNextStep(value);
    setSavedStep(false);
    draftStep.current = { id: selected.id, value, revision: ++stepRevision.current };
    clearTimeout(stepTimer.current);
    stepTimer.current = setTimeout(() => void flushNextStep(), 500);
  }
  async function inspect(p: Entity) {
    const request = ++inspection.current;
    try {
      await flushNextStep();
      await projectWrites;
      if (inspection.current !== request) return;
      const current = (await api<Entity[]>('list', 'projects')).find((item) => item.id === p.id);
      if (!current || inspection.current !== request) return;
      p = current;
      setSelected(p);
      setInfo(null);
      setNextStep(p.nextStep || '');
      setSavedStep(false);
      await save('projects', { ...p, lastOpened: new Date().toISOString() });
      const result = await api('projectInspect', p.projectPath);
      if (inspection.current !== request) return;
      setInfo(result);
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
        <span className="quiet">
          {t(
            `${data.projects.length} 个项目 · 每个想法都有自己的空间`,
            `${data.projects.length} projects · A place for every idea`,
          )}
        </span>
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
              <p>{p.description || t('等待下一个好想法。', 'Room for the next good idea.')}</p>
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
                {done} / {tasks.length} {t('任务已完成', 'tasks completed')}
              </small>
              <div className="card-actions">
                <button onClick={() => action(p, 'folder')}>
                  <Folder size={14} />
                  {t('目录', 'Folder')}
                </button>
                <button onClick={() => setEditing(p)}>{t('编辑', 'Edit')}</button>
              </div>
            </section>
          );
        })}
      </div>
      {!data.projects.length && (
        <div className="panel empty">
          <Folder size={40} />
          <h3>{t('为你的下一个作品留个位置', 'Make room for your next project')}</h3>
          <p>
            {t(
              '选择已有目录，自动识别 Godot、Unity 与 Git。',
              'Choose a folder to detect Godot, Unity and Git.',
            )}
          </p>
        </div>
      )}
      {selected && (
        <section className="panel project-detail" ref={detailRef}>
          <h2>
            {selected.name}
            <span>{info?.engine || t('检查项目中…', 'Inspecting project…')}</span>
          </h2>
          <div className="project-resume">
            <h3>
              <Play size={15} />
              {t('继续上次工作', 'Continue where you left off')}
            </h3>
            <div className="toolbar wrap">
              {resumeTask && onTask && (
                <button onClick={() => onTask(resumeTask)}>
                  {t('继续任务：', 'Continue task: ')}
                  {resumeTask.title}
                </button>
              )}
              {resumeTask && onFocus && (
                <button className="primary" onClick={() => onFocus(resumeTask)}>
                  <Play size={14} />
                  {t('专注这个任务', 'Focus on this task')}
                </button>
              )}
              {projectNotes[0] && onNote && (
                <button onClick={() => onNote(projectNotes[0].id)}>
                  <NotebookPen size={14} />
                  {t('最近灵感：', 'Latest idea: ')}
                  {projectNotes[0].title}
                </button>
              )}
            </div>
            {!resumeTask && !projectNotes.length && (
              <p className="quiet">
                {t(
                  '为任务或灵感关联这个项目，下次就能从这里继续。',
                  'Link a task or idea to this project to resume it here.',
                )}
              </p>
            )}
            <div className="project-next-step">
              <label>
                {t('下次第一步', 'Next first step')}
                <textarea
                  aria-label={t('下次第一步', 'Next first step')}
                  rows={2}
                  maxLength={2000}
                  value={nextStep}
                  disabled={savingStep}
                  placeholder={t(
                    '给下次打开项目的自己留一句话…',
                    'Leave a starting point for your next visit…',
                  )}
                  onChange={(e) => changeNextStep(e.target.value)}
                  onBlur={() => void flushNextStep()}
                />
              </label>
              <p className="quiet">
                {t(
                  '自动保存，随时可以离开此页。',
                  'Saved automatically, including when you leave this page.',
                )}
              </p>
              <button disabled={savingStep} onClick={() => void flushNextStep()}>
                {t('保存下一步', 'Save next step')}
              </button>
              {savedStep && <span role="status">{t('已保存', 'Saved')}</span>}
            </div>
            <div className="project-links">
              <div>
                <h3>{t('近期任务', 'Recent tasks')}</h3>
                {projectTasks.slice(0, 5).map((task) => (
                  <div className="project-linked-row" key={task.id}>
                    {onTask ? (
                      <button onClick={() => onTask(task)}>{task.title}</button>
                    ) : (
                      <p>{task.title}</p>
                    )}
                    <span>{t(task.status)}</span>
                  </div>
                ))}
                {!projectTasks.length && <p>{t('还没有关联任务。', 'No linked tasks yet.')}</p>}
              </div>
              <div>
                <h3>{t('关联灵感', 'Linked ideas')}</h3>
                {projectNotes.slice(0, 5).map((note) => (
                  <div className="project-linked-row" key={note.id}>
                    {onNote ? (
                      <button onClick={() => onNote(note.id)}>
                        <NotebookPen size={13} />
                        {note.title}
                      </button>
                    ) : (
                      <p>{note.title}</p>
                    )}
                  </div>
                ))}
                {!projectNotes.length && <p>{t('还没有关联灵感。', 'No linked ideas yet.')}</p>}
              </div>
            </div>
          </div>
          <div className="toolbar wrap">
            <button onClick={() => action(selected, 'vscode')}>
              <Code2 size={15} />
              VS Code
            </button>
            <button onClick={() => action(selected, 'terminal')}>
              <Terminal size={15} />
              {t('终端', 'Terminal')}
            </button>
            <button onClick={() => action(selected, 'launch')}>
              {t('启动项目', 'Launch project')}
            </button>
            {selected.repository && (
              <button
                onClick={() =>
                  api('openUrl', selected.repository).catch((e) => setError(e.message))
                }
              >
                <ExternalLink size={15} />
                {t('仓库', 'Repository')}
              </button>
            )}
          </div>
          {info && (
            <>
              <h3>
                <GitBranch size={14} /> {info.git.available ? info.git.branch : info.git.error}
              </h3>
              <p>{info.git.lastCommit}</p>
              <pre className="git-files">
                {info.git.files.join('\n') ||
                  t('没有已知的未提交更改', 'No known uncommitted changes')}
              </pre>
              <h3>{t('重要文档', 'Key documents')}</h3>
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
              <h3>{t('关联 Agent · 最近观测', 'Linked Agents · Recent observations')}</h3>
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
              <h3>{t('明确记录的近期修改文件', 'Explicitly recorded recent file changes')}</h3>
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
                  .join('\n') ||
                  t('没有可用的结构化文件修改记录', 'No structured file changes available')}
              </pre>
              <h3>{t('项目动态', 'Project activity')}</h3>
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
