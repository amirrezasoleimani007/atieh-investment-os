import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectEntryPlan,mergeScenarioPlans,scopedCases,reviewSignature} from '../lib/scenario-workspace.mjs';
import {restoreMovementState} from '../lib/movement-model.mjs';
import {allocateCapital,DEFAULT_FINANCIAL_INPUT} from '../lib/capital-allocation.mjs';
const opportunity={key:'parent:1',parentId:1,name:'آزمون',child:false,macro:67,detail:null,management:4,entryPriority:72,horizon:'adjacent'};
const plan={...opportunity,year:1406,share:100};
test('handoff validates annual percentages and mission eligibility without replacing missing scores',()=>{
  const valid=inspectEntryPlan({1406:{'parent:1':{share:100}}},[opportunity]);
  assert.equal(valid.errors.length,0);assert.equal(valid.plans[0].detail,null);
  assert.ok(inspectEntryPlan({1406:{'parent:1':{share:90}}},[opportunity]).errors.length);
  assert.ok(inspectEntryPlan({1406:{'parent:1':{share:100}}},[]).errors.length);
  assert.ok(inspectEntryPlan({},[opportunity]).errors.length);
});
test('a parent and its child cannot pass handoff together',()=>{
 const child={...opportunity,key:'activity:123',child:true};
 assert.ok(inspectEntryPlan({1406:{'parent:1':{share:50},'activity:123':{share:50}}},[opportunity,child]).errors.some(s=>s.includes('مادر')));
});
test('identical opportunities are deduplicated and shared capacity is consumed only once',()=>{
  const {plans,conflicts}=mergeScenarioPlans([{id:'a',name:'الف',plans:[plan]},{id:'b',name:'ب',plans:[plan]}],1406);
  assert.equal(plans.length,1);assert.equal(conflicts.length,0);assert.equal(plans[0].sourceNames.length,2);
  const output=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,cashStart:100},portfolioActions:[],projects:plans.map(p=>({...p,id:p.key,annualNeed:100,needType:'توسعه / CAPEX رشد',minimumExecution:1,stageable:false,maximumRate:null,dedicatedSource:'',dedicatedAmount:0}))});
  assert.equal(output.totalNeed,100);assert.equal(output.totalExecuted,100);assert.equal(output.totalCapacity,100);
});
test('conflicting scenarios require explicit reference choice and remain unchanged',()=>{
  const snapshots=[{id:'a',name:'الف',plans:[plan]},{id:'b',name:'ب',plans:[{...plan,entryPriority:90}]}];
  const original=JSON.stringify(snapshots);const unresolved=mergeScenarioPlans(snapshots,1406);
  assert.equal(unresolved.plans.length,0);assert.equal(unresolved.conflicts.length,1);
  assert.equal(mergeScenarioPlans(snapshots,1406,{[plan.key]:'b'}).plans[0].entryPriority,90);
  assert.equal(JSON.stringify(snapshots),original);
  assert.equal(mergeScenarioPlans(snapshots,1407).plans.length,0);
});
test('scenario cases are isolated while independent projects have no fabricated scientific score',()=>{
 const cases={a:{runKey:'a',macro:90},b:{runKey:'b',macro:40},manual:{sourceKind:'independent',macro:null,detail:null},old:{macro:12}};
 const scoped=scopedCases(cases,'a');assert.deepEqual(Object.keys(scoped),['a','manual']);assert.equal(scoped.manual.macro,null);
 assert.deepEqual(Object.keys(scopedCases(cases,'legacy')),['manual','old']);
});
test('edits invalidate dependent review signatures and preserve independent ones',()=>{
 const base={vision:{core:60,adjacent:30,transform:10},baskets:{1406:{}},board:{},isicPreset:'balanced'};
 const changed={...base,board:{1:{score:5}}};
 assert.equal(reviewSignature(base,'mission'),reviewSignature(changed,'mission'));
 assert.notEqual(reviewSignature(base,'management'),reviewSignature(changed,'management'));
 assert.notEqual(reviewSignature(base,'entry'),reviewSignature(changed,'entry'));
 const restored=JSON.parse(JSON.stringify(base));assert.equal(reviewSignature(restored,'entry'),reviewSignature(base,'entry'));
});

test('defensive state restoration does not revoke unchanged reviews',()=>{
 const rows=[{id:1,priority:60},{id:2,priority:30}];const state=restoreMovementState(null,rows,[]);const restored=restoreMovementState(JSON.parse(JSON.stringify(state)),rows,[]);
 for(const stage of ['mission','isic','management','entry']) assert.equal(reviewSignature(state,stage),reviewSignature(restored,stage),stage);
});
