import { useMemo, useState } from 'react';
import { Activity, Download, Copy, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { L, useI18n } from '../../domain/i18n';
import { api, today } from '../../domain/api';
import { makeReport } from '../../domain/report';
import type { WorkspaceActions } from '../../domain/useWorkspace';
import type { AgentRun } from '../../domain/types';
export default function Timeline({
  workspace,
  agents,
}: {
  workspace: WorkspaceActions;
  agents: AgentRun[];
}) {
  const { t } = useI18n();
  const kindName = (kind: string) =>
    ({
      tasks: t('任务', 'Task'),
      notes: t('灵感笔记', 'Idea'),
      projects: t('项目', 'Project'),
      events: t('日程', 'Event'),
      focus: t('专注', 'Focus'),
    })[kind] || kind;
  const { data, save, setError } = workspace;
  const [date, setDate] = useState(today()),
    [project, setProject] = useState(''),
    [agent, setAgent] = useState(''),
    [task, setTask] = useState(''),
    [tab, setTab] = useState('Timeline'),
    [copied, setCopied] = useState(false);
  const events = useMemo(() => {
    const local = data.timeline;
    return [...local]
      .filter(
        (e) =>
          (!date || new Date(e.time).toLocaleDateString('sv-SE') === date) &&
          (!project || e.project === project) &&
          (!agent || e.agent === agent) &&
          (!task || `${e.title} ${e.entityId || ''}`.toLowerCase().includes(task.toLowerCase())),
      )
      .sort((a, b) => b.time.localeCompare(a.time));
  }, [data.timeline, date, project, agent, task]);
  const report = makeReport(date || today(), data, agents);
  async function exportReport() {
    try {
      await save('reports', {
        id: date || today(),
        date: date || today(),
        markdown: report,
        updatedAt: new Date().toISOString(),
      });
      await api('exportMarkdown', report, `Nexus-${date || today()}.md`);
    } catch (e: any) {
      setError(e.message);
    }
  }
  return (
    <>
      <div className="toolbar wrap">
        <div className="segmented">
          {['Timeline', 'Daily Report'].map((t) => (
            <button className={t === tab ? 'active' : ''} key={t} onClick={() => setTab(t)}>
              <L text={t} />
            </button>
          ))}
        </div>
        <input
          aria-label="动态日期"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        {tab === 'Timeline' ? (
          <>
            <select
              aria-label="动态项目"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">
                <L text="所有项目" />
              </option>
              {data.projects.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              aria-label="动态 Agent"
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
            >
              <option value="">所有 Agent</option>
              {[...new Set(agents.map((a) => a.agentName))].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
            <input
              placeholder="过滤任务 / ID"
              value={task}
              onChange={(e) => setTask(e.target.value)}
            />
          </>
        ) : (
          <>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(report);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch (e: any) {
                  setError(e.message);
                }
              }}
            >
              <Copy size={14} />
              {copied ? '已复制' : '复制 Markdown'}
            </button>
            <button className="primary" onClick={exportReport}>
              <Download size={14} />
              <L text="导出 Markdown" />
            </button>
          </>
        )}
      </div>
      {tab === 'Timeline' ? (
        <section className="panel timeline-list">
          {events.length ? (
            events.slice(0, 500).map((e) => (
              <div className="timeline-row" key={e.id}>
                <span className="timeline-time">
                  {new Date(e.time).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <i />
                <div>
                  <strong>
                    {String(e.title || '').replace(/^(tasks|notes|projects|events) · /, '')}
                  </strong>
                  <p>
                    {e.agent || kindName(e.kind)} ·{' '}
                    {data.projects.find((p) => p.id === e.project)?.name || t('个人', 'Personal')}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="empty">
              <Activity size={32} />
              <h3>这一天，还没有记录</h3>
              <p>你的项目、任务与 Agent 动态会自动保存在这里。</p>
            </div>
          )}
        </section>
      ) : (
        <section className="panel markdown">
          <ReactMarkdown skipHtml>{report}</ReactMarkdown>
        </section>
      )}
    </>
  );
}
