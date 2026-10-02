import test from "node:test";
import assert from "node:assert/strict";
import { STEEL_CHAIN_DATA } from "../lib/steel-chain-data.ts";

test("steel-chain source mapping retains workbook and presentation figures", () => {
  assert.equal(STEEL_CHAIN_DATA.groupCapacity.upstream[0].current, 13.63);
  assert.equal(STEEL_CHAIN_DATA.groupCapacity.upstream[0].future, 30.47);
  assert.equal(STEEL_CHAIN_DATA.mainCompany.find((x) => x.product === "اسلب").balance1405, -2.8298969072);
  assert.equal(STEEL_CHAIN_DATA.futureGroup["18"].nodes.find((x) => x.product === "سنگ‌آهن").balance, -35.3045);
  assert.equal(STEEL_CHAIN_DATA.national.likely.nodes.find((x) => x.product === "فولاد میانی").balance, 17.51336);
  assert.equal(STEEL_CHAIN_DATA.products.slab.scenarios.demand.balance, 2.63);
  assert.equal(STEEL_CHAIN_DATA.products.hot.scenarios.market.breakdown[2].value, 6.8);
  assert.equal(STEEL_CHAIN_DATA.trade.series.find((x) => x.product === "اسلب").values.at(-1), 1764.479104);
  assert.deepEqual(STEEL_CHAIN_DATA.national.nominalSteelMix.map((x) => x.value), [46.25, 18.52]);
  assert.deepEqual(STEEL_CHAIN_DATA.national.nominalSteelMix.map((x) => x.label), ["بیلت و بلوم", "اسلب"]);
  assert.deepEqual(STEEL_CHAIN_DATA.national.nominalSteelCapacity.map((x) => x.value), [47.737, 5.3, 11.7393]);
  assert.ok(Math.abs(STEEL_CHAIN_DATA.national.nominalSteelCapacity.reduce((sum, x) => sum + x.value, 0) - 64.7763) < 1e-9);
  assert.deepEqual(STEEL_CHAIN_DATA.national.energy.nodes.map((x) => x.utilization), [83, 83, 62, 55]);
  assert.deepEqual(STEEL_CHAIN_DATA.national.historicalUtilization.map((x) => x.value), [83, 83, 82, 71]);
  assert.deepEqual(STEEL_CHAIN_DATA.national.scenarioUtilization.at(-1).values, [79, 80, 67, 61]);
  assert.deepEqual(STEEL_CHAIN_DATA.national.weights.map((x) => x.value), [20, 30, 50]);
});

test("steel-chain balances equal supply less demand where both are present", () => {
  const nodeSets = [
    ...Object.values(STEEL_CHAIN_DATA.futureGroup).map((item) => item.nodes),
    ...Object.values(STEEL_CHAIN_DATA.national).filter((item) => "nodes" in item).map((item) => item.nodes),
  ];
  for (const nodes of nodeSets) for (const node of nodes) {
    if (node.demand != null && node.balance != null) assert.ok(Math.abs((node.supply ?? 0) - node.demand - node.balance) < 1e-7, node.product);
  }
});
