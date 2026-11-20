import React from 'react';
import Box from '@mui/material/Box';
import { configuredSx, fill } from '@ui/appearance.mjs';

export const componentId = 'layout.separator';

// UI — an Action Bar sibling; its appearance/placement belong to JSON, not Rotation.
export default function ActionSeparator({ config }) {
  return <Box id={config.id} role="separator" aria-label={config.label} aria-orientation="vertical" sx={{ ...fill, ...configuredSx(config) }} />;
}
