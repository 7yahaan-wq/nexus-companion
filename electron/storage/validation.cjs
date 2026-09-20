const taskStates = new Set(['Inbox', 'Planned', 'In Progress', 'Waiting', 'Done', 'Cancelled']);
function validate(kind, value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    typeof value.id !== 'string' ||
    value.id.length > 200
  )
    throw Error('Invalid record');
  const title = kind === 'projects' ? 'name' : 'title';
  if (
    ['projects', 'tasks', 'events', 'notes'].includes(kind) &&
    (typeof value[title] !== 'string' || !value[title].trim() || value[title].length > 1000)
  )
    throw Error('标题不能为空，且不能超过 1000 个字符');
  if (kind === 'tasks' && !taskStates.has(value.status)) throw Error('无效任务状态');
  if (kind === 'events') {
    const start = new Date(value.start),
      end = new Date(value.end);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
      throw Error('无效日程时间范围');
    if (value.recurrence && !['none', 'daily', 'weekly', 'monthly'].includes(value.recurrence))
      throw Error('不支持的重复类型');
  }
  if (
    kind === 'projects' &&
    (typeof value.projectPath !== 'string' || !require('node:path').isAbsolute(value.projectPath))
  )
    throw Error('项目需要绝对目录路径');
  return value;
}
module.exports = { validate };
