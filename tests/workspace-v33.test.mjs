import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileScenarioCases,mergeScenarioPlans,scopedCases} from '../lib/scenario-workspace.mjs';
import {allocateCapital,DEFAULT_FINANCIAL_INPUT,SOURCE_WATERFALL} from '../lib/capital-allocation.mjs';
const plan={key:'parent:1',name:'فرصت',parentName:'حوزه',parentId:1,child:false,share:100,year:1408,macro:70,detail:null,management:4,entryPriority:65,horizon:'adjacent'};
const a={id:'a',scenarioId:'s',name:'سناریو',plans:[plan]};
test('handoff materializes every selected year without inventing capital needs or scores',()=>{
 const snapshots=[{...a,plans:[plan,{...plan,year:1414}]}];
 const cases=reconcileScenarioCases({},snapshots,['a']);
 assert.equal(Object.keys(cases).length,2);
 assert.equal(cases['a:1408:parent:1'].annualNeed,0);
 assert.equal(cases['a:1408:parent:1'].detail,null);
 assert.deepEqual(scopedCases(cases,'a'),cases);
});
test('new scenario revision preserves financial input but updates original scientific scores',()=>{
 const b={...a,id:'b',plans:[{...plan,macro:80,entryPriority:75}]};
 let cases=reconcileScenarioCases({},[a],['a']);
 cases['a:1408:parent:1']={...cases['a:1408:parent:1'],annualNeed:120,dedicatedAmount:60,overrideReason:'مصوبه'};
 const next=reconcileScenarioCases(cases,[a,b],['b']);
 assert.equal(next['b:1408:parent:1'].annualNeed,120);
 assert.equal(next['b:1408:parent:1'].overrideReason,'مصوبه');
 assert.equal(next['b:1408:parent:1'].entryPriority,75);
 assert.equal(next['a:1408:parent:1'].macro,70);
 assert.equal(next['b:1408:parent:1'].detail,null);
});
test('combined scenarios deduplicate projects, keep explicit conflict reference and isolate previous runs',()=>{
 const b={...a,id:'b',scenarioId:'t',plans:[{...plan,entryPriority:85}]};
 let cases=reconcileScenarioCases({},[a,b],['a']);
 cases['a:1408:parent:1'].annualNeed=100;
 cases=reconcileScenarioCases(cases,[a,b],['b']);cases['b:1408:parent:1'].annualNeed=200;
 const blocked=reconcileScenarioCases(cases,[a,b],['a','b']);
 assert.equal(blocked['a|b:1408:parent:1'],undefined);
 const resolved=reconcileScenarioCases(cases,[a,b],['b','a'],{'parent:1':'b'});
 assert.equal(resolved['a|b:1408:parent:1'].annualNeed,200);
 assert.equal(resolved['a|b:1408:parent:1'].entryPriority,85);
 assert.equal(resolved['a:1408:parent:1'].annualNeed,100);
 const switched=reconcileScenarioCases(resolved,[a,b],['a','b'],{'parent:1':'a'});
 assert.equal(switched['a|b:1408:parent:1'].annualNeed,100);
 assert.equal(switched['a|b:1408:parent:1'].entryPriority,65);
 const identical={...b,plans:[plan]};
 assert.equal(mergeScenarioPlans([a,identical],1408).plans.length,1);
});
const project={id:'p',name:'طرح',year:1406,annualNeed:100,needType:'توسعه / CAPEX رشد',stageable:false,minimumExecution:1,entryPriority:70,maximumRate:.35};
const financial={...DEFAULT_FINANCIAL_INPUT,cashStart:100,longDebtCapacity:100,longDebtRate:.3,totalNewDebtCeiling:100};
const order=['internal','longDebt','partner','disposal'];
test('manager-selected waterfall changes actual source usage and keeps baseline unchanged',()=>{
 const baseline=allocateCapital({year:1406,financialInput:financial,projects:[project]});
 const changed=allocateCapital({year:1406,financialInput:financial,projects:[project],sourcePolicy:{orders:{[project.needType]:order}}});
 assert.equal(baseline.used.longDebt,100);assert.equal(changed.used.internal,100);
 assert.deepEqual(SOURCE_WATERFALL[project.needType],['longDebt','internal','partner','disposal','shortDebt']);
 assert.equal(changed.valid,true);
});
test('custom policy cannot bypass debt ceiling, rate or minimum-execution rollback',()=>{
 const output=allocateCapital({year:1406,financialInput:{...financial,cashStart:0,longDebtRate:.4},projects:[project],sourcePolicy:{orders:{[project.needType]:order}}});
 assert.equal(output.totalUsed,0);assert.equal(output.totalDeferred,100);
 const capped=allocateCapital({year:1406,financialInput:{...financial,cashStart:0,totalNewDebtCeiling:50},projects:[project],sourcePolicy:{orders:{[project.needType]:order}}});
 assert.equal(capped.totalUsed,0);assert.equal(capped.results[0].temporaryFunding,50);
 assert.throws(()=>allocateCapital({year:1406,financialInput:financial,projects:[project],sourcePolicy:{orders:{[project.needType]:['internal','internal','partner','disposal']}}}));
});
test('dedicated-source precedence is explicit and never creates capacity',()=>{
 const input={year:1406,financialInput:{...financial,partnerCapacity:100},projects:[{...project,dedicatedSource:'partner',dedicatedAmount:100}]};
 assert.equal(allocateCapital(input).used.partner,100);
 const after=allocateCapital({...input,sourcePolicy:{dedicatedFirst:false}});
 assert.equal(after.used.longDebt,100);assert.equal(after.used.partner,0);assert.equal(after.valid,true);
});
