import test from "node:test";
import assert from "node:assert/strict";
import {
  applyManagementAdjustment,
  clampManagementEffect,
  normalizeManagementAdjustments,
} from "../lib/management-adjustment.mjs";

test("management adjustment is proportional, bounded and score-safe", () => {
  assert.equal(applyManagementAdjustment(5, 20), 6);
  assert.equal(applyManagementAdjustment(5, -20), 4);
  assert.equal(applyManagementAdjustment(9, 20), 10);
  assert.equal(applyManagementAdjustment(5, 30), 6);
  assert.equal(applyManagementAdjustment(null, 10), null);
});

test("configurable limit never exceeds twenty percent", () => {
  assert.equal(clampManagementEffect(18, 12), 12);
  assert.equal(clampManagementEffect(-18, 12), -12);
  assert.equal(clampManagementEffect(50, 40), 20);
  assert.deepEqual(normalizeManagementAdjustments({ الف: { financial: 18, market: -17 } }, 10), {
    الف: { financial: 10, market: -10 },
  });
});
