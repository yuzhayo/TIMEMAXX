import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { discoverComponents } from '@ui/ComponentDiscovery.mjs';
import { createDiagnostics } from '@ui/LayoutDiagnostics.mjs';
import { validateInputConfig } from '@input/logic/InputConfig.mjs';
import { createInputSession } from '@input/logic/InputSession.mjs';
import InputLayout from './layout/InputLayout.jsx';
import './styles.css';

// LOGIC — Input-only bootstrap. Discover the full folder catalog before validation/mount.
const bootstrap = await window.inputHost.bootstrap();
document.title = bootstrap.config.window.title;
const diagnostics = createDiagnostics(window.inputHost.diagnostics);
const catalog = await discoverComponents(import.meta.glob('./sections/**/*.jsx'), diagnostics, 'sections');
const initialPlan = validateInputConfig(bootstrap.config, catalog, diagnostics);
const session = createInputSession(initialPlan, bootstrap.development && (bootstrap.inspectionRequested || initialPlan.development?.enabled));
let reconfigure;

// UI — the renderer entry only composes its generic layout and state owner.
function InputApp() {
  const [plan, setPlan] = useState(initialPlan);
  reconfigure = (raw) => setPlan(validateInputConfig(raw, catalog, diagnostics));
  return <InputLayout plan={plan} session={session} diagnostics={diagnostics} development={bootstrap.development} />;
}

// LOGIC — development-only proof/inspection surface; no Node/file or Frame operations.
if (bootstrap.development && bootstrap.inspectionRequested) window.inputDev = {
  snapshot: session.getSnapshot, setLanguage: session.setLanguage, setExpanded: session.setExpanded, inspect: session.inspect,
  records: diagnostics.getSnapshot, flush: diagnostics.flush, reconfigure: (raw) => reconfigure(raw),
  config: structuredClone(bootstrap.config), logPath: bootstrap.logPath,
};
window.addEventListener('pagehide', () => session.dispose(), { once: true });
createRoot(document.getElementById('root')).render(<InputApp />);
