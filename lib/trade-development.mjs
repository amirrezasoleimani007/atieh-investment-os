/** Evidence-based managerial lens; never part of opportunity or funding formulas. */
export const TRADE_METHOD='trade-routes-v1';
export const TRADE_CRITERIA=[['customers','مشتری و کانال فروش مشترک'],['suppliers','شبکه تأمین مشترک'],['operations','توان قرارداد، قیمت‌گذاری و اجرای معامله'],['infrastructure','لجستیک و تأمین مالی قابل انتقال']];
export const STEEL_CRITERIA=[['product','ارتباط محصول یا خدمت با زنجیره'],['market','ارتباط مشتریان هدف با زنجیره']];
export const LEVELS=['فاقد پیوند مستند','پیوند محدود؛ عمدتاً قابلیت جدید','پیوند نسبی؛ نیازمند توسعه محسوس','پیوند قوی؛ قابل انتقال با تکمیل محدود','پیوند مستقیم و مستند'];
export function dimensionScore(route,dimension){
 const keys=(dimension==='trade'?TRADE_CRITERIA:STEEL_CRITERIA).map(x=>x[0]);
 const values=keys.map(k=>route?.[dimension]?.[k]);
 const complete=values.every(v=>v&&Number.isInteger(v.level)&&v.level>=0&&v.level<=4&&typeof v.evidence==='string'&&v.evidence.trim());
 return {score:complete?Math.round(25*values.reduce((n,v)=>n+v.level,0)/keys.length):null,covered:values.filter(v=>v&&Number.isInteger(v.level)&&v.level>=0&&v.level<=4&&v.evidence?.trim()).length,total:keys.length};
}
export function routeAssessment(route){
 const trade=dimensionScore(route,'trade'),steel=dimensionScore(route,'steel');
 const complete=[route?.title,route?.product,route?.customer,route?.channel,route?.gap,route?.reviewer,route?.reviewedAt].every(v=>typeof v==='string'&&v.trim())&&trade.score!=null&&steel.score!=null;
 return {trade,steel,complete,label:complete?'ارزیابی مستند مدیریتی':'ارزیابی ناقص'};
}
export function validateTradeRoutes(routes){
 if(routes==null)return true;
 if(!Array.isArray(routes)||routes.length>500)return false;
 const ids=new Set();
 return routes.every(r=>{
  if(!r||typeof r!=='object'||typeof r.id!=='string'||!r.id||ids.has(r.id)||!Number.isInteger(r.parentId)||r.parentId<1||r.parentId>77)return false;
  ids.add(r.id);
  if(!['title','product','customer','channel','gap','reviewer','reviewedAt'].every(k=>typeof r[k]==='string'&&r[k].length<=2000))return false;
  return [['trade',TRADE_CRITERIA],['steel',STEEL_CRITERIA]].every(([d,criteria])=>r[d]&&criteria.every(([k])=>{const v=r[d][k];return v&&typeof v.evidence==='string'&&v.evidence.length<=2000&&(v.level===null||Number.isInteger(v.level)&&v.level>=0&&v.level<=4);}));
 });
}
export function newTradeRoute(id,parentId){return {id,parentId,title:'',product:'',customer:'',channel:'',gap:'',reviewer:'',reviewedAt:'',trade:Object.fromEntries(TRADE_CRITERIA.map(([k])=>[k,{level:null,evidence:''}])),steel:Object.fromEntries(STEEL_CRITERIA.map(([k])=>[k,{level:null,evidence:''}]))};}
