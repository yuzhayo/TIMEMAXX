import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import Box from '@mui/material/Box';
import { configuredSx, fill } from '@ui/appearance.mjs';
import { diagnosticSummary } from '@ui/LayoutDiagnostics.mjs';
import { compactDetailsPercent, resolveCompactLayout } from '@input/logic/CompactLayout.mjs';

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

const configuredParts = (node) => Object.entries(node.parts ?? {})
  .filter(([name, part]) => name !== 'header' && name !== 'details' && Number.isFinite(part?.bounds?.height));

// LOGIC — measure each child at its intrinsic height, then solve for the smallest
// card whose configured percentage slots still contain that content. Pixels are
// used only for measurement; the result is written back as a parent percentage.
function measureCompact(wrapper, node, stackHeight) {
  const content = wrapper.querySelector('[data-card-content]');
  if (!content || !stackHeight) return null;
  const parts = Array.from(content.children);
  const fractions = configuredParts(node).map(([, part]) => part.bounds.height);
  if (!parts.length || fractions.length !== parts.length) return null;
  const previousHeight = wrapper.style.height;
  wrapper.style.height = `${node.bounds.height}%`;
  try {
    const heights = parts.map((part) => {
      const style = getComputedStyle(part);
      const box = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']
        .reduce((total, key) => total + (parseFloat(style[key]) || 0), 0);
      const measured = [];
      const visit = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          if (!node.textContent.trim()) return;
          const range = document.createRange();
          range.selectNode(node);
          measured.push(range.getBoundingClientRect().height);
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches('input, textarea, select')) {
            const control = getComputedStyle(node);
            const size = parseFloat(control.fontSize);
            const leading = parseFloat(control.lineHeight);
            measured.push(Number.isFinite(leading) && leading > 0 ? leading : (Number.isFinite(size) && size > 0 ? size * 1.3 : 0));
          }
          Array.from(node.childNodes).forEach(visit);
        }
      };
      visit(part);
      const content = measured.length ? Math.max(...measured) : 0;
      if (!measured.length) return 0;
      return content + box;
    });
    return compactDetailsPercent({ heights, fractions, stackHeight });
  } finally {
    wrapper.style.height = previousHeight;
  }
}

// UI — one generic parent assembles validated sections; no named section imports/registry.
export default function InputLayout({ plan, session, diagnostics, development }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const records = useSyncExternalStore(diagnostics.subscribe, diagnostics.getSnapshot);
  const layout = plan.layouts[state.language];
  const stackRef = useRef(null);
  const wrappers = useRef(new Map());
  const [compact, setCompact] = useState({});
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return undefined;
    const observer = new ResizeObserver(() => setRevision((value) => value + 1));
    observer.observe(stack);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const stackHeight = stackRef.current?.clientHeight;
    if (!stackHeight || !layout) return;
    const next = {};
    for (const node of layout.sections) {
      if (node.sizing === 'fixed') continue;
      const wrapper = wrappers.current.get(node.id);
      if (!wrapper) continue;
      const measured = measureCompact(wrapper, node, stackHeight);
      if (measured !== null) next[node.id] = measured;
    }
    setCompact((current) => {
      const ids = new Set([...Object.keys(current), ...Object.keys(next)]);
      for (const id of ids) {
        if (Math.abs((current[id] ?? -1) - (next[id] ?? -1)) > 0.05) return next;
      }
      return current;
    });
  }, [layout, state.expanded, state.language, revision]);

  if (!plan.root) return null;
  const notice = records.length > 0 && plan.diagnostics;
  return <Box component="main" aria-label="Input" id={plan.root.id} data-ready="true" lang={state.language ?? undefined}
    sx={{ ...fill, ...configuredSx(plan.root), containerType: 'size' }}>
    <Box ref={stackRef} data-input-stack sx={{ width: '100%', height: notice ? `${100 - plan.diagnostics.height}%` : '100%', minHeight: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', rowGap: layout ? `${layout.gapY}%` : undefined, overflow: 'auto', containerType: 'size' }}>
      {layout?.sections.map((node) => {
        const Component = node.Component;
        const headerFraction = node.parts.header.bounds.height / 100;
        const detailsPercent = node.sizing === 'fixed'
          ? node.bounds.height * (1 - headerFraction)
          : (compact[node.id] ?? node.bounds.height * (1 - headerFraction));
        const resolved = resolveCompactLayout({ boundsHeight: node.bounds.height, headerFraction, detailsPercent });
        const height = state.expanded[node.id] ? resolved.cardPercent : resolved.collapsedPercent;
        const view = { ...node, parts: { ...node.parts,
          header: { ...node.parts.header, resolvedHeightPercent: resolved.headerPercentOfCard } } };
        return <Box key={node.id} ref={(element) => { if (element) wrappers.current.set(node.id, element); else wrappers.current.delete(node.id); }}
          data-instance={node.id} data-component={node.componentId} data-parent={node.parentId} data-source={node.filePath}
          data-compact={node.sizing === 'fixed' ? 'false' : 'true'}
          sx={{ width: `${node.bounds.width}%`, height: `${height}%`, minWidth: 0, minHeight: 0, flexShrink: 0, position: 'relative', containerType: 'size' }}>
          <SectionBoundary node={view} diagnostics={diagnostics}>
            <Component config={view} state={state} actions={session} languages={plan.languages} />
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
