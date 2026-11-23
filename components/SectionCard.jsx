import Box from '@mui/material/Box';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { configuredSx, part } from './appearance.mjs';

// UI — shared section card. Header is the always-visible expand/collapse control;
// body auto-compacts inside its configured slot and hosts the section content.
// Presentation and layout mechanics only: the caller owns expansion state.
export default function SectionCard({ config, label, expanded, onToggle, children }) {
  const header = part(config, 'header');
  const body = part(config, 'body');
  return (
    <Box data-section-card sx={{ ...configuredSx(config), width: '100%', flexShrink: 0,
      height: config.sizing === 'fixed' ? '100%' : 'auto', maxHeight: '100%' }}>
      <Box component="button" type="button" data-section-header aria-expanded={expanded} onClick={onToggle}
        sx={{ ...configuredSx(header), width: '100%', flexShrink: 0, font: 'inherit', cursor: 'pointer', textAlign: 'inherit' }}>
        <Box component="span" sx={{ minWidth: 0 }}>{label}</Box>
        <ExpandMoreIcon aria-hidden="true" sx={{ fontSize: 'inherit', flexShrink: 0,
          transform: expanded ? 'none' : 'rotate(-90deg)' }} />
      </Box>
      {expanded && <Box data-section-body sx={{ ...configuredSx(body), width: '100%', flex: '0 1 auto', minHeight: 0 }}>{children}</Box>}
    </Box>
  );
}
