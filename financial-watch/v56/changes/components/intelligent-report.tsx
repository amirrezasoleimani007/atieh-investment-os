"use client";
import {useState,useMemo,useEffect,useRef} from 'react';
import {Sparkles,Download,RefreshCw,LoaderCircle,FileText,Check,Square,Printer,Copy} from 'lucide-react';
import {REPORT_SOURCES,reportCompanies,reportYears,buildComprehensiveEvidence,type ReportInputs,type SourceId} from '@/lib/comprehensive-evidence';
import {validateLocalReport,resolveLocalText,compactModelPacket} from '@/lib/local-report-contract.mjs';
import {buildAxisMatrix} from '@/lib/financial-engine';
import {selectReportModel,type ReportKind} from '@/lib/report-period';
import {buildReportEvidence} from '@/lib/report-evidence';
import {ReportRadar} from './company-report-pilot';
type Result={key:string;report:{paragraphs:{id:string;text:string;evidenceIds:string[]}[]};model:string;generatedAt:string;edits?:string[]};
const names:Record<string,string>={overview:'تصویر عملکرد',drivers:'ارتباط ابعاد و تغییرات',comparison:'جایگاه و مقایسه',focus:'اولویت بررسی'};
export default function IntelligentReport({inputs,initialCompany}:{inputs:ReportInputs;initialCompany:string}){
 const companies=useMemo(()=>reportCompanies(inputs),[inputs]);
 const [company,setCompany]=useState(initialCompany),[kind,setKind]=useState<ReportKind>('annual'),[latest,setLatest]=useState(true),[chosenYear,setChosenYear]=useState(0);
 const [selected,setSelected]=useState<SourceId[]>(REPORT_SOURCES.map(s=>s.id));
 const [status,setStatus]=useState<{configured:boolean;models:string[];model?:string;mode?:string}>({configured:false,models:[]});
 const [model,setModel]=useState('qwen3:4b-instruct'),[checking,setChecking]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[copyNote,setCopyNote]=useState('');
 const [result,setResult]=useState<Result|null>(null);const abort=useRef<AbortController|null>(null);
 const years=useMemo(()=>reportYears(inputs,company,kind,selected),[inputs,company,kind,selected]);
 const year=latest?years.at(-1)??0:years.includes(chosenYear)?chosenYear:years.at(-1)??0;
 const packet=useMemo(()=>buildComprehensiveEvidence(inputs,company,kind,year,selected),[inputs,company,kind,year,selected]);
 const modelPacket=useMemo(()=>compactModelPacket(packet),[packet]);
 const key=JSON.stringify({company,holding:inputs.holding,model,packet});
 const output=result?.key===key?result:null;
 const allCoverage=useMemo(()=>buildComprehensiveEvidence(inputs,company,kind,year,REPORT_SOURCES.map(s=>s.id)),[inputs,company,kind,year]);
 const radar=useMemo(()=>{if(!selected.includes('watch'))return null;const m=selectReportModel(inputs.financial,kind);return buildReportEvidence(m,buildAxisMatrix(m,inputs.settings),company,year);},[inputs,company,kind,year,selected]);
 useEffect(()=>{abort.current?.abort();setBusy(false);setError('');setCopyNote('');setResult(null);},[key]);
 useEffect(()=>()=>abort.current?.abort(),[]);
 async function check(){setChecking(true);try{const r=await fetch(new URL('api/status',window.location.href),{signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error();const s=await r.json() as typeof status;setStatus(s);if(s.configured&&!s.models.includes(model))setModel(s.model??s.models[0]);}catch{setStatus({configured:false,models:[]});}finally{setChecking(false);}}
 useEffect(()=>{void check();},[]);
 async function generate(){if(!packet.facts.length||!status.configured)return;const controller=new AbortController();abort.current=controller;setBusy(true);setError('');setResult(null);try{
   const r=await fetch(new URL('api/report',window.location.href),{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({evidence:packet,model,consent:true})});
   const data=await r.json() as {error?:string;report?:unknown;model:string;generatedAt:string;edits?:string[]};if(!r.ok)throw Error(data.error??'گزارش دریافت نشد.');
   const report=validateLocalReport(data.report,packet) as Result['report'];if(!controller.signal.aborted)setResult({key,report,model:data.model,generatedAt:data.generatedAt,edits:data.edits});
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'ارتباط برقرار نشد.');}finally{if(!controller.signal.aborted)setBusy(false);}}
 function download(value:unknown,name:string){const url=URL.createObjectURL(new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:typeof value==='string'?'text/plain;charset=utf-8':'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const text=output?`${company}\n${packet.period}\n\n${output.report.paragraphs.map(p=>resolveLocalText(p.text,packet)).join('\n\n')}`:'';
 return <section className="intelligent-report" aria-label="گزارش هوشمند عملکرد">
  <header className="ir-heading"><div><span className="ir-eyebrow"><Sparkles size={17}/>تحلیل یکپارچه شرکت</span><h2>گزارش هوشمند عملکرد</h2><p>منابع را انتخاب کنید؛ هوش مصنوعی محلی از شواهد همان منابع، گزارش می‌نویسد.</p></div><span className={`ir-status ${status.configured?'ready':''}`}>{status.configured?<Check size={16}/>:<Square size={15}/>} {status.configured?'Ollama متصل است':'اتصال محلی آماده نیست'}</span></header>
  <div className="ir-filters no-print">
   <label>شرکت<select value={company} onChange={e=>setCompany(e.target.value)}>{companies.map(c=><option key={c}>{c}</option>)}</select></label>
   <label>نوع دوره<select value={kind} onChange={e=>setKind(e.target.value as ReportKind)}><option value="annual">سالانه</option><option value="half-year">شش‌ماهه</option></select></label>
   <label>مبنای دوره<select value={latest?'latest':'selected'} onChange={e=>setLatest(e.target.value==='latest')}><option value="latest">آخرین دوره منابع منتخب</option><option value="selected">انتخاب دوره</option></select></label>
   <label>دوره گزارش<select value={year} disabled={latest||!years.length} onChange={e=>setChosenYear(Number(e.target.value))}>{years.length?years.map(y=><option key={y} value={y}>{y.toLocaleString('fa-IR',{useGrouping:false})}</option>):<option value={0}>داده دوره‌دار موجود نیست</option>}</select></label>
  </div>
  <div className="ir-layout"><aside className="ir-sources no-print"><header><h3>شواهد گزارش</h3><button type="button" onClick={()=>setSelected(selected.length?[]:REPORT_SOURCES.map(s=>s.id))}>{selected.length?'پاک‌کردن انتخاب':'انتخاب همه'}</button></header>
   <p>تنها منابع انتخاب‌شده وارد تحلیل می‌شوند.</p>
   {REPORT_SOURCES.map(s=>{const c=allCoverage.sources.find(x=>x.id===s.id);return <label key={s.id} className={selected.includes(s.id)?'selected':''}><input type="checkbox" checked={selected.includes(s.id)} onChange={e=>setSelected(e.target.checked?[...selected,s.id]:selected.filter(x=>x!==s.id))}/><span><b>{s.label}</b><small>{c?.count?`${c.count.toLocaleString('fa-IR')} شاهد · ${c.period}`:'برای این شرکت و دوره داده معتبر ندارد'}</small></span></label>;})}
  </aside><div className="ir-main">
   <section className="ir-compose no-print"><div><h3>{company}</h3><p>{packet.period} · {packet.sources.filter(s=>s.count).length.toLocaleString('fa-IR')} منبع دارای داده · {packet.facts.length.toLocaleString('fa-IR')} شاهد</p></div>
    {status.configured?<div className="ir-model"><label>مدل محلی<select value={model} onChange={e=>setModel(e.target.value)}>{status.models.map(m=><option key={m}>{m}</option>)}</select></label><p>با زدن دکمه، خلاصه شواهد انتخابی فقط به Ollama همین رایانه فرستاده می‌شود. تولید متن ممکن است چند دقیقه طول بکشد.</p></div>:status.mode==='ollama-offline'?<div className="ir-setup"><p>برنامه محلی آماده است، اما مدل در دسترس نیست. Ollama را از منوی Start باز کنید؛ سپس «بررسی اتصال» را بزنید. مدل نصب‌شده باید در فهرست Ollama موجود باشد.</p></div>:<div className="ir-setup"><p>Ollama را باز نگه دارید و این سامانه را با اجرای «شروع گزارش» در بسته محلی باز کنید.</p><a href="./Atieh56-local.zip">دریافت بسته اجرای محلی</a><span>نسخه گیت‌هاب برای اتصال به مدل رایانه به اجرای محلی نیاز دارد؛ تنظیمات مرورگر را تغییر ندهید.</span></div>}
    <div className="ir-actions"><button type="button" className="primary-button" onClick={generate} disabled={busy||!status.configured||!packet.facts.length}>{busy?<LoaderCircle className="report-spinner" size={18}/>:<Sparkles size={18}/>} {busy?'در حال تحلیل شواهد…':'تولید گزارش هوشمند'}</button>{busy&&<button type="button" className="outline-button" onClick={()=>{abort.current?.abort();setBusy(false);}}>لغو تولید</button>}<button type="button" className="outline-button" onClick={check} disabled={checking}><RefreshCw size={16}/>بررسی اتصال</button></div>
    {!packet.facts.length&&<p className="ir-warning">برای این انتخاب شاهد معتبر وجود ندارد؛ دوره یا منابع را تغییر دهید.</p>}{error&&<p className="ir-warning" role="alert">{error}</p>}
   </section>
   {output?<article className="ir-report" aria-label="گزارش تولیدشده با هوش مصنوعی"><header><div><span>گزارش عملکرد</span><h3>{company}</h3><small>{packet.period} · {output.model} · {new Date(output.generatedAt).toLocaleString('fa-IR')}</small></div><div className="ir-actions no-print"><button type="button" title="کپی گزارش" onClick={async()=>{try{await navigator.clipboard.writeText(text);setCopyNote('متن کپی شد.');}catch{setCopyNote('از دریافت متن استفاده کنید.');}}}><Copy size={17}/></button><button type="button" title="دریافت متن" onClick={()=>download(text,`company-report-${year}.txt`)}><Download size={17}/></button><button type="button" title="چاپ گزارش" onClick={()=>window.print()}><Printer size={17}/></button></div></header>{copyNote&&<small role="status">{copyNote}</small>}
    {output.report.paragraphs.map(p=><div className="ir-paragraph" key={p.id}><h4>{names[p.id]}</h4><p>{resolveLocalText(p.text,packet)}</p><details className="no-print"><summary>شواهد این بند</summary>{p.evidenceIds.map(id=>{const f=packet.facts.find(f=>f.id===id)!;return <div key={id}><b>{f.label}</b><span>{f.value} · {f.period}</span></div>;})}</details></div>)}{Boolean(output.edits?.length)&&<details className="ir-evidence no-print"><summary>کنترل متن و ارجاع‌ها</summary><ul>{output.edits!.map(x=><li key={x}>{x}</li>)}</ul></details>}<footer>این متن با مدل محلی تولید و با شواهد کنترل شده است. ارجاع اعداد کنترل می‌شود؛ تفسیرها پیش از استفاده مدیریتی بازبینی شوند.</footer>
   </article>:<div className="ir-empty"><FileText size={32}/><h3>گزارش بر پایه انتخاب شما</h3><p>متن تولیدشده در این بخش قرار می‌گیرد؛ وضعیت فعلی، ارتباط ابعاد، مقایسه و اولویت بررسی.</p></div>}
   {radar&&<details className="ir-radar"><summary>نمای چندبعدی امتیازهای مالی</summary><ReportRadar evidence={radar}/><p>این نمودار فقط امتیازهای مالی را نشان می‌دهد؛ سایر شواهد در متن گزارش و جدول منابع بررسی می‌شوند.</p></details>}
   <details className="ir-evidence no-print"><summary>منابع، تازگی داده و شواهد ورودی مدل</summary><div className="ir-actions"><button className="outline-button" type="button" onClick={()=>download({evidence:packet,modelInput:modelPacket},`selected-evidence-${year}.json`)}><Download size={16}/>دریافت شواهد JSON</button>{output&&<button className="outline-button" type="button" onClick={()=>download({company,...output,evidence:packet,key:undefined},`ai-report-${year}.json`)}>دریافت گزارش و شواهد</button>}</div>{packet.sources.map(s=><div className="ir-source-note" key={s.id}><b>{s.label} · {s.count.toLocaleString('fa-IR')} شاهد</b><span>{s.period} · ورود فایل: {s.importedAt&&Number.isFinite(Date.parse(s.importedAt))?new Date(s.importedAt).toLocaleString('fa-IR'):'ثبت نشده'}</span><p>{s.note}</p></div>)}<p>برای مدل کوچک، {modelPacket.facts.length.toLocaleString('fa-IR')} شاهد کلیدی از منابع منتخب آماده می‌شود. بسته JSON، تمام شواهد و ورودی دقیق مدل را جدا نگه می‌دارد.</p><ul>{packet.limitations.map(x=><li key={x}>{x}</li>)}</ul><div className="table-scroll"><table><thead><tr><th>منبع</th><th>شاهد</th><th>مقدار</th><th>دوره</th></tr></thead><tbody>{packet.facts.map(f=><tr key={f.id}><td>{REPORT_SOURCES.find(s=>s.id===f.source)?.label}</td><td>{f.label}</td><td>{f.value}</td><td>{f.period}</td></tr>)}</tbody></table></div></details>
  </div></div>
 </section>;
}
