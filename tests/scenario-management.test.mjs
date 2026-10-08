import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultMovementState} from '../lib/movement-model.mjs';
import {archiveScenario,renameScenario,validateScenarioBackup,scenarioBackup,mergeScenarioBackup} from '../lib/scenario-management.mjs';
import {reconcileScenarioCases,eligibleScenarioCases} from '../lib/scenario-workspace.mjs';
const plan={key:'parent:1',parentId:1,name:'حوزه آزمون',parentName:'حوزه اصلی',child:false,macro:70,detail:null,management:4,entryPriority:75,horizon:'adjacent',year:1406,share:0,priorityRank:1};
function fixture(){
 const base=defaultMovementState();base.baskets[1406]={'parent:1':{share:0,priorityRank:1}};
 const scenarios=['a','b'].map(id=>({id,name:`سناریو ${id}`,revision:1,base:structuredClone(base),completed:['mission','isic','management','entry']}));
 const snapshots=scenarios.map(s=>({id:`s-${s.id}`,scenarioId:s.id,name:s.name,revision:1,plans:[structuredClone(plan)],policy:base}));
 const cases=reconcileScenarioCases({},snapshots,['s-a']);cases['s-a:1406:parent:1'].annualNeed=120;
 return {version:31,base,scenarios,snapshots,activeScenarioId:'a',selectedSnapshots:['s-a'],conflictChoices:{},capital:{cases,financialByYear:{1406:{partnerCapacity:100}},portfolioActions:{},evaluations:[{id:'approved',status:'approved',input:{projects:[]}}],sourcePolicies:{'s-a':{liquidityMode:'block'}}}};
}
test('full backup round trip preserves scenario, financial inputs and frozen decisions',()=>{
 const w=fixture();assert.deepEqual(validateScenarioBackup(JSON.parse(JSON.stringify(w))),w);
});
test('v40 core data snapshot and source eligibility survive export, import and merge',()=>{
 const w=fixture();w.snapshots[0].coreLens={method:'2.2-trade-anchor-v1',rows:[{id:1,name:'حوزه',coreFit:1.2,verticalTrade:.01,verticalSteel:.02}]};
 w.capital.sourcePolicies['s-a'].allowedSources={'توسعه / CAPEX رشد':['internal']};w.capital.sourcePolicies['s-a'].reason='مصوبه';
 const backup=scenarioBackup(w,'a');assert.deepEqual(validateScenarioBackup(JSON.parse(JSON.stringify(backup))).snapshots[0].coreLens,w.snapshots[0].coreLens);
 let n=0;const merged=mergeScenarioBackup(fixture(),backup,()=>`v40-${++n}`);validateScenarioBackup(merged);assert.deepEqual(merged.snapshots.at(-1).coreLens,w.snapshots[0].coreLens);
 assert.deepEqual(merged.capital.sourcePolicies['v40-2'].allowedSources,{'توسعه / CAPEX رشد':['internal']});
 const bad=structuredClone(w);bad.snapshots[0].coreLens.rows[0].coreFit=-1;assert.throws(()=>validateScenarioBackup(bad));
});
test('recoverable deletion removes handoff selection without deleting financial history',()=>{
 const w=fixture();const archived=archiveScenario(w,'a');assert.equal(archived.activeScenarioId,'b');assert.deepEqual(archived.selectedSnapshots,[]);assert.deepEqual(archived.capital,w.capital);assert.deepEqual(w.archivedScenarioIds,undefined);
 const restored=archiveScenario(archived,'a',false);assert.deepEqual(restored.archivedScenarioIds,[]);assert.equal(restored.capital.cases['s-a:1406:parent:1'].annualNeed,120);
 const none=archiveScenario(archived,'b');assert.equal(none.activeScenarioId,'');assert.deepEqual(none.archivedScenarioIds,['a','b']);
});
test('single scenario file excludes unrelated programs and keeps dependent case inputs',()=>{
 const w=fixture();const backup=scenarioBackup(w,'a');validateScenarioBackup(backup);assert.equal(backup.scenarios.length,1);assert.equal(backup.snapshots.length,1);assert.equal(backup.capital.cases['s-a:1406:parent:1'].annualNeed,120);assert.deepEqual(backup.capital.evaluations,[]);
});
test('merge creates isolated identifiers, preserves existing money and remaps continuation',()=>{
 const current=fixture();const backup=scenarioBackup(current,'a');backup.capital.financialByYear[1406].partnerCapacity=999;
 backup.capital.cases['s-a:1407:parent:1']={...backup.capital.cases['s-a:1406:parent:1'],id:'s-a:1407:parent:1',year:1407,continuationOf:'s-a:1406:parent:1',entryYear:1406};
 let n=0;const merged=mergeScenarioBackup(current,backup,()=>`new${++n}`);validateScenarioBackup(merged);
 assert.equal(merged.scenarios.length,3);assert.equal(merged.capital.financialByYear[1406].partnerCapacity,100);assert.deepEqual(merged.capital.evaluations,current.capital.evaluations);
 assert.equal(merged.activeScenarioId,'new1');assert.match(merged.scenarios.at(-1).name,/بازیابی/);assert.equal(merged.capital.cases['new2:1406:parent:1'].annualNeed,120);assert.equal(merged.capital.cases['new2:1407:parent:1'].continuationOf,'new2:1406:parent:1');
 const reconciled=reconcileScenarioCases(merged.capital.cases,merged.snapshots,['new2']);const eligible=eligibleScenarioCases(reconciled,'new2',[plan]);assert.equal(eligible['new2:1406:parent:1'].annualNeed,120);assert.equal(eligible['new2:1406:parent:1'].entryRank,1);assert.equal(eligible['s-a:1406:parent:1'],undefined);
});
test('invalid files cannot pass restore validation',()=>{
 for(const mutate of [w=>{w.scenarios.push(w.scenarios[0])},w=>{w.snapshots[0].scenarioId='missing'},w=>{w.selectedSnapshots=['missing']},w=>{w.base.vision.core=NaN},w=>{delete w.capital.financialByYear},w=>{w.snapshots[0].plans[0].year=9999},w=>{w.capital.sourcePolicies['s-a']={orders:{'سرمایه در گردش':['internal','internal']}}}]){const w=fixture();mutate(w);assert.throws(()=>validateScenarioBackup(w));}
 const malicious=JSON.parse('{"__proto__":{"unsafe":true}}');assert.throws(()=>validateScenarioBackup({...fixture(),unsafe:malicious}));
});

test('negative or incomplete confirmed finance cannot enter through restore',()=>{
 const negative=fixture();negative.capital.financialByYear[1406].cashStart=-1;
 assert.throws(()=>validateScenarioBackup(negative));
 const incomplete=fixture();incomplete.capital.financialStatusByYear={1406:'confirmed'};incomplete.capital.financialByYear[1406]={partnerCapacity:100};
 assert.throws(()=>validateScenarioBackup(incomplete));
});
test('renaming updates labels without recalculating plans or changing model scores',()=>{
 const w=fixture();const renamed=renameScenario(w,'a','رشد گزینشی');assert.equal(renamed.snapshots[0].name,'رشد گزینشی');assert.deepEqual(renamed.snapshots[0].plans,w.snapshots[0].plans);assert.deepEqual(renamed.capital,w.capital);assert.throws(()=>renameScenario(w,'a','سناریو b'));assert.throws(()=>renameScenario(w,'a',' '));
});

test('importing a deleted scenario preserves its archive status and current active selection',()=>{
 const current=fixture();const archived=archiveScenario(current,'a');const backup=scenarioBackup(archived,'a');let n=0;const merged=mergeScenarioBackup(current,backup,()=>`archive${++n}`);validateScenarioBackup(merged);assert.equal(merged.activeScenarioId,'a');assert.deepEqual(merged.archivedScenarioIds,['archive1']);assert.deepEqual(merged.selectedSnapshots,current.selectedSnapshots);
});
test('v46 debt terms survive scenario backup and remap to imported run IDs',()=>{
 const w=fixture();w.capital.debtTermsByRun={'s-a':{'1406:shortDebt':{years:3,grace:1}},'s-b':{'1406:longDebt':{years:5,grace:0}}};
 const backup=scenarioBackup(w,'a');assert.deepEqual(Object.keys(backup.capital.debtTermsByRun),['s-a']);validateScenarioBackup(backup);
 let n=0;const merged=mergeScenarioBackup(fixture(),backup,()=>`debt-${++n}`);assert.deepEqual(merged.capital.debtTermsByRun['debt-2'],w.capital.debtTermsByRun['s-a']);
 const invalid=structuredClone(w);invalid.capital.debtTermsByRun['s-a']['1406:shortDebt'].grace=3;assert.throws(()=>validateScenarioBackup(invalid));
});
