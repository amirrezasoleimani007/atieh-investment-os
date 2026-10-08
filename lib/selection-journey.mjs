import {ENTRY_MODES,captureSelectionTrace} from './entry-route.mjs';
import {selectionScore} from './movement-model.mjs';
/** Recorded selection evidence is independent from later policy edits and allocation amounts. */
export function selectionJourney(input,year){
 const base=input.scenario.base??{};
 return Object.entries(input.baskets[year]??{}).map(([key,plan])=>{
  const item=input.opportunities.find(o=>o.key===key);if(!item)return null;
  const stored=plan.selectionTrace;
  const trace=stored??captureSelectionTrace(item,base,null,year,'نسخه جاری؛ سابقه زمان انتخاب ثبت نشده');
  const weights=trace.weights??{macro:50,detail:30,board:20};
  const calculation=selectionScore(trace.scores.macro,trace.scores.detail,trace.scores.management,weights);
  return {key,name:item.name,parentId:item.parentId,parentName:item.parentName??'حوزه اصلی',child:item.child,rank:plan.priorityRank,mode:plan.entryMode??null,modeLabel:ENTRY_MODES[plan.entryMode]?.label??'مسیر تعیین نشده',target:ENTRY_MODES[plan.entryMode]?.target??'نیازمند تعیین مسیر',trace,recorded:Boolean(stored),calculation,currentPriority:item.entryPriority};
 }).filter(Boolean).sort((a,b)=>(a.rank??999)-(b.rank??999)||a.parentId-b.parentId);
}
