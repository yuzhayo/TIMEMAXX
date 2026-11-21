import React from 'react';
import Typography from '@mui/material/Typography';
import { configuredSx, fill } from '@ui/appearance.mjs';

export const componentId = 'photo.fileName';

export default function FileName({ config, state }) {
  // LOGIC — display published photo identity; do not own file operations.
  const text = state.photo?.name ?? 'No image loaded';
  const title = state.photo?.path ?? text;

  // UI — clipping, typography and alignment are configured values.
  return <Typography component="output" id={config.id} aria-label={config.label} title={title}
    sx={{ ...fill, ...configuredSx(config) }}>{text}</Typography>;
}
