import { validateSectionCard } from '../../../../components/SectionCardConfig.mjs';

// LOGIC — Language owns its field options; the shared card owns the header/content host.
export function validateLanguageConfig(config, report) {
  let valid = validateSectionCard(config, report, ['field']);
  const check = (ok, path, expected, actual) => { if (!ok) { valid = false; report(path, expected, actual); } };
  const field = config.parts?.field;
  check(field && Object.keys(field.parts ?? {}).sort().join('|') === 'icon|menu|option|value', 'parts.field.parts', 'value/icon/menu/option', field?.parts);
  check(Number.isFinite(field?.bounds?.width) && field.bounds.width > 0 && field.bounds.width <= 100
    && Number.isFinite(field?.bounds?.height) && field.bounds.height > 0 && field.bounds.height <= 100, 'parts.field.bounds', 'positive content-relative bounds', field?.bounds);
  check(field?.parts?.icon?.name === 'arrowDropDown', 'parts.field.parts.icon.name', 'arrowDropDown', field?.parts?.icon?.name);
  const iconBounds = field?.parts?.icon?.bounds;
  check(Number.isFinite(iconBounds?.width) && iconBounds.width > 0 && iconBounds.width <= 100
    && Number.isFinite(iconBounds?.height) && iconBounds.height > 0 && iconBounds.height <= 100, 'parts.field.parts.icon.bounds', 'positive field-relative icon bounds', iconBounds);
  const portal = field?.parts?.menu?.portal;
  check(portal?.base === 'inputViewport' && portal.widthBase === 'anchor' && Number.isFinite(portal.maxHeight) && portal.maxHeight > 0 && portal.maxHeight <= 100,
    'parts.field.parts.menu.portal', 'explicit Input-viewport/anchor bases and contained height', portal);
  check(portal?.anchorOrigin?.vertical === 'bottom' && portal.anchorOrigin.horizontal === 'left'
    && portal.transformOrigin?.vertical === 'top' && portal.transformOrigin.horizontal === 'left', 'parts.field.parts.menu.portal.origins', 'bottom-left anchor and top-left menu', portal);
  return valid;
}
