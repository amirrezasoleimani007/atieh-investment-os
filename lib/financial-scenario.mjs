export const FINANCIAL_BASE_WEIGHTS = Object.freeze({
  growth: 20,
  profitability: 15,
  capitalReturn: 20,
  cashQuality: 15,
  resilience: 20,
  workingCapital: 10,
});

export function redistributeFinancialWeight(weights, key, next) {
  const bounded = Math.max(5, Math.min(40, Number(next) || 0));
  const keys = Object.keys(FINANCIAL_BASE_WEIGHTS);
  const others = keys.filter((item) => item !== key);
  const otherTotal = others.reduce((sum, item) => sum + weights[item], 0) || 1;
  const remaining = 100 - bounded;
  return Object.fromEntries([
    [key, bounded],
    ...others.map((item) => [item, (weights[item] / otherTotal) * remaining]),
  ]);
}

export function financialScenarioWeights(lens) {
  let weights = { ...FINANCIAL_BASE_WEIGHTS };
  if (!lens || lens === "score") return weights;
  weights = redistributeFinancialWeight(weights, lens, 35);
  if (lens === "workingCapital") {
    weights = redistributeFinancialWeight(weights, "profitability", 10);
  }
  return weights;
}

export function financialScenarioScore(company, lens = "score") {
  if (lens === "score") {
    return Number.isFinite(company?.score) ? company.score : null;
  }
  const weights = financialScenarioWeights(lens);
  const valid = Object.keys(FINANCIAL_BASE_WEIGHTS).filter((key) =>
    Number.isFinite(company?.dimensions?.[key]?.score),
  );
  const total = valid.reduce((sum, key) => sum + weights[key], 0);
  if (!total) return null;
  return valid.reduce(
    (sum, key) => sum + (company.dimensions[key].score * weights[key]) / total,
    0,
  );
}
