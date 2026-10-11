import {allocateCapital} from './capital-allocation.mjs';
/** A read-only counterfactual; never changes the recorded plan or its funding. */
export function assessPhasedExecution(input,id,minimumPercent) {
 if(!Number.isFinite(minimumPercent)||minimumPercent<1||minimumPercent>100)return {status:'invalid'};
 const baseline=allocateCapital(input),before=baseline.results.find(p=>p.id===id);
 if(!before?.validation.valid || !baseline.financialValidation.valid || !baseline.policyValid || baseline.liquidityBlocked || baseline.reservationConflict)return {status:'blocked'};
 const candidate=allocateCapital({...input,projects:input.projects.map(p=>p.id===id?{...p,stageable:true,minimumExecution:minimumPercent/100}:p)});
 const after=candidate.results.find(p=>p.id===id);
 const affected=candidate.results.filter(p=>p.id!==id&&p.executed<(baseline.results.find(b=>b.id===p.id)?.executed??0)-.01).map(p=>({name:p.name,before:baseline.results.find(b=>b.id===p.id).executed,after:p.executed}));
 return {status:after.executed>before.executed+.01?'improved':'unchanged',before:before.executed,after:after.executed,gap:after.deferred,affected};
}
