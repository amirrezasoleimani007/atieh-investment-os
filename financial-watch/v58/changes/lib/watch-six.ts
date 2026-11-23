import type {FinancialModel,BubbleMetric,DisplayMode,AxisComponent,ModelSettings} from './financial-engine';
import type {PlotAxis,PlotPoint,PlotDefinition} from '../components/scatter-chart';
import {getBubbleRecord} from './financial-engine';
export type WatchSixAxisKey='revenueGrowth'|'spread'|'turnover'|'margin'|'ccc'|'quick'|'liquidity'|'stability'|'accrual'|'fcfMargin';
interface AxisSpec{key:WatchSixAxisKey;label:string;parts:{code:string;label:string;weight:number}[]}
const part=(code:string,label:string,weight=1)=>({code,label,weight});
export const WATCH_SIX_AXES:AxisSpec[]=[
 {key:'revenueGrowth',label:'رشد درآمد عملیاتی',parts:[part('144','رشد درآمد عملیاتی')]},
 {key:'spread',label:'اسپرد بازده و هزینه سرمایه',parts:[part('176','اسپرد بازده و هزینه سرمایه')]},
 {key:'turnover',label:'گردش دارایی‌ها',parts:[part('152','گردش دارایی‌ها')]},
 {key:'margin',label:'حاشیه سود عملیاتی',parts:[part('146','حاشیه سود عملیاتی')]},
 {key:'ccc',label:'چرخه تبدیل نقد',parts:[part('168','چرخه تبدیل نقد')]},
 {key:'quick',label:'نسبت آنی',parts:[part('164','نسبت آنی')]},
 {key:'liquidity',label:'نقدینگی ترکیبی',parts:[part('163','نسبت جاری',.3),part('164','نسبت آنی',.7)]},
 {key:'stability',label:'پایداری مالی',parts:[part('155','بدهی به حقوق مالکانه',.4),part('173','پوشش بهره',.3),part('174','بدهی خالص به سود عملیاتی پیش از استهلاک',.3)]},
 {key:'accrual',label:'نسبت تعهدی',parts:[part('169','نسبت تعهدی')]},
 {key:'fcfMargin',label:'نسبت جریان نقد آزاد به درآمد',parts:[part('175','نسبت جریان نقد آزاد به درآمد')]},
];
const questions=[
 'آیا رشد شرکت واقعاً ارزش اقتصادی ایجاد می‌کند؟',
 'شرکت چقدر خوب از دارایی‌هایش فروش و سود می‌سازد؟',
 'پول شرکت چقدر در عملیات درگیر است و چقدر نقدینگی در دسترس دارد؟',
 'آیا شرکت توان پرداخت بدهی‌ها و تحمل فشار مالی را دارد؟',
 'آیا سود شرکت از کیفیت و پشتوانه مناسبی برخوردار است؟',
 'آیا ارزش‌آفرینی شرکت با ایجاد جریان نقد آزاد همراه است؟',
];
const rows:[string,WatchSixAxisKey,WatchSixAxisKey][]=[['رشد و ارزش‌آفرینی','revenueGrowth','spread'],['بهره‌وری و سودآوری','turnover','margin'],['سرمایه در گردش و نقدینگی','ccc','quick'],['نقدینگی و پایداری مالی','liquidity','stability'],['سودآوری و کیفیت سود','margin','accrual'],['ارزش‌آفرینی و جریان نقد آزاد','spread','fcfMargin']];
const formula=(s:AxisSpec)=>({formula:s.parts.map(p=>`${p.weight===1?'':p.weight.toLocaleString('fa-IR')+' × '}نمره ${Number(p.code).toLocaleString('fa-IR',{useGrouping:false})} (${p.label})`).join(' + '),components:s.parts.map(p=>({label:`${p.label} (کد ${Number(p.code).toLocaleString('fa-IR',{useGrouping:false})})`,weight:p.weight}))});
export const WATCH_SIX_CHARTS:PlotDefinition[]=rows.map(([title,xKey,yKey],i)=>{const x=WATCH_SIX_AXES.find(a=>a.key===xKey)!,y=WATCH_SIX_AXES.find(a=>a.key===yKey)!;return {key:`M${i+1}`,phase:`نمودار ${(i+1).toLocaleString('fa-IR')}`,title,xKey,yKey,xLabel:x.label,yLabel:y.label,question:questions[i],formulas:{x:formula(x),y:formula(y)},fourMainStates:true};});
export interface WatchSixBundle{company:string;year:number;nature:string;axes:Record<WatchSixAxisKey,PlotAxis>}
export type WatchSixMatrix=Map<string,Map<number,WatchSixBundle>>;
export function watchSixBand(score:number|null|undefined){return score===null||score===undefined?null:score<3.33?'W':score<6.66?'M':'G';}
export function buildWatchSixMatrix(model:FinancialModel):WatchSixMatrix{
 const matrix:WatchSixMatrix=new Map();
 for(const company of model.companies){const years=new Map<number,WatchSixBundle>();for(const [year,records] of model.codeIndex.get(company)??[]){
  const axes={} as WatchSixBundle['axes'];
  for(const spec of WATCH_SIX_AXES){const components:AxisComponent[]=spec.parts.map(p=>{const r=records.get(p.code),score=r?.score??null;return {key:`code-${p.code}`,label:p.label,variable:r?.variable??p.label,score,value:r?.value??null,unit:r?.unit??'',originalWeight:p.weight,adjustedWeight:p.weight,contribution:score===null?0:score*p.weight,missing:score===null};});
   const complete=components.every(c=>c.score!==null);
   const score=complete?(components.length===1?components[0].score:components.reduce((s,c)=>s+c.score!*c.originalWeight,0)):null;
   axes[spec.key]={key:spec.key,label:spec.label,score,coverage:complete?1:0,band:score===null?null:score<3.33?'weak':score<6.66?'medium':'good',components,missing:components.filter(c=>c.missing).map(c=>c.label),warnings:[],formula:formula(spec).formula};
  }
  years.set(year,{company,year,nature:model.natureByCompany.get(company)??'',axes});
 }matrix.set(company,years);}return matrix;
}
export function buildWatchSixPoints({model,matrix,definition,selectedCompany,selectedYear,displayMode,natureFilter,bubbleMetric}: {model:FinancialModel;matrix:WatchSixMatrix;definition:PlotDefinition;selectedCompany:string;selectedYear:number;displayMode:DisplayMode;natureFilter:string;bubbleMetric:BubbleMetric;settings?:ModelSettings}):PlotPoint[]{
 const selectedNature=model.natureByCompany.get(selectedCompany)??'';
 const bundles=displayMode==='trend'?[...(matrix.get(selectedCompany)?.values()??[])].filter(b=>b.year<=selectedYear).sort((a,b)=>a.year-b.year):model.companies.filter(c=>displayMode==='peers'?model.natureByCompany.get(c)===selectedNature:natureFilter==='همه'||model.natureByCompany.get(c)===natureFilter).flatMap(c=>matrix.get(c)?.get(selectedYear)??[]);
 const points=bundles.flatMap(b=>{const xAxis=b.axes[definition.xKey as WatchSixAxisKey],yAxis=b.axes[definition.yKey as WatchSixAxisKey];if(xAxis.score===null||yAxis.score===null)return [];const r=model.codeIndex.get(b.company)?.get(b.year),bubble=getBubbleRecord(model,b.company,b.year,bubbleMetric);return [{company:b.company,year:b.year,nature:b.nature,x:xAxis.score,y:yAxis.score,xAxis,yAxis,selected:b.company===selectedCompany,bubbleValue:bubble.value,bubbleLabel:bubble.label,spreadValue:null,spreadScore:r?.get('176')?.score??null,regionTitle:`${xAxis.label} / ${yAxis.label}`,interpretation:''}];});
 return displayMode==='trend'?points.slice(-3):points;
}
