import test from 'node:test';
import assert from 'node:assert/strict';
import {renameCapitalProject,reconcileScenarioCases} from '../lib/scenario-workspace.mjs';
import {allocateCapital,DEFAULT_FINANCIAL_INPUT} from '../lib/capital-allocation.mjs';
import {assessPhasedExecution} from '../lib/capital-next-step.mjs';
const p={id:'s:1406:parent:1',opportunityKey:'parent:1',sourceKind:'scenario',runKey:'s',name:'حوزه',parentName:'مادر',year:1406,needType:'توسعه / CAPEX رشد',annualNeed:200,totalNeed:200,stageable:false,minimumExecution:1,entryRank:1};
test('project names survive same snapshot reconciliation, later years and isolated scenarios',()=>{
 const later={...p,id:'s:1407:parent:1',year:1407,annualNeed:0};const other={...p,id:'other',runKey:'other'};
 const cases=renameCapitalProject({[p.id]:p,[later.id]:later,other},p.id,'مرکز خدمات جنوب');
 assert.equal(cases[later.id].name,'مرکز خدمات جنوب');assert.equal(cases.other.name,'حوزه');assert.equal(cases[p.id].annualNeed,200);
 const snaps=[{id:'s',scenarioId:'a',name:'سناریو',revision:1,plans:[{key:'parent:1',name:'حوزه',parentName:'مادر',year:1406,priorityRank:1}]}];
 const next=reconcileScenarioCases(cases,snaps,['s']);assert.equal(next[p.id].name,'مرکز خدمات جنوب');assert.equal(next[p.id].sectorName,'حوزه');
 const revised=[...snaps,{...snaps[0],id:'s2',revision:2,plans:[...snaps[0].plans,{...snaps[0].plans[0],year:1407}]}];
 const revisedCases=reconcileScenarioCases(cases,revised,['s2']);assert.equal(revisedCases['s2:1406:parent:1'].name,'مرکز خدمات جنوب');assert.equal(revisedCases['s2:1407:parent:1'].name,'مرکز خدمات جنوب');
 const restored=JSON.parse(JSON.stringify(next));assert.equal(restored[p.id].projectName,'مرکز خدمات جنوب');
 const output=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,cashStart:200},projects:[next[p.id]]});assert.equal(output.results[0].name,'مرکز خدمات جنوب');assert.equal(output.results[0].executed,200);
});
test('phase experiment independently matches reallocation and reports harm to later projects without mutation',()=>{
 const second={...p,id:'second',opportunityKey:'second',name:'طرح دوم',annualNeed:100,totalNeed:100,entryRank:2};
 const input={year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,cashStart:100},projects:[p,second]};const original=structuredClone(input);
 const trial=assessPhasedExecution(input,p.id,50);assert.equal(trial.status,'improved');assert.equal(trial.before,0);assert.equal(trial.after,100);assert.equal(trial.gap,100);assert.deepEqual(trial.affected,[{name:'طرح دوم',before:100,after:0}]);assert.deepEqual(input,original);
 assert.equal(assessPhasedExecution(input,p.id,70).status,'unchanged');assert.equal(assessPhasedExecution(input,p.id,0).status,'invalid');
 const blocked={...input,financialInput:{...input.financialInput,requiredPayments:200}};assert.equal(assessPhasedExecution(blocked,p.id,50).status,'blocked');
});
