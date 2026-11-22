import { validateSectionCard } from '../../../../components/SectionCardConfig.mjs';

// LOGIC - Code declares its own parts; the shared card owns the header/host.
export function validateCodeConfig(config, report) {
  return validateSectionCard(config, report, ['field', 'generate', 'copy', 'status']);
}
