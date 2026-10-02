import test from 'node:test';
import assert from 'node:assert/strict';
import {allocateCapital,DEFAULT_FINANCIAL_INPUT} from '../lib/capital-allocation.mjs';
import {mergeScenarioPlans,reconcileScenarioCases,eligibleScenarioCases} from '../lib/scenario-workspace.mjs';
import {evaluationSignature,freezeAllocationEvaluation} from '../lib/allocation-evaluations.mjs';
const p={id:'p',opportunityKey:'parent:1',name:'طرح',parentName:'حوزه',year:1406,annualNeed:100,entryPriority:80,needType:'تملک / سرمایه‌گذاری راهبردی',stageable:false,minimumExecution:1,maximumRate:.35,dedicatedSource:'',dedicatedAmount:0};
const finance={...DEFAULT_FINANCIAL_INPUT,cashStart:100};
const plan={key:'parent:1',name:'فرصت',parentName:'حوزه',parentId:1,child:false,share:100,year:1406,macro:70,detail:null,management:4,entryPriority:65,horizon:'adjacent'};
const a={id:'a',scenarioId:'s',name:'اول',plans:[plan]};
test('empty and null override ranks cannot precede approved positive rank',()=>{
 for(const overrideRank of [null,'',undefined,0,-1]){const o=allocateCapital({year:1406,financialInput:finance,projects:[{...p,id:'low',entryPriority:20,overrideRank},{...p,id:'approved',overrideRank:1}]});assert.equal(o.results[0].id,'approved');assert.equal(o.results[0].executed,100);}
});
test('reserved contribution is protected from higher priority projects and never adds capacity',()=>{
 const o=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,partnerCapacity:100},projects:[{...p,id:'high',entryPriority:90},{...p,id:'reserved',entryPriority:10,dedicatedSource:'partner',dedicatedAmount:100,dedicatedMode:'reserved'}]});
 assert.equal(o.results[0].executed,0);assert.equal(o.results[1].executed,100);assert.equal(o.totalUsed,100);assert.equal(o.valid,true);
});
test('reservation overload blocks allocation instead of silently consuming other commitments',()=>{
 const o=allocateCapital({year:1406,financialInput:finance,projects:[{...p,dedicatedSource:'internal',dedicatedAmount:100,dedicatedMode:'reserved'},{...p,id:'q',dedicatedSource:'internal',dedicatedAmount:100,dedicatedMode:'reserved'}]});assert.equal(o.reservationConflict,true);assert.equal(o.totalUsed,0);
});
test('unconsumed reservation stays protected even when minimum execution fails',()=>{
 const o=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,partnerCapacity:100},projects:[{...p,id:'reserved',entryPriority:90,annualNeed:200,dedicatedSource:'partner',dedicatedAmount:100,dedicatedMode:'reserved'},{...p,id:'other'}]});assert.equal(o.totalExecuted,0);
});
test('liquidity safeguard blocks new investment and exception needs a documented decision',()=>{
 const financialInput={...DEFAULT_FINANCIAL_INPUT,requiredPayments:100,minimumCashReserve:20,partnerCapacity:100};
 const input={year:1406,financialInput,projects:[p]};
 assert.equal(allocateCapital(input).totalExecuted,100); // approved baseline unchanged
 const blocked=allocateCapital({...input,sourcePolicy:{liquidityMode:'block'}});assert.equal(blocked.totalExecuted,0);assert.equal(blocked.financial.reserveShortfall,120);assert.equal(blocked.investmentReady,false);
 assert.equal(allocateCapital({...input,sourcePolicy:{liquidityMode:'restricted'}}).totalExecuted,0);
 const restricted=allocateCapital({...input,sourcePolicy:{liquidityMode:'restricted',liquidityReason:'منبع محدود به طرح؛ مصوبه',liquiditySources:['partner']}});assert.equal(restricted.totalExecuted,100);assert.equal(restricted.investmentReady,false);assert.equal(restricted.financial.reserveShortfall,120);
});
test('financial disagreements require reference even when scientific plans match',()=>{
 const b={...a,id:'b',scenarioId:'t',name:'دوم'};
 const cases={one:{...p,runKey:'a',annualNeed:100},two:{...p,runKey:'b',annualNeed:200}};
 assert.equal(mergeScenarioPlans([a,b],1406,{},cases).conflicts.length,1);
 assert.equal(mergeScenarioPlans([a,b],1406,{'parent:1':'b'},cases).plans[0].snapshotId,'b');
});
test('combined parent and child scope requires explicit resolution',()=>{
 const b={...a,id:'b',name:'تفصیلی',plans:[{...plan,key:'activity:100',child:true}]};
 assert.equal(mergeScenarioPlans([a,b],1406).conflicts[0].key,'overlap:1');
 assert.equal(mergeScenarioPlans([a,b],1406,{'overlap:1':'a'}).plans[0].key,'parent:1');
 assert.equal(mergeScenarioPlans([a,b],1406,{'overlap:1':'b'}).plans[0].key,'activity:100');
});
test('continuing annual funding stays visible without a second entry decision',()=>{
 const cases={base:{...p,id:'a:1406:parent:1',runKey:'a'},next:{...p,id:'a:1407:parent:1',runKey:'a',year:1407,continuationOf:'a:1406:parent:1'},other:{...p,id:'outside',runKey:'a',opportunityKey:'parent:2',continuationOf:'gone'}};
 assert.deepEqual(Object.keys(eligibleScenarioCases(cases,'a',[plan])),['base','next']);
});
test('new revision preserves financing but explicitly requires financial review',()=>{
 const prior=reconcileScenarioCases({},[a],['a']);prior['a:1406:parent:1'].annualNeed=100;
 const b={...a,id:'b'};const next=reconcileScenarioCases(prior,[a,b],['b']);assert.equal(next['b:1406:parent:1'].annualNeed,100);assert.equal(next['b:1406:parent:1'].financialReviewRequired,true);
});
test('annual approval freezes inputs and rejects incomplete finance or unresolved scope',()=>{
 const input={runKey:'a',year:1406,finance};const output=allocateCapital({year:1406,financialInput:finance,projects:[p]});
 const options={status:'approved',actor:'مدیر',reason:'مصوبه',financeStatus:'confirmed',blocked:false,id:'e',createdAt:'2026-10-01'};
 assert.throws(()=>freezeAllocationEvaluation(input,output,{...options,financeStatus:'sample'}));
 assert.throws(()=>freezeAllocationEvaluation(input,output,{...options,blocked:true}));
 const saved=freezeAllocationEvaluation(input,output,options);input.finance.cashStart=200;output.results[0].annualNeed=999;assert.equal(saved.input.finance.cashStart,100);assert.equal(saved.output.results[0].annualNeed,100);assert.notEqual(saved.signature,evaluationSignature(input));
});
test('debt reservations respect the shared ceiling and reserved amounts are not free capacity',()=>{
 const o=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,longDebtCapacity:100,shortDebtCapacity:100,totalNewDebtCeiling:100,longDebtRate:.3,shortDebtRate:.3},projects:[{...p,id:'reserved',annualNeed:200,dedicatedSource:'longDebt',dedicatedAmount:80,dedicatedMode:'reserved',needType:'توسعه / CAPEX رشد'}]});assert.equal(o.totalExecuted,0);assert.equal(o.reserved.longDebt,80);assert.equal(o.freeCapacity,20);assert.equal(o.valid,true);
});
test('a continuing phase survives a scenario revision without adding an entry allocation',()=>{
 const b={...a,id:'b'};const cases=reconcileScenarioCases({},[a],['a']);cases['a:1407:parent:1']={...cases['a:1406:parent:1'],id:'a:1407:parent:1',year:1407,entryYear:1406,continuationOf:'a:1406:parent:1',annualNeed:50};
 const next=reconcileScenarioCases(cases,[a,b],['b']);assert.equal(next['b:1407:parent:1'].annualNeed,50);assert.equal(next['b:1407:parent:1'].financialReviewRequired,true);assert.equal(eligibleScenarioCases(next,'b',[plan])['b:1407:parent:1'].entryYear,1406);assert.equal(b.plans.length,1);
});
test('documented liquidity exception cannot consume non-authorized sources',()=>{
 const o=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,requiredPayments:100,longDebtCapacity:100,totalNewDebtCeiling:100,longDebtRate:.2,partnerCapacity:20},projects:[{...p,stageable:true,minimumExecution:.1}],sourcePolicy:{liquidityMode:'restricted',liquidityReason:'مصوبه آورده',liquiditySources:['partner']}});assert.equal(o.used.longDebt,0);assert.equal(o.used.partner,20);assert.equal(o.totalExecuted,20);assert.equal(o.freeCapacity,0);
});
