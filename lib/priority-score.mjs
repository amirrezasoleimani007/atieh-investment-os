/** Supplementary decision index, not part of the governed Excel 2.2 model.
 * Normalize fixed display bounds 0.5..9.5 to 0..1, then geometric mean.
 * Equal exponents = equal importance. No synergy, optionality or rank input.
 */
export function priorityScore(x, y) {
  for (const value of [x, y]) {
    if (!Number.isFinite(value) || value < 0.5 || value > 9.5) {
      throw new RangeError('Priority inputs must be finite coordinates in 0.5..9.5');
    }
  }
  return 100 * Math.sqrt(((x - 0.5) / 9) * ((y - 0.5) / 9));
}
