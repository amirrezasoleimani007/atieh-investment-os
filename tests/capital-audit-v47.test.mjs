import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateCapital,DEFAULT_FINANCIAL_INPUT} from '../lib/capital-allocation.mjs';
import {capitalStory,sourceDecision} from '../lib/capital-story.mjs';
const financial={...DEFAULT_FINANCIAL_INPUT,cashStart:160,reliableInflows:100,shortDebtCapacity:100,shortDebtIncludedInInflows:60,shortDebtRate:.2,longDebtCapacity:80,longDebtRate:.2,totalNewDebtCeiling:100,partnerCapacity:60};
const projects=[{id:'A',name:'الف',year:1406,entryRank:1,annualNeed:300,totalNeed:300,needType:'سرمایه در گردش',stageable:false,maximumRate:.3},{id:'B',name:'ب',year:1406,entryRank:2,annualNeed:100,totalNeed:100,needType:'توسعه / CAPEX رشد',stageable:false,maximumRate:.3},{id:'C',name:'ج',year:1406,entryRank:3,annualNeed:100,totalNeed:100,needType:'توسعه / CAPEX رشد',stageable:true,minimumExecution:.5,maximumRate:.3}];
const run=patch=>allocateCapital({year:1406,financialInput:{...financial,...patch},projects});
test('v47 independent hand-calculated scenario preserves cash, inflow overlap, debt cap and rollback',()=>{
 const o=run({});assert.equal(o.financial.internal,260);assert.equal(o.capacity.shortDebt,40);assert.equal(o.capacity.debtCeiling,40);
 assert.deepEqual(o.results.map(r=>[r.id,r.executed,r.deferred]),[['A',300,0],['B',0,100],['C',60,40]]);
 assert.deepEqual(o.used,{internal:260,shortDebt:40,longDebt:0,partner:60,disposal:0});
 assert.equal(o.results[1].temporaryFunding,60);assert.equal(o.results[1].trace.reduce((s,t)=>s+(t.releasedAllocation??0),0),60);
 assert.equal(o.totalNeed,500);assert.equal(o.totalExecuted,360);assert.equal(o.totalDeferred,140);
 assert.equal(o.results[2].trace.find(t=>t.source==='partner').usedByEarlier,0);
 for(const p of o.results){
  assert.equal(capitalStory(p).at(-1).temporary,p.executed);
  for(let i=0;i<p.trace.length;i++){const t=p.trace[i];if(!t.source||t.needBefore<=.01)continue;const decision=sourceDecision(p,i);assert.equal(t.allocation,decision.blocked?0:Math.min(...decision.candidates.map(c=>c.amount)));}
 }
});
test('v47 cash and rate edits recompute source mix, rollbacks and later projects deterministically',()=>{
 const baseline=run({}),before=structuredClone(baseline);
 assert.deepEqual(run({cashStart:200}).results.map(r=>r.executed),[300,100,0]);
 assert.deepEqual(run({shortDebtRate:.5}).results.map(r=>r.executed),[300,0,60]);
 assert.equal(run({shortDebtRate:.5}).results[2].allocations.longDebt,40);
 assert.equal(run({shortDebtRate:.5}).results[2].allocations.partner,20);
 assert.equal(run({shortDebtRate:.5}).results[0].trace.find(t=>t.source==='shortDebt').reasonCode,'rate_exceeded');
 assert.deepEqual(baseline,before);assert.deepEqual(run({}),baseline);
});
