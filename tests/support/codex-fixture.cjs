const fs = require('node:fs/promises');
const path = require('node:path');
module.exports = async function codexFixture(base) {
  const root = path.join(base, 'codex');
  await fs.mkdir(path.join(root, 'sessions'), { recursive: true });
  const timestamp = new Date().toISOString();
  const records = [
    { timestamp, type: 'session_meta', payload: { id: 'harness-agent', cwd: base, source: 'cli' } },
    { timestamp, type: 'event_msg', payload: { type: 'task_started', turn_id: 'harness-turn' } },
    {
      timestamp,
      type: 'event_msg',
      payload: { type: 'user_message', message: 'Review the isolated harness fixture' },
    },
    {
      timestamp,
      type: 'event_msg',
      payload: { type: 'agent_message', message: 'Fixture response for bounded log rendering.' },
    },
    { timestamp, type: 'event_msg', payload: { type: 'task_complete' } },
  ];
  await fs.writeFile(
    path.join(root, 'sessions', 'fixture.jsonl'),
    records.map((record) => JSON.stringify(record)).join('\n') + '\n',
  );
  return root;
};
