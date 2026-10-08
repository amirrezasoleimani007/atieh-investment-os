import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateCapital,DEFAULT_FINANCIAL_INPUT} from '../lib/capital-allocation.mjs';
import {capitalStory,sourceDecision} from '../lib/capital-story.mjs';
const project={id:'p',name:'طرح',parentName:'حوزه',year:1406,annualNeed:200,totalNeed:200,needType:'توسعه / CAPEX رشد',stageable:false};
const run=(finance,patch={},policy)=>allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,...finance},projects:[{...project,...patch}],sourcePolicy:policy}).results[0];
test('v43 replay preserves every repeated source visit in the engine order',()=>{
 const p=run({cashStart:150,longDebtCapacity:100,totalNewDebtCeiling:100,longDebtRate:.3},{dedicatedSource:'internal',dedicatedAmount:40});
 const events=capitalStory(p).filter(e=>e.kind==='source');
 assert.deepEqual(events.map(e=>e.traceIndex),[0,1,2]);
 assert.deepEqual(events.map(e=>p.trace[e.traceIndex].source),['internal','longDebt','internal']);
 assert.deepEqual(events.map(e=>e.temporary),[40,140,200]);
 assert.deepEqual(events.map(e=>e.remaining),[160,60,0]);
 assert.equal(sourceDecision(p,0).limit,40);assert.equal(sourceDecision(p,2).limit,null);
});
test('v43 default and management-defined source order have different explanations',()=>{
 const p=run({partnerCapacity:200},{},{orders:{[project.needType]:['partner']},reason:'مصوبه'});
 assert.equal(p.trace.find(t=>t.source).source,'partner');
 assert.match(sourceDecision(p,1).why,/مدیریت/);
 assert.match(sourceDecision(run({}),1).why,/پیش‌فرض/);
});
test('v43 completed need compresses only subsequent unneeded stages without hiding rejected sources',()=>{
 const p=run({cashStart:200});const events=capitalStory(p);
 assert.ok(events.some(e=>e.kind==='source'&&p.trace[e.traceIndex].source==='longDebt'));
 const summary=events.find(e=>e.kind==='unneeded');assert.ok(summary);
 assert.deepEqual(summary.unneeded.map(t=>t.source),['partner','disposal','shortDebt']);
});
test('v43 failed execution gate keeps provisional money distinct from final zero',()=>{
 const p=run({cashStart:100});const events=capitalStory(p);
 assert.equal(events.find(e=>e.kind==='gate').temporary,100);
 assert.equal(events.at(-1).temporary,0);assert.equal(events.at(-1).remaining,200);
 assert.equal(events.at(-1).kind,'result');
});
test('v43 stopped cases have no invented resource or minimum-execution events',()=>{
 const p=run({requiredPayments:100,partnerCapacity:200});assert.deepEqual(capitalStory(p).map(e=>e.kind),['entry','stop','result']);
 const missing=run({cashStart:100},{annualNeed:null});assert.deepEqual(capitalStory(missing).map(e=>e.kind),['entry','stop','result']);assert.equal(capitalStory(missing).at(-1).remaining,null);
});
test('v43 replay has no allocation side effects and candidate rule matches every permitted stage',()=>{
 const p=run({cashStart:100,longDebtCapacity:80,totalNewDebtCeiling:80,longDebtRate:.3,partnerCapacity:60},{dedicatedSource:'internal',dedicatedAmount:20});
 const before=structuredClone(p);
 for(const e of capitalStory(p).filter(e=>e.kind==='source')){
  const d=sourceDecision(p,e.traceIndex),t=p.trace[e.traceIndex];
  const expected=d.blocked?0:Math.min(...d.candidates.map(c=>c.amount));
  assert.ok(Math.abs(expected-t.allocation)<.011);
 }
 assert.deepEqual(p,before);
});
test('v43 reserved dedicated source is explicitly distinguished from preferred funding',()=>{
 const p=run({cashStart:200},{dedicatedSource:'internal',dedicatedAmount:100,dedicatedMode:'reserved'});
 assert.equal(p.trace[0].selectionReason,'dedicated_reserved');assert.match(sourceDecision(p,0).why,/رزرو/);
});
