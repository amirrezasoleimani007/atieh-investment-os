import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tradeExpansion} from '../lib/trade-expansion.mjs';
import {findFundingImprovement} from '../lib/funding-improvement.mjs';
import {allocateCapital,DEFAULT_FINANCIAL_INPUT} from '../lib/capital-allocation.mjs';
import {debtBridge} from '../lib/debt-bridge.mjs';
import {movementRoadmap} from '../lib/movement-roadmap.mjs';
import {evaluationSignature} from '../lib/allocation-evaluations.mjs';
const rows=JSON.parse(fs.readFileSync(new URL('../public/data/opportunities.json',import.meta.url)));
const finance={...DEFAULT_FINANCIAL_INPUT,cashStart:100,shortDebtCapacity:100,totalNewDebtCeiling:100,shortDebtRate:.2};
const a={id:'a',name:'A',year:1406,entryRank:1,entryPriority:10,annualNeed:100,totalNeed:100,needType:'سرمایه در گردش',stageable:false,maximumRate:.3};
const b={...a,id:'b',name:'B',entryRank:2,needType:'توسعه / CAPEX رشد'};
test('v46 all 77 scores have separate bounded components and filter-invariant calibration',()=>{
 const all=tradeExpansion(rows);assert.equal(all.length,77);
 for(const r of all){assert.ok(r.score>=0&&r.score<=100);assert.ok(Math.abs(r.score-Math.sqrt(r.service*r.steel))<1e-9);assert.equal(tradeExpansion([rows.find(x=>x.id===r.id)])[0].score,r.score);}
 assert.equal(tradeExpansion([{id:999,name:'missing'}])[0].score,null);
 assert.equal(all.find(r=>r.id===44).group,'پشتیبان اجرای تجارت');
});
test('v46 policy search finds stranded-capacity counterexample without lowering any baseline allocation',()=>{
 const input={year:1406,financialInput:finance,projects:[a,b],sourcePolicy:{allowedSources:{[b.needType]:['shortDebt']},reason:'policy'}};
 const original=JSON.stringify(input),result=findFundingImprovement(input);
 assert.equal(result.baseline.totalExecuted,100);assert.equal(result.best.totalExecuted,200);assert.equal(result.status,'improved');assert.equal(JSON.stringify(input),original);
 assert.deepEqual(result.best.results.map(r=>r.id),result.baseline.results.map(r=>r.id));for(const r of result.baseline.results)assert.ok(result.best.results.find(x=>x.id===r.id).executed>=r.executed);
 assert.equal(result.best.results.find(r=>r.id==='b').allocations.internal,0);
});
test('v46 invalid and blocked financial inputs cannot generate policy recommendations',()=>{
 assert.equal(findFundingImprovement({year:1406,financialInput:{},projects:[a]}).status,'blocked');
 const result=findFundingImprovement({year:1406,financialInput:finance,projects:[a],sourcePolicy:{allowedSources:{[a.needType]:[]},reason:'blocked'}});assert.equal(result.best,null);
});
test('v46 equal-principal debt bridge starts next year, respects grace and reports unknown terms',()=>{
 const out=allocateCapital({year:1406,financialInput:{...finance,cashStart:0},projects:[a]});
 const outputs=[out,...[1407,1408,1409].map(year=>allocateCapital({year,financialInput:DEFAULT_FINANCIAL_INPUT,projects:[]}))];
 const bridge=debtBridge(outputs,{'1406:shortDebt':{years:3,grace:1}});
 assert.equal(bridge.rows[0].principal,0);assert.equal(bridge.rows[0].interest,0);
 assert.equal(bridge.rows[1].principal,0);assert.equal(bridge.rows[1].interest,20);assert.equal(bridge.rows[2].principal,50);assert.equal(bridge.rows[3].interest,10);assert.equal(bridge.tailPrincipal,0);
 assert.equal(debtBridge(outputs).missing.length,1);assert.equal(debtBridge(outputs).rows[1].unknown,100);
 assert.equal(debtBridge(outputs,{'1406:shortDebt':{years:5,grace:0}}).tailPrincipal,40);
});
test('v46 roadmap separates approval, stale inputs, drafts and other scenarios',()=>{
 const base={baskets:{1406:{k:{priorityRank:1}}}},input={runKey:'s',year:1406};
 const output=allocateCapital({year:1406,financialInput:finance,projects:[{...a,opportunityKey:'k'}]});
 const evaluation={id:'e',createdAt:'2026-01-01',status:'approved',input,signature:evaluationSignature(input),output};
 const args={baskets:base.baskets,opportunities:[{key:'k',name:'A'}],scenario:{id:'scenario',revision:1,base},snapshots:[{id:'s',scenarioId:'scenario',revision:1,createdAt:'2026-01-01',policy:base}],evaluations:[evaluation],currentRunKey:'s',currentInputs:{1406:input}};
 assert.equal(movementRoadmap(args)[0].cells.length,9);assert.equal(movementRoadmap(args)[0].cells[0].status,'funded');
 assert.equal(movementRoadmap({...args,currentInputs:{}})[0].cells[0].status,'historical');
 assert.equal(movementRoadmap({...args,evaluations:[{...evaluation,status:'draft'}]})[0].cells[0].status,'draft');
 assert.equal(movementRoadmap({...args,evaluations:[{...evaluation,input:{...input,runKey:'other'}}]})[0].cells[0].status,'waiting');
 assert.equal(movementRoadmap({...args,scenario:{...args.scenario,revision:2}})[0].cells[0].status,'historical');
});
test('v46 shared source-order change also protects allocations in other years',()=>{
 const input={year:1406,financialInput:finance,projects:[a,b],sourcePolicy:{allowedSources:{[b.needType]:['shortDebt']},reason:'policy'}};
 const other={year:1407,financialInput:finance,projects:[{...a,id:'a7',year:1407},{...b,id:'b7',year:1407,needType:'تملک / سرمایه‌گذاری راهبردی'}],sourcePolicy:{allowedSources:{[b.needType]:['shortDebt'],'تملک / سرمایه‌گذاری راهبردی':['internal']},reason:'policy'}};
 // Apply the same run policy to both years: A borrowing first protects B7's only source.
 input.sourcePolicy.allowedSources['تملک / سرمایه‌گذاری راهبردی']=['internal'];
 const baseline=allocateCapital(other);assert.equal(baseline.totalExecuted,200);
 const result=findFundingImprovement(input,undefined,[other]);assert.equal(result.status,'not_found');
});
