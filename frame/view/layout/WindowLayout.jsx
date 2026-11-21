import React, { useSyncExternalStore } from 'react';
import Box from '@mui/material/Box';
import { configuredAppearance as appearance, configuredSx, configuredBounds, boundsStyle } from '@ui/appearance.mjs';
import LayoutInspector from './LayoutInspector.jsx';

// LOGIC — isolate a render-time control failure at its owning instance.
class ComponentBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) {
    const { node, diagnostics } = this.props;
    diagnostics.report({ code: 'COMPONENT_RENDER_FAILED', componentId: node.componentId, instanceId: node.id, filePath: node.filePath, configPath: node.configPath, expected: 'renderable control', actual: error.message });
  }
  render() { return this.state.failed ? null : this.props.children; }
}

// UI — unified assembly consumes validated results only, never named-control imports.
export default function WindowLayout({ plan, session, diagnostics, inspection, generation }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const issues = state.diagnostics ?? [];
  const settings = plan.development;
  const inspect = inspection && settings;
  // The validated plan owns mode/tracks; losing a section cannot silently switch layout mechanisms.
  const flow = plan.sectionLayout?.mode === 'vertical-flow';
  return (
    <main className="frame-root" data-ready="true" style={{ backgroundColor: plan.window?.background,
      ...(flow ? { display: 'grid', gridTemplateRows: plan.sectionLayout.tracks.join(' '), alignContent: 'start' } : {}),
    }}>
      {plan.sections.map((section) => (
        <Box component="section" key={section.id} id={section.id} aria-label={section.label}
          className={`frame-section${section.draggable ? ' frame-drag' : ''}`}
          sx={{ ...boundsStyle(section.bounds), ...configuredSx(section),
            ...(flow ? { position: 'relative', top: 'auto', height: 'auto', gridRow: plan.sectionLayout.rows[section.id] } : {}),
            ...(section.sizing === 'content' ? { containerType: 'inline-size' } : {}),
          }}>
          {inspect && <LayoutInspector node={section} settings={settings} />}
          <div className={section.nativeSafeArea ? 'native-safe-area' : 'frame-section-content'} data-section-content={section.id}
            style={section.sizing === 'content' ? { height: 'auto', containerType: 'inline-size' } : undefined}>
            {plan.instances.filter((node) => node.parentId === section.id).map((node) => {
              const Component = node.Component;
              return <div key={`${node.id}-${generation}`} className="frame-slot"
                data-drag-region={node.interaction?.dragRegion ?? 'no-drag'}
                data-instance={node.id} data-component={node.componentId} data-parent={node.parentId} data-source={node.filePath}
                style={{ ...configuredBounds(node), pointerEvents: node.interaction?.pointerEvents ?? 'auto',
                  ...(section.sizing === 'content' ? { position: 'relative', top: 'auto', height: 'auto', containerType: 'inline-size' } : {}),
                }}>
                <ComponentBoundary node={node} diagnostics={diagnostics}>
                  <Component config={node} state={state} actions={session} />
                </ComponentBoundary>
                {inspect && <LayoutInspector node={node} source={node.filePath} settings={settings} />}
              </div>;
            })}
          </div>
        </Box>
      ))}
      {inspect && <output className="layout-summary" data-history={JSON.stringify(state)} style={{ ...boundsStyle(settings.summary.bounds), ...appearance(settings.summary) }}>
        <span>Inspection · {JSON.stringify(state.document)} · {issues.length} diagnostic(s)</span>
        {plan.instances.map((node) => <span key={node.id}>{node.componentId} / {node.id} → {node.parentId} · {node.filePath}</span>)}
      </output>}
    </main>
  );
}
