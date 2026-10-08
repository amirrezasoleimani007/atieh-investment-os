import {FUNDING_SOURCES,TRACE_REASONS} from './capital-allocation.mjs';
export const STORY_PHASES=['ورود طرح','نوبت بررسی','تأمین از منابع','کنترل اجرا','نتیجه'];
/** Replay recorded events. Never recompute or merge repeated source visits. */
export function capitalStory(project) {
 const events=[{id:'entry',kind:'entry',phase:0,title:'این طرح چگونه وارد تخصیص شد؟',temporary:0,remaining:project.validation.valid?project.annualNeed:null}];
 const assessed=project.audit?.assessed??project.trace.some(t=>t.source);
 if(!assessed){
  events.push({id:'stop',kind:'stop',phase:1,title:'بررسی متوقف شد',temporary:null,remaining:project.validation.valid?project.annualNeed:null});
 }else{
  events.push({id:'turn',kind:'turn',phase:1,title:'چرا نوبت این طرح رسید؟',temporary:0,remaining:project.annualNeed});
  let temporary=0;const unneeded=[];
  project.trace.forEach((t,index)=>{
   if(!t.source)return;
   if(t.needBefore<=.01){unneeded.push({index,source:t.source,stage:t.stage});return;}
   temporary+=t.allocation;
   events.push({id:`source:${index}`,kind:'source',phase:2,title:FUNDING_SOURCES[t.source].label,traceIndex:index,temporary,remaining:t.needAfter});
  });
  if(unneeded.length)events.push({id:'unneeded',kind:'unneeded',phase:2,title:'نیاز پیش از منابع بعدی تکمیل شد',unneeded,temporary,remaining:0});
  events.push({id:'gate',kind:'gate',phase:3,title:'آیا تأمین برای اجرای طرح کافی بود؟',temporary:project.temporaryFunding??temporary,remaining:Math.max(0,project.annualNeed-(project.temporaryFunding??temporary))});
 }
 events.push({id:'result',kind:'result',phase:4,title:'نتیجه نهایی تخصیص',temporary:project.executed,remaining:project.validation.valid?project.deferred:null});
 return events;
}
export function sourceDecision(project,traceIndex) {
 const t=project.trace[traceIndex];if(!t?.source)return null;
 const dedicated=t.stageKind==='dedicated'||t.stage==='منبع اختصاصی';
 const selection=t.selectionReason??(dedicated?project.dedicatedMode==='reserved'?'dedicated_reserved':'dedicated_preferred':'default_order');
 const why={dedicated_reserved:'این منبع برای طرح رزرو شده است؛ تعهد اختصاصی پیش از منابع عمومی بررسی می‌شود.',dedicated_preferred:'این منبع به‌عنوان منبع اختصاصی ترجیحی پرونده ثبت شده است.',custom_order:'این منبع در نوبت فعلیِ ترتیب منابع تعیین‌شده توسط مدیریت قرار دارد.',default_order:`این منبع در نوبت فعلیِ ترتیب پیش‌فرض تأمین «${project.needType}» قرار دارد.`}[selection];
 const limit=t.dedicatedLimit??(dedicated?project.dedicatedAmount:null);
 const constraints=[...new Set(t.constraints??[])].filter(c=>c!=='not_needed');
 const explanations=constraints.map(c=>{
  if(c==='source_consumed'&&(t.temporaryBefore??0)>0)return (t.usedByEarlier??0)>0?'ظرفیت پس از مصرف طرح‌های مقدم و تأمین موقت همین طرح تمام شده است.':'ظرفیت با تأمین موقت همین طرح پر شده است.';
  return TRACE_REASONS[c]??c;
 });
 const permissions=[{label:'مجوز این منبع برای نوع نیاز',pass:t.eligible??null},{label:'مجوز استفاده در وضعیت نقدینگی',pass:t.permittedByLiquidity??null},{label:'نرخ بدهی در سقف طرح',pass:t.rateAllowed}];
 const blocked=permissions.some(p=>p.pass===false);
 const candidates=[{label:'نیاز قبل از این مرحله',amount:t.needBefore},{label:'ظرفیت پس از مصرف، رزرو و سقف بدهی',amount:t.usableCapacity},...(limit==null?[]:[{label:'سقف این مرحله اختصاصی',amount:limit}])];
 return {why,dedicated,limit,explanations,permissions,blocked,candidates,selection};
}
