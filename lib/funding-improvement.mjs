import {allocateCapital,FUNDING_SOURCES,normalizedSourceOrder} from './capital-allocation.mjs';
const permutations=items=>items.length?items.flatMap((x,i)=>permutations(items.filter((_,j)=>i!==j)).map(p=>[x,...p])):[[]];
const orders=permutations(Object.keys(FUNDING_SOURCES));
/** Bounded policy search, preserving each baseline project's committed amount. No global-optimum claim. */
export function findFundingImprovement(input,baseline=allocateCapital(input),otherInputs=[]){
 if(!baseline.valid||!baseline.policyValid||baseline.liquidityBlocked||baseline.reservationConflict||baseline.reservationInvalid||!baseline.financialValidation.valid||baseline.results.some(r=>!r.validation.valid))return {status:'blocked',tested:0,baseline,best:null,gain:0,changes:[]};
 const peers=otherInputs.map(input=>({input,baseline:allocateCapital(input)}));
 let best=baseline,policy=structuredClone(input.sourcePolicy??{}),tested=0;
 const needs=[...new Set(baseline.results.map(r=>r.needType))];
 const changes=[];
 for(const need of needs){
  let winning=null;
  for(const order of orders){
   const proposal={...policy,orders:{...policy.orders,[need]:order},reason:policy.reason||'تحلیل مقایسه ترتیب منابع با حفظ اولویت طرح‌ها'};
   const out=allocateCapital({...input,sourcePolicy:proposal});tested++;
   const protectedAll=baseline.results.every(r=>(out.results.find(p=>p.id===r.id)?.executed??0)+.009>=r.executed);
   if(protectedAll&&out.valid&&out.policyValid&&out.totalExecuted>best.totalExecuted+.009){
    const protectsOtherYears=peers.every(p=>{const {liquidityMode,liquidityReason,liquiditySources}=p.input.sourcePolicy??{};const next=allocateCapital({...p.input,sourcePolicy:{...proposal,liquidityMode,liquidityReason,liquiditySources}});return p.baseline.results.every(r=>(next.results.find(n=>n.id===r.id)?.executed??0)+.009>=r.executed);});
    if(protectsOtherYears){best=out;winning=proposal;}
   }
  }
  if(winning){changes.push({needType:need,before:normalizedSourceOrder(need,policy.orders?.[need]),after:winning.orders[need]});policy=winning;}
 }
 return {status:best.totalExecuted>baseline.totalExecuted+.009?'improved':'not_found',tested,baseline,best:best===baseline?null:best,policy,gain:Math.round((best.totalExecuted-baseline.totalExecuted)*100)/100,changes};
}
