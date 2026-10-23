const { _electron: electron, expect } = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Store } = require('../electron/storage/index.cjs');

const root = path.resolve(__dirname, '..');
const base = path.join(root, '.test-data', 'calendar-navigation-' + Date.now());
const profile = path.join(base, 'profile');
const codexPath = path.join(base, 'codex');
// These are local date parts, so the scenario also works outside UTC+8.
const fixedClock = [2026, 9, 23, 21, 17, 0, 0];
const today = '2026-10-23';
const yesterday = '2026-10-22';

async function capture(app, page, name) {
  await settle(page);
  const image = await app.evaluate(async ({ BrowserWindow }) =>
    (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'),
  );
  await fs.writeFile(path.join(base, name + '.png'), Buffer.from(image, 'base64'));
}

async function settle(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

async function read(page, kind) {
  const response = await page.evaluate((value) => window.nexus.call('list', value), kind);
  assert.equal(response.ok, true, 'Fixture collection must remain readable');
  return response.data;
}

async function expectNowInView(page, language = 'zh-CN') {
  const line = page.getByTestId('calendar-now');
  await expect(line).toHaveCount(1);
  await expect(line).toHaveAttribute(
    'aria-label',
    language === 'en' ? 'Current time 21:17' : '当前时间 21:17',
  );
  await expect
    .poll(() =>
      line.evaluate((element) => {
        const scroll = document.querySelector('.time-scroll');
        const marker = element.getBoundingClientRect();
        const viewport = scroll.getBoundingClientRect();
        return (
          scroll.scrollTop > 0 &&
          marker.top >= Math.max(0, viewport.top) &&
          marker.bottom <= Math.min(innerHeight, viewport.bottom) &&
          marker.left >= Math.max(0, viewport.left) &&
          marker.right <= Math.min(innerWidth, viewport.right)
        );
      }),
    )
    .toBe(true);
  assert.ok(
    Math.abs((await line.evaluate((element) => parseFloat(element.style.top))) - 1021.6) < 1,
    '21:17 must align with the 48px/hour time grid',
  );
  assert.equal(
    await line.evaluate((element) => {
      const days = [...document.querySelectorAll('.time-day')];
      const headers = [...document.querySelectorAll('.time-header button')];
      const index = days.indexOf(element.closest('.time-day'));
      return index >= 0 && headers[index]?.classList.contains('today');
    }),
    true,
    'The marker must belong to today, not every visible day',
  );
}

async function scrollToMidnight(page) {
  await page.locator('.time-scroll').evaluate((element) => {
    element.scrollTop = 0;
  });
  await settle(page);
  assert.equal(await page.locator('.time-scroll').evaluate((element) => element.scrollTop), 0);
}

async function repeatToday(page, language = 'zh-CN') {
  for (let attempt = 0; attempt < 2; attempt++) {
    await scrollToMidnight(page);
    await page
      .locator('.calendar-nav')
      .getByRole('button', { name: language === 'en' ? 'Today' : '今天', exact: true })
      .click();
    await expectNowInView(page, language);
  }
}

async function draftHasTime(page, start, end, events, language = 'zh-CN') {
  await page
    .getByRole('button', { name: language === 'en' ? 'New event' : '新建日程', exact: true })
    .click();
  await expect(page.getByLabel('日程标题', { exact: true })).toBeFocused();
  await expect(page.getByLabel('开始时间', { exact: true })).toHaveValue(start);
  await expect(page.getByLabel('结束时间', { exact: true })).toHaveValue(end);
  assert.deepEqual(await read(page, 'events'), events, 'Opening a new event must not save it');
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  assert.deepEqual(
    await read(page, 'events'),
    events,
    'Dismissing an untouched draft must preserve every existing event',
  );
}

async function workspaceRefreshKeepsScroll(page, title) {
  await scrollToMidnight(page);
  const originalScroller = await page.locator('.time-scroll').elementHandle();
  // A real TaskEditor save refreshes workspace data without navigating away from Calendar.
  await page.keyboard.press('Control+k');
  await page.getByLabel('全局搜索', { exact: true }).fill('Create Task');
  await page.getByLabel('全局搜索', { exact: true }).press('Enter');
  await page.getByLabel('任务标题', { exact: true }).fill(title);
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(
    page.locator('.calendar-tasks').getByRole('button', { name: title, exact: true }),
  ).toBeVisible();
  await settle(page);
  assert.equal(
    await originalScroller.evaluate(
      (element) => element.isConnected && element === document.querySelector('.time-scroll'),
    ),
    true,
    'The refresh scenario must exercise the same mounted calendar',
  );
  assert.equal(
    await page.locator('.time-scroll').evaluate((element) => element.scrollTop),
    0,
    'Workspace refresh must not take the user away from their chosen time',
  );
  await originalScroller.dispose();
}

(async () => {
  await fs.mkdir(path.join(codexPath, 'sessions'), { recursive: true });
  const store = new Store(path.join(profile, 'nexus.sqlite'));
  await store.save('settings', {
    id: 'appearance',
    onboarded: true,
    language: 'zh-CN',
    theme: 'dark',
  });
  await store.save('tasks', {
    id: 'calendar-task',
    title: 'Calendar fixture task',
    status: 'Planned',
    estimatedTime: 60,
  });
  await store.save('events', {
    id: 'preserved-event',
    title: 'Preserved morning event',
    start: today + 'T09:00',
    end: today + 'T10:00',
    type: 'Work',
    recurrence: 'none',
    color: '#a6a2f5',
  });
  await store.close();
  const errors = [];
  const app = await electron.launch({
    ...(process.env.NEXUS_PACKAGED_EXE
      ? { executablePath: process.env.NEXUS_PACKAGED_EXE, args: [] }
      : { args: [root] }),
    env: {
      ...process.env,
      NEXUS_TEST_MODE: '1',
      NEXUS_DATA_DIR: profile,
      CODEX_HOME: codexPath,
    },
  });
  try {
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    page.on('pageerror', (error) => errors.push(error.message));
    // firstWindow can precede main's initial loadFile completion. Reloading then
    // aborts that navigation and makes the app exit before the test can begin.
    await page.waitForLoadState('load');
    await page.waitForFunction(async () =>
      Boolean(window.nexus && (await window.nexus.call('info')).data.ready),
    );
    await page.addInitScript((parts) => {
      const RealDate = Date;
      // Mutable only inside this isolated test renderer; no production clock flag.
      window.__calendarTestNow = new RealDate(...parts).getTime();
      class ControlledDate extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [window.__calendarTestNow]));
        }
        static now() {
          return window.__calendarTestNow;
        }
      }
      window.Date = ControlledDate;
    }, fixedClock);
    await page.reload();
    await page.waitForFunction(async () =>
      Boolean(window.nexus && (await window.nexus.call('info')).data.ready),
    );
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.unmaximize();
      win.setSize(1366, 900);
      win.show();
      win.focus();
    });
    await page.waitForFunction(() => Math.abs(outerWidth - 1366) < 30);
    await page.locator('[data-page="Calendar"]').click();
    await expect(page.locator('.time-day')).toHaveCount(7);
    const originalEvents = await read(page, 'events');
    assert.equal(originalEvents.length, 1);

    // This deliberately fails against the old bundle: it had no now marker or initial scroll.
    await expectNowInView(page);
    await capture(app, page, '01-week-current-time');
    await draftHasTime(page, today + 'T21:30', today + 'T22:30', originalEvents);
    await workspaceRefreshKeepsScroll(page, 'Refresh while viewing Week');
    await repeatToday(page);

    await page.locator('.segmented').getByRole('button', { name: '日', exact: true }).click();
    await expect(page.locator('.time-day')).toHaveCount(1);
    await expectNowInView(page);
    await workspaceRefreshKeepsScroll(page, 'Refresh while viewing Day');
    await repeatToday(page);
    await capture(app, page, '02-day-current-time');
    await page.getByRole('button', { name: '上一页', exact: true }).click();
    await expect(page.getByTestId('calendar-now')).toHaveCount(0);
    await expect(page.locator('.time-header strong')).toHaveText('22');
    await draftHasTime(page, yesterday + 'T09:00', yesterday + 'T10:00', originalEvents);
    await page.getByRole('button', { name: '下一页', exact: true }).click();
    await expectNowInView(page);

    await page.locator('.segmented').getByRole('button', { name: '月', exact: true }).click();
    await expect(page.locator('.month-grid')).toBeVisible();
    await expect(page.locator('.month-cell')).toHaveCount(42);
    await expect(page.getByTestId('calendar-now')).toHaveCount(0);
    await expect(page.locator('.time-scroll')).toHaveCount(0);
    await expect(page.locator('.month-grid')).toContainText('Preserved morning event');
    await page.locator('.segmented').getByRole('button', { name: '周', exact: true }).click();
    await expectNowInView(page);
    assert.deepEqual(await read(page, 'events'), originalEvents);

    await page.locator('[data-page="Settings"]').click();
    await page.getByLabel('Language / 语言', { exact: true }).selectOption('en');
    await page.getByLabel('主题', { exact: true }).selectOption('light');
    await expect(page.locator('.app')).toHaveAttribute('data-theme', 'light');
    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      win.unmaximize();
      win.setSize(1060, 760);
    });
    await page.waitForFunction(() => Math.abs(outerWidth - 1060) < 30);
    await page.locator('[data-page="Calendar"]').click();
    await expectNowInView(page, 'en');
    await repeatToday(page, 'en');
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
    await draftHasTime(page, today + 'T21:30', today + 'T22:30', originalEvents, 'en');
    const layout = await page.evaluate(() => {
      const selectors = ['.calendar-layout', '.calendar-body', '.time-scroll'];
      return {
        windowFits: document.documentElement.scrollWidth <= innerWidth + 1,
        regions: selectors.map((selector) => {
          const element = document.querySelector(selector);
          const box = element.getBoundingClientRect();
          return {
            selector,
            fits:
              element.scrollWidth <= element.clientWidth + 1 &&
              box.left >= 0 &&
              box.right <= innerWidth + 1,
          };
        }),
      };
    });
    assert.ok(
      layout.windowFits && layout.regions.every((region) => region.fits),
      JSON.stringify(layout),
    );
    await capture(app, page, '03-english-light-minimum-window');

    // Keep the selected date at today while the real-time default crosses midnight.
    await page.evaluate(() => {
      window.__calendarTestNow = new Date(2026, 9, 23, 23, 59, 0, 0).getTime();
    });
    await page.locator('.calendar-nav').getByRole('button', { name: 'Today', exact: true }).click();
    await expect(page.getByTestId('calendar-now')).toHaveAttribute(
      'aria-label',
      'Current time 23:59',
    );
    await draftHasTime(page, '2026-10-24T00:00', '2026-10-24T01:00', originalEvents, 'en');

    await page.evaluate(() => {
      window.__calendarTestNow = new Date(2026, 9, 24, 0, 0, 0, 0).getTime();
    });
    await page.locator('.calendar-nav').getByRole('button', { name: 'Today', exact: true }).click();
    const midnight = page.getByTestId('calendar-now');
    await expect(midnight).toHaveCount(1);
    await expect(midnight).toHaveAttribute('aria-label', 'Current time 00:00');
    await expect(midnight.locator('time')).toHaveText('00:00');
    await expect
      .poll(() =>
        midnight.evaluate((element) => {
          const scroller = document.querySelector('.time-scroll');
          const viewport = scroller.getBoundingClientRect();
          const bounds = [element, element.querySelector('time')].map((item) =>
            item.getBoundingClientRect(),
          );
          return (
            scroller.scrollTop === 0 &&
            bounds.every(
              (box) =>
                box.top >= Math.max(0, viewport.top) &&
                box.bottom <= Math.min(innerHeight, viewport.bottom) &&
                box.left >= Math.max(0, viewport.left) &&
                box.right <= Math.min(innerWidth, viewport.right),
            )
          );
        }),
      )
      .toBe(true);
    assert.equal(await midnight.evaluate((element) => parseFloat(element.style.top)), 0);
    await expect(page.locator('.time-header .today strong')).toHaveText('24');
    await capture(app, page, '04-midnight-label-visible');
    assert.deepEqual(errors, []);
    assert.deepEqual(await read(page, 'events'), originalEvents);
    console.log(
      'PASS calendar navigation: Week/Day now positioning, refresh keeps manual scroll, repeat Today, history/Month, safe event defaults including midnight, English/light/minimum width, midnight marker and label',
    );
    console.log('Evidence: ' + base);
  } finally {
    await app.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
