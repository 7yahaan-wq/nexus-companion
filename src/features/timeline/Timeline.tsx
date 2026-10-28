import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Download, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { L, useI18n } from '../../domain/i18n';
import { api, today } from '../../domain/api';
import { makeReport } from '../../domain/report';
import { dailyPlan, type DailyPlan } from '../../domain/planning';
import type { WorkspaceActions } from '../../domain/useWorkspace';
import type { AgentRun, Entity } from '../../domain/types';
export default function Timeline({
  workspace,
  agents,
  reportRequest,
}: {
  workspace: WorkspaceActions;
  agents: AgentRun[];
  reportRequest?: { date: string; revision: number } | null;
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
  const [date, setDate] = useState(reportRequest?.date || today()),
    [project, setProject] = useState(''),
    [agent, setAgent] = useState(''),
    [task, setTask] = useState(''),
    [tab, setTab] = useState(reportRequest ? 'Daily Report' : 'Timeline'),
    [copied, setCopied] = useState(false);
  const [planState, setPlanState] = useState<{
    date: string;
    status: 'loading' | 'ready' | 'error';
    plan: DailyPlan | null;
    error?: string;
  }>({ date: '', status: 'loading', plan: null });
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const reportDate = date || today();
  useEffect(() => {
    if (reportRequest) {
      setDate(reportRequest.date);
      setTab('Daily Report');
    }
  }, [reportRequest]);
  useEffect(() => {
    setCopied(false);
    if (tab !== 'Daily Report') return;
    let valid = true;
    setPlanState({ date: reportDate, status: 'loading', plan: null });
    api<Entity[]>('list', 'settings')
      .then((records) => {
        if (!valid) return;
        const saved = records.find(
          (record) => record.id === `daily-plan:${reportDate}` && record.date === reportDate,
        );
        setPlanState({
          date: reportDate,
          status: 'ready',
          plan: saved ? dailyPlan(reportDate, saved) : null,
        });
      })
      .catch((error) => {
        if (valid)
          setPlanState({ date: reportDate, status: 'error', plan: null, error: error.message });
      });
    return () => {
      valid = false;
    };
  }, [reportDate, tab, retry]);
  const reportReady =
    tab === 'Daily Report' && planState.date === reportDate && planState.status === 'ready';
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
  const report = makeReport(reportDate, data, agents, reportReady ? planState.plan : null);
  async function shareReport(exportFile: boolean) {
    if (!reportReady || operation.current) return;
    operation.current = true;
    setBusy(true);
    try {
      if (exportFile) {
        await save('reports', {
          id: reportDate,
          date: reportDate,
          markdown: report,
          updatedAt: new Date().toISOString(),
        });
        await api('exportMarkdown', report, `Nexus-${reportDate}.md`);
      } else {
        await navigator.clipboard.writeText(report);
        setCopied(true);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="toolbar wrap">
        <div className="segmented">
          {['Timeline', 'Daily Report'].map((t) => (
            <button
              disabled={busy}
              className={t === tab ? 'active' : ''}
              key={t}
              onClick={() => setTab(t)}
            >
              <L text={t} />
            </button>
          ))}
        </div>
        <input
          aria-label="动态日期"
          type="date"
          disabled={busy}
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
            <button disabled={!reportReady || busy} onClick={() => void shareReport(false)}>
              <Copy size={14} />
              {copied ? t('已复制', 'Copied') : t('复制 Markdown', 'Copy Markdown')}
            </button>
            <button
              className="primary"
              disabled={!reportReady || busy}
              onClick={() => void shareReport(true)}
            >
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
      ) : !reportReady ? (
        <section className="panel" aria-live="polite">
          {planState.date === reportDate && planState.status === 'error' ? (
            <div data-testid="report-error">
              <p>
                {t('日报读取失败：', 'Could not load report: ')}
                {planState.error}
              </p>
              <button onClick={() => setRetry((value) => value + 1)}>
                {t('重试读取', 'Retry loading')}
              </button>
            </div>
          ) : (
            <p data-testid="report-loading">
              {t('正在读取当天计划与回顾…', 'Loading this day’s plan and reflection…')}
            </p>
          )}
        </section>
      ) : (
        <section className="panel markdown" data-testid="daily-report">
          <ReactMarkdown
            skipHtml
            components={{
              img: () => null,
              a: ({ href, children }) => (
                <button
                  className="inline-link"
                  onClick={() => href && api('openUrl', href).catch((e) => setError(e.message))}
                >
                  {children}
                </button>
              ),
            }}
          >
            {report}
          </ReactMarkdown>
        </section>
      )}
    </>
  );
}
