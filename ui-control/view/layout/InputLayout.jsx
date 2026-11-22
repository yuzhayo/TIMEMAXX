import React, { useSyncExternalStore } from 'react';
import Box from '@mui/material/Box';
import { configuredSx, fill } from '@ui/appearance.mjs';
import { diagnosticSummary } from '@ui/LayoutDiagnostics.mjs';

// LOGIC — an isolated section render failure never removes valid siblings.
class SectionBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) {
    const { node, diagnostics } = this.props;
    diagnostics.report({ code: 'INPUT_SECTION_RENDER_FAILED', componentId: node.componentId, instanceId: node.id,
      parentId: node.parentId, filePath: node.filePath, configPath: node.configPath, expected: 'renderable section', actual: error.message, action: 'failed section skipped; siblings retained' });
  }
  render() { return this.state.failed ? null : this.props.children; }
}

// UI — one generic parent assembles validated sections; no named section imports/registry.
export default function InputLayout({ plan, session, diagnostics, development }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const records = useSyncExternalStore(diagnostics.subscribe, diagnostics.getSnapshot);
  const layout = plan.layouts[state.language];
  if (!plan.root) return null;
  const notice = records.length > 0 && plan.diagnostics;
  return <Box component="main" aria-label="Input" id={plan.root.id} data-ready="true" lang={state.language ?? undefined}
    sx={{ ...fill, ...configuredSx(plan.root), containerType: 'size' }}>
    <Box data-input-stack sx={{ width: '100%', height: notice ? `${100 - plan.diagnostics.height}%` : '100%', minHeight: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', rowGap: layout ? `${layout.gapY}%` : undefined, overflow: 'auto', containerType: 'size' }}>
      {layout?.sections.map((node) => {
        const Component = node.Component;
        return <Box key={node.id} data-instance={node.id} data-component={node.componentId} data-parent={node.parentId} data-source={node.filePath}
          sx={{ width: `${node.bounds.width}%`, height: `${node.bounds.height}%`, minWidth: 0, minHeight: 0, flexShrink: 0, position: 'relative', containerType: 'size' }}>
          <SectionBoundary node={node} diagnostics={diagnostics}>
            <Component config={node} state={state} actions={session} languages={plan.languages} />
          </SectionBoundary>
          {development && state.inspection && plan.development && <Box aria-hidden="true" data-inspection={node.id}
            sx={{ ...fill, ...configuredSx(plan.development.inspector), position: 'absolute', left: 0, top: 0,
              pointerEvents: 'none', zIndex: plan.development.inspector.zIndex }}>
            {`${node.componentId} / ${node.id} → ${node.parentId} · ${node.filePath}`}
          </Box>}
        </Box>;
      })}
    </Box>
    {notice && <Box component="output" role="status" data-input-diagnostics sx={{ width: '100%', height: `${plan.diagnostics.height}%`, ...configuredSx(plan.diagnostics) }}>{diagnosticSummary(records)}</Box>}
  </Box>;
}
