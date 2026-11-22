// LOGIC - pure compact-height rules. Callers supply measured pixels; config stays percentage-only.
export function compactDetailsPercent({ heights, fractions, stackHeight }) {
  if (!Array.isArray(heights) || !Array.isArray(fractions) || heights.length !== fractions.length || !heights.length) return null;
  if (!Number.isFinite(stackHeight) || stackHeight <= 0) return null;
  let details = 0;
  for (let index = 0; index < heights.length; index++) {
    const height = heights[index], fraction = fractions[index] / 100;
    if (!Number.isFinite(height) || height <= 0 || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1) continue;
    details = Math.max(details, height / fraction);
  }
  if (!Number.isFinite(details) || details <= 0) return null;
  return Math.min(100, details / stackHeight * 100);
}

// LOGIC - header is a stable share of the stack, never of the shrinking card.
export function resolveCompactLayout({ boundsHeight, headerFraction, detailsPercent }) {
  if (![boundsHeight, headerFraction, detailsPercent].every(Number.isFinite)
    || boundsHeight <= 0 || headerFraction <= 0 || headerFraction >= 1) return null;
  const headerOfStack = boundsHeight * headerFraction;
  const detailsOfStack = Math.max(0, Math.min(detailsPercent, boundsHeight - headerOfStack));
  const cardOfStack = headerOfStack + detailsOfStack;
  return {
    cardPercent: cardOfStack,
    collapsedPercent: headerOfStack,
    headerPercentOfCard: cardOfStack > 0 ? headerOfStack / cardOfStack * 100 : headerFraction * 100,
  };
}
