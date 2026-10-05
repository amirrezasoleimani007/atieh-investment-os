/** Frozen annual evaluation, independent from editable scenarios and scientific scores. */
import {sourcePolicyRequiresReason} from './capital-allocation.mjs';
export function evaluationSignature(input) {
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])):v;
  return JSON.stringify(canonical(input));
}
export function freezeAllocationEvaluation(input, output, {status='draft', actor='', reason='', financeStatus='draft', blocked=false, id, createdAt}={}) {
  if(status==='approved' && (financeStatus!=='confirmed'||output.financialValidation?.valid===false||blocked||!output.valid||output.policyValid===false||output.liquidityBlocked||output.reservationConflict||output.results.some(r=>r.validation?.valid===false||r.financialReviewRequired)||!output.results.length||output.results.some(r=>r.overrideRank!=null&&!r.overrideReason?.trim())||sourcePolicyRequiresReason(input?.sourcePolicy)&&!input?.sourcePolicy?.reason?.trim()||!actor.trim()||!reason.trim())) throw new Error('ورودی‌ها، دلایل تغییر سیاست و مشخصات تصمیم را تکمیل و تأیید کنید.');
  return structuredClone({id,createdAt,status,actor,reason,signature:evaluationSignature(input),input,output});
}
