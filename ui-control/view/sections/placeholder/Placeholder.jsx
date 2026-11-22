import Box from '@mui/material/Box';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { configuredSx, part } from '@ui/appearance.mjs';

export const componentId = 'input.placeholder';

// Baked named parts: header is the always-visible expand/collapse toggle;
// body is the mount point where individual components are attached later.
export const partKeys = ['header', 'body'];
export const partConfigKeys = {};

// UI — the baked placeholder card. Height follows content (auto compact) inside
// its configured slot; sizing "fixed" fills the slot instead. All visuals come
// from config.json, with parts.header/parts.body overriding per part.
export default function Placeholder({ config, state, actions }) {
  const expanded = state.expanded[config.id] ?? Boolean(config.expanded);
  const header = part(config, 'header');
  const body = part(config, 'body');
  const toggle = () => actions.setExpanded(config.id, !expanded);
  return (
    <Box data-section-card sx={{ ...configuredSx(config), width: '100%', flexShrink: 0,
      height: config.sizing === 'fixed' ? '100%' : 'auto', maxHeight: '100%' }}>
      <Box component="button" type="button" data-section-header aria-expanded={expanded} onClick={toggle}
        sx={{ ...configuredSx(header), width: '100%', flexShrink: 0, font: 'inherit', cursor: 'pointer', textAlign: 'inherit' }}>
        <Box component="span" sx={{ minWidth: 0 }}>{config.label}</Box>
        <ExpandMoreIcon aria-hidden="true" sx={{ fontSize: 'inherit', flexShrink: 0,
          transform: expanded ? 'none' : 'rotate(-90deg)' }} />
      </Box>
      {expanded && <Box data-section-body sx={{ ...configuredSx(body), width: '100%', flex: '0 1 auto', minHeight: 0 }} />}
    </Box>
  );
}
