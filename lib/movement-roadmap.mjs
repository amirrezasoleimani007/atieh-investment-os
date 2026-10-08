import {evaluationSignature} from './allocation-evaluations.mjs';
import {reviewSignature} from './scenario-workspace.mjs';
export function movementRoadmap({baskets,opportunities,scenario,snapshots,evaluations,currentRunKey,currentInputs={}}){
 const snapshot=snapshots.filter(s=>s.scenarioId===scenario.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
 const unchanged=Boolean(snapshot&&snapshot.revision===scenario.revision&&snapshot.policy&&reviewSignature(snapshot.policy,'entry')===reviewSignature(scenario.base,'entry'));
 const keys=[...new Set(Object.values(baskets).flatMap(b=>Object.keys(b)))];
 return keys.map(key=>({key,name:opportunities.find(o=>o.key===key)?.name??key,cells:Array.from({length:9},(_,i)=>{
  const year=1406+i,plan=baskets[year]?.[key];if(!plan)return {year,status:'none',label:'—'};
  const evaluation=evaluations.filter(e=>e.input.year===year&&snapshot&&e.input.runKey===snapshot.id&&e.output.results.some(r=>r.opportunityKey===key)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
  const project=evaluation?.output.results.find(r=>r.opportunityKey===key);
  const current=unchanged&&evaluation&&currentRunKey===evaluation.input.runKey&&evaluation.signature===evaluationSignature(currentInputs[year]);
  if(!project)return {year,rank:plan.priorityRank,status:unchanged?'waiting':'planned',label:unchanged?'در انتظار ارزیابی مالی':'برنامه ورود'};
  const status=!current?'historical':evaluation.status!=='approved'?'draft':project.executed===0?'deferred':project.deferred>.009?'partial':'funded';
  const labels={historical:'نسخه پیشین / ورودی متفاوت',draft:'پیش‌نویس تخصیص',deferred:'تعویق تأییدشده',partial:'تأمین جزئی تأییدشده',funded:'تأمین کامل تأییدشده'};
  return {year,rank:plan.priorityRank,status,label:labels[status],need:project.validation.valid?project.annualNeed:null,funded:project.executed,gap:project.validation.valid?project.deferred:null,reason:project.reason,sources:project.allocations,evaluationId:evaluation.id};
 })}));
}
