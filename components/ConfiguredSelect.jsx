import Box from '@mui/material/Box';
import { configuredSx, part } from './appearance.mjs';

// UI — one configured native dropdown shared by sections that need a choice.
// The section owns the value and its command; this control owns only the
// configured appearance and the option mapping.
export default function ConfiguredSelect({ config, partName = 'select', value, onChange, options, label, ...rest }) {
  return (
    <Box component="select" aria-label={label} value={value}
      onChange={(event) => onChange(event.target.value)} {...rest}
      sx={{ ...configuredSx(part(config, partName)), width: '100%', minWidth: 0, cursor: 'pointer' }}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </Box>
  );
}
