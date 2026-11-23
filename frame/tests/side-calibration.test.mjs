import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCalibrationState, transformedGroupBox } from '../view/preview/SideTextCalibration.mjs';

test('side text calibration keeps Code and Verified transforms independent in frame coordinates', () => {
  const state = normalizeCalibrationState({ groups: {
    sideCode: { x: 12, y: -4, scaleX: 1.2, scaleY: 0.9, rotation: 3 },
    sideVerified: { x: -7, y: 9, scaleX: 0.8, scaleY: 1.1, rotation: -2 },
  } });
  assert.deepEqual(state.groups.sideCode, { x: 12, y: -4, scaleX: 1.2, scaleY: 0.9, rotation: 3 });
  assert.deepEqual(state.groups.sideVerified, { x: -7, y: 9, scaleX: 0.8, scaleY: 1.1, rotation: -2 });
  assert.deepEqual(transformedGroupBox({ x: 100, y: 200, width: 20, height: 100 }, state.groups.sideCode),
    { cx: 122, cy: 246, width: 24, height: 90, rotation: 3 });
});
