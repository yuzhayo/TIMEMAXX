// LOGIC - pure compact-height rule. Callers supply measured pixels; config stays percentage-only.
export function compactHeightPercent({ heights, fractions, headerFraction, stackHeight, minCardPx = 0 }) {
  if (!Array.isArray(heights) || !Array.isArray(fractions) || heights.length !== fractions.length || !heights.length) return null;
  if (!Number.isFinite(stackHeight) || stackHeight <= 0 || !Number.isFinite(headerFraction)
    || headerFraction <= 0 || headerFraction >= 1) return null;
  let details = 0;
  for (let index = 0; index < heights.length; index++) {
    const height = heights[index], fraction = fractions[index] / 100;
    if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1) continue;
    details = Math.max(details, height / fraction);
  }
  if (!Number.isFinite(details) || details <= 0) return null;
  const total = Math.max(details / (1 - headerFraction), Number.isFinite(minCardPx) ? minCardPx : 0);
  const percent = total / stackHeight * 100;
  if (!Number.isFinite(percent)) return null;
  return Math.min(100, Math.max(1, percent));
}
