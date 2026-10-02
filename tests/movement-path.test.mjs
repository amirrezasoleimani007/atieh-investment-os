import test from "node:test";
import assert from "node:assert/strict";
import master from "../public/data/movement-master-data.json" with { type: "json" };
import portfolio from "../public/data/portfolio.json" with { type: "json" };
import {
  FOCUS_CONFIG, HORIZONS, ISIC_INDICATORS, ISIC_PRESETS, YEARS, canEnterDetailedAnalysis,
  MISSION_PENDING, MOVEMENT_BASELINE, auditCurrentPortfolio, baselineHorizon, canSelectPortfolio, defaultMovementState, normalizeWeights, passesMissionGate, scoreIsicActivities,
  suggestFocus, updateIndependentShare, validatePortfolioShares, validateYearAllocation, portfolioGap, removeOpportunityAllocations, restoreMovementState,
  calculateRankDelta, currentPortfolioMix, MIN_ISIC_WEIGHT_COVERAGE, resolveFocus,
} from "../lib/movement-model.mjs";

test("the source adapter has 145 rows and real 77-sector primary mappings", () => {
  assert.equal(master.length, 145);
  assert.ok(master.some((row) => row.include && row.parentId === 7));
  assert.ok(master.filter((row) => row.parentId !== null).every((row) => Number.isInteger(row.parentId) && row.parentName));
  assert.ok(master.every((row) => ["ISIC 3-digit", "ISIC 4-digit"].includes(row.isicLevel)));
  assert.ok(master.every((row) => Array.isArray(row.persianExamples) && row.dataPeriod && row.dataPeriod.start && row.dataPeriod.end));
  assert.equal(new Set(master.map((row) => row.parentId).filter(Number.isInteger)).size, 28);
  assert.equal(ISIC_INDICATORS.length, 6);
  assert.equal(ISIC_INDICATORS.find((indicator) => indicator.key === "investment").label, "شدت سرمایه‌گذاری");
  assert.ok(master.every((row) => row.dataPeriod && row.dataPeriod.start && row.dataPeriod.end));
});

test("Mission Gate and Focus Gate remain separate from model scores", () => {
  assert.equal(passesMissionGate("مجاز"), true);
  assert.equal(passesMissionGate("مشروط"), false);
  assert.equal(passesMissionGate("مشروط", { key: "مرتبط با زنجیره فولاد", note: "" }), false);
  assert.equal(passesMissionGate("مشروط", { key: "سایر", note: "" }), false);
  assert.equal(passesMissionGate("مشروط", { key: "سایر", note: "فقط در این مورد" }), true);
  assert.equal(passesMissionGate(MISSION_PENDING), false);
  assert.equal(passesMissionGate("خارج از مأموریت"), false);
  assert.equal(canEnterDetailedAnalysis("مجاز", "بررسی عمیق", true), true);
  assert.equal(canEnterDetailedAnalysis("خارج از مأموریت", "بررسی عمیق", true), false);
  assert.equal(canEnterDetailedAnalysis("مشروط", "رصد", true), false);
  assert.equal(canEnterDetailedAnalysis("مجاز", "بررسی عمیق", false), false);
  assert.equal(canSelectPortfolio("مجاز", "رصد"), true);
  assert.equal(canSelectPortfolio("مجاز", "فعلاً متوقف"), true);
  assert.equal(canSelectPortfolio("مشروط", ""), false);
  assert.equal(suggestFocus(FOCUS_CONFIG.deep), "بررسی عمیق");
  assert.equal(suggestFocus(FOCUS_CONFIG.monitor), "رصد");
});

test("weight presets normalize to exactly 100 and weights change sub-sector rankings", () => {
  for (const preset of Object.values(ISIC_PRESETS)) {
    assert.equal(Object.values(normalizeWeights(preset.weights)).reduce((sum, value) => sum + value, 0), 100);
  }
  const balanced = scoreIsicActivities(master, ISIC_PRESETS.balanced.weights);
  const investment = scoreIsicActivities(master, ISIC_PRESETS.investment.weights);
  const rank = (result) => result.activities.filter((row) => row.score != null).sort((a, b) => a.isicLevel.localeCompare(b.isicLevel) || a.rank - b.rank).map((row) => row.code);
  assert.notDeepEqual(rank(balanced), rank(investment));
  assert.equal(Object.values(balanced.weights).reduce((sum, value) => sum + value, 0), 100);
});

test("3-digit and 4-digit activities are ranked within separate peer groups", () => {
  const record = (code, level, values) => ({ code, isicLevel: level, parentId: 1, include: true, readiness: "آماده تحلیل", indicators: { economicSize: values, valueCreation: values, investment: values, productivity: values, employmentGrowth: values, firmGrowth: values } });
  const result = scoreIsicActivities([
    record("301", "ISIC 3-digit", 1), record("302", "ISIC 3-digit", 2),
    record("4011", "ISIC 4-digit", 100), record("4012", "ISIC 4-digit", 200),
  ]);
  const byCode = Object.fromEntries(result.activities.map(row => [row.code, row]));
  assert.equal(byCode["301"].percentiles.economicSize, 0);
  assert.equal(byCode["302"].percentiles.economicSize, 100);
  assert.equal(byCode["4011"].percentiles.economicSize, 0);
  assert.equal(byCode["4012"].percentiles.economicSize, 100);
  assert.equal(byCode["4012"].rank, 1);
  assert.equal(result.sectors[1].level, "ISIC 4-digit");
});

test("mission defaults to allowed and board preference starts blank", () => {
  const state = defaultMovementState();
  assert.deepEqual(state.mission, {});
  assert.deepEqual(state.board, {});
  assert.equal(MISSION_PENDING, "بررسی‌نشده");
});

test("movement horizon identity uses only fixed baseline contributions", () => {
  assert.deepEqual(MOVEMENT_BASELINE.fitWeights,{core:60,adjacent:30,transform:10});
  assert.deepEqual(MOVEMENT_BASELINE.opportunityWeights,{growth:25,valueAdded:25,megatrends:20,inflation:10,fxExposure:20});
  assert.equal(baselineHorizon(9, 4, 1), "core");
  assert.equal(baselineHorizon(5, 11, 1), "adjacent");
  assert.equal(baselineHorizon(1, 3, 20), "transform");
  assert.equal(calculateRankDelta(12,4),8);
  assert.equal(calculateRankDelta(3,10),-7);
  assert.equal(calculateRankDelta(5,5),0);
});

test("missing values are excluded and sparse activities report insufficient data", () => {
  const rows = [
    { code: "a", parentId: 1, include: true, readiness: "آماده تحلیل", indicators: { economicSize: 1, valueCreation: 1, investment: 1, productivity: 1, employmentGrowth: 1, firmGrowth: 1 } },
    { code: "b", parentId: 1, include: true, readiness: "آماده تحلیل", indicators: { economicSize: 9, valueCreation: 9, investment: 9, productivity: 9, employmentGrowth: 9, firmGrowth: 9 } },
    { code: "c", parentId: 2, include: true, readiness: "آماده تحلیل", indicators: { economicSize: 5, valueCreation: 5, investment: null, productivity: null, employmentGrowth: null, firmGrowth: null } },
    { code: "d", parentId: 2, include: true, readiness: "داده ناکافی", indicators: { economicSize: 0, valueCreation: 0, investment: 0, productivity: 0, employmentGrowth: 0, firmGrowth: 0 } },
  ];
  const result = scoreIsicActivities(rows);
  assert.equal(result.activities.find((row) => row.code === "c").score, null);
  assert.equal(result.activities.find((row) => row.code === "c").dataStatus, "داده ناکافی");
  assert.equal(result.activities.find((row) => row.code === "d").score, null);
  assert.equal(result.activities.find((row) => row.code === "d").dataStatus, "داده ناکافی");
  assert.equal(result.sectors[2].score, null);
  assert.equal(result.sectors[2].activityCount, 2);
  assert.equal(result.sectors[1].validCount, 2);
});

test("parent-sector score is the median and reports best plus top three", () => {
  const result = scoreIsicActivities(master, ISIC_PRESETS.balanced.weights);
  const sector = Object.values(result.sectors).find((row) => row.validCount >= 3);
  assert.ok(sector);
  assert.equal(sector.topThree.length, Math.min(3, sector.validCount));
  assert.equal(sector.best.code, sector.topThree[0].code);
  assert.ok(Number.isFinite(sector.score) && sector.score >= 0 && sector.score <= 100);
});

test("Focus never changes the fixed ISIC calculation universe or rank", () => {
  const full = scoreIsicActivities(master, ISIC_PRESETS.balanced.weights);
  const targetId = Number(Object.keys(full.sectors).find((id) => full.sectors[id].validCount > 0));
  const afterFocusChange = scoreIsicActivities(master, ISIC_PRESETS.balanced.weights, [targetId]);
  assert.equal(afterFocusChange.activities.length, full.activities.length);
  assert.deepEqual(afterFocusChange.activities.map((row) => [row.code,row.rank,row.score]), full.activities.map((row) => [row.code,row.rank,row.score]));
  assert.deepEqual(afterFocusChange.sectors, full.sectors);
});

test("year shares and each selected horizon allocation must reconcile", () => {
  assert.equal(YEARS.length, 9);
  assert.equal(YEARS[0], 1406);
  assert.equal(YEARS.at(-1), 1414);
  assert.equal(validatePortfolioShares({ core: 60, adjacent: 30, transform: 10 }), true);
  assert.equal(validatePortfolioShares({ core: 60, adjacent: 30, transform: 9 }), false);
  const independent = updateIndependentShare({ core: 60, adjacent: 25, transform: 15 }, "core", 65);
  assert.deepEqual(independent, { core: 65, adjacent: 25, transform: 15 });
  assert.equal(validatePortfolioShares(independent), false);
  const rows = [
    { id: 1, horizon: HORIZONS[0].key, mission: "مجاز", focus: "بررسی عمیق" },
    { id: 2, horizon: HORIZONS[1].key, mission: "مشروط", condition: { key: "فقط با مشارکت شریک راهبردی / صنعتی" }, focus: "رصد" },
    { id: 3, horizon: HORIZONS[2].key, mission: "مجاز", focus: "بررسی عمیق" },
    { id: 4, horizon: HORIZONS[0].key, mission: "خارج از مأموریت", focus: "بررسی عمیق" },
  ];
  const targets = { core: 60, adjacent: 30, transform: 10 };
  const balanced = validateYearAllocation(targets, { 1: 60, 2: 30, 3: 10 }, rows);
  assert.equal(balanced.valid, true);
  assert.equal(balanced.totals.core, 60);
  assert.equal(validateYearAllocation(targets, { 1: 60, 2: 30, 3: 10 }, [{...rows[0],focus:"فعلاً متوقف"},rows[1],rows[2],rows[3]]).valid, true);
  assert.equal(validateYearAllocation(targets, { 1: 60, 2: 30, 3: 10 }, [{...rows[1],condition:{key:"",note:""}},rows[0],rows[2],rows[3]]).valid, false);
  assert.equal(validateYearAllocation(targets, { 1: 50, 2: 30, 3: 10 }, rows).valid, false);
  assert.equal(validateYearAllocation(targets, { 1: 60, 2: 30, 3: 10, 4: 1 }, rows).valid, false);
  const scenarioRows=[{id:11,horizon:"core",mission:"مجاز"},{id:12,horizon:"adjacent",mission:"مجاز"},{id:13,horizon:"transform",mission:"مجاز"}];
  for (const shares of [{core:60,adjacent:25,transform:15},{core:50,adjacent:35,transform:15},{core:40,adjacent:40,transform:20}]) {
    assert.equal(validatePortfolioShares(shares), true);
    assert.equal(Object.values(shares).reduce((sum,value)=>sum+value,0), 100);
    assert.equal(validateYearAllocation(shares,{11:shares.core,12:shares.adjacent,13:shares.transform},scenarioRows).valid,true);
  }
});

test("all ISIC presets and custom weights recalculate score, ranks, rank delta and traceable contributions", () => {
  const baseline = scoreIsicActivities(master, ISIC_PRESETS.balanced.weights);
  for (const [key,preset] of Object.entries(ISIC_PRESETS)) {
    const result = scoreIsicActivities(master, preset.weights);
    const baselineRank = new Map(baseline.activities.map((row)=>[row.code,row.rank]));
    const ranked = result.activities.filter((row)=>row.score!==null);
    assert.ok(ranked.length > 100, `${key} should calculate the complete valid universe`);
    if(key!=="balanced")assert.ok(ranked.some((row)=>row.rank!==baselineRank.get(row.code)), `${key} should move ranks relative to balanced`);
    else assert.deepEqual(ranked.map((row)=>[row.code,row.rank]),baseline.activities.filter((row)=>row.score!==null).map((row)=>[row.code,row.rank]));
    for (const row of ranked) {
      const contributionTotal=Object.values(row.contributions).reduce((sum,value)=>sum+value,0);
      assert.ok(Math.abs(contributionTotal-row.score)<1e-8);
    }
  }
  for (const weights of [
    {economicSize:10,valueCreation:10,investment:50,productivity:10,employmentGrowth:10,firmGrowth:10},
    {economicSize:40,valueCreation:10,investment:10,productivity:10,employmentGrowth:10,firmGrowth:20},
    {economicSize:1,valueCreation:1,investment:1,productivity:1,employmentGrowth:90,firmGrowth:5},
  ]) {
    const effective=normalizeWeights(weights);
    assert.ok(Math.abs(Object.values(effective).reduce((sum,value)=>sum+value,0)-100)<1e-9);
    const result=scoreIsicActivities(master,effective);
    assert.notDeepEqual(result.activities.map((row)=>[row.code,row.score]),baseline.activities.map((row)=>[row.code,row.score]));
  }
});

test("outside-mission status clears allocations, and reload drops ineligible saved allocations", () => {
  const allocations=Object.fromEntries(YEARS.map((year)=>[year,{7:25,8:15}]));
  const cleaned=removeOpportunityAllocations(allocations,7);
  assert.ok(YEARS.every((year)=>!Object.hasOwn(cleaned[year],7)));
  const rows=[{id:7,priority:55,horizon:"core"},{id:8,priority:75,horizon:"adjacent"}];
  const restored=restoreMovementState({mission:{7:"خارج از مأموریت",8:"مجاز"},allocations:Object.fromEntries(YEARS.map((year)=>[year,{7:25,8:15}]))},rows);
  assert.ok(YEARS.every((year)=>!Object.hasOwn(restored.allocations[year],7)));
  assert.ok(YEARS.every((year)=>restored.allocations[year][8]===15));
  assert.equal(restored.board[7],undefined);
});

test("restored presets, custom weights, shares and blank board preference are coherent", () => {
  const rows=[{id:1,priority:70,horizon:"core"}];
  const restored=restoreMovementState({isicPreset:"custom",customWeights:{economicSize:1,valueCreation:1,investment:1,productivity:1,employmentGrowth:1,firmGrowth:1},board:{1:{score:3,reason:"مصوبه"}},annualShares:{1406:{core:60,adjacent:25,transform:15}}},rows);
  assert.equal(restored.isicPreset,"custom");
  assert.equal(Object.values(restored.customWeights).reduce((sum,value)=>sum+value,0),100);
  assert.deepEqual(restored.annualShares[1406],{core:60,adjacent:25,transform:15});
  assert.equal(restored.board[1].score,3);
  const blank=restoreMovementState(null,rows);
  assert.equal(blank.board[1],undefined);
  assert.equal(blank.mission[1],"مجاز");
});

test("portfolio gap always compares the explicit first-year target, and current portfolio aliases are reported", () => {
  const current={core:50,adjacent:40,transform:10};
  const target1406={core:60,adjacent:25,transform:15};
  assert.deepEqual(portfolioGap(current,target1406),{core:10,adjacent:-15,transform:5});
  const warnings=auditCurrentPortfolio(portfolio);
  assert.ok(warnings.some((item)=>item.type==="possible-duplicate"&&item.name.includes("آتیه صنعت افق نقش جهان")));
  assert.ok(warnings.some((item)=>item.sameExposure===true));
});

test("28 parent sectors remain visible, while 4-digit and 3-digit parent ranks remain distinct", () => {
  const base = scoreIsicActivities(master, ISIC_PRESETS.balanced.weights);
  assert.equal(Object.keys(base.sectors).length, 28);
  assert.equal(Object.values(base.sectors).filter((row) => row.score !== null).length, 27);
  const details = Object.values(base.sectors).filter((row) => row.level === "ISIC 4-digit");
  const aggregates = Object.values(base.sectors).filter((row) => row.level === "ISIC 3-digit");
  assert.equal(details.length, 24);
  assert.equal(aggregates.length, 3);
  assert.deepEqual(details.map((row) => row.rank).sort((a,b)=>a-b), Array.from({length:24},(_,index)=>index+1));
  assert.deepEqual(aggregates.map((row) => row.rank).sort((a,b)=>a-b), [1,2,3]);
  assert.equal(base.sectors[5].score, null);
  assert.equal(base.sectors[5].rank, undefined);
  const investment = scoreIsicActivities(master, ISIC_PRESETS.investment.weights);
  assert.ok(details.some((row, index) => row.rank !== investment.sectors[Object.keys(base.sectors).filter((key)=>base.sectors[key].level==="ISIC 4-digit")[index]].rank));
  assert.ok(Object.keys(base.sectors).every((id) => base.sectors[id].score === null || base.sectors[id].validCount <= base.sectors[id].activityCount));
});

test("scenario weight coverage blocks artificial rank gains without turning missing into zero", () => {
  const baseline = scoreIsicActivities(master, ISIC_PRESETS.balanced.weights);
  const growth = scoreIsicActivities(master, ISIC_PRESETS.growth.weights);
  assert.equal(MIN_ISIC_WEIGHT_COVERAGE, 70);
  const affected = growth.activities.filter((row) => row.dataStatus === "پوشش داده برای این سناریو ناکافی است");
  assert.ok(affected.length >= 1);
  assert.ok(affected.some((row) => baseline.activities.find((item) => item.code === row.code).score !== null));
  assert.ok(affected.every((row) => row.weightCoverage < MIN_ISIC_WEIGHT_COVERAGE && row.score === null && row.rank === null));
  assert.ok(affected.every((row) => row.percentiles && Object.values(row.percentiles).length >= 4));
  for (const [name, preset] of Object.entries(ISIC_PRESETS)) {
    const result = scoreIsicActivities(master, preset.weights);
    for (const row of result.activities.filter((activity) => activity.score !== null)) {
      assert.ok(row.weightCoverage >= MIN_ISIC_WEIGHT_COVERAGE, `${name}: ${row.code}`);
      assert.ok(Math.abs(row.score-Object.values(row.contributions).reduce((sum,value)=>sum+value,0))<1e-8);
    }
  }
});

test("the multi-mapped petroleum activity has an independent score and no parent aggregation", () => {
  const result=scoreIsicActivities(master);
  const item=result.activities.find((row)=>row.code==="1920");
  assert.ok(item.score !== null && item.rank > 0);
  assert.equal(item.mappingEligible,false);
  assert.equal(item.mappingStatus,"نگاشت چندگانه / نیازمند تعیین تکلیف بخش مادر");
  assert.equal(item.parentId,null);
  assert.ok(Object.values(result.sectors).every((sector)=>!sector.topThree.some((row)=>row.code==="1920")));
  const sample=[...master.filter((row)=>row.code==="1920"),{...master.find((row)=>row.code==="1920"),code:"1921",parentId:7,include:false}];
  assert.ok(scoreIsicActivities(sample).activities.every((row)=>row.score!==null&&row.mappingEligible===false));
});

test("parent median, quality and coverage respect the same granularity and available indicators", () => {
  const fixture=(code,level,parentId,value,options={})=>({code,name:code,parentId,include:true,isicLevel:level,readiness:"آماده تحلیل",mappingConfidence:"High",quality:"کامل",indicators:{economicSize:value,valueCreation:value,investment:value,productivity:value,employmentGrowth:value,firmGrowth:value},...options});
  const rows=[fixture("4011","ISIC 4-digit",1,1),fixture("4012","ISIC 4-digit",1,2,{readiness:"قابل استفاده با احتیاط"}),fixture("4013","ISIC 4-digit",1,3),fixture("311","ISIC 3-digit",2,9),fixture("4021","ISIC 4-digit",3,10),fixture("4022","ISIC 4-digit",3,2,{indicators:{economicSize:2,valueCreation:2,investment:null,productivity:null,employmentGrowth:null,firmGrowth:null}})];
  const score=scoreIsicActivities(rows);
  assert.equal(score.sectors[1].validCount,3);
  assert.equal(score.sectors[1].score,score.activities.find((row)=>row.code==="4012").score);
  assert.equal(score.activities.find((row)=>row.code==="4012").dataStatus,"قابل استفاده با احتیاط");
  assert.equal(score.sectors[2].level,"ISIC 3-digit");
  assert.equal(score.sectors[2].validCount,1);
  assert.equal(score.sectors[3].validCount,1);
  assert.equal(score.sectors[3].activityCount,2);
});

test("three custom scenarios change parent and activity ranks without mixing scores", () => {
  const base=scoreIsicActivities(master);
  const variants=[
    {economicSize:10,valueCreation:10,investment:50,productivity:10,employmentGrowth:10,firmGrowth:10},
    {economicSize:40,valueCreation:10,investment:10,productivity:10,employmentGrowth:10,firmGrowth:20},
    {economicSize:1,valueCreation:1,investment:1,productivity:1,employmentGrowth:90,firmGrowth:5},
  ];
  for(const weights of variants){
    const scored=scoreIsicActivities(master,weights);
    assert.ok(scored.activities.some((row)=>row.rank!==base.activities.find((item)=>item.code===row.code).rank));
    assert.ok(Object.keys(scored.sectors).some((id)=>scored.sectors[id].rank!==base.sectors[id].rank));
    assert.ok(Object.values(normalizeWeights(weights)).every((value)=>Number.isFinite(value)&&value>=0));
  }
  assert.deepEqual(normalizeWeights({economicSize:Infinity,valueCreation:-10,investment:0,productivity:0,employmentGrowth:0,firmGrowth:0}),ISIC_PRESETS.balanced.weights);
});

test("focus overrides, board and annual approvals restore coherently from current and legacy exports", () => {
  const rows=[{id:7,priority:80,horizon:"core",mission:"مجاز"},{id:8,priority:45,horizon:"adjacent",mission:"مجاز"},{id:9,priority:20,horizon:"transform",mission:"مجاز"}];
  const allocations={1406:{7:60,8:30,9:10}};
  const saved={mission:{7:"مجاز",8:"مجاز",9:"مجاز"},focus:{7:"رصد",8:"رصد",9:"فعلاً متوقف"},focusOverride:{7:true,8:false,9:false},board:{7:{score:5,reason:"پروژه"}},annualApproval:{1406:"approved",1407:"approved"},allocations,scenarioTitle:"طرح منتخب",isicPreset:"custom",customWeights:{economicSize:30,valueCreation:10,investment:20,productivity:10,employmentGrowth:20,firmGrowth:10}};
  const restored=restoreMovementState(saved,rows);
  assert.equal(restored.focusOverride[7],true);
  assert.equal(restored.focus[7],"رصد");
  assert.equal(restored.focusOverride[8],false);
  assert.equal(restored.annualApproval[1406],"approved");
  assert.equal(restored.annualApproval[1407],"draft");
  assert.equal(restored.board[7].score,5);
  assert.equal(restored.scenarioTitle,"طرح منتخب");
  const old=restoreMovementState({mission:saved.mission,focus:{7:"رصد",8:"رصد"},annualShares:{1406:{core:60,adjacent:30,transform:10}}},rows);
  assert.equal(old.focusOverride[7],true);
  assert.equal(old.focusOverride[8],false);
  assert.equal(old.annualApproval[1406],"default");
  assert.equal(resolveFocus(68,{deep:65,monitor:40},"رصد",false),"بررسی عمیق");
  assert.equal(resolveFocus(68,{deep:75,monitor:40},"بررسی عمیق",false),"رصد");
  assert.equal(resolveFocus(68,{deep:75,monitor:40},"بررسی عمیق",true),"بررسی عمیق");
});

test("current portfolio classifications remain explicit, and annual gap follows selected classes", () => {
  const source=currentPortfolioMix(portfolio);
  assert.equal(source.confirmed,0);
  assert.equal(source.total,portfolio.length);
  assert.ok(Math.abs(Object.values(source.mix).reduce((sum,value)=>sum+value,0)-100)<1e-8);
  const revised=currentPortfolioMix(portfolio,{0:{horizon:"adjacent",confirmed:true,sourceName:portfolio[0].name}});
  assert.equal(revised.confirmed,1);
  assert.ok(revised.mix.adjacent>source.mix.adjacent);
  assert.ok(revised.mix.core<source.mix.core);
  assert.deepEqual(portfolioGap(revised.mix,{core:60,adjacent:30,transform:10}),{
    core:60-revised.mix.core,adjacent:30-revised.mix.adjacent,transform:10-revised.mix.transform,
  });
  assert.deepEqual(currentPortfolioMix(portfolio,{0:{horizon:"adjacent",confirmed:true,sourceName:"wrong name"}}).mix,source.mix);
});
