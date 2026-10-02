import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateCapital,DEFAULT_FINANCIAL_INPUT,allocationSourceRows} from '../lib/capital-allocation.mjs';
import {freezeAllocationEvaluation} from '../lib/allocation-evaluations.mjs';
import {reconcileScenarioCases} from '../lib/scenario-workspace.mjs';
const p={id:'p',name:'طرح',parentName:'حوزه',year:1406,annualNeed:100,entryPriority:80,needType:'تملک / سرمایه‌گذاری راهبردی',stageable:false,minimumExecution:1,maximumRate:.35,dedicatedSource:'',dedicatedAmount:0};
const finance={...DEFAULT_FINANCIAL_INPUT,partnerCapacity:100};
const options={status:'approved',actor:'مدیر',reason:'مصوبه',financeStatus:'confirmed'};
test('incomplete project keeps its commitment protected from other projects',()=>{
 const o=allocateCapital({year:1406,financialInput:finance,projects:[{...p,id:'reserved',annualNeed:0,dedicatedSource:'partner',dedicatedAmount:100,dedicatedMode:'reserved'},{...p,id:'other'}]});
 assert.equal(o.totalExecuted,0);assert.equal(o.reserved.partner,100);assert.equal(o.freeCapacity,0);assert.equal(o.investmentReady,false);
 assert.equal(allocationSourceRows(o).find(r=>r.key==='partner').reserved,100);
});
test('malformed reservation blocks spending until commitment is resolved',()=>{
 for(const dedicatedAmount of [0,NaN,-1]){const o=allocateCapital({year:1406,financialInput:finance,projects:[{...p,dedicatedMode:'reserved',dedicatedSource:'partner',dedicatedAmount},{...p,id:'other'}]});assert.equal(o.totalExecuted,0);assert.equal(o.policyValid,false);assert.throws(()=>freezeAllocationEvaluation({},o,options));}
});
test('unconfirmed liquidity exception cannot be recorded as an approved evaluation',()=>{
 const o=allocateCapital({year:1406,financialInput:{...finance,requiredPayments:100},projects:[p],sourcePolicy:{liquidityMode:'restricted'}});
 assert.equal(o.valid,true);assert.equal(o.policyValid,false);assert.throws(()=>freezeAllocationEvaluation({},o,options));
});
test('valid explicit decision to defer may be approved without claiming financing',()=>{
 const o=allocateCapital({year:1406,financialInput:DEFAULT_FINANCIAL_INPUT,projects:[p],sourcePolicy:{liquidityMode:'block'}});
 assert.equal(o.totalExecuted,0);assert.equal(o.policyValid,true);assert.equal(freezeAllocationEvaluation({},o,options).status,'approved');
});
test('third scenario revision retains latest continuing phase, regardless of case insertion order',()=>{
 const plan={key:'parent:1',name:'فرصت',parentName:'حوزه',year:1406,share:100,entryPriority:70};
 const snapshots=['a','b','c'].map((id,i)=>({id,scenarioId:'s',revision:i+1,plans:[plan]}));
 const older={...p,id:'a:1407:parent:1',opportunityKey:'parent:1',sourceKind:'scenario',runKey:'a',year:1407,entryYear:1406,continuationOf:'a:1406:parent:1',annualNeed:50};
 const newer={...older,id:'b:1407:parent:1',runKey:'b',annualNeed:120};
 for(const cases of [{older,newer},{newer,older}]){const out=reconcileScenarioCases(cases,snapshots,['c']);assert.equal(out['c:1407:parent:1'].annualNeed,120);assert.equal(out['c:1407:parent:1'].financialReviewRequired,true);}
});
test('empty portfolio does not claim investment readiness',()=>{assert.equal(allocateCapital({year:1406,financialInput:finance}).investmentReady,false);});
