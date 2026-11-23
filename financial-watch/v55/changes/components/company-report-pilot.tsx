"use client";
import {useEffect,useMemo,useRef,useState} from 'react';
import {FileText,Download,LoaderCircle,Sparkles,ChevronDown} from 'lucide-react';
import type {FinancialModel,AxisBundle} from '@/lib/financial-engine';
import {buildReportEvidence,demoReport,latestCompanyYear,type ReportEvidence} from '@/lib/report-evidence';
import {validateReport,resolveReportText} from '@/lib/report-contract.mjs';
type Paragraph={id:string;text:string;evidenceIds:string[]};
type Result={key:string;report:{paragraphs:Paragraph[]};mode:string;model?:string;generatedAt?:string};
const headings:Record<string,string>={current:'وضعیت آخرین دوره',trend:'مسیر تغییرات',peers:'جایگاه میان همتایان',focus:'موضوع اصلی بررسی'};
function Radar({evidence:e}: {evidence:ReportEvidence}){
 const cx=200,cy=170,r=104;
 const pos=(i:number,v:number,extra=0)=>[cx+Math.sin(i*Math.PI/4)*(r*v/10+extra),cy-Math.cos(i*Math.PI/4)*(r*v/10+extra)];
 const ring=(v:number)=>e.axes.map((_,i)=>pos(i,v).join(',')).join(' ');
 const series=[{key:'peerMedian',color:'#169c8b',dash:'5 4'},{key:'previous',color:'#94a3b8',dash:'3 4'},{key:'current',color:'#2563eb',dash:undefined}] as const;
 const labels=['رشد','سودآوری','بهره‌وری','بازده سرمایه','نقدینگی','ساختار مالی','کیفیت سود','نقد آزاد'];
 return <div className="report-radar"><svg viewBox="0 0 400 345" role="img" aria-label={`نمای هشت محور شرکت در ${e.periodLabel}؛ مقیاس صفر تا ده`}>
  {[2,4,6,8,10].map(v=><polygon key={v} points={ring(v)} fill={v===10?'#f8fbfe':'none'} stroke="#e0e8f0" strokeWidth="1"/>)}
  {e.axes.map((a,i)=>{const p=pos(i,10),t=pos(i,10,33);return <g key={a.key}><line x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="#e0e8f0"/><text x={t[0]} y={t[1]+4} textAnchor="middle">{labels[i]}</text></g>})}
  {series.map(s=>{const valid=e.axes.every(a=>a[s.key]!==null);return <g key={s.key}>{valid?<polygon points={e.axes.map((a,i)=>pos(i,a[s.key]!).join(',')).join(' ')} fill={s.key==='current'?'#2563eb16':'none'} stroke={s.color} strokeWidth={s.key==='current'?2.3:1.5} strokeDasharray={s.dash}/>:e.axes.map((a,i)=>{const b=e.axes[(i+1)%8];if(a[s.key]===null||b[s.key]===null)return null;const p=pos(i,a[s.key]!),q=pos((i+1)%8,b[s.key]!);return <line key={i} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={s.color} strokeDasharray={s.dash}/>})}{e.axes.map((a,i)=>{if(a[s.key]===null)return null;const p=pos(i,a[s.key]!);return <circle key={i} cx={p[0]} cy={p[1]} r={s.key==='current'?3.2:2} fill={s.color}/>})}</g>})}
 </svg><div className="report-radar-legend"><span><i style={{background:'#2563eb'}}/>دوره گزارش</span><span><i style={{background:'#94a3b8'}}/>مشابه قبل</span><span><i style={{background:'#169c8b'}}/>میانه سایر همتایان</span></div><small>مقیاس ثابت صفر تا ده؛ محور فاقد داده رسم نمی‌شود. تعداد همتایان معتبر هر محور در شواهد آمده است.</small></div>;
}
export default function CompanyReportPilot({model,matrix,company,selectedYear}:{model:FinancialModel;matrix:Map<string,Map<number,AxisBundle>>;company:string;selectedYear:number}){
 const [open,setOpen]=useState(false),[latest,setLatest]=useState(true),[consent,setConsent]=useState(false),[status,setStatus]=useState<{configured:boolean;model?:string}>({configured:false});
 const [result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const abort=useRef<AbortController|null>(null),cache=useRef(new Map<string,Result>());
 const e=useMemo(()=>open?buildReportEvidence(model,matrix,company,latest?latestCompanyYear(model,company):selectedYear):null,[open,model,matrix,company,latest,selectedYear]);
 const key=JSON.stringify(e),display=result?.key===key?result:null;
 const yearIsLatest=e?.year===latestCompanyYear(model,company);
 useEffect(()=>{abort.current?.abort();setBusy(false);setConsent(false);setError('');setResult(cache.current.get(key)??null);return()=>abort.current?.abort()},[key]);
 useEffect(()=>{if(!open||!['http:','https:'].includes(window.location.protocol))return;const controller=new AbortController();fetch(new URL('api/status',window.location.href),{signal:controller.signal}).then(r=>r.ok?r.json():null).then(value=>{const s=value as {configured?:unknown;model?:unknown}|null;if(!controller.signal.aborted)setStatus(s?.configured===true?{configured:true,model:typeof s.model==='string'?s.model:undefined}:{configured:false})}).catch(()=>{if(!controller.signal.aborted)setStatus({configured:false})});return()=>controller.abort()},[open]);
 function store(value:Result){cache.current.set(key,value);if(cache.current.size>8)cache.current.delete(cache.current.keys().next().value!);setResult(value)}
 function preview(){if(!e)return;try{setError('');store({key,report:validateReport(demoReport(e),e) as Result['report'],mode:'demo'})}catch{setError('برای این دامنه گزارش نمونه ساخته نشد.')}}
 async function generate(){if(!e||!consent||!status.configured)return;const controller=new AbortController();abort.current=controller;setBusy(true);setError('');try{const r=await fetch(new URL('api/report',window.location.href),{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({evidence:e,consent:true})});const data=await r.json() as {error?:string;report?:unknown;model?:string;generatedAt?:string};if(!r.ok)throw Error(data.error??'گزارش آماده نشد.');const report=validateReport(data.report,e) as Result['report'];if(!controller.signal.aborted)store({key,report,mode:'openrouter',model:data.model,generatedAt:data.generatedAt})}catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'پاسخ معتبر دریافت نشد.')}finally{if(!controller.signal.aborted)setBusy(false)}}
 function download(){if(!e)return;const url=URL.createObjectURL(new Blob([JSON.stringify(e,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`report-evidence-${e.year}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <section className="company-report-pilot" aria-label="گزارش چندبعدی شرکت">
  <button className="report-pilot-toggle" type="button" aria-expanded={open} onClick={()=>setOpen(!open)}><span><FileText size={20}/><b>گزارش چندبعدی عملکرد شرکت</b><small>نسخه آزمایشی</small></span><ChevronDown size={18} style={{transform:open?'rotate(180deg)':undefined}}/></button>
  {open&&<div className="report-pilot-body">
   <header><div><h3>{company}</h3><p>جمع‌بندی مالی، روند و مقایسه همتایان</p></div><div className="report-period-choice"><button type="button" aria-pressed={latest} className={latest?'active':''} onClick={()=>setLatest(true)}>آخرین دوره موجود</button><button type="button" aria-pressed={!latest} className={!latest?'active':''} onClick={()=>setLatest(false)}>دوره انتخابی صفحه</button></div></header>
   {!e?<p className="report-warning">برای این شرکت و دوره داده‌ای موجود نیست.</p>:<>
    <div className="report-context"><span><b>دوره گزارش</b>{e.periodLabel}{yearIsLatest?' · آخرین دوره فایل':''}</span><span><b>زمان ورود فایل</b>{Number.isFinite(Date.parse(model.importedAt))?new Date(model.importedAt).toLocaleString('fa-IR'):'ثبت نشده'}</span><span><b>گروه مقایسه</b>{e.nature||'ماهیت نامشخص'} · سایر شرکت‌های همین هلدینگ</span></div>
    <div className="report-pilot-grid"><Radar evidence={e}/><div className="report-compose">
      <p className="report-demo-note">بدون کلید، نمونه گزارش از قواعد و محاسبات سامانه تولید می‌شود و داده‌ای ارسال نمی‌شود.</p>
      <div className="report-actions"><button type="button" className="primary-button" onClick={preview} disabled={busy}><FileText size={16}/>ساخت گزارش نمونه</button><button type="button" className="outline-button" onClick={download}><Download size={16}/>دریافت بسته شواهد</button></div>
      <details className="report-connection"><summary>اتصال OpenRouter · {status.configured?'آماده':'هنوز فعال نشده'}</summary><p>{status.configured?`مدل تنظیم‌شده: ${status.model}`:'برای اتصال زنده، نسخه سروری همراه سورس را اجرا و کلید را در تنظیمات خصوصی سرور وارد کنید. نسخه عمومی گیت‌هاب بدون کلید در حالت نمونه کار می‌کند.'}</p><p>کلید در مرورگر یا گیت‌هاب قرار نمی‌گیرد. بسته ارسالی شامل نام شرکت، نام فایل و ردیف‌های اکسل نیست.</p></details>
      {status.configured&&<label className="report-consent"><input type="checkbox" checked={consent} onChange={v=>setConsent(v.target.checked)}/>ارسال همین خلاصه مالی به OpenRouter و ارائه‌دهنده مدل را برای تولید گزارش تأیید می‌کنم.</label>}
      <button type="button" className="outline-button report-live-button" disabled={!status.configured||!consent||busy} onClick={generate}>{busy?<LoaderCircle className="report-spinner" size={16}/>:<Sparkles size={16}/>}تولید گزارش با OpenRouter</button>
      {error&&<p role="alert" className="report-warning">{error}</p>}
    </div></div>
    {display&&<article className="report-output" aria-label="متن گزارش عملکرد"><header><strong>{display.mode==='demo'?'نمونه قاعده‌محور · تولیدشده در سامانه':'گزارش پیشنهادی OpenRouter'}</strong><span>{e.periodLabel}{display.model?` · ${display.model}`:''}</span></header>{display.report.paragraphs.map(p=><div key={p.id}><h4>{p.id==='current'&&!yearIsLatest?'وضعیت دوره انتخابی':headings[p.id]}</h4><p>{resolveReportText(p.text,e)}</p><details className='report-citations'><summary>شواهد این بند</summary><small>{p.evidenceIds.map(id=>e.facts.find(f=>f.id===id)?.label).filter(Boolean).join('، ')}</small></details></div>)}<p className="report-review-note">ارجاع و جای‌گذاری اعداد کنترل می‌شود؛ تفسیرهای گزارش پیشنهادی، پیش از استفاده مدیریتی بازبینی شوند.</p></article>}
    <details className="report-evidence"><summary>دامنه داده، محدودیت‌ها و اعداد مبنا</summary><ul>{e.limitations.map(x=><li key={x}>{x}</li>)}</ul><div className="table-scroll"><table><thead><tr><th>شاهد</th><th>مقدار</th></tr></thead><tbody>{e.facts.map(f=><tr key={f.id}><td>{f.label}</td><td>{f.value}</td></tr>)}</tbody></table></div></details>
   </>}
  </div>}
 </section>;
}
