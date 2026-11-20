import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createFrameSession } from '@frame/logic/FrameSession.mjs';
import { attachKeyboardShortcuts } from '@frame/logic/KeyboardShortcuts.mjs';
import { createDiagnostics } from './layout/LayoutDiagnostics.mjs';
import { discoverComponents } from './layout/ComponentDiscovery.mjs';
import { validateFrameConfig } from './layout/ConfigValidation.mjs';
import WindowLayout from './layout/WindowLayout.jsx';
import './styles.css';

// LOGIC — discover, validate, then mount valid instances regardless of history capability.
const bootstrap = await window.frameHost.bootstrap();
document.title = bootstrap.config.window.title;
const diagnostics = createDiagnostics((records) => window.frameHost.diagnostics(records));
const catalog = await discoverComponents(import.meta.glob('./window/**/*.jsx'), diagnostics);
const initialPlan = validateFrameConfig(bootstrap.config, catalog, diagnostics);
const session = createFrameSession(initialPlan.history, {
  document: initialPlan.document, output: initialPlan.output, rotation: initialPlan.rotation, size: initialPlan.size, view: initialPlan.view,
  transport: window.frameHost, windowState: bootstrap.windowState, diagnostics,
});
let reconfigure;
let toggleInspection;

// UI — one generic layout; a missing capability does not delete unrelated controls.
function FrameApp() {
  const [plan, setPlan] = useState(initialPlan);
  const [generation, setGeneration] = useState(0);
  const [inspection, setInspection] = useState(bootstrap.inspectionRequested);
  reconfigure = (raw) => {
    setPlan(validateFrameConfig(raw, catalog, diagnostics));
    setGeneration((value) => value + 1);
  };
  toggleInspection = setInspection;
  return <WindowLayout plan={plan} session={session} diagnostics={diagnostics}
    inspection={bootstrap.development && inspection} generation={generation} />;
}

// LOGIC — development-only proof access, never seeded history or filesystem access.
if (bootstrap.development && bootstrap.inspectionRequested) {
  window.frameDev = {
    commit: session.commit,
    snapshot: session.getSnapshot,
    setOutputWidth: session.setOutputWidth,
    config: structuredClone(bootstrap.config),
    catalog: catalog.map(({ componentId, filePath, folder }) => ({ componentId, filePath, folder })),
    reconfigure: (raw) => reconfigure(raw),
    inspect: (enabled) => toggleInspection(Boolean(enabled)),
    records: diagnostics.getSnapshot,
    flush: diagnostics.flush,
    logPath: bootstrap.logPath,
  };
}
const detachKeyboardShortcuts = attachKeyboardShortcuts(session);
window.addEventListener('pagehide', () => { detachKeyboardShortcuts(); session.dispose(); }, { once: true });
createRoot(document.getElementById('root')).render(<FrameApp />);
