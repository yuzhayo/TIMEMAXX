import { validateSectionCard } from '../../../../components/SectionCardConfig.mjs';
import { FORMATS } from '../../../logic/DateLogic.mjs';

// LOGIC - Date declares its format choices; language stays a global session fact.
export function validateDateConfig(config, report) {
  return validateSectionCard(config, report, ['field', ...FORMATS, 'result', 'copy', 'status']);
}
