const { parentPort } = require('node:worker_threads');
const { CodexProvider } = require('./codex.cjs');
let provider = new CodexProvider();
parentPort.on('message', async ({ id, method, args }) => {
  try {
    if (method === 'configure') {
      provider = new CodexProvider(args?.[0] || undefined);
      parentPort.postMessage({ id, result: true });
      return;
    }
    if (!['list', 'logs'].includes(method)) throw Error('Unknown provider method');
    parentPort.postMessage({ id, result: await provider[method](...(args || [])) });
  } catch (e) {
    parentPort.postMessage({ id, error: e.message });
  }
});
