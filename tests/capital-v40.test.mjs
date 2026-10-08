import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {allocateCapital,DEFAULT_FINANCIAL_INPUT,FUNDING_SOURCES,sourcePolicyRequiresReason,validateSourcePolicy} from '../lib/capital-allocation.mjs';
import {coreConnection,CORE_CONNECTION_METHOD} from '../lib/core-connection.mjs';
import {carryFundingPolicies,reconcileScenarioCases} from '../lib/scenario-workspace.mjs';
const finance={...DEFAULT_FINANCIAL_INPUT,cashStart:100};
const project={id:'p',year:1406,name:'طرح',needType:'توسعه / CAPEX رشد',annualNeed:100,totalNeed:100,stageable:false,entryRank:1,maximumRate:.35};
const run=(financial=finance,projects=[project],sourcePolicy)=>allocateCapital({year:1406,financialInput:financial,projects,sourcePolicy});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('v40 completed need skips later sources without reporting capacity shortage',()=>{
 const o=run({...finance,longDebtCapacity:100,totalNewDebtCeiling:100,longDebtRate:.3});
 const p=o.results[0];assert.equal(p.executed,100);
 for(const t of p.trace.filter(t=>t.needBefore===0&&t.source)){assert.equal(t.reasonCode,'not_needed');assert.equal(t.status,'not_needed');assert.match(t.note,/نیاز قبلاً تأمین شده/);}
 assert.equal(p.trace.reduce((s,t)=>s+t.finalAllocation,0),p.executed);
});
test('v40 rollback records temporary funding and releases it for the next project',()=>{
 const o=run(finance,[{...project,annualNeed:200,totalNeed:200},{...project,id:'next',entryRank:2}]);
 const p=o.results[0];assert.equal(p.executed,0);assert.equal(p.temporaryFunding,100);
 assert.equal(p.trace.reduce((s,t)=>s+t.releasedAllocation,0),100);assert.equal(p.trace.reduce((s,t)=>s+t.finalAllocation,0),0);
 assert.equal(o.results[1].executed,100);assert.equal(o.totalUsed,100);
});
test('v40 trace identifies earlier consumers and reservation holders by project',()=>{
 const o=run(finance,[{...project,id:'first'},{...project,id:'second',entryRank:2}]);
 const t=o.results[1].trace.find(t=>t.source==='internal');assert.equal(t.reasonCode,'source_consumed');assert.equal(t.consumers[0].id,'first');assert.equal(t.consumers[0].amount,100);
 const r=run(finance,[{...project,id:'first'},{...project,id:'reserve',entryRank:2,annualNeed:200,totalNeed:200,dedicatedSource:'internal',dedicatedAmount:100,dedicatedMode:'reserved'}]);
 const rt=r.results[0].trace.find(t=>t.source==='internal');assert.equal(rt.reasonCode,'source_reserved');assert.equal(rt.reservationHolders[0].id,'reserve');
});
test('v40 rate and shared debt ceiling have distinct explanations',()=>{
 const o=run({...DEFAULT_FINANCIAL_INPUT,longDebtCapacity:100,totalNewDebtCeiling:0,longDebtRate:.4});
 const t=o.results[0].trace.find(t=>t.source==='longDebt');assert.equal(t.reasonCode,'rate_exceeded');assert.ok(t.constraints.includes('debt_ceiling'));
});
test('v40 ineligible source cannot bypass policy through a dedicated allocation',()=>{
 const policy={allowedSources:{[project.needType]:['partner']},reason:'مصوبه'};
 const o=run(finance,[{...project,dedicatedSource:'internal',dedicatedAmount:100}],policy);
 assert.equal(o.totalUsed,0);assert.equal(o.results[0].trace.find(t=>t.source==='internal').reasonCode,'source_ineligible');assert.equal(sourcePolicyRequiresReason(policy),true);
 assert.throws(()=>validateSourcePolicy({allowedSources:{[project.needType]:['madeUp']}}));
 assert.equal(validateSourcePolicy({allowedSources:{[project.needType]:[]}}),true);
});
test('v40 global blockers produce explanations and no misleading free capacity',()=>{
 const missing=run({cashStart:100});assert.equal(missing.totalUsed,0);assert.equal(missing.freeCapacity,0);assert.equal(missing.results[0].trace[0].reasonCode,'invalid_finance');
 const shortage=run({...DEFAULT_FINANCIAL_INPUT,requiredPayments:20,partnerCapacity:100});assert.equal(shortage.totalUsed,0);assert.equal(shortage.results[0].trace[0].reasonCode,'liquidity_blocked');
 const overlap=run({...finance,reliableInflows:20,disposalIncludedInInflows:20});assert.equal(overlap.financialValidation.valid,false);assert.equal(overlap.totalUsed,0);
});
test('v40 already drawn new debt consumes the annual debt ceiling once',()=>{
 const f={...DEFAULT_FINANCIAL_INPUT,reliableInflows:600,requiredPayments:600,shortDebtCapacity:600,shortDebtIncludedInInflows:600,longDebtCapacity:500,totalNewDebtCeiling:900,longDebtRate:.3};
 const o=run(f,[{...project,annualNeed:500,totalNeed:500,stageable:true,minimumExecution:.5}]);
 assert.equal(o.financial.debtCeiling,300);assert.equal(o.totalExecuted,300);assert.equal(o.used.longDebt,300);assert.equal(o.financial.debtAlreadyDrawn,600);
 assert.ok(o.totalUsed+o.financial.debtAlreadyDrawn<=o.financial.debtCeilingGross);
 assert.equal(run({...f,totalNewDebtCeiling:500}).financialValidation.valid,false);
});
test('v40 policy changes recalculate deterministically without changing projects',()=>{
 const f={...finance,partnerCapacity:100};const before=structuredClone(project);
 const a=run(f,[project]);const b=run(f,[project],{orders:{[project.needType]:['partner','internal','longDebt','disposal','shortDebt']}});
 assert.equal(a.used.internal,100);assert.equal(b.used.partner,100);assert.deepEqual(project,before);
 const c=run(f,[{...project,annualNeed:150,totalNeed:150}]);assert.equal(c.totalExecuted,150);
});
test('v40 policies migrate only across the same scenario lineage and year',()=>{
 const snapshots=[{id:'a',scenarioId:'s'},{id:'b',scenarioId:'s'},{id:'x',scenarioId:'other'}];
 const input={sourcePolicies:{a:{allowedSources:{[project.needType]:['internal']},reason:'دلیل'}},liquidityPoliciesByYear:{'a:1406':{liquidityMode:'restricted',liquiditySources:['partner'],liquidityReason:'مصوبه'}}};
 const next=carryFundingPolicies(input,snapshots,['b']);assert.deepEqual(next.sourcePolicies.b,input.sourcePolicies.a);assert.deepEqual(next.liquidityPoliciesByYear['b:1406'],input.liquidityPoliciesByYear['a:1406']);assert.equal(next.liquidityPoliciesByYear['b:1407'],undefined);
 assert.equal(carryFundingPolicies(input,snapshots,['x']).sourcePolicies.x,undefined);next.sourcePolicies.b.reason='changed';assert.equal(input.sourcePolicies.a.reason,'دلیل');
});
test('v40 new scenario revision retains financial edits and new entry ranks',()=>{
 const plan={key:'parent:24',parentId:24,name:'حوزه',year:1406,priorityRank:1,entryPriority:70,share:0};
 const a={id:'a',scenarioId:'s',plans:[plan]};const old=reconcileScenarioCases({},[a],['a']);Object.assign(old['a:1406:parent:24'],{annualNeed:200,totalNeed:200,maximumRate:.3});
 const b={...a,id:'b',plans:[{...plan,priorityRank:3}]};const next=reconcileScenarioCases(old,[a,b],['b'])['b:1406:parent:24'];assert.equal(next.annualNeed,200);assert.equal(next.maximumRate,.3);assert.equal(next.entryRank,3);assert.equal(next.financialReviewRequired,true);
});
test('v40 core lens is fixed, complete and independent of selection and policy',()=>{
 const rows=JSON.parse(fs.readFileSync(new URL('../public/data/opportunities.json',import.meta.url)));
 assert.equal(rows.length,77);assert.equal(rows.find(r=>r.id===CORE_CONNECTION_METHOD.anchorId).coreFit,CORE_CONNECTION_METHOD.anchorFit);
 for(const row of rows){const before=structuredClone(row);const c=coreConnection(row);assert.ok(c.score>=0&&c.score<=100);assert.equal(c.score,coreConnection({...row,x:1,dynamicY:9,priority:99}).score);assert.deepEqual(row,before);assert.ok(c.chain&&c.capability);}
 assert.equal(coreConnection({id:41,coreFit:9}).score,100);assert.equal(coreConnection({id:1,coreFit:0}).score,0);assert.equal(coreConnection({id:1,coreFit:null}).score,null);
});
test('v40 randomized allocations conserve final and released money under policy changes',()=>{
 let seed=40;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
 for(let i=0;i<200;i++){
  const f={...DEFAULT_FINANCIAL_INPUT,cashStart:Math.round(rand()*500),shortDebtCapacity:Math.round(rand()*300),longDebtCapacity:Math.round(rand()*300),partnerCapacity:Math.round(rand()*300),totalNewDebtCeiling:Math.round(rand()*400),shortDebtRate:.3,longDebtRate:.4};
  const ps=Array.from({length:5},(_,j)=>({...project,id:`p${j}`,annualNeed:20+Math.round(rand()*300),totalNeed:1000,entryRank:j+1,stageable:rand()>.5,minimumExecution:.5,maximumRate:rand()>.5?.35:.45}));
  const o=run(f,ps,{allowedSources:{[project.needType]:Object.keys(FUNDING_SOURCES).filter(()=>rand()>.3)}});
  assert.equal(o.valid,true);near(o.totalNeed,o.totalExecuted+o.totalDeferred);near(o.totalUsed,o.totalExecuted);
  for(const p of o.results){near(p.executed,p.trace.reduce((s,t)=>s+t.finalAllocation,0));near(p.temporaryFunding,p.trace.reduce((s,t)=>s+t.finalAllocation+t.releasedAllocation,0));if(!p.passedMinimum)assert.equal(p.executed,0);}
 }
});
