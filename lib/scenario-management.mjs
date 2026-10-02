import { workspaceId } from './scenario-workspace.mjs';
import { validateSourcePolicy } from './capital-allocation.mjs';

const record = value => value && typeof value === 'object' && !Array.isArray(value);
const assert = (ok, message) => { if (!ok) throw new Error(message); };
/** Validate before touching browser storage. A rejected file never replaces current work. */
export function validateScenarioBackup(value) {
  assert(record(value) && value.version === 31, 'نسخه فایل پشتیبان پشتیبانی نمی‌شود.');
  const inspect = (v, depth = 0) => {
    assert(depth < 60, 'ساختار فایل معتبر نیست.');
    if (typeof v === 'number') assert(Number.isFinite(v), 'فایل دارای عدد نامعتبر است.');
    if (v && typeof v === 'object') for (const [key, child] of Object.entries(v)) {
      assert(!['__proto__', 'prototype', 'constructor'].includes(key), 'ساختار فایل معتبر نیست.');
      inspect(child, depth + 1);
    }
  };
  inspect(value);
  const baseValid = b => record(b) && record(b.vision) && ['core','adjacent','transform'].every(k=>Number.isFinite(b.vision[k]) && b.vision[k]>=0) && Math.abs(Object.values(b.vision).reduce((a,b)=>a+b,0)-100)<.01 && ['baskets','board','activityBoard','mission','conditions','customWeights','selectionWeights'].every(k=>record(b[k]));
  assert(baseValid(value.base), 'ساختار سیاست سناریو ناقص است.');
  assert(Array.isArray(value.scenarios) && Array.isArray(value.snapshots), 'فهرست سناریوها ناقص است.');
  const ids = new Set();
  for (const s of value.scenarios) {
    assert(record(s) && typeof s.id === 'string' && s.id && !ids.has(s.id) && typeof s.name === 'string' && s.name.trim() && s.name.length<=100 && Number.isInteger(s.revision) && s.revision>0 && baseValid(s.base) && Array.isArray(s.completed) && s.completed.every(k=>['mission','isic','management','entry'].includes(k)), 'سناریوی نامعتبر یا شناسه تکراری در فایل وجود دارد.');
    ids.add(s.id);
  }
  assert(!value.activeScenarioId || ids.has(value.activeScenarioId), 'سناریوی جاری در فایل موجود نیست.');
  const snapshots = new Set();
  for (const s of value.snapshots) {
    assert(record(s) && typeof s.id === 'string' && s.id && !snapshots.has(s.id) && ids.has(s.scenarioId) && Array.isArray(s.plans) && typeof s.name === 'string' && Number.isInteger(s.revision), 'خروجی سناریو معتبر نیست.');
    for (const p of s.plans) assert(record(p) && typeof p.key==='string' && typeof p.name==='string' && Number.isInteger(p.year) && p.year>=1406 && p.year<=1414 && Number.isFinite(p.entryPriority) && (p.priorityRank==null || Number.isInteger(p.priorityRank)&&p.priorityRank>0), 'برنامه ورود خروجی نامعتبر است.');
    snapshots.add(s.id);
  }
  assert(Array.isArray(value.selectedSnapshots) && value.selectedSnapshots.every(id=>snapshots.has(id)) && record(value.conflictChoices) && Object.values(value.conflictChoices).every(id=>snapshots.has(id)), 'مرجع خروجی منتخب معتبر نیست.');
  assert(record(value.capital) && ['cases','financialByYear','portfolioActions'].every(k=>record(value.capital[k])), 'اطلاعات تخصیص سرمایه ناقص است.');
  for(const c of Object.values(value.capital.cases)) assert(record(c) && typeof c.id==='string' && typeof c.name==='string' && Number.isInteger(c.year) && c.year>=1406 && c.year<=1414 && Number.isFinite(c.annualNeed) && c.annualNeed>=0, 'پرونده مالی نامعتبر است.');
  Object.values(value.capital.sourcePolicies ?? {}).forEach(validateSourcePolicy);
  assert(value.archivedScenarioIds == null || Array.isArray(value.archivedScenarioIds) && value.archivedScenarioIds.every(id=>ids.has(id)), 'فهرست سناریوهای حذف‌شده معتبر نیست.');
  return structuredClone(value);
}

/** Recoverable removal: frozen financial history remains intact, but cannot be selected. */
export function archiveScenario(workspace, id, archived = true) {
  assert(workspace.scenarios.some(s=>s.id===id), 'سناریو پیدا نشد.');
  const archivedIds = new Set(workspace.archivedScenarioIds ?? []);
  if(archived) archivedIds.add(id); else archivedIds.delete(id);
  const blocked = new Set(workspace.snapshots.filter(s=>archivedIds.has(s.scenarioId)).map(s=>s.id));
  const active = archivedIds.has(workspace.activeScenarioId) ? workspace.scenarios.find(s=>!archivedIds.has(s.id)) : workspace.scenarios.find(s=>s.id===workspace.activeScenarioId);
  return {...workspace, archivedScenarioIds:[...archivedIds],activeScenarioId:active?.id??'',base:active?.base??workspace.base,selectedSnapshots:workspace.selectedSnapshots.filter(id=>!blocked.has(id)),conflictChoices:Object.fromEntries(Object.entries(workspace.conflictChoices).filter(([,v])=>!blocked.has(v)))};
}

export function renameScenario(workspace, id, name) {
  const clean=name.trim();
  assert(clean && clean.length<=100, 'نام سناریو باید بین یک تا صد نویسه باشد.');
  assert(!workspace.scenarios.some(s=>s.id!==id && s.name===clean && !(workspace.archivedScenarioIds??[]).includes(s.id)), 'نام سناریو تکراری است.');
  return {...workspace,scenarios:workspace.scenarios.map(s=>s.id===id?{...s,name:clean}:s),snapshots:workspace.snapshots.map(s=>s.scenarioId===id?{...s,name:clean}:s)};
}

/** Import scenarios as independent copies. Existing finance and decisions are never overwritten. */
export function mergeScenarioBackup(current, backup, makeId=workspaceId) {
  const incoming=validateScenarioBackup(backup);
  const scenarioIds=new Map(incoming.scenarios.map(s=>[s.id,makeId()]));
  const snapshotIds=new Map(incoming.snapshots.map(s=>[s.id,makeId()]));
  const names=new Set(current.scenarios.map(s=>s.name));
  const scenarios=incoming.scenarios.map(s=>{
    let name=s.name;let n=1;while(names.has(name)) name=`${s.name.slice(0,75)} · بازیابی ${(n++).toLocaleString('fa-IR')}`;names.add(name);
    return {...s,id:scenarioIds.get(s.id),name};
  });
  const snapshots=incoming.snapshots.map(s=>({...s,id:snapshotIds.get(s.id),scenarioId:scenarioIds.get(s.scenarioId),name:scenarios.find(x=>x.id===scenarioIds.get(s.scenarioId)).name}));
  const runKey=key=>key?.split('|').map(id=>snapshotIds.get(id)??id).sort().join('|');
  const caseIds=new Map(Object.values(incoming.capital.cases).map(c=>[c.id,c.sourceKind==='independent'?makeId():`${runKey(c.runKey)}:${c.year}:${c.opportunityKey}`]));
  const cases=Object.fromEntries(Object.values(incoming.capital.cases).filter(c=>c.sourceKind!=='independent' && c.runKey?.split('|').every(id=>snapshotIds.has(id))).map(c=>{
    const id=caseIds.get(c.id);return [id,{...c,id,runKey:runKey(c.runKey),referenceSnapshotId:snapshotIds.get(c.referenceSnapshotId),continuationOf:c.continuationOf?caseIds.get(c.continuationOf):undefined}];
  }));
  const sourcePolicies=Object.fromEntries(Object.entries(incoming.capital.sourcePolicies??{}).filter(([key])=>key.split('|').every(id=>snapshotIds.has(id))).map(([key,value])=>[runKey(key),value]));
  const requestedActive=(incoming.archivedScenarioIds??[]).includes(incoming.activeScenarioId)?undefined:scenarioIds.get(incoming.activeScenarioId);
  const activeScenarioId=requestedActive??scenarios.find(s=>!(incoming.archivedScenarioIds??[]).some(id=>scenarioIds.get(id)===s.id))?.id??current.activeScenarioId;
  return {...current,scenarios:[...current.scenarios,...scenarios],snapshots:[...current.snapshots,...snapshots],archivedScenarioIds:[...(current.archivedScenarioIds??[]),...(incoming.archivedScenarioIds??[]).map(id=>scenarioIds.get(id))],activeScenarioId,base:scenarios.find(s=>s.id===activeScenarioId)?.base??current.base,capital:{...current.capital,cases:{...current.capital.cases,...cases},sourcePolicies:{...current.capital.sourcePolicies,...sourcePolicies}}};
}

export function scenarioBackup(workspace, id) {
  const scenario=workspace.scenarios.find(s=>s.id===id);
  assert(scenario,'سناریو پیدا نشد.');
  const snapshots=workspace.snapshots.filter(s=>s.scenarioId===id);
  const ids=new Set(snapshots.map(s=>s.id));
  return structuredClone({...workspace,activeScenarioId:id,base:scenario.base,scenarios:[scenario],snapshots,archivedScenarioIds:(workspace.archivedScenarioIds??[]).filter(x=>x===id),selectedSnapshots:workspace.selectedSnapshots.filter(x=>ids.has(x)),conflictChoices:Object.fromEntries(Object.entries(workspace.conflictChoices).filter(([,v])=>ids.has(v))),capital:{...workspace.capital,evaluations:[],cases:Object.fromEntries(Object.entries(workspace.capital.cases).filter(([,c])=>c.runKey?.split('|').every(x=>ids.has(x)))),sourcePolicies:Object.fromEntries(Object.entries(workspace.capital.sourcePolicies??{}).filter(([key])=>key.split('|').every(x=>ids.has(x))))},backupScope:'scenario',exportedAt:new Date().toISOString()});
}
