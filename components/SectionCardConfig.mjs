// LOGIC — the shared card accepts only its declared header/content parts and geometry.
export function validateSectionCard(config, report, extraParts = []) {
  let valid = true;
  const check = (ok, path, expected, actual) => { if (!ok) { report(path, expected, actual); valid = false; } };
  const percent = (value) => Number.isFinite(value) && value > 0 && value <= 100;
  check(Object.keys(config.parts ?? {}).every((name) => ['header', 'details', ...extraParts].includes(name)), 'parts', 'declared section parts', Object.keys(config.parts ?? {}));
  const header = config.parts?.header;
  check(percent(header?.bounds?.height) && header.bounds.height < 100 && header.bounds.width === 100, 'parts.header.bounds', 'full width and height between 0 and 100%', header?.bounds);
  check(Object.keys(header?.parts ?? {}).sort().join('|') === 'icon|title', 'parts.header.parts', 'title and icon', header?.parts);
  check(header?.parts?.icon?.name === 'expandMore', 'parts.header.parts.icon.name', 'expandMore', header?.parts?.icon?.name);
  for (const name of ['title', 'icon']) {
    const bounds = header?.parts?.[name]?.bounds;
    check(percent(bounds?.width) && percent(bounds?.height), `parts.header.parts.${name}.bounds`, 'positive parent-relative width/height', bounds);
  }
  check(Number.isFinite(header?.parts?.icon?.rotation?.open) && Number.isFinite(header?.parts?.icon?.rotation?.closed), 'parts.header.parts.icon.rotation', 'open/closed rotation degrees', header?.parts?.icon?.rotation);
  check(Boolean(config.parts?.details), 'parts.details', 'configured content appearance', config.parts?.details);
  check(Number.isFinite(config.animation?.durationMs) && config.animation.durationMs >= 0 && config.animation.durationMs <= 10000, 'animation.durationMs', '0–10000 ms', config.animation?.durationMs);
  return valid;
}
