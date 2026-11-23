import {CHART_DEFINITIONS,buildAxisMatrix,formatNumber,type FinancialModel,type ModelSettings} from './financial-engine';
import {selectReportModel,type ReportKind} from './report-period';
import {canonicalCompanyKey,canonicalHolding,type HoldingKey} from './company-resolver';
import {buildDynamicRanking,BASE_RANKING_WEIGHTS} from './dynamic-ranking-engine';
import {BENCHMARK_METRIC_DEFINITIONS,buildBenchmarkRows,type BenchmarkModel} from './benchmark-engine';
import {MARKET_DIMENSIONS,canonicalCompanyName,type MarketModel} from './market-engine';
import type {ProductionModel} from './investment-engine';
import {profitRecordsForCompany,type ProfitModel} from './profit-engine';
import type {AssetModel,MetilActivityModel,EquipmentModel} from './investment-data-engine';
import {buildValueCreationAnalysis} from './value-creation-engine';
import {calculateCompanyUtilization} from './utilization-engine';
import {median} from './report-evidence';

export const REPORT_SOURCES=[
 {id:'financial',label:'ارقام واقعی مالی'}, {id:'watch',label:'دیده‌بان مالی'},
 {id:'ranking',label:'رتبه‌نمای عملکرد'}, {id:'benchmark',label:'پایش تطبیقی عملکرد'},
 {id:'capital',label:'سرمایه و ارزش‌آفرینی'}, {id:'production',label:'تولید و بهره‌برداری'},
 {id:'profit',label:'سود محصول و بودجه'}, {id:'market',label:'ارزیابی بازار'},
 {id:'assets',label:'دارایی‌های شرکت'}, {id:'activity',label:'فروش و فعالیت متیل'},
 {id:'equipment',label:'تجهیزات و ظرفیت متیل'},
] as const;
export type SourceId=typeof REPORT_SOURCES[number]['id'];
export interface ReportInputs {financial:FinancialModel;settings:ModelSettings;holding:HoldingKey;benchmark:BenchmarkModel|null;market:MarketModel|null;production:ProductionModel|null;profit:ProfitModel|null;assets:AssetModel|null;activity:MetilActivityModel|null;equipment:EquipmentModel|null}
export interface EvidenceFact {id:string;source:SourceId;label:string;value:string;period:string;reading?:string;tone?:'positive'|'negative'|'neutral'}
export interface SourceCoverage {id:SourceId;label:string;count:number;period:string;importedAt:string;note:string}
export interface ComprehensiveEvidence {version:2;period:string;year:number;kind:ReportKind;facts:EvidenceFact[];sources:SourceCoverage[];limitations:string[]}
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const fmt=(v:number|null|undefined,d=2)=>finite(v)?formatNumber(v,d):'ناموجود';
const same=(a:string,b:string)=>canonicalCompanyKey(a)===canonicalCompanyKey(b);
const period=(year:number,kind:ReportKind)=>`${kind==='half-year'?'شش‌ماهه':'سالانه'} ${year.toLocaleString('fa-IR',{useGrouping:false})}`;
const date=(v:unknown)=>v instanceof Date?v.toISOString():typeof v==='string'?v:'';
const sumValid=(a:(number|null)[])=>a.length&&a.every(finite)?a.reduce<number>((s,v)=>s+v!,0):null;
export function reportCompanies(input:ReportInputs){return [...new Set([...input.financial.companies,...(input.holding==='atieh'?input.benchmark?.atiehCompanies.map(c=>c.name)??[]:[])])];}
export function reportYears(input:ReportInputs,company:string,kind:ReportKind,selected:SourceId[]){
 const model=selectReportModel(input.financial,kind),resolved=model.companies.find(c=>same(c,company));
 const years=new Set<number>();
 if(selected.some(s=>['financial','watch','ranking','capital'].includes(s))&&resolved)for(const y of model.codeIndex.get(resolved)?.keys()??[])years.add(y);
 if(kind==='annual'){
  if(selected.includes('benchmark')&&input.holding==='atieh'&&input.benchmark?.companies.some(c=>same(c.name,company))) {const b=input.benchmark;for(const y of b.years)years.add(y);}
  if(selected.includes('profit'))for(const r of profitRecordsForCompany(input.profit,company,input.holding))if(!r.isBudget)years.add(r.year);
  // Production sheets can include next-year plans without an actual/budget flag.
  // They must not move a mixed-source report beyond the latest dated actual evidence.
  if(selected.includes('production')&&!years.size)for(const r of input.production?.records??[])if(same(r.company,company))years.add(r.year);
  if(selected.includes('activity')&&input.holding==='metil')for(const r of input.activity?.records??[])if(same(r.company,company))years.add(r.year);
 }
 // Undated sources are snapshots. Use a financial anchor only for selecting a report, never assign them that date.
 if(!years.size&&resolved)for(const y of model.codeIndex.get(resolved)?.keys()??[])years.add(y);
 return [...years].sort((a,b)=>a-b);
}
export function buildComprehensiveEvidence(input:ReportInputs,company:string,kind:ReportKind,year:number,selected:SourceId[]):ComprehensiveEvidence{
 const model=selectReportModel(input.financial,kind),resolved=model.companies.find(c=>same(c,company));
 const annual=kind==='annual',p=period(year,kind),prev=period(year-1,kind);
 const facts:EvidenceFact[]=[],sources:SourceCoverage[]=[],limitations:string[]=[];
 const add=(source:SourceId,label:string,value:string,when=p,reading='',tone:'positive'|'negative'|'neutral'='neutral')=>{if(value.length&&value!=='ناموجود')facts.push({id:`f${facts.length+1}`,source,label:label.slice(0,180),value:value.slice(0,600),period:when,reading,tone});};
 let start=0;
 const close=(id:SourceId,when:string,imported:unknown,note='')=>{sources.push({id,label:REPORT_SOURCES.find(s=>s.id===id)!.label,count:facts.length-start,period:when,importedAt:date(imported),note:note|| (facts.length===start?'برای این شرکت و دوره شاهد معتبر موجود نیست.':'')});start=facts.length;};
 const current=resolved?model.codeIndex.get(resolved)?.get(year):undefined;
 const before=resolved?model.codeIndex.get(resolved)?.get(year-1):undefined;
 const nature=resolved?model.natureByCompany.get(resolved):undefined;
 const peers=resolved&&nature?model.companies.filter(c=>c!==resolved&&model.natureByCompany.get(c)===nature&&model.codeIndex.get(c)?.has(year)):[];
 const raw=(r:{value:number|null;unit:string}|undefined)=>r&&finite(r.value)?`${fmt(r.unit.includes('درصد')?r.value*100:r.value)} ${r.unit}`:null;
 if(selected.includes('financial')){
  const codes=['111','112','113','118','124','114','160','161','128','129','130','134','148','144','146','152','154','162','164','173','174','175','176','179','186'];
  for(const code of codes){const r=current?.get(code);if(!r||raw(r)===null)continue;const old=before?.get(code);const vals=peers.map(c=>model.codeIndex.get(c)?.get(year)?.get(code)).filter(r=>r&&finite(r.value));
   const valid=vals.filter(v=>v!.unit===r.unit);const med=valid.length>=2?median(valid.map(v=>v!.value!)):null;
   let v=`دوره گزارش: ${raw(r)}`;if(old&&old.unit===r.unit&&raw(old)!==null)v+=`؛ مشابه قبل: ${raw(old)}`;
    if(finite(med))v+=`؛ میانه سایر هم‌ماهیت‌ها: ${raw({value:med,unit:r.unit})} (${valid.length.toLocaleString('fa-IR')} شرکت)`;
    if(code==='161')v+=r.value!<0?'؛ جریان نقد آزاد منفی است؛ علت آن از این عدد مشخص نیست.':'؛ جریان نقد آزاد غیرمنفی است.';
   const change=old&&old.unit===r.unit&&finite(old.value)?r.value!-old.value:null;
   const flow=['114','161'].includes(code);const favorable=['111','113','118','124'].includes(code);
   const loss=['113','118','124'].includes(code)&&r.value!<0;
   const reading=`${flow?(r.value!<0?'مقدار جریان نقد منفی است.':r.value===0?'جریان نقد صفر است.':'مقدار جریان نقد مثبت است.'):loss?'در این سطح هنوز زیان وجود دارد.':''}${change===null?'':change>0?' مقدار نسبت به مشابه قبل بیشتر شده است.':change<0?' مقدار نسبت به مشابه قبل کمتر شده است.':' مقدار تغییر نکرده است.'}`;
   const tone=loss?'negative':flow?(r.value!<0?'negative':r.value!>0?'positive':'neutral'):favorable&&change!==null?(change>0?'positive':change<0?'negative':'neutral'):'neutral';
   add('financial',r.variable,v,p,reading,tone);
  }
  // Only genuine earlier observations; absent years stay absent.
  if(current)for(const y of [year-2])for(const code of ['111','118','124','173','176']){const r=resolved?model.codeIndex.get(resolved)?.get(y)?.get(code):undefined;if(r&&raw(r)!==null)add('financial',r.variable,raw(r)!,period(y,kind));}
  close('financial',p,model.importedAt,'مبالغ و نسبت‌ها از مرکز داده؛ همتایان با واحد و دوره یکسان و بدون شرکت منتخب.');
 }
 if(selected.includes('watch')){
  const matrix=buildAxisMatrix(model,input.settings),bundle=resolved?matrix.get(resolved)?.get(year):null;
  for(const key of CHART_DEFINITIONS.flatMap(d=>[d.xKey,d.yKey])){const a=bundle?.axes[key];if(!a||!finite(a.score))continue;const old=resolved?matrix.get(resolved)?.get(year-1)?.axes[key].score:null;const vals=peers.map(c=>matrix.get(c)?.get(year)?.axes[key].score).filter(finite);const band=a.score<3.33?'ضعیف':a.score<6.66?'متوسط':'مطلوب';const reading=`این محور در طبقه ${band} مدل است.${finite(old)?a.score>old?' امتیاز نسبت به مشابه قبل افزایش یافته است.':a.score<old?' امتیاز نسبت به مشابه قبل کاهش یافته است.':' امتیاز تغییر نکرده است.':''}`;add('watch',a.label,`امتیاز از ده: ${fmt(a.score)}${finite(old)?`؛ مشابه قبل: ${fmt(old)}`:''}${vals.length>=2?`؛ میانه سایر همتایان: ${fmt(median(vals))} (${vals.length.toLocaleString('fa-IR')} شرکت)`:''}`,p,reading,a.score<3.33?'negative':a.score>=6.66?'positive':'neutral');}
  close('watch',p,model.importedAt,'امتیاز مدل، معادل مقدار واقعی یا شاهد مستقل از داده مالی نیست.');
 }
 if(selected.includes('ranking')){const rank=resolved?buildDynamicRanking(model,year,BASE_RANKING_WEIGHTS).find(r=>r.company===resolved):null;if(rank&&finite(rank.score)){add('ranking','ارزیابی رتبه‌نما با وزن‌های پایه',`امتیاز ${fmt(rank.score)} از ده؛ ${rank.validityLabel}؛ پوشش ${fmt(rank.coverage*100)} درصد${rank.peerRank&&rank.peerRanked>=3?`؛ رتبه هم‌ماهیت ${rank.peerRank.toLocaleString('fa-IR')} از ${rank.peerRanked.toLocaleString('fa-IR')}`:''}`);add('ranking','مسیر رتبه‌نما',rank.historyLabel);}
  close('ranking',p,model.importedAt,'وزن‌های پایه رسمی؛ داده مشترک با مالی و دیده‌بان.');}
 if(selected.includes('benchmark')){const source=input.holding==='atieh'?input.benchmark:null;const b=annual&&source?.sourceRows?.length?buildBenchmarkRows(source.sourceRows,source.fileName,year):source;const matches=annual?b?.companies.filter(c=>same(c.name,company))??[]:[];if(matches.length===1&&year===(b?.currentYear??Math.max(...(b?.years??[])))){const c=matches[0],others=b!.companies.filter(o=>o!==c&&o.peerGroup===c.peerGroup);for(const [key,d] of Object.entries(BENCHMARK_METRIC_DEFINITIONS)){const m=c.metrics[key as keyof typeof c.metrics];if(!m)continue;const vals=others.map(o=>o.metrics[key as keyof typeof c.metrics]).filter(x=>x.status==='numeric'&&finite(x.value)).map(x=>x.value!);if(m.status==='unavailable')continue;add('benchmark',d.label,`${m.label}${vals.length>=2&&m.status==='numeric'?`؛ میانه سایر اعضای گروه: ${fmt(median(vals))} ${d.unit} (${vals.length.toLocaleString('fa-IR')} شرکت)`:''}`,`${b!.previousYear??year-1} → ${year}`,m.status==='numeric'?`${d.kind==='growth'?(m.value!>0?'رشد مثبت است؛ رشد هم‌زمان چند شاخص تضاد داخلی نیست.':m.value!<0?'تغییر منفی است.':'تغییر صفر است.'):''}${vals.length>=2?m.value!>median(vals)!?' مقدار بالاتر از میانه سایر اعضای گروه است.':m.value!<median(vals)!?' مقدار پایین‌تر از میانه سایر اعضای گروه است.':' مقدار برابر میانه است.':''}`:m.label,m.status==='numeric'&&d.kind==='growth'?(m.value!>0?'positive':m.value!<0?'negative':'neutral'):'neutral');}}
  close('benchmark',annual&&b?`${b.previousYear??Math.min(...b.years)} → ${b.currentYear??Math.max(...b.years)}`:'سالانه',source?.importedAt,!annual?'پایش سالانه با دوره شش‌ماهه ترکیب نمی‌شود.':matches.length>1?'نام شرکت مبهم است؛ داده پایش وارد نشد.':'');}
 if(selected.includes('capital')){
  if(resolved){const a=buildValueCreationAnalysis(model,null,resolved,year,{},null,input.holding),s=a.selected; if(s){for(const [key,label,unit,mult] of [['roic','بازده سرمایه','درصد',100],['wacc','هزینه سرمایه','درصد',100],['spread','فاصله بازده و هزینه سرمایه','واحد درصد',100],['averageIc','متوسط سرمایه درگیر','میلیون ریال',1],['nopat','سود عملیاتی پس از مالیات','میلیون ریال',1],['dso','دوره وصول مطالبات','روز',1],['dio','دوره نگهداری موجودی','روز',1],['ccc','چرخه تبدیل نقد','روز',1]] as const){const v=s[key];if(finite(v)){const old=a.previous?.[key];let reading='';if(key==='spread')reading=v<0?'؛ بازده کمتر از هزینه سرمایه است و کسری بازده برقرار است.':'؛ بازده کمتر از هزینه سرمایه نیست.';if(key==='spread'&&finite(old))reading+=v>old?' فاصله نسبت به قبل بهتر شده است.':v<old?' فاصله نسبت به قبل بدتر شده است.':' فاصله تغییر نکرده است.';if(key==='ccc'&&finite(old))reading=v>old?'چرخه تبدیل نقد طولانی‌تر شده است؛ اثر و علت آن از این عدد به‌تنهایی مشخص نیست.':v<old?'چرخه تبدیل نقد کوتاه‌تر شده است.':'چرخه تبدیل نقد تغییر نکرده است.';add('capital',label,`فعلی ${fmt(v*mult)} ${unit}${finite(old)?`؛ مشابه قبل ${fmt(old*mult)} ${unit}`:''}${reading}`,p,reading,key==='spread'?(v<0?'negative':'positive'):'neutral');}}} else {add('capital','پوشش محاسبات سرمایه','اطلاعات کافی برای محاسبه کامل بازده و هزینه سرمایه این دوره موجود نیست.');}}
  close('capital',p,model.importedAt,'محاسبات موتور سرمایه؛ سناریوهای فرضی به‌عنوان عملکرد واقعی وارد نشده‌اند.');}
 if(selected.includes('production')){const prod=input.production;const rs=annual?prod?.records.filter(r=>same(r.company,company)&&r.year===year)??[]:[];if(rs.length){const u=calculateCompanyUtilization(company,rs);if(finite(u.value))add('production','بهره‌برداری ظرفیت',`${fmt(u.value*100)} درصد؛ روش ${u.method}`);for(const r of rs.slice(0,5))add('production',r.equipment||'خط تولید',`تولید ${fmt(r.production)}؛ ظرفیت ${fmt(r.capacity)}؛ واحد طبق فایل تولید${finite(r.grossMargin)?`؛ حاشیه سود ${fmt(r.grossMargin*100)} درصد`:''}`);const old=calculateCompanyUtilization(company,prod!.records.filter(r=>same(r.company,company)&&r.year===year-1));if(finite(old.value))add('production','بهره‌برداری مشابه قبل',`${fmt(old.value*100)} درصد`,prev);}
  close('production',p,prod?.importedAt,annual?'تولید و ظرفیت دوره منتخب؛ بیش از پنج خط در جزئیات خلاصه می‌شود.':'ورودی تولید سالانه است؛ برای شش‌ماهه استفاده نشد.');}
 if(selected.includes('profit')){const rows=annual?profitRecordsForCompany(input.profit,company,input.holding):[];for(const budget of [false,true]){const y=budget?year+1:year;const group=rows.filter(r=>r.isBudget===budget&&r.year===y);if(!group.length)continue;const totals=group.filter(r=>r.isTotal),details=group.filter(r=>!r.isTotal);const use=totals.length===1?totals:totals.length>1?[]:details;const units=new Set(use.map(r=>r.unit));if(use.length&&units.size===1){const rev=sumValid(use.map(r=>r.revenue)),gross=sumValid(use.map(r=>r.calculatedGrossProfit));add('profit',budget?'برنامه دوره آینده؛ تحقق‌یافته نیست':'فروش و سود ناخالص محصولات',`فروش ${fmt(rev)}؛ سود ناخالص محاسبه‌شده ${fmt(gross)} ${use[0].unit}${rev&&finite(gross)?`؛ حاشیه ${fmt(gross/rev*100)} درصد`:''}`,`${budget?'بودجه':'واقعی'} ${y}`);if(!budget)for(const r of details.sort((a,b)=>b.revenue-a.revenue).slice(0,3))add('profit',`محصول ${r.product}`,`فروش ${fmt(r.revenue)} ${r.unit}؛ حاشیه ناخالص ${fmt(r.calculatedGrossMargin===null?null:r.calculatedGrossMargin*100)} درصد`);}}
  close('profit',annual?`${year} واقعی / ${year+1} بودجه احتمالی`:'سالانه',input.profit?.importedAt,annual?'جمع کل و جزئیات هم‌زمان جمع نمی‌شوند؛ بودجه، عملکرد واقعی محسوب نمی‌شود.':'داده سالانه محصول با شش‌ماهه ترکیب نشد.');}
 if(selected.includes('market')){const m=input.holding==='atieh'?input.market:null;const rows=m?.companies.filter(c=>same(c.name,company)||canonicalCompanyName(c.name)===canonicalCompanyName(company))??[];if(rows.length===1){const c=rows[0];if(finite(c.total))add('market','امتیاز کل ارزیابی بازار',fmt(c.total),'تصویر بدون تاریخ مالی');for(const d of MARKET_DIMENSIONS)if(finite(c.dimensions[d.key]))add('market',d.label,fmt(c.dimensions[d.key]),'تصویر بدون تاریخ مالی');}
  close('market','بدون تاریخ مالی',m?.importedAt,'امتیاز ارزیابی بازار است؛ فروش واقعی، سهم بازار یا تغییرات دوره‌ای از آن استنتاج نمی‌شود.');}
 if(selected.includes('assets')){const rs=input.assets?.records.filter(r=>same(r.company,company)&&canonicalHolding(r.group)===input.holding)??[];if(rs.length){const cost=sumValid(rs.map(r=>r.costRial)),book=sumValid(rs.map(r=>r.bookValueRial));add('assets','جمع دارایی‌های ثبت‌شده شرکت',`بهای تمام‌شده ${fmt(cost===null?null:cost/1e6)}؛ ارزش دفتری ${fmt(book===null?null:book/1e6)} میلیون ریال؛ ${rs.length.toLocaleString('fa-IR')} دارایی`,'تصویر بدون تاریخ مالی');}for(const cls of [...new Set(rs.map(r=>r.assetClass))].slice(0,6)){const rows=rs.filter(r=>r.assetClass===cls);const cost=sumValid(rows.map(r=>r.costRial)),book=sumValid(rows.map(r=>r.bookValueRial));add('assets',cls,`بهای تمام‌شده ${fmt(cost===null?null:cost/1e6)}؛ ارزش دفتری ${fmt(book===null?null:book/1e6)} میلیون ریال؛ ${rows.length.toLocaleString('fa-IR')} دارایی`,'تصویر بدون تاریخ مالی');}
  close('assets','بدون تاریخ مالی',input.assets?.importedAt,'ارزش دفتری با ارزش روز برابر نیست؛ تاریخ ورود فایل، تاریخ ارزش‌گذاری نیست.');}
 if(selected.includes('activity')){const rs=annual&&input.holding==='metil'?input.activity?.records.filter(r=>same(r.company,company)&&r.year===year)??[]:[];const groups=new Map<string,typeof rs>();for(const r of rs){const k=`${r.operation} | ${r.variable} | ${r.unit}`;groups.set(k,[...(groups.get(k)??[]),r]);}for(const [label,rows] of [...groups].slice(0,6)){const totals=rows.filter(r=>/^(جمع|جمع کل|کل|مجموع)$/.test(r.product));const use=totals.length===1?totals:totals.length?[]:rows;const value=sumValid(use.map(r=>r.value));if(finite(value))add('activity',label,fmt(value));}
  close('activity',p,input.activity?.importedAt,'جمع هر عملیات و متغیر با واحد یکسان؛ ردیف جمع با جزئیات دوباره‌شماری نمی‌شود.');}
 if(selected.includes('equipment')){const rs=input.holding==='metil'?input.equipment?.records.filter(r=>same(r.company,company))??[]:[];for(const op of [...new Set(rs.map(r=>r.operation))].slice(0,5)){const rows=rs.filter(r=>r.operation===op);add('equipment',op||'تجهیزات',`${rows.length.toLocaleString('fa-IR')} تجهیز؛ ظرفیت واقعی ثبت‌شده ${fmt(sumValid(rows.map(r=>r.actualCapacityTon)))} تن؛ ظرفیت اسمی ${fmt(sumValid(rows.map(r=>r.nominalCapacityTon)))} تن`,'تصویر بدون تاریخ مالی');}
  close('equipment','بدون تاریخ مالی',input.equipment?.importedAt,'ظرفیت ثبت‌شده تجهیز، تولید محقق‌شده دوره نیست؛ ظرفیت عملیات مختلف با هم جمع نشده‌اند.');}
 if(!facts.length)limitations.push('برای منابع و دوره منتخب، شاهد قابل استفاده موجود نیست.');
 if(sources.some(s=>!s.count))limitations.push('بعضی منابع منتخب برای این شرکت و دوره فاقد شواهدند؛ از دوره دیگر جایگزین نشده‌اند.');
 limitations.push('داده‌های مشترک در مالی، امتیازها و سرمایه، شواهد مستقل چندباره نیستند.','ارتباط آماری یا هم‌زمانی، علت قطعی نیست. منابع بدون تاریخ مالی فقط زمینه‌اند.');
 return {version:2,period:p,year,kind,facts,sources,limitations};
}
