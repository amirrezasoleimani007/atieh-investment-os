import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("embedded market scores match the latest assessment snapshot row by row", async () => {
  const [source, companies] = await Promise.all([
    readJson("../public/data/market-assessment.json"),
    readJson("../public/data/companies.json"),
  ]);
  assert.equal(Object.keys(source.companies).length, 10);
  for (const company of companies) {
    assert.deepEqual(company.market, source.companies[company.name], company.name);
  }
});

test("market snapshot contains one total and five finite dimensions", async () => {
  const source = await readJson("../public/data/market-assessment.json");
  for (const [name, scores] of Object.entries(source.companies)) {
    assert.deepEqual(Object.keys(scores), ["کل", ...source.dimensions], name);
    assert.ok(Object.values(scores).every(Number.isFinite), name);
    assert.ok(Object.values(scores).every((value) => value >= 0 && value <= 10), name);
  }
});
