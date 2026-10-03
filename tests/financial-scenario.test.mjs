import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  financialScenarioScore,
  financialScenarioWeights,
} from "../lib/financial-scenario.mjs";

const companies = JSON.parse(
  await readFile(new URL("../public/data/companies.json", import.meta.url), "utf8"),
);

test("financial scenario weights reproduce the approved ranking presets", () => {
  for (const lens of [
    "profitability",
    "growth",
    "cashQuality",
    "capitalReturn",
    "resilience",
    "workingCapital",
  ]) {
    const weights = financialScenarioWeights(lens);
    assert.ok(Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 100) < 1e-9);
    assert.ok(Object.values(weights).every((value) => value >= 0));
  }
  assert.equal(financialScenarioWeights("profitability").profitability, 35);
  assert.equal(financialScenarioWeights("workingCapital").profitability, 10);
});

test("profit-oriented matrix uses the composite score, not the capped component", () => {
  const capped = companies.filter((company) => company.dimensions.profitability?.score === 10);
  assert.ok(capped.length >= 3);
  const scores = capped.map((company) => financialScenarioScore(company, "profitability"));
  assert.ok(scores.every((score) => score > 0 && score < 10));
  assert.ok(new Set(scores.map((score) => score.toFixed(6))).size > 1);
});

test("all financial matrix lenses produce finite direct coordinates", () => {
  const lenses = ["score", "profitability", "growth", "cashQuality", "capitalReturn", "resilience", "workingCapital"];
  for (const company of companies.filter((item) => item.score != null)) {
    for (const lens of lenses) {
      const score = financialScenarioScore(company, lens);
      assert.ok(Number.isFinite(score), `${company.name} / ${lens}`);
      assert.ok(score >= 0 && score <= 10, `${company.name} / ${lens}`);
    }
  }
});
