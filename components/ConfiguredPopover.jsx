import React, { useCallback, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Popper from '@mui/material/Popper';
import { configuredSx, fill } from './appearance.mjs';

// LOGIC — one shared popup mechanism: a trigger opens a surface that stays open
// during a gesture and closes on commit, Escape or an outside click. The
// feature that owns the content owns its values, commands and open state.
// The surface is portaled, so the owner closes it on a pointer press outside.
export default function ConfiguredPopover({ id, config, open, onClose, trigger, children, placement = 'bottom-start' }) {
  const anchor = useRef(null);
  const surface = useRef(null);
  const close = useCallback(() => onClose?.(), [onClose]);

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
    <Popper open={open} anchorEl={anchor.current} placement={placement} style={{ zIndex: 1300 }}
      modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}>
      <Box ref={surface} data-popover-surface={id} sx={configuredSx(config)}
        style={{ ...fill, width: config.surfaceWidth, padding: config.surfacePadding }}>
        {children}
      </Box>
    </Popper>
  </>;
}
