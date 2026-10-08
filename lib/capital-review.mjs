import {FUNDING_SOURCES} from './capital-allocation.mjs';
const fa=n=>n.toLocaleString('fa-IR',{maximumFractionDigits:2});
const reasons={
 source_ineligible:'این منبع برای نوع نیاز طرح مجاز نیست.',
 liquidity_restricted:'مجوز استفاده از این منبع در وضعیت کسری نقد وجود ندارد.',
 rate_exceeded:'نرخ بدهی از سقف پذیرفته‌شده طرح بالاتر است.',
 no_capacity:'برای این منبع ظرفیتی ثبت نشده است.',
 source_reserved:'مانده منبع برای طرح‌های دیگر رزرو شده است.',
 source_consumed:'ظرفیت منبع در طرح‌های مقدم مصرف شده است.',
 debt_ceiling:'سقف مشترک بدهی قابل استفاده تمام شده است.',
 dedicated_limit:'سقف مرحله اختصاصی اجازه تخصیص بیشتر نمی‌دهد.',
 partial_reserved:'رزرو دیگر طرح‌ها، ظرفیت این مرحله را محدود کرده است.',
 partial_capacity:'مانده منبع از نیاز باقیمانده این مرحله کمتر بوده است.',
 partial_debt_ceiling:'سقف مشترک بدهی، مبلغ این مرحله را محدود کرده است.',
 partial_dedicated_limit:'سقف مرحله اختصاصی، مبلغ این مرحله را محدود کرده است.',
};
/** Display adapter, with no allocation decisions or counterfactual estimates. */
export function reviewCapitalProject(project) {
 const assessed=project.audit?.assessed??project.trace.some(t=>t.source);
 const temporary=assessed?(project.temporaryFunding??project.trace.reduce((n,t)=>n+t.allocation,0)):null;
 const released=assessed?project.trace.reduce((n,t)=>n+(t.releasedAllocation??0),0):null;
 const rows=Object.keys(FUNDING_SOURCES).map(key=>{
  const stages=project.trace.filter(t=>t.source===key);
  const considered=stages.filter(t=>t.needBefore>0.01);
  const constraints=[...new Set(considered.flatMap(t=>t.constraints??(t.reasonCode?[t.reasonCode]:[])))].filter(c=>reasons[c]);
  const amount=project.allocations[key];
  const trial=stages.reduce((n,t)=>n+t.allocation,0);
  const freed=stages.reduce((n,t)=>n+(t.releasedAllocation??0),0);
  const consumers=stages[0]?.consumers??[];
  const reservations=stages[0]?.reservationHolders??[];
  const debtConsumers=stages.find(t=>t.debtConsumers?.length)?.debtConsumers??[];
  const debtReservations=stages.find(t=>t.debtReservationHolders?.length)?.debtReservationHolders??[];
  const state=!assessed?'unassessed':freed>0?'released':amount>0?'funded':considered.length?'blocked':stages.length?'not_needed':'unassessed';
  const explanation=state==='unassessed'?'بررسی این منبع انجام نشده است.':state==='not_needed'?'نیاز طرح پیش از رسیدن به این منبع تأمین شده بود.':state==='released'?'مبلغ موقت به علت عبور نکردن از حداقل اجرا آزاد شد.':state==='funded'?'این مبلغ در تخصیص نهایی طرح منظور شد.':constraints.includes('no_capacity')?'برای این منبع ظرفیتی ثبت نشده است.':'این منبع به تأمین طرح کمک نکرد.';
  return {key,label:FUNDING_SOURCES[key].label,amount,temporary:trial,released:freed,state,explanation,constraints:constraints.map(code=>{
   const stage=considered.find(t=>t.constraints?.includes(code)||t.reasonCode===code);
   let text=reasons[code];
   if(code==='source_consumed'){
    const earlier=stage?.usedByEarlier??stage?.consumers?.reduce((n,r)=>n+r.amount,0)??0;
    const own=stage?.temporaryBefore??0;
    text=own>0?(earlier>0?'ظرفیت پس از مصرف طرح‌های مقدم و تخصیص موقت همین طرح تمام شده است.':'ظرفیت پس از تخصیص موقت همین طرح تمام شده است.'):(earlier>0?reasons[code]:'ظرفیت پس از تخصیص‌های قبلی تمام شده است.');
   }
   return {code,text};
  }),consumers,reservations,debtConsumers,debtReservations,start:project.audit?.start.remaining[key]??null,usedByEarlier:project.audit?.start.used[key]??null,reserved:project.audit?.start.otherReserved[key]??null,end:project.audit?.end.remaining[key]??null};
 });
 const narrative=!project.validation.valid?'نیاز طرح هنوز معتبر نیست؛ ابتدا ورودی‌های پرونده را تکمیل کنید.':!assessed?project.reason:project.passedMinimum===false?`از نیاز ${fa(project.annualNeed)}، مبلغ ${fa(temporary)} بررسی و موقتاً قابل تخصیص بود؛ به حداقل ${fa(project.minimumRequired??project.annualNeed)} نرسید. ${fa(released)} آزاد شد و تأمین نهایی صفر است.`:project.deferred>0?`از نیاز ${fa(project.annualNeed)}، مبلغ ${fa(project.executed)} تخصیص یافت؛ حداقل اجرا تأمین شد و ${fa(project.deferred)} به تعویق رفت.`:`نیاز ${fa(project.annualNeed)} با ترکیب منابع زیر به‌طور کامل تأمین شد.`;
 const codes=new Set(project.trace.flatMap(t=>[t.reasonCode,...(t.constraints??[])]));
 const action=!project.validation.valid?'case':codes.has('invalid_finance')||codes.has('liquidity_blocked')?'resources':!assessed?'policy':project.deferred>0?'resources':'decision';
 return {assessed,temporary,released,rows,narrative,action};
}
