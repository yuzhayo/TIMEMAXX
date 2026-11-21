import React from 'react';
import { configuredAppearance as appearance, boundsStyle, fill } from '@ui/appearance.mjs';

// UI — outlines/labels use configured visuals and never capture control input.
export default function LayoutInspector({ node, source, settings }) {
  // The full identity/path is readable in the inspector summary; local badges
  // identify the outlined node without squeezing a path into a small button.
  const label = node.id;
  return (
    <div className="layout-inspector" aria-hidden="true" data-inspection={node.id} data-source={source} style={{ ...fill, ...appearance(settings.inspector) }}>
      <span style={{ ...boundsStyle(settings.label.bounds), ...appearance(settings.label) }}>{label}</span>
    </div>
  );
}
