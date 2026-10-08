import reference from './trading-reference.json' with {type:'json'};
import {TRADING_ROUTES} from './trading-proximity.mjs';
export const TRADE_EXPANSION_METHOD=Object.freeze({version:reference.method,ceiling:reference.ceiling,baseYear:1400});
const products=new Set([5,6,7,8,9,13,14,15,16,17,19,20,22,23,24,25,26,27,28,29,30,31,32,37,38,39,40,41]);
const enablers=new Set([18,33,34,35,36,42,44,46,47,48,49,50,51,52,55,56,57,58,59,63,65,66,67,72]);
const referenceById=new Map(reference.reference.map(r=>[r.id,r]));
export function tradeExpansion(rows){
 const result=rows.map(row=>{
  const data=referenceById.get(row.id),route=TRADING_ROUTES[row.id]??['نامشخص','نیازمند بررسی','داده مرجع موجود نیست'];
  const service=data?.service??null,steel=data?Math.min(100,100*data.steelTransaction/reference.ceiling):null;
  const score=service==null||steel==null?null:Math.sqrt(service*steel);
  const group=products.has(row.id)?'توسعه محصول و مشتری':enablers.has(row.id)?'پشتیبان اجرای تجارت':'بازار جدید / ارتباط غیرمستقیم';
  return {id:row.id,name:row.name,service,steel,score,raw:data?.legacyCore??null,steelVertical:data?.steelTransaction??null,group,connection:route[0],expansion:route[1],reason:row.id===41?'حوزه عمومی تجارت؛ امتیاز ۱۰۰ به معنی رسیدن هم‌زمان به سقف هر دو مؤلفه است.':route[2],limiter:service==null?'داده ناکافی':service<steel?'شباهت قابلیت خدمات بازرگانی':service>steel?'پیوند معاملاتی مستقیم با فولاد':'هر دو مؤلفه برابرند',method:reference.method};
 }).sort((a,b)=>(b.score??-1)-(a.score??-1)||a.id-b.id);
 let previous=null,rank=0;
 return result.map((r,i)=>{const displayed=r.score==null?null:Math.round(r.score*10)/10;if(displayed!==previous)rank=i+1;previous=displayed;return {...r,rank:r.score==null?null:rank};});
}
export function tradeExpansionCsv(rows,selected=[]){const ids=new Set(selected),quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';return '\uFEFF'+[['رتبه','کد','حوزه','گروه توسعه','امتیاز ترکیبی','شباهت خدمات بازرگانی','پیوند معاملاتی فولاد','عامل محدودکننده','مسیر اتصال','توسعه پیشنهادی','محدودیت','منتخب سال','روش'],...rows.map(r=>[r.rank,r.id,r.name,r.group,r.score,r.service,r.steel,r.limiter,r.connection,r.expansion,r.reason,ids.has(r.id)?'بله':'خیر',r.method])].map(r=>r.map(quote).join(',')).join('\r\n');}
