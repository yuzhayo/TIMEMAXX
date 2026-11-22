import { validateSectionCard } from '../../../../components/SectionCardConfig.mjs';

// LOGIC - Time declares its range inputs, clock choices and result parts.
export function validateTimeConfig(config, report) {
  return validateSectionCard(config, report, ['from', 'to', 'generate', 'copy', 'h24', 'h12', 'result', 'status', 'fromLabel', 'toLabel']);
}
