/** Scenario orchestration only. Scientific and allocation engines remain unchanged. */
export function mergeScenarioPlans(snapshots, year, choices = {}, cases = {}) {
  const groups = new Map();
  for (const snapshot of snapshots) {
    for (const plan of snapshot.plans ?? []) {
      if (plan.year !== year || !(plan.priorityRank > 0 || plan.share > 0)) continue;
      const group = groups.get(plan.key) ?? [];
      group.push({ ...plan, snapshotId: snapshot.id, scenarioName: snapshot.name });
      groups.set(plan.key, group);
    }
  }
  const plans = [], conflicts = [];
  for (const [key, group] of groups) {
    const signatures = new Set(group.map(p => {
      const c = Object.values(cases).find(c=>c.runKey===p.snapshotId && c.year===year && c.opportunityKey===p.key);
      return JSON.stringify([p.entryMode??null,p.priorityRank??null,p.share,p.entryPriority,p.horizon,p.macro,p.detail,p.management,...["method","totalNeed","annualNeed","needType","stageable","minimumExecution","maximumRate","dedicatedSource","dedicatedAmount","dedicatedMode"].map(k=>c?.[k]??null)]);
    }));
    const chosen = group.find(p => p.snapshotId === choices[key]);
    if (signatures.size > 1 && !chosen) { conflicts.push({ key, name: group[0].name, options: group }); continue; }
    plans.push({ ...(chosen ?? group[0]), sourceNames: group.map(p => p.scenarioName) });
  }
  // A parent and its detailed activity describe overlapping investment scope.
  const parents = plans.filter(p=>!p.child);
  for (const parent of parents) {
    const children = plans.filter(p=>p.child && p.parentId===parent.parentId);
    if (!children.length) continue;
    const key = `overlap:${parent.parentId}`;
    const alternatives = [parent,...children];
    const choice = choices[key];
    const chosen = alternatives.find(p=>p.snapshotId===choice);
    if (!chosen) {
      conflicts.push({key,name:`هم‌پوشانی ${parent.name}`,options:[...new Map(alternatives.map(p=>[p.snapshotId,p])).values()]});
      for(const p of alternatives) plans.splice(plans.indexOf(p),1);
    } else {
      const keepParent = chosen.key===parent.key;
      for(const p of alternatives) if(keepParent ? p.key!==parent.key : !p.child || p.snapshotId!==choice) plans.splice(plans.indexOf(p),1);
    }
  }
  return { plans, conflicts };
}

export function inspectEntryPlan(baskets, opportunities, mode = "shares") {
  const errors = [], plans = [];
  for (const [yearText, basket] of Object.entries(baskets ?? {})) {
    const year = Number(yearText);
    if (!Number.isInteger(year) || year < 1406 || year > 1414) { errors.push('سال برنامه نامعتبر است.'); continue; }
    const positive = Object.entries(basket).filter(([, p]) => mode === "priority" || Number(p.share) > 0);
    if (!positive.length) continue;
    const total = positive.reduce((sum, [, p]) => sum + Number(p.share), 0);
    if (mode !== "priority" && Math.abs(total - 100) > 0.001) errors.push(`سهم برنامه سال ${year.toLocaleString('fa-IR', {useGrouping:false})} باید صد درصد باشد.`);
    const keys = new Set(positive.map(([key]) => key));
    for (const [key, value] of positive) {
      const opportunity = opportunities.find(item => item.key === key);
      if (!opportunity) { errors.push('یک فرصت منتخب دیگر از غربال مأموریت عبور نمی‌کند.'); continue; }
      if (mode !== "priority" && (!Number.isFinite(Number(value.share)) || Number(value.share) > 100)) { errors.push('سهم یک فرصت نامعتبر است.'); continue; }
      if (opportunity.child && keys.has(`parent:${opportunity.parentId}`)) errors.push('حوزه مادر و زیر‌بخش آن نمی‌توانند همزمان در یک سبد باشند.');
      if(mode === "priority" && (!Number.isInteger(Number(value.priorityRank)) || Number(value.priorityRank)<=0)){errors.push("رتبه پیشنهادی ورود باید عدد صحیح مثبت باشد.");continue;}
      plans.push({ ...opportunity,entryMode:value.entryMode,selectionTrace:value.selectionTrace?structuredClone(value.selectionTrace):undefined, share: Number(value.share??0), ...(mode === "priority" ? {priorityRank:Number(value.priorityRank)} : {}), year });
    }
  }
  if (!plans.length) errors.push(mode === 'priority' ? 'حداقل یک فرصت با رتبه ورود معتبر ثبت کنید.' : 'حداقل یک برنامه سالانه با سهم مثبت ثبت کنید.');
  return { plans, errors: [...new Set(errors)] };
}

export function scopedCases(cases, runKey) {
  return Object.fromEntries(Object.entries(cases).filter(([, item]) => item.sourceKind === 'independent' || item.runKey === runKey || (!item.runKey && runKey === 'legacy')));
}

export function reviewSignature(base, stage) {
  const keys = {
    mission: ['vision','mission','conditions','visionLocked'],
    isic: ['isicPreset','customWeights','mission','conditions'],
    management: ['board','activityBoard'],
    entry: ['tradeRoutes','baskets','selectionWeights','vision','mission','conditions','isicPreset','customWeights','board','activityBoard'],
  }[stage];
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
  const values = keys.filter(key=>key!=='tradeRoutes'||base.tradeRoutes?.length).map(key => {
    if(key === 'visionLocked') return base[key] === true;
    if(key === 'mission') return Object.fromEntries(Object.entries(base[key] ?? {}).filter(([,status])=>status !== 'مجاز'));
    if(key === 'conditions') return Object.fromEntries(Object.entries(base[key] ?? {}).filter(([,c])=>c?.key || c?.note));
    if(key === 'board' || key === 'activityBoard') return Object.fromEntries(Object.entries(base[key] ?? {}).filter(([,b])=>b?.score != null || b?.reason));
    return base[key] ?? null;
  });
  return JSON.stringify(canonical(values));
}

export function workspaceId() { return globalThis.crypto?.randomUUID?.() ?? `record-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }

/** Carry policies across revisions of the same scenario set only. */
export function carryFundingPolicies(capital, snapshots, selectedIds) {
  const sourcePolicies={...capital.sourcePolicies};
  const liquidityPoliciesByYear={...capital.liquidityPoliciesByYear};
  const runKey=selectedIds.slice().sort().join("|");
  const lineage=key=>key.split("|").map(id=>snapshots.find(s=>s.id===id)?.scenarioId??id).sort().join("|");
  if(!runKey)return {sourcePolicies,liquidityPoliciesByYear};
  const same=key=>lineage(key)===lineage(runKey);
  if(!sourcePolicies[runKey]) {
    const previous=Object.entries(sourcePolicies).filter(([key])=>same(key)).at(-1)?.[1];
    if(previous)sourcePolicies[runKey]=structuredClone(previous);
  }
  for(let year=1406;year<=1414;year++){
    const target=`${runKey}:${year}`;
    if(liquidityPoliciesByYear[target])continue;
    const previous=Object.entries(liquidityPoliciesByYear).filter(([key])=>key.endsWith(`:${year}`)&&same(key.slice(0,key.lastIndexOf(":")))).at(-1)?.[1];
    if(previous)liquidityPoliciesByYear[target]=structuredClone(previous);
  }
  return {sourcePolicies,liquidityPoliciesByYear};
}

/** Materialize eligible plans for all years; retain case financial inputs across revisions.
 * Contexts keep separate case records. Prefer the explicitly selected conflict reference.
 */
export function reconcileScenarioCases(cases, snapshots, selectedIds, choices = {}) {
  const selected = snapshots.filter(s => selectedIds.includes(s.id));
  if (!selected.length) return cases;
  const runKey = selectedIds.slice().sort().join("|");
  const result = {...cases};
  const lineage = ids => ids.map(id => snapshots.find(s => s.id === id)?.scenarioId ?? id).sort().join("|");
  const targetLineage = lineage(selectedIds);
  // Snapshot order is the persisted publication order; revisions take precedence.
  const revisionOrder = c => Math.max(-1,...(c.runKey??"").split("|").map(id=>{
    const index=snapshots.findIndex(s=>s.id===id); const snapshot=snapshots[index];
    return Number(snapshot?.revision??0)*100000 + index;
  }));
  const newestFirst = (a,b) => revisionOrder(b)-revisionOrder(a);

  for (let year = 1406; year <= 1414; year++) {
    const {plans} = mergeScenarioPlans(selected, year, choices, cases);
    for (const plan of plans) {
      const id = `${runKey}:${year}:${plan.key}`;
      const same = Object.values(cases).filter(c => c.sourceKind !== "independent" && c.year === year && c.opportunityKey === plan.key);
      const current = cases[id];
      const referenceChanged = current?.referenceSnapshotId && current.referenceSnapshotId !== plan.snapshotId;
      const exact = referenceChanged ? undefined : current;
      const revision = same.filter(c => !(referenceChanged && c.runKey === runKey)).filter(c => lineage((c.runKey ?? "").split("|")) === targetLineage).sort(newestFirst)[0];
      const reference = same.filter(c => c.runKey === plan.snapshotId).at(-1) ?? same.filter(c => lineage((c.runKey ?? "").split("|")) === lineage([plan.snapshotId])).at(-1);
      const prior = exact ?? (referenceChanged || choices[plan.key] ? reference : revision ?? reference);
      result[id] = {
        method:"مشارکت",totalNeed:0,annualNeed:0,needType:"تملک / سرمایه‌گذاری راهبردی",stageable:true,minimumExecution:0.5,maximumRate:0.35,dedicatedSource:"",dedicatedAmount:0,economicNote:"",
        ...prior, id,sourceKind:"scenario",runKey,opportunityKey:plan.key,name:plan.name,parentName:plan.parentName,year,
        financialReviewRequired: Boolean(prior?.financialReviewRequired || prior && prior.referenceSnapshotId !== plan.snapshotId),referenceSnapshotId:plan.snapshotId,...(plan.entryMode?{entryMode:plan.entryMode}:{}),entryRank:plan.priorityRank,entryPriority:plan.entryPriority,macro:plan.macro,detail:plan.detail,management:plan.management,
      };
    }
  }
  // Carry continuing phases into the revised context only when their original
  // opportunity remains approved; independent projects already remain global.
  const approvedKeys = new Set(Array.from({length:9},(_,i)=>mergeScenarioPlans(selected,1406+i,choices,cases).plans).flat().map(p=>p.key));
  for(const prior of Object.values(cases).sort(newestFirst)) {
    if(!prior.continuationOf || prior.sourceKind === "independent" || !approvedKeys.has(prior.opportunityKey) || lineage((prior.runKey??"").split("|"))!==targetLineage) continue;
    const id=`${runKey}:${prior.year}:${prior.opportunityKey}`;
    if(result[id]) continue;
    result[id]={...prior,id,runKey,continuationOf:`${runKey}:${prior.entryYear??prior.year}:${prior.opportunityKey}`,financialReviewRequired:true};
  }
  return result;
}

/** Continuing funding does not create a second entry decision. */
export function eligibleScenarioCases(cases, runKey, plansByYear) {
  const keys = new Set(plansByYear.flatMap(p=>p.key));
  const ids = new Set(plansByYear.map(p=>`${runKey}:${p.year}:${p.key}`));
  return Object.fromEntries(Object.entries(scopedCases(cases,runKey)).filter(([id,c])=>c.sourceKind==="independent" || runKey==="legacy" || ids.has(c.id ?? id) || Boolean(c.continuationOf && keys.has(c.opportunityKey))));
}
