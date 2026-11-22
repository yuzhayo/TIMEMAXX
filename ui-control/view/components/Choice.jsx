import React from 'react';
import Button from '@mui/material/Button';
import { boundsStyle, configuredSx, fill } from '@ui/appearance.mjs';

// UI - one configured choice; selection is a visual state resolved from config.
export default function Choice({ config, selected, disabled = false, onClick, children }) {
  return <Button type="button" disableRipple disableElevation
    aria-pressed={selected === undefined ? undefined : selected}
    aria-selected={selected === undefined ? undefined : selected}
    disabled={disabled} onClick={onClick}
    sx={{ ...fill, ...boundsStyle(config.bounds), ...configuredSx(config), textTransform: 'none' }}>
    {children ?? config.label}
  </Button>;
}
