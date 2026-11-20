import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createFrameSession } from '../logic/FrameSession.mjs';
import { createDiagnostics } from '../view/layout/LayoutDiagnostics.mjs';
import { validateFrameConfig } from '../view/layout/ConfigValidation.mjs';

const raw = JSON.parse(fs.readFileSync(new URL('../config.json', import.meta.url), 'utf8'));

test('session delivers initial and live diagnostics without erasing file messages, and unsubscribes', async () => {
  const diagnostics = createDiagnostics(async () => ({ ok: false, error: 'read-only log' }));
  diagnostics.report({ code: 'INITIAL_LAYOUT_ERROR' });
  const session = createFrameSession(raw.history, { document: raw.document, output: raw.output, diagnostics });
  const initialMessage = session.getSnapshot().message;
  assert.equal(session.getSnapshot().diagnostics[0].code, 'INITIAL_LAYOUT_ERROR');
  let publications = 0;
  session.subscribe(() => publications++);
  diagnostics.report({ code: 'PREVIEW_ERROR' });
  assert.equal(session.getSnapshot().diagnostics.length, 2);
  assert.equal(session.getSnapshot().message, initialMessage);
  assert.equal(publications, 1);
  await diagnostics.flush();
  assert.ok(session.getSnapshot().diagnostics.some((issue) => issue.code === 'LOG_WRITE_FAILED'));
  session.dispose();
  const stopped = session.getSnapshot();
  diagnostics.report({ code: 'AFTER_DISPOSAL' });
  assert.equal(session.getSnapshot(), stopped);
});

test('section sizing is configured, validated, and isolates only malformed sections', () => {
  const config = structuredClone(raw);
  config.instances = [];
  const diagnostics = createDiagnostics();
  const plan = validateFrameConfig(config, [], diagnostics);
  assert.deepEqual(diagnostics.getSnapshot(), []);
  assert.equal(plan.sections.find((node) => node.id === 'frameBody').sizing, 'remaining');
  assert.equal(plan.sections.find((node) => node.id === 'bottomBar').sizing, 'content');
  config.sections.find((node) => node.id === 'bottomBar').sizing = 'mistyped';
  const invalid = validateFrameConfig(config, [], diagnostics);
  assert.equal(invalid.sections.length, 3);
  assert.ok(diagnostics.getSnapshot().some((issue) => issue.configPath === 'sections[3].sizing'));
});
