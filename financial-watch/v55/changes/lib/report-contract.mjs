export const SECTION_IDS=['current','trend','peers','focus'];
export function sanitizeEvidence(input){
 if(!input||input.schemaVersion!==1||!Number.isInteger(input.year)||input.year<1300||input.year>1699||!['annual','half-year'].includes(input.reportKind))throw Error('بسته شواهد معتبر نیست.');
 if(!Array.isArray(input.facts)||input.facts.length<4||input.facts.length>100||!Array.isArray(input.axes)||input.axes.length!==8)throw Error('ساختار شواهد معتبر نیست.');
 const seen=new Set();
 const facts=input.facts.map(f=>{if(!f||typeof f.id!=='string'||!/^[-a-zA-Z0-9_.]{1,64}$/.test(f.id)||seen.has(f.id)||typeof f.label!=='string'||f.label.length>180||typeof f.value!=='string'||f.value.length>260)throw Error('شناسه یا مقدار شاهد معتبر نیست.');seen.add(f.id);return {id:f.id,label:f.label,value:f.value}});
 const axes=input.axes.map(a=>{if(!a||typeof a.label!=='string'||a.label.length>120)throw Error('محور معتبر نیست.');for(const k of ['current','previous','peerMedian'])if(a[k]!==null&&(!Number.isFinite(a[k])||a[k]<0||a[k]>10))throw Error('امتیاز نامعتبر است.');if(a.delta!==null&&(!Number.isFinite(a.delta)||Math.abs(a.delta)>10))throw Error('تغییر نامعتبر است.');if(!Number.isInteger(a.peerCount)||a.peerCount<0||a.peerCount>10000)throw Error('تعداد همتا نامعتبر است.');return {label:a.label,current:a.current,previous:a.previous,delta:a.delta,peerMedian:a.peerMedian,peerCount:a.peerCount,band:typeof a.band==='string'?a.band.slice(0,30):null}});
 return {schemaVersion:1,year:input.year,previousYear:Number.isInteger(input.previousYear)&&input.previousYear===input.year-1?input.previousYear:null,reportKind:input.reportKind,nature:String(input.nature??'').slice(0,100),periodLabel:String(input.periodLabel??'').slice(0,60),historyYears:Array.isArray(input.historyYears)?input.historyYears.filter(y=>Number.isInteger(y)&&y<=input.year).slice(-3):[],axes,facts,limitations:Array.isArray(input.limitations)?input.limitations.filter(x=>typeof x==='string').slice(0,12).map(x=>x.slice(0,300)):[]};
}
export function reportSchema(e){return {type:'object',additionalProperties:false,required:['paragraphs'],properties:{paragraphs:{type:'array',minItems:4,maxItems:4,items:{type:'object',additionalProperties:false,required:['id','text','evidenceIds'],properties:{id:{type:'string',enum:SECTION_IDS},text:{type:'string'},evidenceIds:{type:'array',minItems:1,items:{type:'string',enum:e.facts.map(f=>f.id)}}}}}}}}
export function validateReport(doc,e){
 if(!doc||Object.keys(doc).some(k=>k!=='paragraphs')||!Array.isArray(doc.paragraphs)||doc.paragraphs.length!==4)throw Error('ساختار گزارش دریافتی معتبر نیست.');
 const facts=new Map(e.facts.map(f=>[f.id,f.value]));
 return {paragraphs:doc.paragraphs.map((p,i)=>{
  if(!p||p.id!==SECTION_IDS[i]||Object.keys(p).some(k=>!['id','text','evidenceIds'].includes(k))||typeof p.text!=='string'||p.text.length<25||p.text.length>1800||!/[آ-ی]/.test(p.text))throw Error('بخش‌های گزارش معتبر نیستند.');
  if(!Array.isArray(p.evidenceIds)||!p.evidenceIds.length||p.evidenceIds.length>100||p.evidenceIds.some(id=>!facts.has(id)))throw Error('ارجاع گزارش به شواهد معتبر نیست.');
  const tokens=[...p.text.matchAll(/\{\{([^{}]+)\}\}/g)].map(m=>m[1]);
  if(tokens.some(id=>!facts.has(id)||!p.evidenceIds.includes(id)))throw Error('عدد یا شاهد ناشناخته در گزارش است.');
  const plain=p.text.replace(/\{\{[^{}]+\}\}/g,'');
  if(/[0-9۰-۹٠-٩]/.test(plain)||/[{}]/.test(plain)||/<\/?[a-z][^>]*>/i.test(plain)||plain.includes('```'))throw Error('اعداد گزارش باید مستقیماً به شواهد ارجاع داشته باشند.');
  return {id:p.id,text:p.text,evidenceIds:[...new Set(p.evidenceIds)]};
 })};
}
export function resolveReportText(text,e){const facts=new Map(e.facts.map(f=>[f.id,f.value]));return text.replace(/\{\{([^{}]+)\}\}/g,(_,id)=>facts.get(id)??'—')}
