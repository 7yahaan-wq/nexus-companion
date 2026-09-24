const { _electron: electron } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const base = path.join(root, '.test-data/nia-' + Date.now());
const errors = [];
async function launch(first = true) {
  const app = await electron.launch({
    ...(process.env.NEXUS_PACKAGED_EXE
      ? { executablePath: process.env.NEXUS_PACKAGED_EXE, args: [] }
      : { args: [root] }),
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: path.join(base, 'profile'),
      CODEX_HOME: path.join(base, 'codex'),
    },
  });
  const page = await app.firstWindow();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForFunction(async () => (await window.nexus.call('info')).data.ready);
  if (process.env.NEXUS_PACKAGED_EXE && first) {
    await page.getByRole('heading', { name: '欢迎使用 Nexus' }).waitFor();
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  }
  await page.locator('.hero').waitFor();
  return { app, page };
}

(async () => {
  await fs.mkdir(path.join(base, 'codex/sessions'), { recursive: true });
  let { app, page: p } = await launch();
  try {
    assert.equal(
      await p.getByRole('button', { name: /进入专注模式|开始一段专注|返回专注/ }).count(),
      1,
    );
    await p.getByRole('button', { name: '进入专注模式', exact: true }).click();
    await p.getByRole('button', { name: '开始专注', exact: true }).waitFor();
    await p.getByRole('button', { name: '← 返回工作台 · Esc', exact: true }).click();
    const idea = p.getByRole('button', { name: '记录灵感', exact: true });
    assert.ok(await idea.isVisible());
    await idea.click();
    await p.getByRole('button', { name: '取消', exact: true }).click();
    await p.locator('.hero').waitFor();
    await idea.click();
    await p.getByLabel('笔记标题', { exact: true }).fill('主页灵感验收');
    await p
      .getByLabel('内容（Markdown）', { exact: true })
      .fill('## 一个及时保存的想法\n让 Nia 多一些表情。');
    await p.getByRole('button', { name: '保存', exact: true }).click();
    await p.waitForFunction(() => !document.querySelector('dialog[open]'));
    await p.getByRole('heading', { name: '灵感笔记', exact: true }).waitFor();
    assert.ok(await p.getByRole('button', { name: '灵感笔记', exact: true }).isVisible());
    await p.getByRole('heading', { name: '一个及时保存的想法', exact: true }).waitFor();
    await p.locator('[data-page="Home"]').click();
    await p.getByRole('button', { name: '查看灵感', exact: true }).click();
    await p.getByRole('heading', { name: '一个及时保存的想法', exact: true }).waitFor();
    await p.locator('[data-page="Home"]').click();
    await p.screenshot({ path: path.join(root, '.test-data/v031-home.png') });
    await p.locator('[data-page="Settings"]').click();
    const preview = p.locator('.nia-preview-stage .avatar-render');
    const sprite = preview.locator('.nia-sprite');
    await p.emulateMedia({ reducedMotion: 'reduce' });
    const triggerKeywords = {
      idle: '白天',
      working: '专注',
      thinking: '启动或等待',
      happy: '一个 Codex',
      warning: '等待审批',
      error: '失败',
      sleepy: '23:00',
      celebrate: '多个 Codex',
    };
    let idleSharpness = 0;
    for (const state of [
      'idle',
      'working',
      'thinking',
      'happy',
      'warning',
      'error',
      'sleepy',
      'celebrate',
    ]) {
      await p.locator(`[data-preview-state="${state}"]`).click();
      assert.equal(await preview.getAttribute('data-state'), state);
      assert.equal(await preview.getAttribute('data-motion'), 'still');
      await sprite
        .locator('img')
        .first()
        .evaluate(async (img) => img.decode());
      assert.equal(await sprite.locator('img').count(), 1);
      assert.ok((await sprite.locator('img').getAttribute('src')).endsWith(state === 'idle' ? '/animations/idle.png' : '/animations-hires/' + state + '.png'), state + ' must use the intended independent artwork');
      assert.equal(await preview.evaluate((el) => getComputedStyle(el).opacity), '1', 'do not tint or dim Nia by state');
      const distinctCells = await sprite
        .locator('img')
        .first()
        .evaluate((img) => {
          if (img.naturalWidth !== 2172 || img.naturalHeight !== 1448) return -1;
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 362;
          const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
          const signatures = new Set();
          for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 6; col++) {
              context.clearRect(0, 0, 362, 362);
              context.drawImage(img, col * 362, row * 362, 362, 362, 0, 0, 362, 362);
              signatures.add(canvas.toDataURL());
            }
          }
          return signatures.size;
        });
      assert.equal(distinctCells, 24, state + ' must contain twenty-four different drawn cells');
      const art = await sprite.locator('img').first().evaluate((img) => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 362;
        const context = canvas.getContext('2d');
        context.imageSmoothingEnabled = false;
        const anchors = [];
        const sharpness = [];
        let borderPixels = 0;
        let laptopPixelMismatches = 0;
        let laptopReference = null;
        for (let frame = 0; frame < 24; frame++) {
          context.clearRect(0, 0, 362, 362);
          context.drawImage(img, (frame % 6) * 362, Math.floor(frame / 6) * 362, 362, 362, 0, 0, 362, 362);
          const data = context.getImageData(0, 0, 362, 362).data;
          const laptop = [];
          for (let y = 285; y < 315; y++) for (let x = 110; x < 250; x++) {
            const start = (y * 362 + x) * 4;
            for (let c = 0; c < 4; c++) laptop.push(data[start + c]);
          }
          if (laptopReference) {
            for (let i = 0; i < laptop.length; i++) {
              if (laptop[i] !== laptopReference[i]) laptopPixelMismatches++;
            }
          } else laptopReference = laptop;
          let xSum = 0;
          let ySum = 0;
          let samples = 0;
          for (let y = 0; y < 362; y++) {
            for (let x = 0; x < 362; x++) {
              const index = (y * 362 + x) * 4;
              if ((x < 8 || y < 8 || x >= 354 || y >= 354) && data[index + 3]) borderPixels++;
              if (x < 162 || x >= 204 || y < 280 || y >= 320) continue;
              const red = data[index];
              const green = data[index + 1];
              const blue = data[index + 2];
              const weight = Math.max(0, Math.min(red - 170, green - 190, blue - 210)) * data[index+3] / 255;
              xSum += x * weight;
              ySum += y * weight;
              samples += weight;
            }
          }
          anchors.push(samples ? [xSum / samples, ySum / samples] : null);
          // A blurred double exposure loses high-frequency eye and eyelash detail.
          const gray = (x, y) => {
            const i = (y * 362 + x) * 4;
            return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
          };
          let edgeSum = 0;
          let edgeSquares = 0;
          let edgeCount = 0;
          for (let y = 141; y < 204; y++) for (let x = 133; x < 247; x++) {
            const lap = gray(x - 1, y) + gray(x + 1, y) + gray(x, y - 1) + gray(x, y + 1) - 4 * gray(x, y);
            edgeSum += lap;
            edgeSquares += lap * lap;
            edgeCount++;
          }
          sharpness.push(edgeSquares / edgeCount - (edgeSum / edgeCount) ** 2);
        }
        sharpness.sort((a, b) => a - b);
        return { borderPixels, laptopPixelMismatches, anchors, medianSharpness: sharpness[12] };
      });
      assert.equal(art.borderPixels, 0, state + ' must not bleed across cells');
      if (state === 'idle') assert.equal(art.laptopPixelMismatches, 0, 'accepted idle laptop unchanged');
      console.log(state, 'sharpness', art.medianSharpness.toFixed(1));
      assert.ok(art.medianSharpness > 500, state + ' must keep legible facial linework');
      if (state === 'idle') idleSharpness = art.medianSharpness;
      else assert.ok(art.medianSharpness >= idleSharpness * 0.7, state + ' loses too much face detail relative to accepted idle');
      assert.ok(art.anchors.every(Boolean), state + ' needs a laptop anchor in every frame');
      const xs = art.anchors.map(([x]) => x);
      const ys = art.anchors.map(([, y]) => y);
      assert.ok(Math.max(...xs) - Math.min(...xs) <= 1, state + ' must not drift sideways');
      assert.ok(Math.max(...ys) - Math.min(...ys) <= 1.5, state + ' must not drift vertically');
      assert.ok(
        await sprite
          .locator('img')
          .first()
          .evaluate((img) => img.naturalWidth >= 1024),
      );
      assert.ok(
        (await p.locator('.nia-preview-trigger span').innerText()).includes(triggerKeywords[state]),
      );
      await p.locator('.nia-preview').screenshot({ path: path.join(base, `preview-${state}.png`) });
    }
    await p.locator('.nia-preview-header .nia-display-toggle').click();
    await p.waitForFunction(() => document.querySelector('.nia-preview-stage .avatar-render').dataset.display === 'portrait');
    for (const state of ['idle', 'working', 'thinking', 'happy', 'warning', 'error', 'sleepy', 'celebrate']) {
      await p.locator(`[data-preview-state="${state}"]`).click();
      const portrait = p.locator('.nia-preview-stage .nia-portrait');
      await portrait.evaluate(async (img) => img.decode());
      assert.equal(await portrait.evaluate((img) => img.naturalWidth), 1024, state + ' portrait width');
      assert.equal(await portrait.evaluate((img) => img.naturalHeight), 1536, state + ' portrait height');
      assert.equal(await preview.getAttribute('data-motion'), 'still');
    }
    await p.locator('.nia-preview').screenshot({ path: path.join(root, '.test-data/v035-portrait.png') });
    await p.locator('.nia-preview-header .nia-display-toggle').click();
    await p.waitForFunction(() => document.querySelector('.nia-preview-stage .avatar-render').dataset.display === 'animation');
    await p.locator('[data-preview-state="working"]').click();
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    await p.waitForFunction(
      () =>
        document.querySelector('.nia-preview-stage .avatar-render').dataset.motion === 'playing',
    );
    const observedFrames = await sprite.evaluate((element) => new Promise((resolve) => {
      const seen = new Set([Number(element.dataset.frame)]);
      const observer = new MutationObserver(() => seen.add(Number(element.dataset.frame)));
      observer.observe(element, { attributes: true, attributeFilter: ['data-frame'] });
      setTimeout(() => { observer.disconnect(); resolve([...seen]); }, 1400);
    }));
    assert.ok(observedFrames.length >= 5 && observedFrames.length <= 14, 'curated playback should advance at a readable pace');
    assert.ok(observedFrames.every((frame) => frame >= 0 && frame < 24));
    await p.locator('[data-preview-state="celebrate"]').click();
    assert.equal(await sprite.getAttribute('data-frame'), '0', 'state switch starts at first cel, not static endpoint');
    await p.locator('[data-preview-state="working"]').click();
    const frame = await sprite.getAttribute('data-frame');
    await p.waitForFunction(
      (frame) => document.querySelector('.nia-preview-stage .nia-sprite').dataset.frame !== frame,
      frame,
    );
    await p.emulateMedia({ reducedMotion: 'reduce' });
    await p.waitForFunction(
      () => document.querySelector('.nia-preview-stage .avatar-render').dataset.motion === 'still',
    );
    const still = await sprite.getAttribute('data-frame');
    await p.waitForTimeout(800);
    assert.equal(await sprite.getAttribute('data-frame'), still);
    await p.emulateMedia({ reducedMotion: 'no-preference' });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
    assert.equal(
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()),
      false,
    );
    await p.waitForFunction(
      () => document.querySelector('.nia-preview-stage .avatar-render').dataset.motion === 'still',
    );
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    await p.waitForFunction(
      () =>
        document.querySelector('.nia-preview-stage .avatar-render').dataset.motion === 'playing',
    );
    await p.getByLabel('角色动画', { exact: true }).click();
    await p.waitForFunction(() => !document.querySelector('input[aria-label="角色动画"]').checked);
    await p.waitForFunction(
      () => document.querySelector('.nia-preview-stage .avatar-render').dataset.motion === 'still',
    );
    await p.getByLabel('主题', { exact: true }).selectOption('light');
    await p.waitForFunction(() => document.querySelector('.app').dataset.theme === 'light');
    await p
      .locator('.nia-preview')
      .screenshot({ path: path.join(root, '.test-data/v030-nia-light.png') });
    await p.getByLabel('Language / 语言').selectOption('en');
    await p.locator('[data-page="Home"]').click();
    await p.getByRole('button', { name: 'Capture an idea', exact: true }).waitFor();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1060, 760));
    const box = await p.getByRole('button', { name: 'Capture an idea', exact: true }).boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= (await p.evaluate(() => innerWidth)));
    assert.ok(await p.getByRole('button', { name: 'View ideas', exact: true }).isVisible());
    assert.ok(await p.locator('.companion-rail .nia-display-toggle').isVisible());
    await p.screenshot({ path: path.join(root, '.test-data/v031-home-narrow.png') });
    await p.getByRole('button', { name: 'View ideas', exact: true }).click();
    await p.getByRole('heading', { name: 'Ideas & notes', exact: true }).waitFor();
    await p.getByRole('heading', { name: '一个及时保存的想法', exact: true }).waitFor();
    await p.locator('.companion-rail .nia-display-toggle').click();
    await p.waitForFunction(() => document.querySelector('.companion-rail .avatar-render').dataset.display === 'portrait');
    await app.close();
    ({ app, page: p } = await launch(false));
    const notes = (await p.evaluate(() => window.nexus.call('list', 'notes'))).data;
    assert.equal(notes.length, 1);
    assert.equal(notes[0].title, '主页灵感验收');
    await p.getByRole('button', { name: 'View ideas', exact: true }).click();
    await p.getByRole('heading', { name: '一个及时保存的想法', exact: true }).waitFor();
    const appearance = (await p.evaluate(() => window.nexus.call('list', 'settings'))).data.find(
      (s) => s.id === 'appearance',
    );
    assert.equal(appearance.avatarMotion, false);
    assert.equal(appearance.avatarDisplay, 'portrait');
    await p.waitForFunction(
      () => document.querySelector('.companion-rail .avatar-render').dataset.motion === 'still',
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS Nia: save-to-notes navigation, view ideas + restart, single focus entry, eight states, 24 reference-style cels, curated frame sequence, eight portraits, mode toggle, frame advance, reduced/disabled/hidden motion, light/English/narrow layout; zero renderer errors',
    );
  } finally {
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
