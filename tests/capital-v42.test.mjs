import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateCapital,DEFAULT_FINANCIAL_INPUT} from '../lib/capital-allocation.mjs';
import {reviewCapitalProject} from '../lib/capital-review.mjs';
const project={id:'p',name:'طرح',year:1406,entryRank:1,annualNeed:100,totalNeed:100,needType:'توسعه / CAPEX رشد',stageable:false};
const run=(financial,projects=[project],sourcePolicy)=>allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,...financial},projects,sourcePolicy});
test('v42 captures turn boundaries independently of later consumption',()=>{
 const o=run({cashStart:200},[{...project,id:'first'},{...project,id:'second',entryRank:2}]);
 const [a,b]=o.results;assert.equal(a.audit.start.used.internal,0);assert.equal(a.audit.end.used.internal,100);assert.equal(a.audit.end.remaining.internal,100);
 assert.equal(b.audit.position,2);assert.equal(b.audit.start.used.internal,100);assert.equal(b.audit.start.remaining.internal,100);assert.equal(b.audit.end.remaining.internal,0);assert.equal(a.audit.end.remaining.internal,100);
 assert.deepEqual(b.audit.priorProjects,[{id:'first',name:'طرح',executed:100}]);
});
test('v42 separates dedicated trial from earlier project spending in repeated source stages',()=>{
 const o=run({cashStart:200},[{...project,id:'first',annualNeed:40,totalNeed:40},{...project,id:'second',entryRank:2,dedicatedSource:'internal',dedicatedAmount:20}]);
 const p=o.results[1],stages=p.trace.filter(t=>t.source==='internal');
 assert.equal(stages[0].usedByEarlier,40);assert.equal(stages[0].temporaryBefore,0);
 assert.equal(stages[1].usedByEarlier,40);assert.equal(stages[1].temporaryBefore,20);assert.equal(stages[1].previousUse,60);
 assert.equal(reviewCapitalProject(p).rows.find(r=>r.key==='internal').temporary,100);assert.equal(p.executed,100);
});
test('v42 rollback preserves protected reservation while exposing released trial',()=>{
 const o=run({cashStart:100},[{...project,annualNeed:200,totalNeed:200,dedicatedSource:'internal',dedicatedAmount:100,dedicatedMode:'reserved'}]);
 const p=o.results[0];assert.equal(p.audit.start.ownReservation,100);assert.equal(p.audit.end.ownReservation,100);assert.equal(p.audit.end.used.internal,0);assert.equal(p.audit.end.remaining.internal,100);assert.equal(o.freeCapacity,0);
 const r=reviewCapitalProject(p);assert.equal(r.temporary,100);assert.equal(r.released,100);assert.equal(r.rows[0].amount,0);assert.match(r.narrative,/آزاد شد/);
});
test('v42 successful commit consumes its own reservation exactly once',()=>{
 const o=run({cashStart:150},[{...project,dedicatedSource:'internal',dedicatedAmount:100,dedicatedMode:'reserved'}]);
 const p=o.results[0];assert.equal(p.audit.start.ownReservation,100);assert.equal(p.audit.end.ownReservation,0);assert.equal(o.freeCapacity,50);
});
test('v42 narration retains simultaneous partial constraints and named competitors',()=>{
 const o=run({longDebtCapacity:300,totalNewDebtCeiling:150,longDebtRate:.3},[{...project,id:'first',annualNeed:50,totalNeed:50},{...project,id:'second',entryRank:2,annualNeed:200,totalNeed:200,stageable:true,minimumExecution:.5}]);
 const p=o.results[1],r=reviewCapitalProject(p).rows.find(r=>r.key==='longDebt');assert.equal(p.executed,100);assert.equal(p.audit.start.remainingDebtCeiling,100);assert.equal(p.audit.end.remainingDebtCeiling,0);
 assert.ok(r.constraints.some(c=>c.code==='partial_debt_ceiling'));assert.equal(r.debtConsumers[0].id,'first');assert.equal(r.amount,100);assert.match(reviewCapitalProject(p).narrative,/١٠٠|۱۰۰/);
});
test('v42 full financing labels later sources as unneeded, not capacity failures',()=>{
 const o=run({cashStart:100});const r=reviewCapitalProject(o.results[0]);const partner=r.rows.find(r=>r.key==='partner');assert.equal(partner.state,'not_needed');assert.equal(partner.constraints.length,0);assert.match(partner.explanation,/تأمین شده بود/);
});
test('v42 global block is unassessed rather than a zero-capacity diagnosis',()=>{
 const o=run({cashStart:100,requiredPayments:200,partnerCapacity:300});const r=reviewCapitalProject(o.results[0]);assert.equal(r.assessed,false);assert.equal(r.temporary,null);assert.equal(r.released,null);assert.ok(r.rows.every(r=>r.state==='unassessed'));assert.equal(r.action,'resources');
});
test('v42 priority evidence follows the actual managerial comparator, including numeric strings',()=>{
 const o=run({cashStart:100},[{...project,id:'first',entryRank:1},{...project,id:'second',entryRank:2,overrideRank:'1'}]);assert.equal(o.results[0].id,'second');assert.equal(o.results[0].audit.priorityBasis,'managerial');assert.equal(o.results[1].audit.position,2);
});
test('v42 legacy results remain readable without invented turn snapshots',()=>{
 const p=structuredClone(run({cashStart:100}).results[0]);delete p.audit;
 const r=reviewCapitalProject(p);assert.equal(r.assessed,true);assert.ok(r.rows.every(r=>r.start===null&&r.end===null));assert.equal(r.rows[0].amount,100);
});
test('v42 own temporary exhaustion is not mislabeled as spending by earlier projects',()=>{
 const p=run({cashStart:100},[{...project,annualNeed:200,totalNeed:200,dedicatedSource:'internal',dedicatedAmount:100}]).results[0];
 const row=reviewCapitalProject(p).rows.find(r=>r.key==='internal');
 const reason=row.constraints.find(c=>c.code==='source_consumed');
 assert.match(reason.text,/موقت همین طرح/);assert.doesNotMatch(reason.text,/طرح‌های مقدم/);assert.equal(row.consumers.length,0);
});
