"use client";
import {useState} from "react";
import CapitalProjectReview from "@/components/capital-project-review";
import {Route} from "lucide-react";
import {allocationSourceRows,type CapitalOutput,type FundingSource} from "@/lib/capital-allocation.mjs";
const fa=(n:number|undefined)=>n==null?"نامشخص":n.toLocaleString("fa-IR",{maximumFractionDigits:2});
export const SOURCE_COLORS:Record<FundingSource,string>={internal:"#187a68",shortDebt:"#3574ca",longDebt:"#7b58b1",partner:"#bd842c",disposal:"#c3654f"};
export default function CapitalFlow({output,selectedId,onSelect,onEdit,onResources,onPolicy,onDecision,revisionKey}:{output:CapitalOutput;selectedId?:string;onSelect:(id:string)=>void;onEdit?:(id:string)=>void;onResources?:()=>void;onPolicy?:()=>void;onDecision?:()=>void;revisionKey?:string}){
 const [sourceFilter,setSourceFilter]=useState<FundingSource|null>(null);
 const [page,setPage]=useState(0);
 const filtered=output.results.filter(r=>!sourceFilter||r.allocations[sourceFilter]>0||r.trace.some(t=>t.source===sourceFilter&&t.needBefore>.01&&t.constraints?.some(c=>c!=="no_capacity"&&c!=="dedicated_limit")));
 const pages=Math.max(1,Math.ceil(filtered.length/6));const currentPage=Math.min(page,pages-1);
 const projects=filtered.slice(currentPage*6,currentPage*6+6);
 const selected=output.results.find(r=>r.id===selectedId)??output.results[0];
 const sources=allocationSourceRows(output);const visibleSources=sourceFilter?sources.filter(s=>s.key===sourceFilter):sources;
 const max=Math.max(.01,...projects.flatMap(r=>visibleSources.map(s=>r.allocations[s.key])));
 const debtLeft=Math.max(0,output.capacity.debtCeiling-output.used.shortDebt-output.used.longDebt-output.reserved.shortDebt-output.reserved.longDebt);
 return <section className="capital-flow-v40">
  <header className="flow-heading"><div><span><Route/> مسیر تأمین طرح‌ها</span><h3>هر طرح چگونه تأمین شد؟</h3><p>یک طرح را انتخاب کنید؛ مسیر آن از ورود تا نتیجه، مرحله‌به‌مرحله نمایش داده می‌شود.</p></div><div className="flow-total"><b>{fa(output.totalExecuted)}</b><span>میلیارد تومان تخصیص نهایی سبد</span></div></header>
  {!selected?<div className="core-empty">برای این سال پرونده‌ای در دسترس نیست؛ ابتدا نیاز طرح‌ها را ثبت کنید.</div>:<>
   <label className="flow-select"><span>طرح مورد بررسی</span><select value={selected.id} onChange={e=>onSelect(e.target.value)}>{output.results.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
   <CapitalProjectReview key={`${selected.id}:${revisionKey??JSON.stringify(selected)}`} project={selected} onEdit={onEdit?()=>onEdit(selected.id):undefined} onResources={onResources} onPolicy={onPolicy} onDecision={onDecision}/>
   <details className="review-portfolio-table"><summary>ترتیب و نتیجه تخصیص کل سبد <span>{fa(output.results.length)} طرح</span></summary><div className="table-scroll"><table><thead><tr><th>نوبت</th><th>طرح</th><th>نیاز سال</th><th>تأمین موقت</th><th>آزادشده</th><th>تأمین نهایی</th><th>نتیجه</th></tr></thead><tbody>{output.results.map((p,i)=>{const assessed=p.audit?.assessed??p.trace.some(t=>t.source);return <tr key={p.id} className={p.id===selected.id?"selected":""}><td>{fa(p.audit?.position??i+1)}</td><td><button onClick={()=>onSelect(p.id)}>{p.name}</button></td><td>{p.validation.valid?fa(p.annualNeed):"نامشخص"}</td><td>{assessed?fa(p.temporaryFunding):"بررسی نشده"}</td><td>{assessed?fa(p.trace.reduce((n,t)=>n+(t.releasedAllocation??0),0)):"—"}</td><td>{fa(p.executed)}</td><td>{p.decision}<small>{p.reason}</small></td></tr>;})}</tbody></table></div></details>
   <details className="flow-portfolio-map"><summary><Route/> نقشه عددی منابع و طرح‌ها <span>مقایسه سبد با رنگ و مبلغ دقیق</span></summary>
    <div className="flow-legend">{sources.map(s=><button key={s.key} className={sourceFilter===s.key?"active":""} aria-pressed={sourceFilter===s.key} onClick={()=>{setSourceFilter(sourceFilter===s.key?null:s.key);setPage(0);}}><i style={{background:SOURCE_COLORS[s.key]}}/>{s.label}</button>)}{sourceFilter&&<button onClick={()=>{setSourceFilter(null);setPage(0);}}>همه منابع</button>}</div>
    <div className="allocation-source-cards">{visibleSources.map(s=><article key={s.key} style={{borderTopColor:SOURCE_COLORS[s.key]}}><b>{s.label}</b><div><span>ظرفیت قابل اتکا <strong>{fa(s.capacity)}</strong></span><span>تخصیص نهایی <strong style={{color:SOURCE_COLORS[s.key]}}>{fa(s.used)}</strong></span><span>رزرو مصرف‌نشده <strong>{fa(s.reserved)}</strong></span><span>مانده منبع <strong>{fa(s.remaining)}</strong></span></div></article>)}</div>
    <p className="allocation-map-note">مبالغ: میلیارد تومان · خانه‌های رنگی فقط تخصیص نهایی را نشان می‌دهند؛ تخصیص موقت آزادشده و پرداخت واقعی در این اعداد منظور نشده‌اند.</p>
    {projects.length?<div className="allocation-map-scroll"><table className="allocation-number-map" style={{minWidth:sourceFilter?560:920}}><thead><tr><th>طرح</th><th>نیاز</th>{visibleSources.map(s=><th key={s.key} style={{borderTopColor:SOURCE_COLORS[s.key]}}><i style={{background:SOURCE_COLORS[s.key]}}/>{s.label}</th>)}<th>جمع نهایی</th><th>کسری</th></tr></thead><tbody>{projects.map(p=><tr key={p.id} className={p.id===selected.id?"selected":""}><td><button onClick={()=>onSelect(p.id)}>{p.name}</button><small>{p.decision}</small></td><td>{p.validation.valid?fa(p.annualNeed):"نامشخص"}</td>{visibleSources.map(s=><td key={s.key}><span className={p.allocations[s.key]>0?'has-allocation':'zero-allocation'} style={p.allocations[s.key]>0?{background:`${SOURCE_COLORS[s.key]}${Math.round(24+36*p.allocations[s.key]/max).toString(16).padStart(2,'0')}`,borderColor:SOURCE_COLORS[s.key],color:SOURCE_COLORS[s.key]}:undefined}>{fa(p.allocations[s.key])}</span></td>)}<td><b>{fa(p.executed)}</b></td><td>{p.validation.valid?fa(p.deferred):"نامشخص"}</td></tr>)}</tbody></table></div>:<p className="review-not-assessed">هیچ طرحی با این منبع تأمین یا محدود نشده است.</p>}
    <div className="flow-chart-foot"><span>سقف مشترک بدهی پس از مصرف و رزرو: <b>{fa(debtLeft)}</b> · ظرفیت آزاد کل سبد: <b>{fa(output.freeCapacity)}</b></span>{pages>1&&<div><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>صفحه قبل</button><span>{fa(currentPage+1)} از {fa(pages)}</span><button disabled={currentPage===pages-1} onClick={()=>setPage(currentPage+1)}>صفحه بعد</button></div>}</div>
   </details>
  </>}
 </section>;
}
