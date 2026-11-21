import React from 'react';
import Box from '@mui/material/Box';
import { configuredBounds, configuredSx, fill } from './appearance.mjs';

// LOGIC — the baked row validates the same order/width/gap contract for every consumer.
export function validateConfiguredRow(config, partNames, report) {
  let valid = true;
  if (!Array.isArray(config.order) || config.order.length !== partNames.length
    || new Set(config.order).size !== partNames.length || config.order.some((name) => !partNames.includes(name))) {
    report('order', `every row part exactly once: ${partNames.join(' | ')}`, config.order); valid = false;
  }
  let width = 0;
  for (const name of partNames) {
    const part = config.parts[name];
    if (!part?.size || part.bounds) { report(`parts.${name}`, 'size-only allocation in the configured row', part); valid = false; continue; }
    width += part.size.width;
  }
  for (const state of ['', ...Object.keys(config.states)]) {
    const patch = state ? config.states[state] : null;
    const content = { ...config.content, ...patch?.content };
    const geometry = { ...config.geometry, ...patch?.geometry };
    const path = state ? `states.${state}.` : '';
    if (content.direction !== 'row' || content.wrap !== 'nowrap') {
      report(`${path}content`, 'one non-wrapping row', content); valid = false;
    }
    if (geometry.paddingX >= 50 || geometry.paddingY >= 50) {
      report(`${path}geometry`, 'padding below 50% per side for positive row content', geometry); valid = false;
    }
    if (width + geometry.gap * Math.max(0, partNames.length - 1) > 100.00001) {
      report(state ? `${path}geometry.gap` : 'parts', 'part widths plus row gaps contained within 100% of row content width',
        { width, gap: geometry.gap, count: partNames.length }); valid = false;
    }
  }
  return valid;
}

// UI — preserve shared state selectors while translating row gaps to the content-box width.
const rowLayout = (style) => ({
  display: 'flex', flexDirection: style.flexDirection, flexWrap: style.flexWrap,
  alignItems: style.alignItems, justifyContent: style.justifyContent,
  columnGap: style.gap.replace('cqw', '%'),
});

export default function ConfiguredRow({ config, contentName, partNames = {}, renderPart }) {
  const visual = configuredSx(config);
  const rowStates = Object.fromEntries(Object.entries(visual).filter(([selector]) => selector.startsWith('&')).map(([selector, style]) => [
    selector.split(',').map((entry) => `${entry.trim()} > [data-row-content]`).join(', '), rowLayout(style),
  ]));
  const contentAttribute = contentName ? { [`data-${contentName}-content`]: 'true' } : {};
  return <Box id={config.id} role="group" aria-label={config.label} sx={{ ...fill, ...visual, ...rowStates }}>
    <Box {...contentAttribute} data-row-content={config.id} sx={{ ...fill, position: 'relative', containerType: 'size', ...rowLayout(visual) }}>
      {config.order.map((name) => {
        const part = config.parts[name];
        return <Box key={name} data-part={partNames[name] ?? name} sx={{
          ...configuredBounds({ ...part, bounds: { x: 0, y: 0, width: part.size.width, height: part.size.height } }),
          position: 'relative', left: 'auto', top: 'auto', flexShrink: 0, containerType: 'size',
        }}>{renderPart(name, part)}</Box>;
      })}
    </Box>
  </Box>;
}
