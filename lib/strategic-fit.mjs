/** Governed display and decision constants for Strategic Alignment model 2.2. */
export const FIT_MODEL_V22 = Object.freeze({
  version: "2.2",
  plot: Object.freeze({ min: 0.5, center: 5, max: 9.5 }),
  matrix: Object.freeze({ medium: 3.5, high: 6.5 }),
  strategicRaw: Object.freeze({ low: 2.25, high: 3.5, ceiling: 8.4 }),
});

function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite`);
  return value;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/** Convert any approved 0.5..9.5 matrix coordinate to a CSS percentage. */
export function plotPercent(value) {
  return clamp(((finite(value, "plot coordinate") - FIT_MODEL_V22.plot.min) / 9) * 100, 0, 100);
}

/** Fixed model-2.2 display mapping. It never ranks the current scenario. */
export function strategicDisplayCoordinate(yRaw) {
  const value = finite(yRaw, "strategic raw score");
  const { low, high, ceiling } = FIT_MODEL_V22.strategicRaw;
  let plotted;
  if (value <= low) plotted = 0.5 + (3 * value) / low;
  else if (value <= high) plotted = 3.5 + (3 * (value - low)) / (high - low);
  else plotted = 6.5 + (3 * (Math.min(value, ceiling) - high)) / (ceiling - high);
  return clamp(plotted, FIT_MODEL_V22.plot.min, FIT_MODEL_V22.plot.max);
}

/** Mid-rank index retained only for the supplementary Optionality indicator. */
export function optionalityIndex(values, current) {
  if (values.length <= 1) return 5;
  const less = values.filter((value) => value < current - 1e-12).length;
  const equal = values.filter((value) => Math.abs(value - current) < 1e-12).length;
  return 1 + (8 * (less + 0.5 * (equal - 1))) / (values.length - 1);
}

/** Runtime recomputes only policy-weighted Y; governed capability scores stay fixed. */
export function calculateStrategicFit(opportunities, weights) {
  const total = finite(weights.core, "weights.core") + finite(weights.adjacent, "weights.adjacent") + finite(weights.transform, "weights.transform");
  if (total <= 0) throw new RangeError("Strategic-fit weights must have a positive sum");
  const normalized = { core: weights.core / total, adjacent: weights.adjacent / total, transform: weights.transform / total };
  return opportunities.map((row) => {
    const coreFit = finite(row.coreFit, `opportunity.${row.id}.coreFit`);
    const adjacentFit = finite(row.adjacentFit, `opportunity.${row.id}.adjacentFit`);
    const transformFit = finite(row.transformFit, `opportunity.${row.id}.transformFit`);
    const strategicRaw = coreFit * normalized.core + adjacentFit * normalized.adjacent + transformFit * normalized.transform;
    return {
      id: row.id,
      strategicRaw,
      dynamicY: strategicDisplayCoordinate(strategicRaw),
      baselineY: finite(row.yPlotBaseline, `opportunity.${row.id}.yPlotBaseline`),
    };
  });
}

/** Recompute Optionality and the three future routes from the current TOPSIS X values. */
export function calculateOpportunityNetwork(opportunities, relatedness, currentXRows) {
  if (!Array.isArray(relatedness?.ids) || !Array.isArray(relatedness?.matrix) || relatedness.ids.length !== opportunities.length || relatedness.matrix.length !== opportunities.length) {
    throw new RangeError("Structural-relatedness matrix must match the opportunity set");
  }
  const opportunityById = new Map(opportunities.map((row) => [row.id, row]));
  const currentXById = new Map(currentXRows.map((row) => [row.id, finite(row.x, `opportunity.${row.id}.x`)]));
  const rawRows = relatedness.ids.map((sourceId, sourceIndex) => {
    const source = opportunityById.get(sourceId);
    const relationRow = relatedness.matrix[sourceIndex];
    if (!source || !Array.isArray(relationRow) || relationRow.length !== relatedness.ids.length) throw new RangeError(`Invalid structural-relatedness row: ${sourceId}`);
    let optionalityRaw = 0;
    const routes = relatedness.ids.map((destinationId, destinationIndex) => {
      const relation = finite(relationRow[destinationIndex], `relatedness.${sourceId}.${destinationId}`);
      const destinationX = currentXById.get(destinationId);
      if (!Number.isFinite(destinationX)) throw new RangeError(`Missing current X for opportunity: ${destinationId}`);
      const score = (relation * destinationX) / 90;
      optionalityRaw += score;
      return { destinationId, score, tieBreakScore: score + destinationId / 1_000_000_000 };
    });
    routes.sort((left, right) => right.tieBreakScore - left.tieBreakScore);
    return {
      id: sourceId,
      optionalityRaw,
      nextPaths: routes.slice(0, 3).map((route) => opportunityById.get(route.destinationId).name),
    };
  });
  const rawValues = rawRows.map((row) => row.optionalityRaw);
  return rawRows.map((row) => ({ ...row, optionality: optionalityIndex(rawValues, row.optionalityRaw) }));
}
