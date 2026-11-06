import { readFileSync, writeFileSync } from 'node:fs';
import { avatarLabels, niaAnimations } from '../src/domain/avatar.ts';

// Embed just the playback table so the review page also works from file://.
const file = new URL('../docs/NIA_REVIEW.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const marker = /(<script type="application\/json" id="animations">)[\s\S]*?(<\/script>)/;
if (!marker.test(html)) throw new Error('Missing NIA_REVIEW.html animation table');

const entries = Object.entries(niaAnimations).map(([state, animation]) => {
  const sheet = animation.sheet.replace('./assets/', '../public/assets/');
  const data = { ...animation, sheet, label: avatarLabels[state] };
  return '  ' + JSON.stringify(state) + ': ' + JSON.stringify(data);
});
const table = '{\n' + entries.join(',\n') + '\n}';
const updated = html.replace(marker, (_, open, close) => open + '\n' + table + '\n' + close);
if (updated !== html) writeFileSync(file, updated);
