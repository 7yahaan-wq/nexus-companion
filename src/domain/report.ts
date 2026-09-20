interface RecordData {
  id: string;
  [key: string]: any;
}
const dayKey = (value: string) => (value ? new Date(value).toLocaleDateString('sv-SE') : '');
export function makeReport(date: string, data: Record<string, RecordData[]>, agents: RecordData[]) {
  const start = new Date(date + 'T00:00').getTime(),
    end = new Date(date + 'T23:59:59.999').getTime();
  const completed = data.tasks.filter((t) => t.status === 'Done' && dayKey(t.completedAt) === date);
  const activity = agents.filter(
    (a) => dayKey(a.observedAt) === date || dayKey(a.endTime) === date,
  );
  const runtime = activity.reduce(
    (sum, a) =>
      a.startTime && a.endTime
        ? sum +
          Math.max(
            0,
            Math.min(end, new Date(a.endTime).getTime()) -
              Math.max(start, new Date(a.startTime).getTime()),
          )
        : sum,
    0,
  );
  const focus = data.focus
    .filter((f) => dayKey(f.endTime) === date)
    .reduce((sum, f) => sum + (f.actualSeconds || 0), 0);
  const modified = new Set(
    (data.timeline || []).filter((t) => dayKey(t.time) === date).map((t) => t.project),
  );
  const projects = data.projects.filter(
    (p) =>
      modified.has(p.id) ||
      activity.some((a) => a.workingDirectory?.toLowerCase() === p.projectPath?.toLowerCase()),
  );
  const notes = data.notes.filter((n) => dayKey(n.updatedAt || n.createdAt) === date);
  const tomorrow = new Date(date + 'T12:00');
  tomorrow.setDate(tomorrow.getDate() + 1);
  const planned = data.tasks.filter(
    (t) =>
      t.dueDate === tomorrow.toLocaleDateString('sv-SE') &&
      !['Done', 'Cancelled'].includes(t.status),
  );
  const items = (rows: RecordData[], key = 'title') =>
    rows.length ? rows.map((r) => `- ${r[key] || r.id}`).join('\n') : '- 无';
  return `# ${date} · Daily Development Report\n\n## Completed Tasks\n${items(completed)}\n\n## Agent Activity（本地观测）\n${activity.length ? activity.map((a) => `- ${a.taskName} · ${a.status} · ${a.currentStep}`).join('\n') : '- 无可用记录'}\n\n## Modified Projects\n${items(projects, 'name')}\n\n## Agent Runtime\n- 已知且有开始/结束事件的时间：${Math.round(runtime / 60000)} 分钟\n- 未结束、缺少事件的时长：Unavailable；不计入合计\n\n## Focus Time\n- ${Math.round(focus / 60)} 分钟\n\n## Failed Tasks\n${items(
    activity.filter((a) => a.status === 'FAILED'),
    'taskName',
  )}\n\n## Waiting Tasks\n${items(data.tasks.filter((t) => t.status === 'Waiting'))}\n${items(
    activity.filter((a) => ['WAITING', 'WAITING_APPROVAL'].includes(a.status)),
    'taskName',
  )}\n\n## Notes\n${items(notes)}\n\n## Tomorrow\n${items(planned)}\n\n---\nLocal only · Agent 统计基于可读取的最近轮次记录，并非完整执行审计。\n`;
}
