import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmScenarioStage, reviewSignature, inspectEntryPlan} from '../lib/scenario-workspace.mjs';
import {passesMissionGate, CONDITIONS} from '../lib/movement-model.mjs';
test('continue records review signatures for every stage and preserves other scenarios',()=>{
 const base={vision:{core:60,adjacent:30,transform:10},mission:{1:'خارج از مأموریت',2:'مجاز'},conditions:{},board:{}};
 let state={base,activeScenarioId:'a',scenarios:[{id:'a',completed:[],reviewed:{}},{id:'b',completed:[],reviewed:{}}]};
 for(const stage of ['mission','isic','management'])state=confirmScenarioStage(state,stage);
 assert.deepEqual(state.scenarios[0].completed,['mission','isic','management']);
 for(const stage of state.scenarios[0].completed)assert.equal(state.scenarios[0].reviewed[stage],reviewSignature(base,stage));
 assert.deepEqual(state.scenarios[1].completed,[]);
 const prior=state;state=confirmScenarioStage(state,'management');assert.equal(state.scenarios[0].completed.length,3);assert.notEqual(state,prior);
 const changed={...base,mission:{1:'مجاز',2:'مجاز'}};assert.notEqual(reviewSignature(changed,'mission'),state.scenarios[0].reviewed.mission);
});
test('an excluded parent rejects both parent and child entry while permitted sectors continue',()=>{
 const rows=[{id:1,mission:'خارج از مأموریت'},{id:2,mission:'مجاز'}];
 const opportunities=[{key:'parent:1',parentId:1},{key:'activity:11',parentId:1,child:true},{key:'parent:2',parentId:2}].filter(o=>passesMissionGate(rows.find(r=>r.id===o.parentId).mission,{}));
 assert.deepEqual(opportunities.map(o=>o.key),['parent:2']);
 assert.equal(inspectEntryPlan({1406:{'parent:2':{priorityRank:1}}},opportunities,'priority').errors.length,0);
 assert.ok(inspectEntryPlan({1406:{'activity:11':{priorityRank:1}}},opportunities,'priority').errors.length);
 assert.equal(passesMissionGate('مشروط',{key:''}),false);
 assert.equal(passesMissionGate('مشروط',{key:CONDITIONS[0]}),true);
});
