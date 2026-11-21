import React from 'react';
import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SectionCard from '@ui/SectionCard.jsx';
import { configuredSx, fill } from '@ui/appearance.mjs';
export { validateLanguageConfig as validateConfig } from './LanguageConfig.mjs';
export const componentId = 'input.language';

// UI — MUI field reads the single global choice; options/visuals come from config.
export default function LanguageSection({ config, state, actions, languages }) {
  const field = config.parts.field, icon = field.parts.icon, menu = field.parts.menu;
  return <SectionCard config={config} expanded={state.expanded[config.id]} onExpandedChange={actions.setExpanded}>
    <Box sx={{ width: `${field.bounds.width}%`, height: `${field.bounds.height}%`, containerType: 'size' }}>
      <Select id={`${config.id}-select`} value={state.language} onChange={(event) => actions.setLanguage(event.target.value)}
        labelId={`${config.id}-heading`} variant="standard" disableUnderline IconComponent={ArrowDropDownIcon}
        sx={{ ...fill, ...configuredSx(field),
          '& .MuiSelect-select': { ...fill, ...configuredSx(field.parts.value), minHeight: '0 !important',
            paddingRight: `${field.parts.value.geometry.paddingX + icon.bounds.width}%` },
          '& .MuiSelect-icon': { color: icon.colors.foreground, width: `${icon.bounds.width}%`, height: `${icon.bounds.height}%`,
            right: `${field.parts.value.geometry.paddingX}%`, top: `${(100 - icon.bounds.height) / 2}%` },
        }}
        MenuProps={{ disableScrollLock: true, anchorOrigin: menu.portal.anchorOrigin, transformOrigin: menu.portal.transformOrigin,
          slotProps: { paper: { sx: { ...configuredSx(menu), maxHeight: `${menu.portal.maxHeight}vh`, maxWidth: '100vw' } }, list: { disablePadding: true } } }}>
        {languages.map((language) => <MenuItem key={language.id} value={language.id} disableRipple sx={configuredSx(field.parts.option)}>{language.label}</MenuItem>)}
      </Select>
    </Box>
  </SectionCard>;
}
