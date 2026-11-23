import {CHART_DEFINITIONS,formatNumber,type FinancialModel,type AxisBundle} from './financial-engine';
import {buildDynamicRanking,BASE_RANKING_WEIGHTS} from './dynamic-ranking-engine';
import {watchBand,WATCH_BAND_NAMES} from './watch-narrative';

export interface ReportFact {id:string;label:string;value:string}
export interface ReportAxis {key:string;label:string;current:number|null;previous:number|null;delta:number|null;peerMedian:number|null;peerCount:number;band:string|null}
export interface ReportEvidence {schemaVersion:1;year:number;previousYear:number|null;reportKind:'annual'|'half-year';nature:string;periodLabel:string;historyYears:number[];axes:ReportAxis[];facts:ReportFact[];limitations:string[]}
export function median(values:number[]){const a=[...values].sort((a,b)=>a-b);return a.length?a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2:null}
const finite=(v:number|null|undefined):v is number=>typeof v==='number'&&Number.isFinite(v);
export function latestCompanyYear(model:FinancialModel,company:string){return [...(model.codeIndex.get(company)?.keys()??[])].sort((a,b)=>b-a)[0]??null}
export function buildReportEvidence(model:FinancialModel,matrix:Map<string,Map<number,AxisBundle>>,company:string,year=latestCompanyYear(model,company)):ReportEvidence|null {
 if(year===null||!model.codeIndex.get(company)?.has(year))return null;
 const current=matrix.get(company)?.get(year);if(!current)return null;
 const previousYear=model.codeIndex.get(company)?.has(year-1)?year-1:null;
 const previous=previousYear===null?null:matrix.get(company)?.get(previousYear);
 const nature=model.natureByCompany.get(company)??'';
 const peers=nature?model.companies.filter(c=>c!==company&&model.natureByCompany.get(c)===nature&&model.codeIndex.get(c)?.has(year)):[];
 const historyYears=[...(model.codeIndex.get(company)?.keys()??[])].filter(y=>y<=year!).sort((a,b)=>a-b).slice(-3);
 const facts:ReportFact[]=[];
 const add=(id:string,label:string,value:string)=>facts.push({id,label,value});
 const periodLabel=`${model.reportKind==='half-year'?'شش‌ماهه':'سالانه'} ${year.toLocaleString('fa-IR',{useGrouping:false})}`;
 add('period','دوره تحلیل',periodLabel);add('peerEligible','تعداد سایر همتایان هم‌ماهیت در همین دوره',peers.length.toLocaleString('fa-IR',{useGrouping:false}));
 add('previousPeriod','دوره مشابه سال قبل',previousYear===null?'داده موجود نیست':`${model.reportKind==='half-year'?'شش‌ماهه':'سالانه'} ${previousYear.toLocaleString('fa-IR',{useGrouping:false})}`);
 const axes=CHART_DEFINITIONS.flatMap(d=>[d.xKey,d.yKey]).map((key,i)=>{
  const a=current.axes[key],p=previous?.axes[key].score??null;
  const values=peers.map(c=>matrix.get(c)?.get(year!)?.axes[key].score).filter(finite);
  const reference=values.length>=2?median(values):null;
  const score=finite(a.score)?a.score:null,band=watchBand(score);
  const delta=score!==null&&finite(p)?score-p:null;
  add(`a${i}.current`,`${a.label}؛ امتیاز فعلی از ده`,formatNumber(score,2));
  add(`a${i}.band`,`${a.label}؛ طبقه مدل`,band?WATCH_BAND_NAMES[band]:'داده ناکافی');
  add(`a${i}.previous`,`${a.label}؛ امتیاز دوره مشابه قبل`,formatNumber(p,2));
  add(`a${i}.delta`,`${a.label}؛ تغییر امتیاز`,delta===null?'قابل محاسبه نیست':formatNumber(delta,2));
  add(`a${i}.peerMedian`,`${a.label}؛ میانه سایر همتایان`,formatNumber(reference,2));
  add(`a${i}.peerCount`,`${a.label}؛ تعداد سایر همتایان دارای داده`,values.length.toLocaleString('fa-IR',{useGrouping:false}));
  return {key,label:a.label,current:score,previous:p,delta,peerMedian:reference,peerCount:values.length,band:band?WATCH_BAND_NAMES[band]:null};
 });
 const ranked=buildDynamicRanking(model,year,BASE_RANKING_WEIGHTS).find(r=>r.company===company);
 add('ranking.score','امتیاز رتبه‌نما با وزن‌های پایه',formatNumber(ranked?.score??null,2));
 add('ranking.validity','اعتبار امتیاز رتبه‌نما',ranked?.validityLabel??'داده ناکافی');
 add('ranking.peerRank','رتبه در گروه هم‌ماهیت شامل شرکت منتخب',ranked?.peerRank&&ranked.peerRanked>=3?ranked.peerRank.toLocaleString('fa-IR',{useGrouping:false}):'گروه معتبر کافی نیست');
 add('ranking.peerTotal','تعداد شرکت‌های دارای رتبه معتبر؛ شامل منتخب',(ranked?.peerRanked??0).toLocaleString('fa-IR',{useGrouping:false}));
 for(const code of ['144','146','152','154','162','164','173','174','175','176','186']){
  const r=model.codeIndex.get(company)?.get(year)?.get(code);
  if(r&&finite(r.value))add(`raw.${code}`,`${r.variable}؛ مقدار منبع`,`${formatNumber(r.unit.includes('درصد')?r.value*100:r.value,2)} ${r.unit}`);
 }
 const limitations=['امتیازهای محور و رتبه‌نما بر داده‌های مشترک تکیه دارند و شواهد مستقل محسوب نمی‌شوند.','رتبه‌نما در این گزارش با وزن‌های پایه محاسبه می‌شود؛ سناریوی وزن‌گذاری دیگر در این گزارش اعمال نشده است.','این بسته به داده مالی متصل است؛ جزئیات بودجه، محصول و عملیات در این نسخه به گزارش متصل نشده‌اند.'];
 if(previousYear===null)limitations.push('دوره مشابه سال قبل موجود نیست؛ بهبود یا افت سال‌به‌سال قابل نتیجه‌گیری نیست.');
 if(axes.some(a=>a.current===null))limitations.push('بعضی محورهای دوره آخر فاقد امتیازند؛ از سال‌های قدیمی جایگزین نشده‌اند.');
 if(axes.some(a=>a.peerMedian===null))limitations.push('برای بعضی محورها حداقل دو همتای دیگر دارای داده موجود نیست؛ مرجع گروه محاسبه نشده است.');
 if(!nature)limitations.push('ماهیت شرکت مشخص نیست؛ گروه همتا تشکیل نشده است.');
 return {schemaVersion:1,year,previousYear,reportKind:model.reportKind==='half-year'?'half-year':'annual',nature:nature.slice(0,100),periodLabel,historyYears,axes,facts,limitations};
}

export function demoReport(e:ReportEvidence){
 const weak=e.axes.map((a,i)=>({...a,i})).filter(a=>a.current!==null&&a.current<3.33).sort((a,b)=>a.current!-b.current!).slice(0,2);
 const good=e.axes.map((a,i)=>({...a,i})).filter(a=>a.current!==null&&a.current>=6.66).slice(0,2);
 const allChanges=e.axes.map((a,i)=>({...a,i})).filter(a=>a.delta!==null&&Math.abs(a.delta)>=.25).sort((a,b)=>Math.abs(b.delta!)-Math.abs(a.delta!));
 const criticalDrop=allChanges.filter(a=>a.i>=4&&a.delta!<=-.25).sort((a,b)=>a.delta!-b.delta!)[0];
 const changes=[...(criticalDrop?[criticalDrop]:[]),...allChanges.filter(a=>a.i!==criticalDrop?.i)].slice(0,3);
 const gaps=e.axes.map((a,i)=>({...a,i})).filter(a=>a.current!==null&&a.peerMedian!==null&&Math.abs(a.current-a.peerMedian)>=.25).sort((a,b)=>Math.abs(b.current!-b.peerMedian!)-Math.abs(a.current!-a.peerMedian!)).slice(0,2);
 const focus=['اجزای رشد فروش و سود عملیاتی','حاشیه سود و ترکیب هزینه‌ها','دارایی‌های به‌کارگرفته‌شده و فروش حاصل از آن‌ها','بازده سرمایه و هزینه سرمایه','ترکیب دارایی‌ها و تعهدات جاری','پوشش هزینه مالی و سررسید بدهی‌ها','تطبیق سود خالص با جریان نقد عملیاتی و اقلام تعهدی','تفکیک جریان نقد عملیاتی و مخارج سرمایه‌ای'];
 const current=weak.length?`در دوره {{period}}، امتیاز ${weak.map(a=>a.label).join(' و ')} در سطح ضعیف مدل است.${good.length?` در کنار آن، امتیاز ${good.map(a=>a.label).join(' و ')} در سطح مطلوب قرار دارد.`:''}`:e.axes.every(a=>a.current===null)?'اطلاعات محورهای دوره آخر برای جمع‌بندی وضعیت کافی نیست.':`در دوره {{period}}، در محورهای دارای داده امتیاز ضعیفی ثبت نشده است.${good.length?` امتیاز ${good.map(a=>a.label).join(' و ')} در سطح مطلوب قرار دارد.`:''}`;
 const trend=e.previousYear===null||!e.axes.some(a=>a.delta!==null)?'برای مقایسه با دوره مشابه سال قبل داده کافی موجود نیست؛ از این بسته نمی‌توان درباره بهبود یا افت سال‌به‌سال نتیجه گرفت.':changes.length?changes.map(a=>`امتیاز ${a.label} نسبت به دوره مشابه قبل ${a.delta!>0?'افزایش':'کاهش'} یافته و از {{a${a.i}.previous}} به {{a${a.i}.current}} رسیده است.`).join(' '):'در محورهایی که هر دو دوره امتیاز دارند، تغییر امتیاز به حد بررسی نرسیده است؛ این نتیجه درباره محورهای فاقد داده صدق نمی‌کند.';
 const comparison=gaps.length?gaps.map(a=>`امتیاز ${a.label}، {{a${a.i}.current}} است و ${a.current!>a.peerMedian!?'بالاتر':'پایین‌تر'} از میانه سایر همتایان، {{a${a.i}.peerMedian}}، قرار دارد؛ این مرجع از {{a${a.i}.peerCount}} شرکت دیگر تشکیل شده است.`).join(' '):e.axes.some(a=>a.peerMedian!==null)?'در محورهای دارای مرجع گروهی، فاصله برجسته‌ای با میانه سایر همتایان دیده نمی‌شود.':'همتایان دارای داده کافی برای تشکیل مرجع مقایسه موجود نیستند؛ جایگاه نسبی از این بسته قابل ارزیابی نیست.';
 const i=weak[0]?.i;
 return {paragraphs:[
  {id:'current',text:current,evidenceIds:['period',...weak.map(a=>`a${a.i}.current`),...good.map(a=>`a${a.i}.current`)]},
  {id:'trend',text:trend,evidenceIds:['previousPeriod',...changes.flatMap(a=>[`a${a.i}.previous`,`a${a.i}.current`])]},
  {id:'peers',text:comparison,evidenceIds:['peerEligible',...gaps.flatMap(a=>[`a${a.i}.current`,`a${a.i}.peerMedian`,`a${a.i}.peerCount`])]},
  {id:'focus',text:i===undefined?'برای کامل‌ترشدن برداشت از عملکرد شرکت، مقادیر واقعی شاخص‌ها و پوشش داده بررسی شوند. این نمونه درباره علت تغییرات یا تصمیم اجرایی حکم قطعی نمی‌دهد.':`موضوع اصلی بررسی، ${focus[i]} است. امتیاز ضعیف به‌تنهایی علت مسئله یا اقدام اجرایی مناسب را تعیین نمی‌کند.`,evidenceIds:[i===undefined?'period':`a${i}.current`]}
 ]};
}
