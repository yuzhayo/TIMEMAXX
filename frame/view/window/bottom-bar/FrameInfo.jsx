import React, { useLayoutEffect, useRef, useState } from 'react';
import Typography from '@mui/material/Typography';
import { configuredSx, fill } from '@ui/appearance.mjs';
import { diagnosticSummary } from '@frame/view/layout/LayoutDiagnostics.mjs';

export const componentId = 'file.status';

// LOGIC — intrinsic text height needs space left after top/bottom percentage padding.
export function validateConfig(config, report) {
  if (config.geometry.paddingY < 50) return true;
  report('geometry.paddingY', 'less than 50% per side so text has positive vertical space', config.geometry.paddingY);
  return false;
}

export default function FrameInfo({ config, state }) {
  // LOGIC — file/session and diagnostic owners retain their facts; this is their text outlet.
  const issues = state.diagnostics ?? [];
  const message = [state.message, diagnosticSummary(issues)].filter(Boolean).join('\n');
  const text = useRef(null);
  const lineHeight = config.geometry.fontSize * config.geometry.lineHeight;
  const [textHeight, setTextHeight] = useState(lineHeight);
  useLayoutEffect(() => {
    const measure = () => setTextHeight(Math.max(lineHeight, text.current.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(text.current);
    return () => observer.disconnect();
  }, [message, lineHeight]);

  // UI — solve percentage padding locally; intrinsic grid sizing does not need parent callbacks.
  const padding = (textHeight + 2 * config.geometry.borderWidth) * config.geometry.paddingY / (100 - 2 * config.geometry.paddingY);
  return <Typography component="output" id={config.id} role="status" aria-live="polite"
    aria-label={config.label} aria-invalid={issues.length > 0}
    style={{ paddingTop: padding, paddingBottom: padding }}
    sx={{ ...fill, ...configuredSx(config), height: 'auto' }}>
    <span ref={text} data-message-text="true" style={{ width: '100%', minWidth: 0, minHeight: lineHeight,
      overflowWrap: 'anywhere', whiteSpace: config.content.whiteSpace === 'normal' ? 'pre-wrap' : 'nowrap',
    }}>{message}</span>
  </Typography>;
}
