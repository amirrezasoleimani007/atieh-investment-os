/** Presentation only: unknown needs remain unknown, no allocation rule changes. */
export function summarizeCapital(output) {
 const valid=output.results.filter(r=>r.validation.valid);
 const incomplete=output.results.length-valid.length;
 const review=output.results.filter(r=>r.financialReviewRequired).length;
 const knownNeed=valid.reduce((n,r)=>n+r.annualNeed,0);
 const knownGap=valid.reduce((n,r)=>n+r.deferred,0);
 return {incomplete,review,knownNeed,knownGap,need:incomplete||!output.results.length?null:knownNeed,gap:incomplete||!output.results.length?null:knownGap,coverage:!incomplete&&knownNeed>0?output.totalExecuted/knownNeed:null};
}
