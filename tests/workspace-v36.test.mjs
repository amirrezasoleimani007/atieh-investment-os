import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileScenarioCases,inspectEntryPlan,mergeScenarioPlans} from '../lib/scenario-workspace.mjs';
import {allocateCapital,DEFAULT_FINANCIAL_INPUT} from '../lib/capital-allocation.mjs';
import {summarizeCapital} from '../lib/capital-presentation.mjs';
import {formatFinancialValue} from '../lib/financial-display.mjs';
const plan={key:'parent:1',name:'فرصت',parentName:'حوزه',year:1406,share:0,priorityRank:1,entryPriority:70};
const snapshots=['a1','a2','b'].map((id,i)=>({id,scenarioId:id==='b'?'b':'a',revision:i+1,plans:[plan]}));
const makeCase=(runKey,amount,referenceSnapshotId=runKey)=>({id:`${runKey}:1406:parent:1`,runKey,referenceSnapshotId,opportunityKey:plan.key,sourceKind:'scenario',year:1406,annualNeed:amount});
test('explicit reference chooses its financial case rather than an older combined revision',()=>{
 const old=makeCase('a1|b',100,'a1'), b=makeCase('b',200);
 const cases={[old.id]:old,[b.id]:b};
 const initial=reconcileScenarioCases(cases,snapshots,['a2','b'],{[plan.key]:'b'});
 assert.equal(initial['a2|b:1406:parent:1'].annualNeed,200);
 const current=makeCase('a2|b',100,'a2');
 const switched=reconcileScenarioCases({...cases,[current.id]:current},snapshots,['a2','b'],{[plan.key]:'b'});
 assert.equal(switched[current.id].annualNeed,200);
 assert.equal(switched[current.id].referenceSnapshotId,'b');
});
test('ranked entry with zero historical share passes and reaches capital with its rank',()=>{
 const checked=inspectEntryPlan({1406:{[plan.key]:{share:0,priorityRank:2}}},[plan],'priority');
 assert.deepEqual(checked.errors,[]);assert.equal(checked.plans[0].priorityRank,2);
 const s={id:'s',plans:checked.plans};assert.equal(mergeScenarioPlans([s],1406).plans.length,1);
 const c=reconcileScenarioCases({},[s],['s']);assert.equal(c['s:1406:parent:1'].entryRank,2);
 assert.ok(inspectEntryPlan({1406:{[plan.key]:{share:0,priorityRank:0}}},[plan],'priority').errors.length);
 assert.ok(inspectEntryPlan({1406:{[plan.key]:{share:0,priorityRank:1}}},[],'priority').errors.length);
});
test('historical percentage entry still requires a complete annual share',()=>{
 assert.ok(inspectEntryPlan({1406:{[plan.key]:{share:30}}},[plan]).errors.length);
 assert.deepEqual(inspectEntryPlan({1406:{[plan.key]:{share:100}}},[plan]).errors,[]);
});
const project={id:'p',name:'طرح',parentName:'حوزه',year:1406,annualNeed:100,entryPriority:80,needType:'تملک / سرمایه‌گذاری راهبردی',stageable:false,minimumExecution:1,maximumRate:.35,dedicatedSource:'',dedicatedAmount:0};
const finance={...DEFAULT_FINANCIAL_INPUT,partnerCapacity:100};
test('entry ranks control funding order and explicit managerial rank remains authoritative',()=>{
 const a={...project,id:'a',entryRank:2,entryPriority:99},b={...project,id:'b',entryRank:1,entryPriority:1};
 let o=allocateCapital({year:1406,financialInput:finance,projects:[a,b]});
 assert.equal(o.results[0].id,'b');assert.equal(o.results[0].executed,100);
 o=allocateCapital({year:1406,financialInput:finance,projects:[{...a,overrideRank:1,overrideReason:'مصوبه'},b]});
 assert.equal(o.results[0].id,'a');assert.equal(o.results[0].executed,100);
});
test('executive totals preserve unknown needs, without masking known financing',()=>{
 const o=allocateCapital({year:1406,financialInput:finance,projects:[project,{...project,id:'missing',annualNeed:0}]});
 const s=summarizeCapital(o);assert.equal(s.need,null);assert.equal(s.gap,null);assert.equal(s.coverage,null);assert.equal(s.knownNeed,100);assert.equal(s.incomplete,1);
 const complete=summarizeCapital(allocateCapital({year:1406,financialInput:finance,projects:[project]}));
 assert.equal(complete.need,100);assert.equal(complete.gap,0);assert.equal(complete.coverage,1);
 assert.equal(summarizeCapital(allocateCapital({year:1406,financialInput:finance})).need,null);
});
test('actual financial values keep database units without silent monetary rescaling',()=>{
 assert.equal(formatFinancialValue(1000000,'میلیون ریال',0),'۱٬۰۰۰٬۰۰۰ میلیون ریال');
 assert.equal(formatFinancialValue(.2,'درصد',0),'۲۰٪');
 assert.equal(formatFinancialValue(20,'روز',0),'۲۰ روز');
 assert.equal(formatFinancialValue(2.5,'نسبت'),'۲٫۵ نسبت');
 assert.equal(formatFinancialValue(null,'درصد'),'—');
 assert.match(formatFinancialValue(2,''),/بدون واحد ثبت‌شده/);
});
test('all embedded actual-history units match original financial workbook unit metadata',async()=>{
 const {readFile}=await import('node:fs/promises');
 const original=JSON.parse(await readFile(new URL('./fixtures/financial-source-units.json',import.meta.url),'utf8'));
 const companies=JSON.parse(await readFile(new URL('../public/data/financial-companies.json',import.meta.url),'utf8'));
 let compared=0;
 for(const c of companies)for(const [code,history]of Object.entries(c.kpiHistory??{}))for(const point of history){
  assert.ok(original[c.scope]?.[code]?.includes(point.unit),`${c.name} ${code}: ${point.unit}`);compared++;
 }
 assert.ok(compared>7000);
});
