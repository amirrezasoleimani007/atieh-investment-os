export const MAX_MANAGEMENT_EFFECT = 20;

export function clampManagementEffect(value, limit = MAX_MANAGEMENT_EFFECT) {
  const safeLimit = Math.max(0, Math.min(MAX_MANAGEMENT_EFFECT, Number(limit) || 0));
  const numeric = Number(value) || 0;
  return Math.max(-safeLimit, Math.min(safeLimit, numeric));
}

export function applyManagementAdjustment(baseScore, effectPercent, limit = MAX_MANAGEMENT_EFFECT) {
  if (!Number.isFinite(baseScore)) return null;
  const effect = clampManagementEffect(effectPercent, limit);
  return Math.max(0, Math.min(10, baseScore * (1 + effect / 100)));
}

export function normalizeManagementAdjustments(adjustments, limit = MAX_MANAGEMENT_EFFECT) {
  return Object.fromEntries(
    Object.entries(adjustments ?? {}).map(([company, value]) => [
      company,
      {
        financial: clampManagementEffect(value?.financial, limit),
        market: clampManagementEffect(value?.market, limit),
      },
    ]),
  );
}
