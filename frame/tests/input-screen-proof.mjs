import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const inputRoot = path.resolve(root, '../ui-control');
const inputConfigPath = path.join(inputRoot, 'config.json');
const config = JSON.parse(await fs.readFile(inputConfigPath, 'utf8'));
const artifacts = path.join(root, '.runtime/checks/input-screen');
await fs.mkdir(artifacts, { recursive: true });
process.env.ELECTRON_CACHE = path.join(root, '.runtime/electron-cache');
process.env.electron_config_cache = process.env.ELECTRON_CACHE;
const { _electron } = require('playwright-core');
const app = await _electron.launch({ executablePath: require('electron'),
  args: [root, '--layout-proof', '--inspect-layout'], cwd: root, timeout: 20000 });
const child = app.process();
const errors = [];
const metrics = [];
let finished = false;
const clipboardText = () => app.evaluate(({ clipboard }) => clipboard.readText());
// Clipboard writes cross the Electron boundary asynchronously; poll instead of
// assuming the OS clipboard is updated by the time the click resolves.
const copyAndWait = async (page, selector, expected, message) => {
  await app.evaluate(({ clipboard }) => clipboard.writeText(''));
  await page.locator(selector).dblclick();
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await clipboardText() === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(await clipboardText(), expected, message);
};

const inputCount = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
  .filter((win) => !win.isDestroyed() && !win.webContents.isDestroyed() && win.webContents.getURL().includes('/ui-control/view-built/index.html')).length);
const closeInput = async (page) => {
  const closed = page.waitForEvent('close');
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('/ui-control/view-built/index.html'));
    return new Promise((resolve) => { win.once('closed', resolve); win.close(); });
  });
  await closed;
};
const captureNative = async (page, name, pair = false) => {
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('/ui-control/view-built/index.html'));
    win.show(); win.focus();
  });
  // Allow the native show/resize animation to settle for visual evidence only.
  await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const next = () => { if (++frames === 20) resolve(); else requestAnimationFrame(next); };
    requestAnimationFrame(next);
  }));
  // Windows omits owned child windows from window-source inventory. Retain only
  // Input's exact native rectangle; the rest of the monitor is never written.
  const native = await app.evaluate(async ({ BrowserWindow, desktopCapturer, screen }, includeFrame) => {
    const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('/ui-control/view-built/index.html'));
    let bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    if (includeFrame) {
      const frame = win.getParentWindow().getBounds();
      bounds = { x: bounds.x, y: Math.min(bounds.y, frame.y), width: frame.x + frame.width - bounds.x,
        height: Math.max(bounds.y + bounds.height, frame.y + frame.height) - Math.min(bounds.y, frame.y) };
    }
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: {
      width: Math.round(display.bounds.width * display.scaleFactor), height: Math.round(display.bounds.height * display.scaleFactor) } });
    const source = sources.find((item) => item.display_id === String(display.id));
    if (!source) throw new Error('Input monitor is unavailable for native capture');
    const size = source.thumbnail.getSize(), xScale = size.width / display.bounds.width, yScale = size.height / display.bounds.height;
    const image = source.thumbnail.crop({ x: Math.round((bounds.x - display.bounds.x) * xScale),
      y: Math.round((bounds.y - display.bounds.y) * yScale), width: Math.round(bounds.width * xScale), height: Math.round(bounds.height * yScale) });
    return { png: image.toPNG().toString('base64'), visible: win.isVisible() };
  }, pair);
  assert.equal(native.visible, true);
  assert.ok(native.png, 'Native Input rectangle was captured');
  await fs.writeFile(path.join(artifacts, `${name}-native.png`), Buffer.from(native.png, 'base64'));
};
const checkInput = async (page, settings, name) => {
  page.on('pageerror', (error) => errors.push(error.message));
  await page.waitForSelector('main[aria-label="Input"]');
  await page.evaluate(() => window.inputDev?.inspect(false));
  await page.waitForFunction(() => document.querySelector('[data-input-stack]') !== null);
  assert.equal(await page.locator('[data-section-card]').count(), 4, 'Input renders the enabled language, code-generator, time and date cards');
  assert.equal(await page.locator('[data-input-stack] > *').count(), 4, 'Input content area holds only configured section slots');
  assert.equal(await page.locator('[data-instance="placeholder"]').count(), 0, 'the disabled placeholder chassis never mounts');
  assert.equal(await page.getByRole('combobox').count(), 4, 'language, time format, date day and date month own one dropdown each');
  assert.equal(await page.locator('canvas, img, iframe').count(), 0);
  assert.deepEqual(await page.evaluate(() => ({ host: typeof window.frameHost, node: typeof require })),
    { host: 'undefined', node: 'undefined' });
  assert.deepEqual(await page.evaluate(() => Object.keys(window.inputHost).sort()), ['bootstrap', 'code', 'diagnostics', 'state'],
    'the bridge exposes only config, persisted selections, the generated code and diagnostics');
  const native = await app.evaluate(async ({ BrowserWindow, screen }) => {
    const win = BrowserWindow.getAllWindows().find((item) => item.webContents.getURL().includes('/ui-control/view-built/index.html'));
    const preferences = win.webContents.getLastWebPreferences();
    const color = await win.webContents.capturePage({ x: 2, y: 50, width: 1, height: 1 });
    const frame = win.getParentWindow();
    return { title: win.getTitle(), bounds: win.getBounds(), contentBounds: win.getContentBounds(),
      area: screen.getDisplayMatching(frame.getBounds()).workArea, parent: frame.id, frame: frame.getBounds(),
      modal: win.isModal(), color: [...color.toBitmap().subarray(0, 4)],
      isolation: preferences.contextIsolation, node: preferences.nodeIntegration, sandbox: preferences.sandbox };
  });
  assert.equal(native.title, settings.title);
  assert.equal(native.bounds.width, Math.round(native.frame.width * settings.width.percent / 100));
  assert.equal(native.bounds.height, Math.round(native.area.height * settings.height.percent / 100));
  assert.equal(native.bounds.x + native.bounds.width, native.frame.x, 'Input touches the left boundary of Frame');
  assert.equal(native.bounds.y, native.area.y);
  assert.deepEqual(native.contentBounds, native.bounds, 'No native caption, border or Windows-Bar area is reserved');
  assert.equal(native.modal, false);
  assert.ok(native.parent);
  assert.equal(native.isolation, true); assert.equal(native.node, false); assert.equal(native.sandbox, true);
  const rgb = settings.background.slice(1).match(/../g).map((value) => parseInt(value, 16));
  assert.deepEqual(native.color, [rgb[2], rgb[1], rgb[0], 255], 'Input background consumes its JSON');
  const geometry = await page.evaluate(() => {
    const box = document.querySelector('main').getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height, viewport: [innerWidth, innerHeight],
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight] };
  });
  assert.equal(geometry.x, 0); assert.equal(geometry.y, 0);
  assert.deepEqual([geometry.width, geometry.height], geometry.viewport);
  assert.deepEqual(geometry.viewport, [native.bounds.width, native.bounds.height]);
  assert.deepEqual(geometry.scroll, geometry.viewport);
  // The generated code stays format-valid and the two controls share one proportional height.
  const shown = await page.locator('[data-code-value]').evaluate((element) => element.value);
  assert.match(shown, /^[ABCDEGHKLMNPRTUWXY123469]{14}$/, 'the value box shows a format-valid code');
  assert.ok(!'469'.includes(shown[0]), 'the code never leads with an unreachable symbol');
  const generatorConfig = config.sections.find((section) => section.id === 'codeGenerator');
  const controls = await page.evaluate(() => {
    const box = document.querySelector('[data-code-value]');
    const button = document.querySelector('[data-code-generate]');
    return { box: box.getBoundingClientRect().height, button: button.getBoundingClientRect().height,
      boxPad: parseFloat(getComputedStyle(box).paddingTop), buttonPad: parseFloat(getComputedStyle(button).paddingTop),
      stack: document.querySelector('[data-input-stack]').getBoundingClientRect().height };
  });
  assert.ok(Math.abs(controls.box - controls.button) < 1, 'value box and button share one row height');
  assert.ok(controls.box >= 30 && controls.box <= 44, `a comfortable click target, measured ${controls.box}`);
  assert.ok(Math.abs(controls.boxPad - controls.stack * generatorConfig.parts.value.geometry.paddingY / 100) < 1,
    'the value box height comes from configured paddingY, not hardcoded pixels');
  assert.ok(Math.abs(controls.buttonPad - controls.stack * generatorConfig.parts.generate.geometry.paddingY / 100) < 1,
    'the button height comes from configured paddingY, not hardcoded pixels');
  // The time section: configured hour format, colon-only display and one
  // proportional row height for the value box and its picker trigger.
  const timeConfig = config.sections.find((section) => section.id === 'time');
  const hourFormat = await page.locator('[data-hour-format-select]').evaluate((element) => element.value);
  assert.ok(['12', '24'].includes(hourFormat), 'the time dropdown selects a supported hour format');
  const timePattern = hourFormat === '12'
    ? /^(0[1-9]|1[0-2]):[0-5]\d (AM|PM)$/ : /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  const timeBoxes = await page.evaluate(() => {
    const read = (selector) => {
      const element = document.querySelector(selector);
      return { text: element.value || element.textContent, height: element.getBoundingClientRect().height,
        pad: parseFloat(getComputedStyle(element).paddingTop) };
    };
    return { main: read('[data-time-value="main"]'), from: read('[data-time-value="from"]'), to: read('[data-time-value="to"]'),
      stack: document.querySelector('[data-input-stack]').getBoundingClientRect().height,
      popup: document.querySelectorAll('[data-popover-surface]').length };
  });
  assert.match(timeBoxes.main.text, timePattern, 'the main value box shows its configured time format');
  assert.match(timeBoxes.from.text, timePattern, 'the range start shows its configured time format');
  assert.match(timeBoxes.to.text, timePattern, 'the range end shows its configured time format');
  for (const value of [timeBoxes.main.text, timeBoxes.from.text, timeBoxes.to.text]) {
    assert.ok(!value.includes('.'), 'a time mark never uses a dot');
  }
  assert.equal(timeBoxes.popup, 0, 'pickers stay closed until their trigger is used');
  assert.ok(Math.abs(timeBoxes.from.height - timeBoxes.to.height) < 1, 'both range bounds share one row height');
  for (const value of [timeBoxes.main, timeBoxes.from, timeBoxes.to]) {
    assert.ok(value.height >= 30 && value.height <= 44, `a comfortable click target, measured ${value.height}`);
  }
  assert.ok(Math.abs(timeBoxes.main.pad - timeBoxes.stack * timeConfig.parts.value.geometry.paddingY / 100) < 1,
    'the time value height comes from configured paddingY, not hardcoded pixels');
  const dateValue = await page.locator('[data-date-value]').evaluate((element) => element.value);
  assert.match(dateValue, /^(?:0[1-9]|[12]\d|3[01])\/(?:0[1-9]|1[0-2])\/\d{4}$/,
    'the date value box shows DD/MM/YYYY');
  assert.equal(await page.locator('[data-date-day] option').count(), 2, 'the day dropdown offers full and short names');
  assert.equal(await page.locator('[data-date-month] option').count(), 2, 'the month dropdown offers full and short names');
  await page.screenshot({ path: path.join(artifacts, `${name}.png`) });
  await captureNative(page, name);
  if (name === 'startup') await captureNative(page, 'input-beside-frame', true);
  metrics.push({ name, native, geometry });
};

try {
  const frame = await app.firstWindow();
  frame.on('pageerror', (error) => errors.push(error.message));
  await frame.waitForSelector('#orphanEdit');
  await frame.evaluate(() => window.frameDev.inspect(false));
  assert.equal(await inputCount(), 0, 'Input is not created at Frame startup');
  const before = await frame.evaluate(() => window.frameDev.snapshot());
  // Seed the persisted state: the first open must restore this selection, not the config default.
  const statePath = path.join(inputRoot, 'state.json');
  const codePath = path.join(inputRoot, 'code.json');
  await fs.writeFile(statePath, JSON.stringify({ schemaVersion: 1, sections: { language: { language: 'id' },
    time: { hourFormat: '12' } } }, null, 2));
  await fs.writeFile(codePath, JSON.stringify({ schemaVersion: 1, code: 'UBDCEAAU9R2PAC' }, null, 2));
  const frameBounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds());
  let [input] = await Promise.all([app.waitForEvent('window'), frame.click('#orphanEdit')]);
  await checkInput(input, config.window, 'startup');
  assert.equal(await inputCount(), 1);

  // The enabled cards: header toggles expand/collapse, body mounts inside, and a
  // content-sized slot hugs its card so sections stack tightly.
  const cardGeometry = () => input.evaluate(() => {
    const card = document.querySelector('[data-instance="language"] [data-section-card]');
    const body = document.querySelector('[data-instance="language"] [data-section-body]');
    const header = document.querySelector('[data-instance="language"] [data-section-header]');
    const style = getComputedStyle(header);
    return { slot: card.parentElement.getBoundingClientRect().height, card: card.getBoundingClientRect().height,
      body: body ? body.getBoundingClientRect().height : 0,
      headerPad: parseFloat(style.paddingTop), header: header.getBoundingClientRect().height,
      expanded: header.getAttribute('aria-expanded') };
  });
  const open = await cardGeometry();
  assert.equal(open.expanded, 'true');
  assert.ok(open.body > 0, 'expanded body mounts inside the card');
  assert.ok(Math.abs(open.slot - open.card) < 1, 'a content-sized slot hugs its card instead of reserving empty space');
  const spacing = await input.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-section-card]')];
    return { gap: cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().bottom,
      stack: document.querySelector('[data-input-stack]').getBoundingClientRect().height };
  });
  assert.ok(spacing.gap >= 0 && spacing.gap < spacing.stack * 0.05, 'sections stack tightly, separated only by the configured gap');
  const headerPaddingY = config.sections.find((section) => section.id === 'language').parts.header.geometry.paddingY;
  assert.ok(Math.abs(open.headerPad - spacing.stack * headerPaddingY / 100) < 1,
    'header height is driven by configured paddingY, not hardcoded');
  assert.ok(open.header > 36, 'the raised header is a comfortable target');
  await input.locator('[data-instance="language"] [data-section-header]').click();
  const shut = await cardGeometry();
  assert.equal(shut.expanded, 'false', 'header click collapses the card');
  assert.equal(shut.body, 0, 'collapsed card removes the body');
  assert.ok(shut.card < open.card, 'collapsed card is shorter than expanded');
  await input.locator('[data-instance="language"] [data-section-header]').click();
  assert.equal((await cardGeometry()).expanded, 'true', 'second click expands the card again');

  // The language section: state.json restores the last choice and saves new ones.
  const select = input.locator('[data-instance="language"] [data-language-select]');
  assert.deepEqual(await select.locator('option').evaluateAll((options) => options.map((option) => option.value)),
    ['en', 'id'], 'the dropdown lists English and Indonesian');
  assert.equal(await select.evaluate((element) => element.value), 'id', 'the seeded selection is restored from state.json');
  assert.equal(await input.locator('[data-instance="language"] [data-section-header]').textContent(), 'Bahasa',
    'the restored selection drives the whole locale layout');
  assert.equal(await input.evaluate(() => document.querySelector('main').getAttribute('lang')), 'id');
  const readState = async () => { try { return JSON.parse(await fs.readFile(statePath, 'utf8')); } catch { return null; } };
  await select.selectOption('en');
  await input.waitForFunction(() => document.querySelector('[data-instance="language"] [data-section-header]')?.textContent === 'Language');
  assert.equal((await input.evaluate(() => window.inputDev.snapshot())).language, 'en', 'the dropdown still owns the layout language');
  assert.equal((await input.evaluate(() => window.inputDev.snapshot())).expanded.language, true,
    'expand/collapse state survives a language switch');
  let persistedState = await readState();
  for (let attempt = 0; attempt < 50 && persistedState?.sections?.language?.language !== 'en'; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    persistedState = await readState();
  }
  assert.deepEqual(persistedState, { schemaVersion: 1, sections: { language: { language: 'en' }, time: { hourFormat: '12' } } },
    'choosing a language saves one bucket for the language section while the time selection stays its own');

  // The code generator: restore, double-click copy, generate and store one dynamic value.
  const codeValue = () => input.locator('[data-code-value]').evaluate((element) => element.value);
  const readCode = async () => { try { return JSON.parse(await fs.readFile(codePath, 'utf8')); } catch { return null; } };
  assert.equal(await codeValue(), 'UBDCEAAU9R2PAC', 'the seeded code is restored from code.json');
  await copyAndWait(input, '[data-code-value]', 'UBDCEAAU9R2PAC', 'double-clicking the value box copies it');
  await input.locator('[data-code-generate]').click();
  const generated = await codeValue();
  assert.notEqual(generated, 'UBDCEAAU9R2PAC', 'Generate replaces the value');
  assert.match(generated, /^[ABCDEGHKLMNPRTUWXY123469]{14}$/, 'the generated code keeps the format rules');
  const storedCodeValue = async () => (await readCode())?.sections?.codeGenerator?.code;
  let storedCode = await readCode();
  for (let attempt = 0; attempt < 50 && (await storedCodeValue()) !== generated; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    storedCode = await readCode();
  }
  assert.equal(await storedCodeValue(), generated, 'Generate replaces the code bucket without a log');
  assert.deepEqual(Object.keys(storedCode).sort(), ['schemaVersion', 'sections'], 'code.json is a generic sections envelope');
  assert.ok(storedCode.sections.time, 'the time bucket sits beside the code bucket');
  await input.locator('[data-code-generate]').click();
  const second = await codeValue();
  assert.notEqual(second, generated, 'each Generate produces a new value');
  for (let attempt = 0; attempt < 50 && (await storedCodeValue()) !== second; attempt++) await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await storedCodeValue(), second, 'a second generate overwrites, it does not append');

  // The time section: the shared format dropdown, the shared popup picker, copy
  // and one generated value inside the two range bounds.
  const timeValue = () => input.locator('[data-time-value="main"]').evaluate((element) => element.value);
  const formatSelect = input.locator('[data-hour-format-select]');
  assert.deepEqual(await formatSelect.locator('option').evaluateAll((options) => options.map((option) => [option.value, option.textContent])),
    [['24', '24 hour'], ['12', '12 hour']], 'the format dropdown offers 24 and 12 hour, default 24');
  assert.equal(await formatSelect.evaluate((element) => element.value), '12',
    'the seeded hour format is restored from state.json');
  assert.match(await timeValue(), /^(0[1-9]|1[0-2]):[0-5]\d (AM|PM)$/);
  assert.equal(await input.locator('[data-time-value="from"]').evaluate((element) => element.value), '08:00 AM');
  assert.equal(await input.locator('[data-time-value="to"]').evaluate((element) => element.value), '05:00 PM');
  await formatSelect.selectOption('24');
  await input.waitForFunction(() => /^\d{2}:\d{2}$/.test(document.querySelector('[data-time-value="main"]')?.value ?? ''));
  assert.equal(await input.locator('[data-time-value="from"]').evaluate((element) => element.value), '08:00', 'the hour format change reaches every value box');
  assert.equal(await input.locator('[data-time-value="to"]').evaluate((element) => element.value), '17:00');
  await input.locator('[data-time-value="main"]').fill('1430');
  assert.equal(await timeValue(), '14:30', 'four typed digits normalize in the main value box');
  await input.locator('[data-time-value="main"]').fill('2460');
  assert.equal(await timeValue(), '14:30', 'an out-of-range entry keeps the accepted time');
  await input.locator('[data-time-value="from"]').fill('0745');
  assert.equal(await input.locator('[data-time-value="from"]').evaluate((element) => element.value), '07:45');
  await input.locator('[data-time-value="to"]').fill('1615');
  assert.equal(await input.locator('[data-time-value="to"]').evaluate((element) => element.value), '16:15');
  await copyAndWait(input, '[data-time-value="main"]', '14:30',
    'double-clicking the main time value box copies the displayed time');
  await copyAndWait(input, '[data-time-value="from"]', '07:45',
    'double-clicking the range start copies its displayed time');
  await copyAndWait(input, '[data-time-value="to"]', '16:15',
    'double-clicking the range end copies its displayed time');

  // Every value box is its own picker trigger; no separate button or icon.
  assert.equal(await input.locator('[data-popover-trigger]').count(), 4,
    'the four value boxes are the only picker triggers');
  await input.locator('[data-time-value="main"]').click();
  await input.waitForSelector('[data-popover-surface]');
  await input.waitForSelector('[data-popover-surface]');
  assert.equal(await input.locator('[data-picker-hour] [data-time-option]').count(), 24, 'the picker lists 24 hours');
  assert.equal(await input.locator('[data-picker-minute] [data-time-option]').count(), 60, 'the picker lists 60 minutes');
  await input.screenshot({ path: path.join(artifacts, 'time-picker.png') });
  // The picker hides its scrollbar and scrolls through explicit wheel input.
  const minuteColumn = input.locator('[data-picker-minute]');
  const hidden = await minuteColumn.evaluate((node) => ({ css: getComputedStyle(node).scrollbarWidth,
    gutter: node.offsetWidth - node.clientWidth }));
  assert.equal(hidden.css, 'none', 'the picker does not render a native scrollbar');
  const pickerBorder = config.sections.find((section) => section.id === 'time').parts.pickerColumn.geometry.borderWidth;
  assert.equal(hidden.gutter, 2 * pickerBorder,
    'only the configured border remains; no scrollbar gutter is reserved');
  const column = await minuteColumn.boundingBox();
  const beforeScroll = await minuteColumn.evaluate((node) => node.scrollTop);
  await input.mouse.move(column.x + column.width / 2, column.y + column.height / 2);
  await input.mouse.wheel(0, 400);
  await input.waitForFunction((previous) => document.querySelector('[data-picker-minute]')?.scrollTop > previous, beforeScroll);
  const afterWheel = await minuteColumn.evaluate((node) => node.scrollTop);
  assert.ok(afterWheel > beforeScroll, `a mouse wheel scrolls the minute list (${beforeScroll} -> ${afterWheel})`);
  const hourColumn = input.locator('[data-picker-hour]');
  const hourBefore = await hourColumn.evaluate((node) => node.scrollTop);
  const hourBox = await hourColumn.boundingBox();
  await input.mouse.move(hourBox.x + hourBox.width / 2, hourBox.y + hourBox.height / 2);
  const hourDelta = hourBefore > 10 ? -300 : 300;
  await input.mouse.wheel(0, hourDelta);
  await input.waitForFunction((previous) => document.querySelector('[data-picker-hour]')?.scrollTop !== previous, hourBefore);
  assert.notEqual(await hourColumn.evaluate((node) => node.scrollTop), hourBefore,
    'the same wheel input scrolls the hour list');
  await input.locator('[data-time-option="hour-14"]').click();
  await input.locator('[data-time-option="minute-30"]').click();
  assert.equal(await timeValue(), '14:30', 'the main box picker updates its value');
  await input.keyboard.press('Escape');
  await input.waitForSelector('[data-popover-surface]', { state: 'detached' });
  await input.locator('[data-time-value="from"]').click();
  await input.waitForSelector('[data-popover-surface]');
  await input.locator('[data-time-option="hour-07"]').click();
  await input.locator('[data-time-option="minute-45"]').click();
  await input.keyboard.press('Escape');
  assert.equal(await input.locator('[data-time-value="from"]').evaluate((element) => element.value), '07:45',
    'the range start box owns its own picker');
  await input.locator('[data-time-value="to"]').click();
  await input.waitForSelector('[data-popover-surface]');
  await input.locator('[data-time-option="hour-16"]').click();
  await input.locator('[data-time-option="minute-15"]').click();
  await input.keyboard.press('Escape');
  assert.equal(await input.locator('[data-time-value="to"]').evaluate((element) => element.value), '16:15',
    'the range end box owns its own picker');
  let storedTime = (await readCode())?.sections?.time;
  for (let attempt = 0; attempt < 50 && storedTime?.value !== '14:30'; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    storedTime = (await readCode())?.sections?.time;
  }
  assert.deepEqual(storedTime, { value: '14:30', from: '07:45', to: '16:15', hourFormat: '24' },
    'every stored time change is auto-saved in code.json');
  for (let draw = 0; draw < 20; draw++) {
    await input.locator('[data-time-generate]').click();
    const picked = await timeValue();
    const minutes = Number(picked.slice(0, 2)) * 60 + Number(picked.slice(3, 5));
    assert.ok(minutes >= 7 * 60 + 45 && minutes <= 16 * 60 + 15, `${picked} stays inside the configured range`);
  }
  await formatSelect.selectOption('12');
  await input.waitForFunction(() => /(AM|PM)$/.test(document.querySelector('[data-time-value="main"]')?.value ?? ''));
  assert.equal(await input.locator('[data-time-value="from"]').evaluate((element) => element.value), '07:45 AM');
  assert.equal(await input.locator('[data-time-value="to"]').evaluate((element) => element.value), '04:15 PM');
  for (const attribute of ['main', 'from', 'to']) {
    const shownTime = await input.locator(`[data-time-value="${attribute}"]`).evaluate((element) => element.value);
    assert.ok(!shownTime.includes('.'), 'the 12-hour display also keeps the colon separator');
  }
  persistedState = await readState();
  for (let attempt = 0; attempt < 50 && persistedState?.sections?.time?.hourFormat !== '12'; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    persistedState = await readState();
  }
  assert.deepEqual(persistedState.sections.time, { hourFormat: '12' },
    'the hour format is saved as the time section own selection');

  // Date section: DD/MM/YYYY, a full-month grid, locale day/month names and
  // copy-on-double-click.
  const dateValue = () => input.locator('[data-date-value]').evaluate((element) => element.value);
  const dateDay = input.locator('[data-date-day]');
  const dateMonth = input.locator('[data-date-month]');
  const englishDay = await dateDay.locator('option').evaluateAll((options) => options.map((option) => option.textContent));
  assert.deepEqual(englishDay, ['Monday', 'Mon'], 'English day names offer full and short forms');
  assert.deepEqual(await dateMonth.locator('option').evaluateAll((options) => options.map((option) => option.textContent)),
    ['November', 'Nov'], 'English month names offer full and short forms');
  await dateDay.selectOption('short');
  await dateMonth.selectOption('short');
  assert.equal(await dateDay.evaluate((element) => element.selectedOptions[0].textContent), 'Mon');
  await select.selectOption('id');
  await input.waitForFunction(() => document.querySelector('[data-instance="date"] [data-section-header]')?.textContent === 'Tanggal');
  assert.deepEqual(await dateDay.locator('option').evaluateAll((options) => options.map((option) => option.textContent)),
    ['Senin', 'Sen'], 'Indonesian day names offer Senin and Sen');
  await select.selectOption('en');
  await input.waitForFunction(() => document.querySelector('[data-instance="date"] [data-section-header]')?.textContent === 'Date');
  const beforeDate = await dateValue();
  const [, monthPart, yearPart] = beforeDate.split('/');
  await input.locator('[data-date-value]').click();
  await input.waitForSelector('[data-popover-surface]');
  const cells = await input.locator('[data-date-cell]').count();
  assert.ok(cells >= 28 && cells <= 31, `the calendar shows a full month of ${cells} days`);
  await input.screenshot({ path: path.join(artifacts, 'date-picker.png') });
  const widths = await input.evaluate(() => ({
    surface: document.querySelector('[data-popover-surface]').getBoundingClientRect().width,
    value: document.querySelector('[data-date-value]').getBoundingClientRect().width,
  }));
  assert.ok(Math.abs(widths.surface - widths.value) < 2,
    `the calendar popup matches the value box width (${widths.surface} vs ${widths.value})`);
  await input.locator(`[data-date-cell$="-15"]`).click();
  assert.equal(await dateValue(), `15/${monthPart}/${yearPart}`, 'picking a calendar cell writes DD/MM/YYYY');
  await input.keyboard.press('Escape');
  await copyAndWait(input, '[data-date-value]', `15/${monthPart}/${yearPart}`,
    'double-clicking the date value copies it');
  let storedDate = (await readCode())?.sections?.date;
  for (let attempt = 0; attempt < 50 && storedDate?.value !== `15/${monthPart}/${yearPart}`; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    storedDate = (await readCode())?.sections?.date;
  }
  assert.deepEqual(storedDate, { value: `15/${monthPart}/${yearPart}`, dayMode: 'short', monthMode: 'short' },
    'every date change is auto-saved in the date bucket');

  const firstId = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find((win) => win.webContents.getURL().includes('/ui-control/view-built/index.html')).id);
  assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot()), before);
  assert.equal(await inputCount(), 1);
  const firstClosed = input.waitForEvent('close');
  await frame.click('#orphanEdit');
  await firstClosed;
  assert.equal(await inputCount(), 0);
  assert.equal(await frame.locator('#fileControls-save').isEnabled(), true);

  const frameConfig = JSON.parse(await fs.readFile(path.join(root, 'config.json'), 'utf8'));
  await app.evaluate(({ BrowserWindow }, settings) => BrowserWindow.getAllWindows()[0]
    .setSize(settings.minWidth, settings.minHeight), frameConfig.window);
  await frame.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  [input] = await Promise.all([app.waitForEvent('window'), frame.click('#orphanEdit')]);
  await checkInput(input, config.window, 'frame-minimum');
  assert.equal(await input.locator('[data-instance="language"] [data-language-select]').evaluate((element) => element.value), 'en',
    'a reopened Input restores the language saved on the previous visit');
  assert.equal(await input.locator('[data-code-value]').evaluate((element) => element.value), second,
    'a reopened Input restores the generated code from code.json');
  assert.equal(await input.locator('[data-hour-format-select]').evaluate((element) => element.value), '12',
    'a reopened Input restores the hour format saved on the previous visit');
  assert.equal(await input.locator('[data-time-value="from"]').evaluate((element) => element.value), '07:45 AM',
    'the reopened Input restores the saved range start');
  assert.equal(await input.locator('[data-time-value="to"]').evaluate((element) => element.value), '04:15 PM',
    'the reopened Input restores the saved range end');
  assert.match(await input.locator('[data-time-value="main"]').evaluate((element) => element.value), /(AM|PM)$/);
  assert.equal(await input.locator('[data-date-value]').evaluate((element) => element.value),
    `15/${monthPart}/${yearPart}`, 'a reopened Input restores the saved date');
  const expectedShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
    new Date(Date.UTC(Number(yearPart), Number(monthPart) - 1, 15)).getUTCDay()];
  assert.equal(await input.locator('[data-date-day]').evaluate((element) => element.selectedOptions[0].textContent),
    expectedShort, 'a reopened Input restores the short day label for the saved date');
  assert.notEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find((win) => win.webContents.getURL().includes('/ui-control/view-built/index.html')).id), firstId);
  const minimumClosed = input.waitForEvent('close');
  await frame.click('#orphanEdit');
  await minimumClosed;
  await app.evaluate(({ BrowserWindow }, bounds) => BrowserWindow.getAllWindows()[0].setBounds(bounds), frameBounds);
  await frame.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot()), before);

  // Five simultaneous commands must finish open, preserving toggle parity and one live Input.
  const rapid = await frame.evaluate(() => Promise.all(Array.from({ length: 5 }, () => window.frameHost.toggleInputScreen())));
  assert.deepEqual(rapid, Array.from({ length: 5 }, (_, index) => ({ ok: true, visible: index % 2 === 0 })));
  assert.equal(await inputCount(), 1);
  input = app.windows().find((page) => !page.isClosed() && page.url().includes('/ui-control/view-built/index.html'));
  assert.ok(input);
  await checkInput(input, config.window, 'rapid-reopened');
  const rapidClosed = input.waitForEvent('close');
  await frame.click('#orphanEdit');
  await rapidClosed;
  assert.equal(await inputCount(), 0);

  // Alternate JSON proves Input geometry/color consumption without editing source config or siblings.
  const variant = structuredClone(config);
  variant.window.width.percent = 35;
  variant.window.background = '#285776';
  variant.root.colors = { background: '#285776' };
  const variantPath = path.join(artifacts, 'variant.json');
  await fs.writeFile(variantPath, JSON.stringify(variant));
  [input] = await Promise.all([app.waitForEvent('window'), app.evaluate(async ({ BrowserWindow, screen, ipcMain }, options) => {
    const require = process.getBuiltinModule('module').createRequire(options.modulePath);
    const { createInputScreen } = require(options.modulePath);
    globalThis.inputProofVariant = createInputScreen({ BrowserWindow, screen, ipcMain, development: true, inspectionRequested: true,
      parent: BrowserWindow.getAllWindows()[0], configPath: options.configPath });
    await globalThis.inputProofVariant.toggle();
  }, { modulePath: path.join(inputRoot, 'screen.cjs'), configPath: variantPath })]);
  await checkInput(input, variant.window, 'config-variation');
  await closeInput(input);
  assert.deepEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds()), frameBounds);
  assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot()), before);

  // Fault only the Input JSON read at the native I/O boundary. Never modify the real file.
  await app.evaluate((_, configPath) => {
    const fs = process.getBuiltinModule('fs');
    globalThis.inputProofRead = fs.readFileSync;
    fs.readFileSync = function (file, ...args) {
      return String(file) === configPath ? '{"schemaVersion":1,"window":{"width":-1}}' : globalThis.inputProofRead.call(this, file, ...args);
    };
  }, inputConfigPath);
  try {
    await frame.click('#orphanEdit');
    await frame.waitForFunction(() => window.frameDev.records().some((issue) => issue.code === 'INPUT_SCREEN_TOGGLE_FAILED'));
    assert.equal(await inputCount(), 0);
    assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot().document), before.document);
    assert.deepEqual(await frame.evaluate(() => window.frameDev.snapshot().view), before.view);
    assert.equal(await frame.locator('#fileControls-load').isEnabled(), true);
    const failure = await frame.evaluate(() => window.frameDev.records().find((issue) => issue.code === 'INPUT_SCREEN_TOGGLE_FAILED'));
    assert.equal(failure.instanceId, 'orphanEdit');
    assert.match(failure.actual, /invalid Input window settings/);
    assert.match(await frame.locator('#fileStatus').textContent(), /Input/);
    const destination = path.join(artifacts, 'black-with-invalid-input.png');
    await app.evaluate(({ dialog }, file) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, destination);
    await frame.click('#fileControls-save');
    await frame.waitForFunction(() => window.frameDev.snapshot().message.startsWith('Saved ') && !window.frameDev.snapshot().busy);
    assert.deepEqual(await app.evaluate(({ nativeImage }, file) => nativeImage.createFromPath(file).getSize(), destination), { width: 1200, height: 1600 });
  } finally {
    await app.evaluate(() => { const fs = process.getBuiltinModule('fs'); fs.readFileSync = globalThis.inputProofRead; delete globalThis.inputProofRead; });
  }

  const [reopened] = await Promise.all([app.waitForEvent('window'), frame.click('#orphanEdit')]);
  input = reopened;
  await input.waitForSelector('main[aria-label="Input"]');
  assert.equal(await inputCount(), 1, 'Input reopens after the isolated failure');
  assert.notEqual(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()
    .find((win) => win.webContents.getURL().includes('/ui-control/view-built/index.html')).id), firstId);
  const records = await frame.evaluate(() => window.frameDev.records());
  assert.deepEqual(records.map((issue) => issue.code), ['INPUT_SCREEN_TOGGLE_FAILED']);
  assert.deepEqual(errors, []);
  await captureNative(input, 'reopened');
  // Damaged state must never block Input: the invalid selection is ignored, defaults apply.
  await closeInput(input);
  await fs.writeFile(statePath, JSON.stringify({ schemaVersion: 1, sections: { language: { language: 'xx' } } }));
  [input] = await Promise.all([app.waitForEvent('window'), frame.click('#orphanEdit')]);
  await input.waitForSelector('main[aria-label="Input"]');
  assert.equal(await input.locator('[data-instance="language"] [data-language-select]').evaluate((element) => element.value), 'en',
    'an invalid persisted selection falls back to the configured default');
  assert.equal(await input.locator('[data-hour-format-select]').evaluate((element) => element.value), '24',
    'a missing time bucket falls back to the configured 24-hour default');
  assert.equal(await input.evaluate(() => document.querySelector('main').getAttribute('lang')), 'en');
  await fs.writeFile(statePath, JSON.stringify({ schemaVersion: 1, sections: { language: { language: 'en' } } }, null, 2));
  const pencil = await frame.locator('#orphanEdit').evaluate((button) => {
    const box = button.getBoundingClientRect();
    return { fractionX: (box.x + box.width / 2) / innerWidth, fractionY: (box.y + box.height / 2) / innerHeight };
  });
  await fs.writeFile(path.join(artifacts, 'metrics.json'), JSON.stringify({ metrics, records, pencil }, null, 2));
  const inputClosed = input.waitForEvent('close');
  const frameClosed = frame.waitForEvent('close');
  const processExited = child.exitCode === null ? once(child, 'exit') : Promise.resolve();
  await frame.click('#windowClose');
  await Promise.all([inputClosed, frameClosed, processExited]);
  assert.equal(child.exitCode, 0);
  finished = true;
  console.log(JSON.stringify({ pass: true, checked: ['real pencil toggles frameless Input with the enabled language, code-generator, time and date cards',
    'the disabled placeholder chassis never mounts',
    'header expands/collapses the card and mounts the body inside',
    'a content-sized slot hugs its card and sections stack tightly',
    'header height comes from configured paddingY on every card',
    'language section hosts a global English/Indonesian dropdown that swaps the locale layout',
    'state.json restores the last chosen language on open',
    'choosing a language saves one bucket for that section',
    'a reopened Input restores the saved selection',
    'code.json restores the generated code on open',
    'double-clicking the value box copies it',
    'Generate replaces the code bucket in a generic sections envelope, never a log',
    'legacy top-level code in code.json is restored and migrated on write',
    'value box and button share one config-driven, comfortable height',
    'time section reuses the language dropdown for a 24/12-hour format with 24 as the default',
    'each value box is its own picker trigger; no separate button or icon',
    'the date value box shows DD/MM/YYYY and opens a full-month calendar on single click',
    'day and month dropdowns offer full and short locale names: Senin/Sen and Monday/Mon',
    'picking a calendar cell, copying and every dropdown change are auto-saved in sections.date',
    'the picker hides its scrollbar and mouse wheel scrolls both columns',
    'four typed digits normalize to colon time in every value box',
    'an out-of-range entry keeps the last accepted time',
    'double-clicking any time value box copies its displayed text',
    'the range bounds own separate pickers and Generate stays inside their inclusive range',
    'the three value boxes share the configured row height',
    'every time value change is auto-saved in the time bucket and restored on reopen',
    'every time display keeps a colon separator, including the 12-hour form',
    'damaged state never blocks Input and falls back to configured defaults',
    'expand/collapse state survives language switching',
    'scoped Input bootstrap and no Frame/file/data/preview bridge', 'rapid-click parity with one live window',
    '40% Frame width at startup/minimum', 'full work-area height', 'Input right edge touches Frame left edge',
    'no native caption or Windows-Bar space', 'JSON geometry/background without sibling changes', 'isolated Input configuration failure',
    'black export with invalid Input', 'no Frame/file/data/preview bridge', 'Input close leaves Frame alive', 'Frame close closes Input'], artifacts }, null, 2));
} finally {
  if (!finished) await app.close();
}
