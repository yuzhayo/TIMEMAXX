import React, { useCallback, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Popper from '@mui/material/Popper';
import { configuredSx, fill } from './appearance.mjs';

// LOGIC — the shared portal validates its own placement and reference-axis contract.
export function validatePopoverConfig(config, report) {
  let valid = true;
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const keys = (value, allowed, path) => {
    if (!object(value)) { report(path, 'configured object', value); valid = false; return false; }
    for (const key of Object.keys(value)) if (!allowed.includes(key)) { report(`${path}.${key}`, 'supported popup property', value[key]); valid = false; }
    return true;
  };
  const portal = config.portal;
  if (keys(portal, ['placement', 'offset', 'zIndex'], 'portal')) {
    const placements = ['top', 'bottom', 'left', 'right'].flatMap((side) => [side, `${side}-start`, `${side}-end`]);
    if (!placements.includes(portal.placement)) { report('portal.placement', 'explicit supported Popper placement', portal.placement); valid = false; }
    if (!Number.isInteger(portal.zIndex) || portal.zIndex < 0 || portal.zIndex > 2147483647) {
      report('portal.zIndex', 'nonnegative CSS stacking integer', portal.zIndex); valid = false;
    }
    if (keys(portal.offset, ['base', 'skid', 'gap'], 'portal.offset')) {
      if (portal.offset.base !== 'anchor') { report('portal.offset.base', 'anchor: offsets use the trigger axes', portal.offset.base); valid = false; }
      if (!Number.isFinite(portal.offset.skid) || Math.abs(portal.offset.skid) > 100) { report('portal.offset.skid', 'signed anchor cross-axis percentage from -100 to 100', portal.offset.skid); valid = false; }
      if (!Number.isFinite(portal.offset.gap) || portal.offset.gap < 0 || portal.offset.gap > 100) { report('portal.offset.gap', 'anchor main-axis percentage from 0 to 100', portal.offset.gap); valid = false; }
    }
  }
  if (!object(config.size)) { report('size', 'explicit viewport-percentage size', config.size); valid = false; }
  if (config.geometry.paddingX >= 50 || config.geometry.paddingY >= 50) {
    report('geometry', 'padding below 50% per side so popup content has positive size', config.geometry); valid = false;
  }
  return valid;
}

// LOGIC — one shared popup mechanism: a trigger opens a surface that stays open
// during a gesture and closes on commit, Escape or an outside click. The
// feature that owns the content owns its values, commands and open state.
// The surface is portaled, so the owner closes it on a pointer press outside.
export default function ConfiguredPopover({ id, config, open, onClose, trigger, children }) {
  const anchor = useRef(null);
  const surface = useRef(null);
  const close = useCallback(() => onClose?.(), [onClose]);

  // UI — Popper's resolved placement determines which trigger axes supply skid/gap.
  const offset = ({ placement, reference }) => {
    const vertical = placement.startsWith('top') || placement.startsWith('bottom');
    return [
      (vertical ? reference.width : reference.height) * config.portal.offset.skid / 100,
      (vertical ? reference.height : reference.width) * config.portal.offset.gap / 100,
    ];
  };

  // LOGIC — Escape belongs to the popup, so a drag can be cancelled with it.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') close(); };
    const onPointerDown = (event) => {
      const inAnchor = anchor.current?.contains(event.target);
      const inSurface = surface.current?.contains(event.target);
      if (!inAnchor && !inSurface) close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onPointerDown, true); };
  }, [open, close]);

  return <>
    <span ref={anchor} data-popover-trigger={id} style={{ ...fill, display: 'inline-flex' }}>{trigger}</span>
    {/* UI — the portal's parent reference is the app viewport; children query this definite size. */}
    <Popper open={open} anchorEl={anchor.current} placement={config.portal.placement}
      style={{ zIndex: config.portal.zIndex, width: `${config.size.width}vw`, height: `${config.size.height}vh`, containerType: 'size' }}
      modifiers={[{ name: 'offset', options: { offset } }]}>
      <Box ref={surface} data-popover-surface={id} sx={configuredSx(config)}
        style={fill}>
        {children}
      </Box>
    </Popper>
  </>;
}
