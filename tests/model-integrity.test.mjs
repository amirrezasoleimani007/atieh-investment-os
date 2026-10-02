import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { calculateOpportunityNetwork, calculateStrategicFit, FIT_MODEL_V22, plotPercent, strategicDisplayCoordinate } from "../lib/strategic-fit.mjs";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const sectors = await readJson("../public/data/sectors.json");
const companies = await readJson("../public/data/companies.json");
const financialCompanies = await readJson("../public/data/financial-companies.json");
const portfolioSnapshot = await readJson("../public/data/portfolio.json");
const opportunities = await readJson("../public/data/opportunities.json");
const relatedness = await readJson("../public/data/opportunity-relatedness.json");
const isic = await readJson("../public/data/isic.json");
const manifest = await readJson("../public/data/manifest.json");

const criteria = ["growth", "valueAdded", "megatrends", "inflation", "fxExposure"];
const benefit = new Set(["growth", "valueAdded", "megatrends"]);
const baselineWeights = { growth: 0.25, valueAdded: 0.25, megatrends: 0.2, inflation: 0.1, fxExposure: 0.2 };
const capabilityLabels = {
  coreFit: "بازرگانی زنجیره فولاد",
  downstream: "پایین دستی فولاد",
  financeDirect: "خدمات مالی مستقیم",
  mineral: "کانی/معدنی",
  steelSupport: "صنایع جانبی زنجیره فولاد",
  paint: "رنگ صنعتی",
};

function topsisRows(weights = baselineWeights) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  const denominators = Object.fromEntries(criteria.map((key) => [key, Math.sqrt(sectors.reduce((sum, sector) => sum + sector.criteria[key] ** 2, 0))]));
  const rows = sectors.map((sector) => ({
    ...sector,
    weighted: Object.fromEntries(criteria.map((key) => [key, (sector.criteria[key] / denominators[key]) * weights[key] / total])),
  }));
  const positive = Object.fromEntries(criteria.map((key) => [key, benefit.has(key) ? Math.max(...rows.map((row) => row.weighted[key])) : Math.min(...rows.map((row) => row.weighted[key]))]));
  const negative = Object.fromEntries(criteria.map((key) => [key, benefit.has(key) ? Math.min(...rows.map((row) => row.weighted[key])) : Math.max(...rows.map((row) => row.weighted[key]))]));
  const scored = rows.map((row) => {
    const good = Math.sqrt(criteria.reduce((sum, key) => sum + (row.weighted[key] - positive[key]) ** 2, 0));
    const bad = Math.sqrt(criteria.reduce((sum, key) => sum + (row.weighted[key] - negative[key]) ** 2, 0));
    return { id: row.id, name: row.name, opportunity: bad / (good + bad) };
  });
  const ranked = [...scored].sort((left, right) => right.opportunity - left.opportunity || left.id - right.id);
  const rankById = new Map(ranked.map((row, index) => [row.id, index + 1]));
  return scored.map((row) => ({ ...row, x: 0.5 + 9 * (77 - rankById.get(row.id)) / 76 }));
}

function mean(values) { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function ranks(values) {
  return values.map((value) => {
    const less = values.filter((candidate) => candidate < value - 1e-12).length;
    const equal = values.filter((candidate) => Math.abs(candidate - value) < 1e-12).length;
    return less + (equal + 1) / 2;
  });
}
function correlation(left, right) {
  const leftMean = mean(left), rightMean = mean(right);
  return left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0) /
    Math.sqrt(left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0) * right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0));
}
function assertClose(actual, expected, tolerance = 1e-12, label = "value") {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
}
function assertFiniteTree(value, path = "root") {
  if (typeof value === "number") assert.ok(Number.isFinite(value), `${path} must be finite`);
  else if (Array.isArray(value)) value.forEach((item, index) => assertFiniteTree(item, `${path}[${index}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => assertFiniteTree(item, `${path}.${key}`));
}

test("embedded snapshot retains the approved non-Fit modules", () => {
  assert.equal(manifest.sectors, 77);
  assert.equal(manifest.companies, 10);
  assert.equal(manifest.isicRows, 16405);
  assert.equal(sectors.length, 77);
  assert.equal(companies.length, 10);
  assert.equal(financialCompanies.length, 32);
  assert.equal(portfolioSnapshot.length, 11);
  assert.equal(isic.length, 16405);
});

test("model 2.2 governed data has the complete schema and no legacy fields", () => {
  assert.equal(manifest.strategicFitModel, "2.2");
  assert.equal(FIT_MODEL_V22.version, "2.2");
  assert.equal(opportunities.length, 77);
  assert.deepEqual(relatedness.ids, Array.from({ length: 77 }, (_, index) => index + 1));
  assert.equal(relatedness.matrix.length, 77);
  assert.ok(relatedness.matrix.every((row) => row.length === 77));
  const legacy = ["x", "y", "yRaw", "rawIo", "relativeRelatedness", "tradeEffectiveDiagnostic", "steelProximity"];
  assert.ok(opportunities.every((row) => legacy.every((key) => !(key in row))));
  assert.ok(opportunities.every((row) => row.ioCode && row.ioActivity && row.adjacentDriver && row.nextPaths.length === 3));
  opportunities.forEach((row) => assertFiniteTree(row, `opportunity.${row.id}`));
  assertFiniteTree(relatedness, "relatedness");
});

test("baseline TOPSIS raw and 0.5..9.5 X exactly reproduce the workbook", () => {
  const calculated = topsisRows();
  for (const row of opportunities) {
    const result = calculated.find((candidate) => candidate.id === row.id);
    assertClose(result.opportunity, row.opportunityRaw, 1e-12, `TOPSIS ${row.id}`);
    assertClose(result.x, row.xPlotBaseline, 1e-12, `X ${row.id}`);
  }
  const x = opportunities.map((row) => row.xPlotBaseline).sort((a, b) => a - b);
  assert.equal(new Set(x).size, 77);
  assert.deepEqual([x[0], x[38], x[76]], [0.5, 5, 9.5]);
  assert.deepEqual(opportunities.reduce((counts, row) => { counts[row.xPlotBaseline < 3.5 ? "low" : row.xPlotBaseline < 6.5 ? "medium" : "high"]++; return counts; }, { low: 0, medium: 0, high: 0 }), { low: 26, medium: 25, high: 26 });
  assert.deepEqual([plotPercent(0.5), plotPercent(5), plotPercent(9.5)], [0, 50, 100]);
});

test("governed capability, finance gating and synergy outputs are internally consistent", () => {
  for (const row of opportunities) {
    const capabilities = [["coreFit", row.coreFit], ...Object.entries(row.adjacentEffective)];
    const ordered = capabilities.map(([key, score], order) => ({ key, score, order })).sort((left, right) => right.score - left.score || left.order - right.order);
    assertClose(row.adjacentFit, Math.max(...Object.values(row.adjacentEffective)), 1e-12, `Adjacent ${row.id}`);
    assert.equal(row.closest, capabilityLabels[ordered[0].key]);
    assert.equal(row.secondClosest, capabilityLabels[ordered[1].key]);
    assertClose(row.closeness, ordered[0].score);
    assertClose(row.secondCloseness, ordered[1].score);
    assertClose(row.gap, ordered[0].score - ordered[1].score);
    assertClose(row.synergy, Math.sqrt(ordered[0].score * ordered[1].score));
    assert.equal(row.adjacentEffective.financeDirect > 0, [56, 57, 58].includes(row.ioCode));
  }
  assert.ok(opportunities.some((row) => Math.abs(row.transformFit - (10 - Math.max(row.coreFit, row.adjacentFit))) > 1));
});

test("baseline Y raw and fixed display mapping match all 77 governed rows", () => {
  const baseline = calculateStrategicFit(opportunities, { core: 60, adjacent: 30, transform: 10 });
  for (const result of baseline) {
    const row = opportunities.find((candidate) => candidate.id === result.id);
    assertClose(result.strategicRaw, row.yRawBaseline, 1e-12, `Y raw ${row.id}`);
    assertClose(result.dynamicY, row.yPlotBaseline, 1e-12, `Y plot ${row.id}`);
    assertClose(strategicDisplayCoordinate(row.yRawBaseline), row.yPlotBaseline, 1e-12, `display ${row.id}`);
  }
  const raw = opportunities.map((row) => row.yRawBaseline).sort((a, b) => a - b);
  const plot = opportunities.map((row) => row.yPlotBaseline).sort((a, b) => a - b);
  assertClose(raw[0], 0.2620622075983632); assertClose(raw[38], 2.279790682484993); assertClose(raw[76], 6.6375421153565854);
  assertClose(plot[0], 0.8494162767978175); assertClose(plot[38], 3.571497637963984); assertClose(plot[76], 8.420944152259134);
  assert.deepEqual(opportunities.reduce((counts, row) => { counts[row.yRawBaseline < 2.25 ? "low" : row.yRawBaseline < 3.5 ? "medium" : "high"]++; return counts; }, { low: 0, medium: 0, high: 0 }), { low: 38, medium: 25, high: 14 });
  assert.equal(opportunities.filter((row) => row.xPlotBaseline >= 6.5 && row.yRawBaseline >= 3.5).length, 7);
});

test("horizon scenarios reproduce 2.2 regression results without moving X", () => {
  const baselineX = opportunities.map((row) => row.xPlotBaseline);
  const baseline = calculateStrategicFit(opportunities, { core: 60, adjacent: 30, transform: 10 });
  const baselineRanks = ranks(baseline.map((row) => row.strategicRaw));
  const scenarios = [
    [{ core: 80, adjacent: 10, transform: 10 }, 0.9622730798049243, 0.31746182188945365, 15, [0.20750905914710324, 7.803533916375753]],
    [{ core: 30, adjacent: 60, transform: 10 }, 0.9764699696344301, 0.47619273283418034, 21, [0.3438919302752531, 7.171429535730914]],
    [{ core: 20, adjacent: 20, transform: 60 }, 0.9565943238731218, 0.5879716820130825, 40, [1.1359480579800993, 5.083180221531194]],
    [{ core: 10, adjacent: 10, transform: 80 }, 0.894469785600673, 0.782269571298004, 51, [1.469136453597416, 4.699928108619271]],
  ];
  for (const [weights, expectedSpearman, expectedMean, expectedMoved, expectedRange] of scenarios) {
    const rows = calculateStrategicFit(opportunities, weights);
    const raw = rows.map((row) => row.strategicRaw);
    const movement = raw.map((value, index) => Math.abs(value - baseline[index].strategicRaw));
    assertClose(correlation(baselineRanks, ranks(raw)), expectedSpearman, 1e-12);
    assertClose(mean(movement), expectedMean, 1e-12);
    assert.equal(movement.filter((value) => value >= 0.5 - 1e-12).length, expectedMoved);
    assertClose(Math.min(...raw), expectedRange[0]); assertClose(Math.max(...raw), expectedRange[1]);
    assert.deepEqual(opportunities.map((row) => row.xPlotBaseline), baselineX);
  }
});

test("Optionality and future routes match baseline and react to current TOPSIS X", () => {
  const baselineX = opportunities.map((row) => ({ id: row.id, x: row.xPlotBaseline }));
  const baseline = calculateOpportunityNetwork(opportunities, relatedness, baselineX);
  for (const result of baseline) {
    const row = opportunities.find((candidate) => candidate.id === result.id);
    assertClose(result.optionalityRaw, row.optionalityRaw, 2e-14, `Optionality ${row.id}`);
    assertClose(result.optionality, row.optionality, 1e-12, `Optionality index ${row.id}`);
    assert.deepEqual(result.nextPaths, row.nextPaths, `Routes ${row.id}`);
  }
  const changed = calculateOpportunityNetwork(opportunities, relatedness, topsisRows({ growth: 0.5, valueAdded: 0.1, megatrends: 0.15, inflation: 0.1, fxExposure: 0.15 }));
  assert.ok(changed.filter((row, index) => Math.abs(row.optionalityRaw - baseline[index].optionalityRaw) > 1e-9).length >= 70);
  assert.ok(changed.filter((row, index) => JSON.stringify(row.nextPaths) !== JSON.stringify(baseline[index].nextPaths)).length >= 10);
});

test("activity mapping, portfolio, financial and SWOT integrity are retained", () => {
  const sectorIds = new Set(sectors.map((row) => row.id));
  assert.deepEqual(new Set(opportunities.map((row) => row.id)), sectorIds);
  assert.ok(isic.every((row) => row.sectorCode.split("/").every((code) => sectorIds.has(Number(code)))));
  assertClose(portfolioSnapshot.reduce((sum, row) => sum + row.portfolioShare, 0), 1);
  const scatterKeys = ["scatterOperationalGrowth", "scatterOperatingProfitability", "scatterResourceProductivity", "scatterCapitalValueCreation", "scatterLiquidityStrength", "scatterFinancialStructure", "scatterEarningsQuality", "scatterFcfGeneration"];
  assert.ok(financialCompanies.every((row) => scatterKeys.every((key) => key in row.scatterAxes)));
  assert.ok(financialCompanies.every((row) => Object.keys(row.kpiHistory).length >= 75));
  const polay = companies.find((company) => company.name === "پولای بهیز");
  const tooka = companies.find((company) => company.name === "توکا رنگ فولاد سپاهان");
  assert.match(polay.swot.strengths.join(" "), /رشد بسیار بالای درآمد/);
  assert.match(tooka.swot.strengths.join(" "), /حاشیه سود عملیاتی ۴۶ درصدی/);
});
