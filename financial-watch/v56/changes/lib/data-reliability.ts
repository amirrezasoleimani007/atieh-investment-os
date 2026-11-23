import { normalizeText, parseNumeric } from './financial-engine';

/** Canonical monetary storage: million IRR. Unknown units are never guessed. */
export function monetaryFactor(unit: unknown): number | null {
  const s=normalizeText(unit).replace(/[\s‌_-]/g,'').toLowerCase();
  const currency=/تومان|toman/.test(s)?10:/ریال|irr|rial/.test(s)?1:null;
  if(currency===null)return null;
  const scale=/میلیارد|billion/.test(s)?1e9:/میلیون|million/.test(s)?1e6:/هزار|thousand/.test(s)?1e3:1;
  return currency*scale/1e6;
}
export function normalizedAmount(value: unknown,unit: unknown): number | null {
  const n=parseNumeric(value),factor=monetaryFactor(unit);return n===null||factor===null?null:n*factor;
}
export function normalizeFinancialCell(value: unknown,unit: unknown): {value:number|null;unit:string} {
  const n=parseNumeric(value),factor=monetaryFactor(unit);
  if(factor!==null)return {value:n===null?null:n*factor,unit:'میلیون ریال'};
  const label=normalizeText(unit);
  // The original data contract uses decimal ratios labelled درصد. Explicit percent
  // cells (e.g. "25%") need conversion; plain 0.25 retains the existing contract.
  return {value:n,unit:label};
}

export const WORKSPACE_VERSION=1;
function encode(value:unknown):unknown {
  if(value instanceof Date)return {__ipsType:'Date',value:value.toISOString()};
  if(value instanceof Map)return {__ipsType:'Map',entries:[...value].map(([k,v])=>[encode(k),encode(v)])};
  if(value instanceof Set)return {__ipsType:'Set',entries:[...value].map(encode)};
  if(Array.isArray(value))return value.map(encode);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]));
    // Benchmark turnaround ordering uses +/-Infinity; preserve it explicitly in JSON.
    if(typeof value==='number'&&!Number.isFinite(value))return {__ipsType:'Number',value:String(value)};
  return value;
}
function decode(value:unknown):unknown {
  if(Array.isArray(value))return value.map(decode);
  if(value&&typeof value==='object'){
    const v=value as Record<string,unknown>;
      if(v.__ipsType==='Number'){if(!['Infinity','-Infinity','NaN'].includes(String(v.value)))throw Error('عدد پرونده معتبر نیست.');return Number(v.value);}
    if(v.__ipsType==='Date'){if(typeof v.value!=='string'||!Number.isFinite(Date.parse(v.value)))throw Error('تاریخ پرونده معتبر نیست.');return new Date(v.value);}
    if(v.__ipsType==='Map'){if(!Array.isArray(v.entries))throw Error('ساختار پرونده معتبر نیست.');return new Map(v.entries.map((entry)=>{if(!Array.isArray(entry)||entry.length!==2)throw Error('ساختار پرونده معتبر نیست.');return [decode(entry[0]),decode(entry[1])];}));}
    if(v.__ipsType==='Set'){if(!Array.isArray(v.entries))throw Error('ساختار پرونده معتبر نیست.');return new Set(v.entries.map(decode));}
    return Object.fromEntries(Object.entries(v).filter(([k])=>!['__proto__','constructor','prototype'].includes(k)).map(([k,x])=>[k,decode(x)]));
  }return value;
}
export function serializeWorkspace(payload:unknown){return JSON.stringify({format:'atieh-financial-workspace',version:WORKSPACE_VERSION,savedAt:new Date().toISOString(),payload:encode(payload)});}
export function deserializeWorkspace(text:string):Record<string,unknown>{
  const envelope=JSON.parse(text);if(envelope.format!=='atieh-financial-workspace'||envelope.version!==WORKSPACE_VERSION)throw Error('این فایل، پرونده پشتیبان سازگار نیست.');
  const p=decode(envelope.payload) as Record<string,unknown>;
  if(!p||typeof p!=='object'||!p.models||!p.settings)throw Error('پرونده ناقص است.');
  const models=p.models as Record<string,any>;
  for(const key of ['atieh','metil']){const m=models[key];if(m!==null&&(!m||!Array.isArray(m.records)||!Array.isArray(m.companies)||!Array.isArray(m.years)||!(m.codeIndex instanceof Map)||!(m.index instanceof Map)))throw Error('ساختار داده مالی پرونده معتبر نیست.');}
  for(const key of ['profitModel','assetModel','productModel','metilActivityModel','equipmentModel'])if(p[key]!=null&&!Array.isArray((p[key] as any).records))throw Error('ساختار فایل تکمیلی معتبر نیست.');
  for(const key of ['marketModel','benchmarkModel'])if(p[key]!=null&&!Array.isArray((p[key] as any).companies))throw Error('ساختار داده بازار یا پایش تطبیقی معتبر نیست.');
  if(!['atieh','metil'].includes(String(p.holding)))throw Error('گروه پرونده مشخص نیست.');
  return p;
}
export function downloadText(text:string,name:string,type='application/json'){
  const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
