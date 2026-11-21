import { configuredSx, fill } from './appearance.mjs';

// UI — nested text explicitly uses its owning value/selector's configured state, not a library palette.
export const inheritedTextSx = {
  color: 'inherit', WebkitTextFillColor: 'currentColor', font: 'inherit',
  letterSpacing: 'inherit', textAlign: 'inherit',
  '&.Mui-disabled': { color: 'inherit', WebkitTextFillColor: 'currentColor' },
};
export const nativeTextSx = { ...fill, ...inheritedTextSx, padding: 0, border: 0 };

// UI — extend focus matching in place, preserving shared hover/focus/disabled/error precedence.
export function configuredHostSx(node, focusSelector) {
  return Object.fromEntries(Object.entries(configuredSx(node)).map(([key, style]) => [
    focusSelector && key === '&:focus-visible, &.Mui-focusVisible' ? `${key}, ${focusSelector}` : key, style,
  ]));
}

// UI — reuse shared state resolution, then route host states to the actual visual slot.
export function configuredSlotSx(node, selector, adapt = (style) => style, focusSelector) {
  const visual = configuredHostSx(node, focusSelector);
  const base = Object.fromEntries(Object.entries(visual).filter(([key]) => !key.startsWith('&')));
  return {
    [`& ${selector}`]: adapt(base),
    ...Object.fromEntries(Object.entries(visual).filter(([key]) => key.startsWith('&')).map(([key, style]) => [
      key.split(',').map((entry) => `${entry.trim()} ${selector}`).join(', '), adapt(style),
    ])),
  };
}

// UI — intrinsic portal parts use their own font size for spacing; no circular percentage height.
export function fontRelativeSx(node) {
  const visual = configuredSx(node);
  const spacing = { padding: `${node.paddingEm.y}em ${node.paddingEm.x}em`, gap: `${node.gapEm}em` };
  return {
    ...visual, ...spacing,
    ...Object.fromEntries(Object.entries(visual).filter(([key]) => key.startsWith('&')).map(([key, style]) => [key, { ...style, ...spacing }])),
  };
}

// LOGIC — reject competing percentage spacing instead of silently ignoring it in intrinsic parts.
export function validateFontSpacing(node, report) {
  let valid = true;
  const padding = node.paddingEm;
  if (!padding || typeof padding !== 'object' || Array.isArray(padding)
    || Object.keys(padding).some((key) => !['x', 'y'].includes(key))
    || !['x', 'y'].every((axis) => Number.isFinite(padding[axis]) && padding[axis] >= 0)) {
    report('paddingEm', 'explicit nonnegative font-relative x/y padding', padding); valid = false;
  }
  if (!Number.isFinite(node.gapEm) || node.gapEm < 0) { report('gapEm', 'nonnegative font-relative gap', node.gapEm); valid = false; }
  for (const state of ['', ...Object.keys(node.states)]) {
    const geometry = { ...node.geometry, ...(state ? node.states[state].geometry : null) };
    if (['paddingX', 'paddingY', 'gap'].some((key) => geometry[key] !== 0)) {
      report(state ? `states.${state}.geometry` : 'geometry', 'zero percentage spacing; this intrinsic part uses paddingEm/gapEm', geometry); valid = false;
    }
  }
  return valid;
}
