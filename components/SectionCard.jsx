import React from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import { configuredSx, fill } from './appearance.mjs';
export { validateSectionCard } from './SectionCardConfig.mjs';

// UI — one shared MUI card. The host owns expansion state and outside placement.
export default function SectionCard({ config, expanded, onExpandedChange, children }) {
  const header = config.parts.header, icon = header.parts.icon;
  return <Accordion id={config.id} data-section-card={config.id} data-card-renderer="shared-mui"
    expanded={expanded} onChange={(_event, value) => onExpandedChange(config.id, value)}
    disableGutters square elevation={0} slots={{ heading: 'h2' }}
    slotProps={{ transition: { timeout: config.animation.durationMs, unmountOnExit: false } }}
    sx={{ ...fill, ...configuredSx(config), position: 'relative', '&::before': { display: 'none' },
      '&.Mui-expanded': { margin: 0 }, margin: 0,
      '& .MuiAccordion-heading': { margin: 0, padding: 0, width: '100%', height: expanded ? `${header.resolvedHeightPercent ?? header.bounds.height}%` : '100%', flexShrink: 0 },
      '& .MuiCollapse-root': { flex: expanded ? '1 1 0' : '0 0 0', minHeight: 0, width: '100%' },
      '& .MuiCollapse-wrapper, & .MuiCollapse-wrapperInner': { width: '100%', height: '100%' },
      '& .MuiAccordion-region': { ...fill, containerType: 'size' },
    }}>
    <AccordionSummary id={`${config.id}-heading`} aria-controls={`${config.id}-content`} disableRipple
      expandIcon={<ExpandMoreRoundedIcon style={{ width: '100%', height: '100%' }} />}
      sx={{ ...fill, ...configuredSx(header), containerType: 'size',
        '&.Mui-expanded': { minHeight: 0 },
        '& .MuiAccordionSummary-content, & .MuiAccordionSummary-content.Mui-expanded': { margin: 0, flexGrow: 0, minWidth: 0, width: `${header.parts.title.bounds.width}%`, height: '100%' },
        '& .MuiAccordionSummary-expandIconWrapper': { ...configuredSx(icon), width: `${icon.bounds.width}%`, height: `${icon.bounds.height}%`, flexShrink: 0,
          transform: `rotate(${expanded ? icon.rotation.open : icon.rotation.closed}deg)` },
      }}>
      <Typography component="span" data-section-title sx={{ ...fill, ...configuredSx(header.parts.title) }}>{config.label}</Typography>
    </AccordionSummary>
    <AccordionDetails data-section-content={config.id} sx={{ ...fill, ...configuredSx(config.parts.details) }}>
      <Box data-card-content sx={{ ...fill, position: 'relative', containerType: 'size' }}>{children}</Box>
    </AccordionDetails>
  </Accordion>;
}
