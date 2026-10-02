/** Rulebook and source adapter for the portfolio movement path. */
export const YEARS = Object.freeze(Array.from({ length: 9 }, (_, i) => 1406 + i));
export const HORIZONS = Object.freeze([
  { key: "core", label: "هسته اصلی", color: "#176cb5" },
  { key: "adjacent", label: "مجاور", color: "#c89435" },
  { key: "transform", label: "تحولی", color: "#7558a6" },
]);
export const MISSION_OPTIONS = Object.freeze(["مجاز", "مشروط", "خارج از مأموریت"]);
export const MISSION_PENDING = "بررسی‌نشده"; // Legacy persisted policy only.
export const CONDITIONS = Object.freeze([
  "فقط در ارتباط با زنجیره فولاد",
  "فقط با مشارکت شریک راهبردی / صنعتی",
  "فقط از طریق شرکت‌های موجود گروه",
  "مشروط به تأیید سهامدار",
  "مشروط به محدودیت مالکیت / نوع سرمایه‌گذاری",
  "سایر",
]);
export const FOCUS_OPTIONS = Object.freeze(["بررسی عمیق", "رصد", "فعلاً متوقف"]);
export const FOCUS_CONFIG = Object.freeze({ deep: 65, monitor: 40 });
/** Fixed source scenario used by the movement path. Growth-page interactive weights do not override this baseline. */
export const MOVEMENT_BASELINE = Object.freeze({
  opportunityWeights: Object.freeze({ growth: 25, valueAdded: 25, megatrends: 20, inflation: 10, fxExposure: 20 }),
  fitWeights: Object.freeze({ core: 60, adjacent: 30, transform: 10 }),
  label: "سناریوی پایه ثابت موتور فرصت و تناسب",
});
export const ISIC_INDICATORS = Object.freeze([
  { key: "economicSize", label: "اندازه اقتصادی", source: "value_added_usd_latest", weight: 20 },
  { key: "valueCreation", label: "خلق ارزش", source: "va_output_ratio", weight: 20 },
  { key: "investment", label: "شدت سرمایه‌گذاری", source: "gfcf_va_ratio", weight: 20 },
  { key: "productivity", label: "بهره‌وری", source: "va_per_employee_usd", weight: 15 },
  { key: "employmentGrowth", label: "رشد اشتغال", source: "employees_cagr", weight: 15 },
  { key: "firmGrowth", label: "رشد تعداد بنگاه‌ها", source: "establishments_cagr", weight: 10 },
]);
export const ISIC_PRESETS = Object.freeze({
  balanced: { label: "متوازن", weights: { economicSize: 20, valueCreation: 20, investment: 20, productivity: 15, employmentGrowth: 15, firmGrowth: 10 } },
  investment: { label: "سرمایه‌گذاری‌محور", weights: { economicSize: 15, valueCreation: 15, investment: 30, productivity: 10, employmentGrowth: 15, firmGrowth: 15 } },
  value: { label: "خلق ارزش‌محور", weights: { economicSize: 15, valueCreation: 30, investment: 15, productivity: 20, employmentGrowth: 10, firmGrowth: 10 } },
  growth: { label: "رشد‌محور", weights: { economicSize: 15, valueCreation: 15, investment: 15, productivity: 10, employmentGrowth: 25, firmGrowth: 20 } },
});
export const MIN_ISIC_INDICATORS = 4;
export const MIN_ISIC_WEIGHT_COVERAGE = 70;

/** @param {Record<string, number>} input @returns {Record<string, number>} */
export function normalizeWeights(input) {
  const positive = Object.fromEntries(ISIC_INDICATORS.map(({ key }) => {
    const value = Number(input?.[key]);
    return [key, Number.isFinite(value) ? Math.max(0, value) : 0];
  }));
  const total = Object.values(positive).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { ...ISIC_PRESETS.balanced.weights };
  const scaled = Object.fromEntries(Object.entries(positive).map(([key, value]) => [key, (value / total) * 100]));
  // Largest remainder at a tenth of a percent preserves nonnegative weights and exactly 100%.
  const units = Object.entries(scaled).map(([key, value]) => ({ key, units: Math.floor(value * 10), fraction: value * 10 - Math.floor(value * 10) }));
  let remaining = 1000 - units.reduce((sum, item) => sum + item.units, 0);
  for (const item of [...units].sort((a, b) => b.fraction - a.fraction || a.key.localeCompare(b.key)).slice(0, remaining)) item.units++;
  return Object.fromEntries(units.map(({ key, units: count }) => [key, count / 10]));
}

function eligibleActivities(records) {
  // Scoring eligibility is independent of the certainty of a parent mapping.
  return records.filter((row) => row.readiness !== "داده ناکافی" && ISIC_INDICATORS.filter(({ key }) => Number.isFinite(row.indicators?.[key])).length >= MIN_ISIC_INDICATORS);
}

function midPercentile(values, current) {
  if (values.length <= 1) return 50;
  const less = values.filter((value) => value < current).length;
  const equal = values.filter((value) => value === current).length;
  return ((less + (equal - 1) / 2) / (values.length - 1)) * 100;
}

/** @param {any[]} records @param {Record<string, number>} inputWeights @param {number[]|null} targetSectorIds */
export function scoreIsicActivities(records, inputWeights = ISIC_PRESETS.balanced.weights) {
  const weights = normalizeWeights(inputWeights);
  const eligible = eligibleActivities(records);
  const peerIds = new Set(eligible.map((row) => row.code));
  // Percentile comparisons are made only within a common ISIC resolution.
  // Legacy fixtures without a level share one explicit fallback group.
  const levelOf = (row) => row.isicLevel || "سطح نامشخص";
  const percentiles = Object.fromEntries(ISIC_INDICATORS.map(({ key }) => {
    const byLevel = new Map();
    for (const row of eligible) {
      const value = row.indicators?.[key];
      if (!Number.isFinite(value)) continue;
      const level = levelOf(row);
      const entries = byLevel.get(level) ?? [];
      entries.push([row.code, value]);
      byLevel.set(level, entries);
    }
    const scores = new Map();
    for (const entries of byLevel.values()) {
      const values = entries.map(([, value]) => value);
      for (const [code, value] of entries) scores.set(code, midPercentile(values, value));
    }
    return [key, scores];
  }));

  // Calculation universe is always the complete master file. Mission and Focus
  // may control which results are displayed, but must never alter percentile peers or ranks.
  const activities = records.map((row) => {
    const available = ISIC_INDICATORS.filter(({ key }) => Number.isFinite(row.indicators?.[key]));
    const totalWeight = available.reduce((sum, { key }) => sum + weights[key], 0);
    const scoreable = peerIds.has(row.code);
    const reliable = scoreable && totalWeight >= MIN_ISIC_WEIGHT_COVERAGE && totalWeight > 0;
    const mappingValid = row.include && row.parentId !== null && Number.isInteger(Number(row.parentId)) && row.mappingConfidence !== "Multi";
    const score = reliable
      ? available.reduce((sum, { key }) => sum + percentiles[key].get(row.code) * weights[key], 0) / totalWeight
      : null;
    const normalizedWeights = reliable ? Object.fromEntries(available.map(({ key }) => [key, weights[key] / totalWeight * 100])) : null;
    const contributions = reliable ? Object.fromEntries(available.map(({ key }) => [key, percentiles[key].get(row.code) * normalizedWeights[key] / 100])) : null;
    const dataStatus = !scoreable ? "داده ناکافی" : !reliable ? "پوشش داده برای این سناریو ناکافی است" : row.readiness === "قابل استفاده با احتیاط" || row.quality === "قابل استفاده با احتیاط" ? "قابل استفاده با احتیاط" : "آماده تحلیل";
    return { ...row, isicLevel: levelOf(row), score, percentiles: scoreable ? Object.fromEntries(available.map(({ key }) => [key, percentiles[key].get(row.code)])) : null, availableCount: available.length, weightCoverage: totalWeight, normalizedWeights, contributions, mappingEligible: mappingValid, mappingStatus: mappingValid ? "نگاشت قطعی" : row.mappingConfidence === "Multi" ? "نگاشت چندگانه / نیازمند تعیین تکلیف بخش مادر" : "نگاشت نامشخص", dataStatus };
  });

  const rankWithinLevel = new Map();
  const byLevel = new Map();
  for (const row of activities.filter((item) => Number.isFinite(item.score))) {
    const entries = byLevel.get(row.isicLevel) ?? [];
    entries.push(row);
    byLevel.set(row.isicLevel, entries);
  }
  for (const entries of byLevel.values()) {
    entries.sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
    entries.forEach((row, index) => rankWithinLevel.set(row.code, index + 1));
  }
  for (const row of activities) row.rank = rankWithinLevel.get(row.code) ?? null;

  const grouped = new Map();
  for (const row of activities.filter((item) => item.mappingEligible)) {
    const list = grouped.get(row.parentId) ?? [];
    list.push(row);
    grouped.set(row.parentId, list);
  }
  const sectors = Object.fromEntries([...grouped].map(([parentId, rows]) => {
    // Prefer detailed 4-digit observations for the parent score. If only 3-digit
    // activities exist, retain them while marking the result as aggregated.
    const validAll = rows.filter((row) => Number.isFinite(row.score));
    const preferredLevel = validAll.some((row) => row.isicLevel === "ISIC 4-digit") ? "ISIC 4-digit" : validAll.some((row) => row.isicLevel === "ISIC 3-digit") ? "ISIC 3-digit" : validAll[0]?.isicLevel ?? null;
    const valid = validAll.filter((row) => row.isicLevel === preferredLevel).sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
    if (!valid.length) return [parentId, { score: null, best: null, topThree: [], validCount: 0, activityCount: rows.length, level: null, averageCoverage: null, dataStatus: "داده ناکافی" }];
    const sorted = valid.map((row) => row.score).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return [parentId, { score: median, best: valid[0], topThree: valid.slice(0, 3), validCount: valid.length, activityCount: rows.length, level: preferredLevel, averageCoverage: valid.reduce((sum, row) => sum + row.weightCoverage, 0) / valid.length, dataStatus: preferredLevel === "ISIC 3-digit" ? "دارای داده تفصیلی؛ سطح تجمیعی" : "دارای داده تفصیلی" }];
  }));
  for (const level of ["ISIC 4-digit", "ISIC 3-digit"]) {
    Object.entries(sectors).filter(([, sector]) => sector.level === level && Number.isFinite(sector.score))
      .sort(([idA, a], [idB, b]) => b.score - a.score || Number(idA) - Number(idB))
      .forEach(([id], index) => { sectors[id].rank = index + 1; });
  }
  return { activities, sectors, weights };
}

/** @param {number} combinedScore @param {{deep:number;monitor:number}} thresholds */
export function suggestFocus(combinedScore, thresholds = FOCUS_CONFIG) {
  if (!Number.isFinite(combinedScore)) return "رصد";
  return combinedScore >= thresholds.deep ? "بررسی عمیق" : combinedScore >= thresholds.monitor ? "رصد" : "فعلاً متوقف";
}
export function resolveFocus(combinedScore, thresholds, managerChoice, hasOverride) {
  return hasOverride && FOCUS_OPTIONS.includes(managerChoice) ? managerChoice : suggestFocus(combinedScore, thresholds);
}

export function hasValidCondition(status, condition) {
  if (status !== "مشروط") return true;
  const key = typeof condition === "string" ? condition : condition?.key;
  if (!key) return false;
  if (key === "سایر") return Boolean((typeof condition === "object" ? condition?.note : "")?.trim());
  return CONDITIONS.includes(key);
}
export function passesMissionGate(status, condition) { return (status === "مجاز" || status === "مشروط") && hasValidCondition(status, condition); }
export function canEnterDetailedAnalysis(status, focus, hasMappedData, condition) {
  return passesMissionGate(status, condition) && focus === "بررسی عمیق" && hasMappedData === true;
}
export function canSelectPortfolio(status, condition) {
  return passesMissionGate(status, condition);
}

/** Fixed identity of a movement-path opportunity, using the approved 60/30/10 baseline only. */
export function weightedHorizon(coreFit, adjacentFit, transformFit, weights = /** @type {{core:number;adjacent:number;transform:number}} */ (MOVEMENT_BASELINE.fitWeights)) {
  return [
    { key: "core", value: coreFit * weights.core },
    { key: "adjacent", value: adjacentFit * weights.adjacent },
    { key: "transform", value: transformFit * weights.transform },
  ].sort((a, b) => b.value - a.value)[0].key;
}
export function baselineHorizon(coreFit, adjacentFit, transformFit) { return weightedHorizon(coreFit, adjacentFit, transformFit); }

export const SELECTION_WEIGHTS = Object.freeze({ macro: 50, detail: 30, board: 20 });
export function selectionScore(macro, detail, board, weights = /** @type {{macro:number;detail:number;board:number}} */ (SELECTION_WEIGHTS)) {
  const available = { macro: Number.isFinite(macro), detail: Number.isFinite(detail), board: [1, 2, 3, 4, 5].includes(board) };
  const values = { macro, detail, board: available.board ? (board - 1) * 25 : null };
  const denominator = Object.keys(values).reduce((sum, key) => sum + (available[key] ? Math.max(0, Number(weights[key]) || 0) : 0), 0);
  if (!available.macro || denominator <= 0) return { score: available.macro ? macro : null, components: [], denominator };
  const components = Object.keys(values).filter(key => available[key] && Number(weights[key]) > 0).map(key => ({ key, value: values[key], effectiveWeight: Number(weights[key]) / denominator * 100 }));
  return { score: components.reduce((sum, part) => sum + part.value * part.effectiveWeight / 100, 0), components, denominator };
}
export function updateVisionShare(shares, key, raw) {
  const value = Math.round(Math.max(0, Math.min(100, Number(raw) || 0)) * 10) / 10;
  const others = HORIZONS.map(row => row.key).filter(item => item !== key);
  const old = others.reduce((sum, item) => sum + shares[item], 0);
  const first = old ? Math.round((100 - value) * shares[others[0]] / old * 10) / 10 : Math.round((100 - value) * 5) / 10;
  return { ...shares, [key]: value, [others[0]]: first, [others[1]]: Math.round((100 - value - first) * 10) / 10 };
}

export const parentBasketKey = id => `parent:${id}`;
export const activityBasketKey = code => `activity:${code}`;
export function canAddBasket(existing, key, parentId, lookup = {}) {
  if (key.startsWith("parent:")) return !Object.keys(existing ?? {}).some(candidate => candidate.startsWith("activity:") && (existing[candidate]?.parentId ?? lookup[candidate]?.parentId) === parentId);
  return !Object.hasOwn(existing ?? {}, parentBasketKey(parentId));
}
export function validateBasket(shares, basket, lookup) {
  const totals = { core: 0, adjacent: 0, transform: 0 };
  if (!validatePortfolioShares(shares)) return { valid: false, reason: "جمع سهم‌های سال باید ۱۰۰٪ باشد.", totals };
  for (const [key, item] of Object.entries(basket ?? {})) {
    const row = lookup[key];
    const amount = Number(item?.share);
    if (!row || !Number.isFinite(amount) || amount < 0 || amount > 100) return { valid: false, reason: "سبد شامل فرصت یا درصد نامعتبر است.", totals };
    if (!canAddBasket(Object.fromEntries(Object.entries(basket).filter(([id]) => id !== key)), key, row.parentId, lookup)) return { valid: false, reason: "حوزه مادر و زیر‌بخش آن نباید هم‌زمان تخصیص بگیرند.", totals };
    if (!passesMissionGate(row.mission, row.condition)) return { valid: false, reason: "فرصت خارج از مأموریت در سبد است.", totals };
    totals[row.horizon] += amount;
  }
  const valid = HORIZONS.every(({key}) => Math.abs(totals[key] - shares[key]) < 1e-6);
  return { valid, reason: valid ? "تخصیص سال با هدف هر افق برابر است." : "سهم تخصیص‌یافته هر افق باید به هدف همان افق برسد.", totals };
}

export function annualPortfolioOutput(currentTargets = {}, currentRows = [], basket = {}, lookup = {}) {
  const totals = { core: 0, adjacent: 0, transform: 0 };
  const entries = [];
  for (const [index, row] of currentRows.entries()) {
    const share = Number(currentTargets[index] ?? 0);
    if (!Number.isFinite(share) || share < 0 || share > 100) return { valid: false, reason: "سهم دارایی موجود نامعتبر است.", totals, total: NaN, entries: [] };
    if (share <= 0) continue;
    if (!Object.hasOwn(totals, row.horizon)) return { valid: false, reason: "طبقه دارایی موجود نامعتبر است.", totals, total: NaN, entries: [] };
    totals[row.horizon] += share;
    entries.push({ key: `current:${index}`, name: row.name, horizon: row.horizon, share, source: "current" });
  }
  for (const [key, value] of Object.entries(basket ?? {})) {
    const row = lookup[key], share = Number(value?.share ?? 0);
    if (!row || !Number.isFinite(share) || share < 0 || share > 100) return { valid: false, reason: "سهم فرصت منتخب نامعتبر است.", totals, total: NaN, entries: [] };
    if (share <= 0) continue;
    totals[row.horizon] += share;
    entries.push({ key, name: row.name, horizon: row.horizon, share, source: "opportunity", parentId: row.parentId });
  }
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return { valid: true, reason: "خروجی پرتفوی محاسبه شد.", totals, total, entries };
}

export function validateAnnualPortfolio(shares, currentTargets, currentRows, basket, lookup) {
  const basketCheck = validateBasket({ core: 100, adjacent: 0, transform: 0 }, basket, lookup);
  // validateBasket's target comparison is intentionally ignored here; its structural checks remain authoritative.
  if (basketCheck.reason.includes("نباید") || basketCheck.reason.includes("نامعتبر") || basketCheck.reason.includes("مأموریت")) return basketCheck;
  if (!validatePortfolioShares(shares)) return { valid: false, reason: "جمع هدف سیاستی سال باید ۱۰۰٪ باشد.", totals: null, total: null, entries: [] };
  const output = annualPortfolioOutput(currentTargets, currentRows, basket, lookup);
  if (!output.valid) return output;
  const matches = HORIZONS.every(({ key }) => Math.abs(output.totals[key] - shares[key]) < 1e-6);
  return { ...output, valid: matches, reason: matches ? "خروجی هر افق با هدف سیاستی همان سال برابر است." : "خروجی واقعی هر افق هنوز با هدف سیاستی سال برابر نشده است." };
}

export function movementLabel(previous, current) {
  const before = Number(previous) || 0, after = Number(current) || 0;
  if (before <= 0 && after > 0) return "ورود";
  if (before > 0 && after <= 0) return "خروج";
  if (after > before + 1e-9) return "افزایش";
  if (after < before - 1e-9) return "کاهش";
  if (after > 0) return "حفظ";
  return "—";
}

export function validatePortfolioShares(shares) {
  const values = [shares?.core, shares?.adjacent, shares?.transform];
  return values.every((value) => Number.isFinite(value) && value >= 0) && Math.abs(values.reduce((sum, value) => sum + value, 0) - 100) < 1e-9;
}

/** First-year gap is always Current → 1406 Target, independent of the selected year in the UI. */
export function portfolioGap(currentMix, targetMix) {
  return Object.fromEntries(HORIZONS.map(({ key }) => [key, Number(targetMix?.[key] ?? 0) - Number(currentMix?.[key] ?? 0)]));
}

/** Positive delta means the activity moved up from the balanced baseline rank. */
export function calculateRankDelta(baselineRank, currentRank) {
  return Number(baselineRank) - Number(currentRank);
}
export function rankSingleIndicator(activities, key, parentId = null) {
  return activities.filter(row => row.score != null && Number.isFinite(row.percentiles?.[key]) && (parentId == null || row.parentId === parentId))
    .sort((a, b) => b.percentiles[key] - a.percentiles[key] || String(a.code).localeCompare(String(b.code)));
}

export function updateIndependentShare(shares, key, value) {
  const bounded = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
  return { ...shares, [key]: bounded };
}

export function validateYearAllocation(shares, allocationById, rows) {
  if (!validatePortfolioShares(shares)) return { valid: false, reason: "مجموع سهم‌های سال باید ۱۰۰٪ باشد.", totals: null };
  const totals = Object.fromEntries(HORIZONS.map(({ key }) => [key, 0]));
  const rowIds = new Set(rows.map((row) => String(row.id)));
  if (Object.keys(allocationById ?? {}).some((id) => !rowIds.has(id))) return { valid: false, reason: "تخصیص دارای شناسه فرصت نامعتبر است.", totals };
  for (const row of rows) {
    const amount = Number(allocationById?.[row.id] ?? 0);
    if (!Number.isFinite(amount) || amount < 0) return { valid: false, reason: "درصد تخصیص باید صفر یا بیشتر باشد.", totals };
    if (!passesMissionGate(row.mission, row.condition)) {
      if (amount > 0) return { valid: false, reason: "فرصت خارج از دامنه انتخاب، تخصیص گرفته است.", totals };
      continue;
    }
    if (totals[row.horizon] === undefined) return { valid: false, reason: `طبقه نامعتبر برای فرصت ${row.id}.`, totals };
    totals[row.horizon] += amount;
  }
  const matches = HORIZONS.every(({ key }) => Math.abs(totals[key] - shares[key]) < 1e-9);
  return { valid: matches, reason: matches ? "تخصیص هر افق با سهم هدف آن برابر است." : "مجموع درصد فرصت‌های منتخب باید در هر افق دقیقاً با سهم هدف همان افق برابر شود.", totals };
}

/** Remove every saved allocation for an opportunity after it leaves the eligible mission set. */
export function removeOpportunityAllocations(allocations, opportunityId) {
  const next = Object.fromEntries(Object.entries(allocations ?? {}).map(([year, values]) => {
    const copy = { ...(values ?? {}) };
    delete copy[opportunityId];
    delete copy[String(opportunityId)];
    return [year, copy];
  }));
  return next;
}

/** Restore persisted user policy defensively; malformed or ineligible allocations are discarded. */
export function restoreMovementState(saved, rows = [], activities = []) {
  const defaults = defaultMovementState();
  if (!saved || typeof saved !== "object") {
    defaults.mission = Object.fromEntries(rows.map((row) => [Number(row.id), "مجاز"]));
    defaults.focus = Object.fromEntries(rows.map((row) => [Number(row.id), suggestFocus(row.priority, FOCUS_CONFIG)]));
    return defaults;
  }
  const validIds = new Set(rows.map((row) => Number(row.id)));
  const mission = {};
  const conditions = {};
  const focus = {};
  const focusOverride = {};
  const board = {};
  const { deep, monitor } = FOCUS_CONFIG;
  for (const row of rows) {
    const id = Number(row.id);
    const status = MISSION_OPTIONS.includes(saved.mission?.[id]) ? saved.mission[id] : "مجاز";
    mission[id] = status;
    const condition = saved.conditions?.[id];
    conditions[id] = { key: typeof condition?.key === "string" ? condition.key : "", note: typeof condition?.note === "string" ? condition.note : "" };
    const savedFocus = saved.focus?.[id];
    const systemFocus = suggestFocus(row.priority, { deep, monitor });
    // Older exports stored a copy of each suggestion; infer an override only when it differs.
    const override = FOCUS_OPTIONS.includes(savedFocus) && (saved.focusOverride?.[id] === true || (saved.focusOverride?.[id] == null && savedFocus !== systemFocus));
    focusOverride[id] = override;
    focus[id] = override && FOCUS_OPTIONS.includes(savedFocus) ? savedFocus : systemFocus;
    const preference = saved.board?.[id];
    const score = preference?.score;
    const validScore = score == null || [1, 2, 3, 4, 5].includes(Number(score));
    if (validScore && (score != null || preference?.reason)) {
      board[id] = { score: score == null ? null : Number(score), reason: typeof preference?.reason === "string" ? preference.reason : "" };
    }
  }
  const annualShares = Object.fromEntries(YEARS.map((year) => {
    const value = saved.annualShares?.[year];
    const shares = Object.fromEntries(HORIZONS.map(({ key }) => [key, value?.[key] == null || value?.[key] === "" ? defaults.annualShares[year][key] : clamp(Number(value[key]), 0, 100, defaults.annualShares[year][key])]));
    return [year, shares];
  }));
  const allocations = Object.fromEntries(YEARS.map((year) => {
    const entries = Object.entries(saved.allocations?.[year] ?? {}).flatMap(([rawId, rawValue]) => {
      const id = Number(rawId), row = rows.find((item) => Number(item.id) === id), amount = Number(rawValue);
      return row && validIds.has(id) && canSelectPortfolio(mission[id], conditions[id]) && Number.isFinite(amount) && amount >= 0 && amount <= 100 ? [[id, amount]] : [];
    });
    return [year, Object.fromEntries(entries)];
  }));
  const isicPreset = Object.hasOwn(ISIC_PRESETS, saved.isicPreset) || saved.isicPreset === "custom" ? saved.isicPreset : "balanced";
  const customWeights = normalizeWeights(saved.customWeights ?? ISIC_PRESETS.balanced.weights);
  const rowsForValidation = rows.map((row) => ({ ...row, mission: mission[row.id], condition: conditions[row.id] }));
  const annualApproval = Object.fromEntries(YEARS.map((year) => {
    const approval = saved.annualApproval?.[year];
    const changedShares = HORIZONS.some(({ key }) => annualShares[year][key] !== defaults.annualShares[year][key]);
    const hasAllocations = Object.values(allocations[year]).some((value) => value > 0);
    const initial = ["default", "draft", "approved"].includes(approval) ? approval : changedShares || hasAllocations ? "draft" : "default";
    const valid = validateYearAllocation(annualShares[year], allocations[year], rowsForValidation).valid;
    return [year, initial === "approved" && !valid ? "draft" : initial === "default" && (changedShares || hasAllocations) ? "draft" : initial];
  }));
  const currentClassification = Object.fromEntries(Object.entries(saved.currentClassification ?? {}).flatMap(([key, entry]) => {
    const value = typeof entry === "object" && entry !== null ? entry : {};
    return ["core", "adjacent", "transform"].includes(value.horizon) ? [[key, { horizon: value.horizon, confirmed: value.confirmed === true, sourceName: typeof value.sourceName === "string" ? value.sourceName : undefined }]] : [];
  }));
  const currentTargets = Object.fromEntries(YEARS.map(year => [year, Object.fromEntries(Object.entries(saved.currentTargets?.[year] ?? {}).flatMap(([key, value]) => Number.isInteger(Number(key)) && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100 ? [[key, Number(value)]] : []))]));
  const vision = validatePortfolioShares(saved.vision) ? saved.vision : validatePortfolioShares(saved.annualShares?.[1414]) ? saved.annualShares[1414] : defaults.vision;
  const selectionWeights = validateSelectionWeights(saved.selectionWeights) ? saved.selectionWeights : { ...SELECTION_WEIGHTS };
  const activityBoard = Object.fromEntries(Object.entries(saved.activityBoard ?? {}).filter(([key, value]) => /^\d{2,4}$/.test(key) && [1,2,3,4,5].includes(value?.score)).map(([key, value]) => [key, { score: value.score, reason: typeof value.reason === "string" ? value.reason.slice(0, 300) : "" }]));
  const activityParents = new Map(activities.filter(row => row.mappingConfidence !== "Multi" && row.parentId != null).map(row => [String(row.code), Number(row.parentId)]));
  const baskets = Object.fromEntries(YEARS.map(year => [year, Object.fromEntries(Object.entries(saved.baskets?.[year] ?? {}).flatMap(([key, item]) => {
    const match = /^(parent|activity):(\d+)$/.exec(key);
    if (!match || !Number.isFinite(Number(item?.share)) || Number(item.share) < 0) return [];
    const parent = match[1] === "parent" ? Number(match[2]) : activityParents.get(match[2]) ?? Number(item?.parentId);
    if (!validIds.has(parent) || !canSelectPortfolio(mission[parent], conditions[parent])) return [];
    return [[key, { share: Number(item.share), ...(Number.isInteger(item.priorityRank)&&item.priorityRank>0?{priorityRank:item.priorityRank}:{}), parentId: parent }]];
  }))]));
  // Legacy parent-only allocations are kept as draft basket entries.
  for (const year of YEARS) for (const [id, amount] of Object.entries(allocations[year])) if (!Object.hasOwn(baskets[year], parentBasketKey(id))) baskets[year][parentBasketKey(id)] = { share: amount };
  annualShares[1414] = { ...vision };
  return { ...defaults, mission, conditions, focus, focusOverride, thresholds: { deep, monitor }, board, activityBoard, vision, visionLocked: saved.visionLocked === true, selectionWeights, annualShares, annualApproval, allocations, baskets, currentTargets, currentClassification, scenarioTitle: typeof saved.scenarioTitle === "string" ? saved.scenarioTitle.slice(0, 120) : "", isicPreset, customWeights };
}

function validateSelectionWeights(value) {
  return value && ["macro", "detail", "board"].every(key => Number.isFinite(Number(value[key])) && Number(value[key]) >= 0) && Math.abs(Number(value.macro) + Number(value.detail) + Number(value.board) - 100) < 1e-6;
}

function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

/** Portfolio source audit: keep every source row, but flag alias-like duplicate exposure for review. */
export function auditCurrentPortfolio(records) {
  const warnings = [{ type: "classification-method" }];
  const groups = new Map();
  const normalizeName = (name) => String(name ?? "").replace(/[0-9۰-۹٠-٩]+$/u, "").replaceAll("ي", "ی").replaceAll("ك", "ک").replaceAll("‌", " ").replace(/\s+/g, " ").trim();
  for (const row of records ?? []) {
    const key = normalizeName(row.name);
    const values = groups.get(key) ?? [];
    values.push(row);
    groups.set(key, values);
  }
  for (const [name, group] of groups) {
    if (group.length < 2) continue;
    const sameExposure = group.every((row) => row.portfolioShare === group[0].portfolioShare && row.attributableValue === group[0].attributableValue);
    const horizons = new Set(group.map((row) => row.horizon));
    warnings.push({ type: "possible-duplicate", name, count: group.length, sameExposure, classificationConflict: horizons.size > 1 });
  }
  const total = (records ?? []).reduce((sum, row) => sum + (Number.isFinite(row.portfolioShare) ? row.portfolioShare : 0), 0);
  if (Math.abs(total - 1) > 0.01) warnings.push({ type: "share-total", total });
  if ((records ?? []).some((row) => !["هسته", "مجاور", "تحولی"].includes(row.horizon))) warnings.push({ type: "unknown-class" });
  return warnings;
}

/** Keep unconfirmed source classes visible for review without silently asserting equivalence. */
export function currentPortfolioMix(records, classification = {}) {
  const totals = { core: 0, adjacent: 0, transform: 0 };
  const sourceClasses = { "هسته": "core", "مجاور": "adjacent", "تحولی": "transform" };
  let confirmed = 0;
  for (const [index, row] of (records ?? []).entries()) {
    const decision = classification[index]?.sourceName && classification[index].sourceName !== row.name ? null : classification[index];
    const key = decision?.horizon ?? sourceClasses[row.horizon];
    if (Object.hasOwn(totals, key)) totals[key] += Number(row.portfolioShare) || 0;
    if (decision?.confirmed && decision?.horizon === key) confirmed++;
  }
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return { mix: Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, total ? 100 * value / total : 0])), confirmed, total: (records ?? []).length };
}

export function defaultMovementState() {
  const annualShares = Object.fromEntries(YEARS.map((year) => [year, { core: 60, adjacent: 30, transform: 10 }]));
  const annualApproval = Object.fromEntries(YEARS.map((year) => [year, "default"]));
  const allocations = Object.fromEntries(YEARS.map((year) => [year, {}]));
  return { mission: {}, conditions: {}, focus: {}, focusOverride: {}, thresholds: { ...FOCUS_CONFIG }, board: {}, activityBoard: {}, vision: { ...MOVEMENT_BASELINE.fitWeights }, visionLocked: false, selectionWeights: { ...SELECTION_WEIGHTS }, annualShares, annualApproval, allocations, baskets: Object.fromEntries(YEARS.map(year => [year, {}])), currentTargets: Object.fromEntries(YEARS.map(year => [year, {}])), currentClassification: {}, scenarioTitle: "", isicPreset: "balanced", customWeights: { ...ISIC_PRESETS.balanced.weights } };
}
