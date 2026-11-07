"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Building2, Compass, ChartNoAxesCombined, Target, ShieldCheck, X, Search, Network, BriefcaseBusiness, Layers3, Flag } from "lucide-react";
import marketData from "@/public/data/company-market-narratives.json";
import management from "@/public/data/management-narratives.json";
import summaries from "@/public/data/management-summary.json";

export type MarketKey = keyof typeof marketData.marketCompanies;
const fa = (n:number) => n.toLocaleString("fa-IR");
function RichText({ text }: { text:string }) {
  return <>{text.split(/(\*\*[^*]+\*\*)/g).map((part,i) => part.startsWith("**") ? <strong key={i}>{part.slice(2,-2)}</strong> : part)}</>;
}
export function CompanyMarketLinks({ market, onSelect, compact=false }: {market:MarketKey; onSelect:(id:string)=>void; compact?:boolean}) {
  const ids:string[] = marketData.marketCompanies[market];
  if(compact) return <div className="company-market-picker"><label><span><Building2 size={17}/> تحلیل، نتیجه و فرصت شرکت‌ها</span><select value="" onChange={e=>{if(e.target.value)onSelect(e.target.value)}} aria-label={`انتخاب شرکت مرتبط با ${market}`}><option value="" disabled>انتخاب شرکت مرتبط</option>{marketData.companies.filter(c=>ids.includes(c.id)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>;
  return <div className="company-market-links"><span><Building2 size={17}/> شرکت‌های مرتبط</span>{marketData.companies.filter(c=>ids.includes(c.id)).map(c=><button key={c.id} onClick={()=>onSelect(c.id)}>{c.name}<ArrowLeft size={16}/></button>)}</div>;
}
export function CompanyMarketNarrative({ id, onBack }: { id:string; onBack:()=>void }) {
  const company=marketData.companies.find(c=>c.id===id)!;
  const icons=[ChartNoAxesCombined,Building2,Compass,Target];
  return <section className="company-narrative"><button className="narrative-back" onClick={onBack}>بازگشت به بازارها <ArrowLeft size={18}/></button><header className="narrative-hero"><span>تحلیل بازار، نتیجه و فرصت</span><h2>{company.name}</h2></header><div className="narrative-flow">{company.sections.map((section,i)=>{const Icon=icons[Math.max(0,i-(company.sections[0].heading?0:1))%icons.length];return <article key={i} className={section.heading.includes("جهت‌گیری")?"narrative-decision":""}><div className="narrative-step"><Icon size={23}/><span>{fa(i+1)}</span></div><div>{section.heading&&<h3>{section.heading}</h3>}{section.blocks.map((b,j)=>b.type==="heading"?<h4 key={j}>{b.text}</h4>:<p key={j}><RichText text={b.text}/></p>)}</div></article>})}</div></section>;
}


const normalizeCompany = (name:string) => name.replace(/^(شرکت|هلدینگ)\s+/, "").replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/[\s\u200c]+/g," ").trim();
const columns=[
  {key:"company",label:"شرکت یا پروژه",icon:BriefcaseBusiness},
  {key:"position",label:"جایگاه در پرتفوی",icon:Layers3},
  {key:"role",label:"نقش در سبد",icon:Compass},
  {key:"actions",label:"اقدام اولویت‌دار",icon:Flag},
  {key:"expectation",label:"انتظار آتیه",icon:Target},
  {key:"synergies",label:"هم‌افزایی درون‌گروهی",icon:Network},
] as const;

export default function ManagementNarratives() {
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState<typeof summaries[number] | null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const opener=useRef<HTMLButtonElement>(null);
  const visible=summaries.filter(r=>!query.trim()||normalizeCompany(r.name).includes(normalizeCompany(query)));
  const legacy=selected&&management.companies.find(c=>normalizeCompany(c.name)===normalizeCompany(selected.name));
  return <section className="panel ips59-management ips60-management">
    <header className="ips60-management-hero">
      <span className="ips60-management-icon"><ShieldCheck size={26}/></span>
      <div><small>روایت امروز / تصمیم‌های پرتفوی</small><h2>نمای راهبردی شرکت‌ها و پروژه‌ها</h2><p>جایگاه هر سرمایه‌گذاری، اقدام اولویت‌دار و انتظار آتیه</p></div>
      <div className="ips60-management-count"><strong>{fa(summaries.length)}</strong><span>شرکت و پروژه</span></div>
    </header>
    <div className="ips59-management-tools">
      <label><Search size={17}/><input value={query} placeholder="جست‌وجوی نام شرکت یا پروژه" aria-label="جست‌وجوی شرکت در جمع‌بندی" onChange={e=>setQuery(e.target.value)}/>
        {query&&<button type="button" aria-label="پاک کردن جست‌وجو" onClick={()=>setQuery("")}><X size={15}/></button>}
      </label>
      <p>با انتخاب نام هر شرکت، جمع‌بندی تفصیلی را ببینید.</p>
      <span aria-live="polite">{query&&`${fa(visible.length)} نتیجه`}</span>
    </div>
    <div className="ips59-table-scroll ips60-management-table-wrap" tabIndex={0} role="region" aria-label="جدول جمع‌بندی مدیریتی">
      <table className="ips59-table ips59-management-table" role="table">
        <colgroup>{columns.map(({key})=><col key={key} className={`ips60-col-${key}`}/>)}</colgroup>
        <thead role="rowgroup"><tr role="row">{columns.map(({key,label,icon:Icon})=><th key={key} scope="col" role="columnheader"><span><Icon size={15} aria-hidden="true"/>{label}</span></th>)}</tr></thead>
        <tbody role="rowgroup">{visible.map((r,i)=><tr key={r.name} role="row" style={{"--row":i} as React.CSSProperties}>
          <th scope="row" role="rowheader">
            <button type="button" className="ips59-company-link" aria-label={r.name} onClick={e=>{opener.current=e.currentTarget;setSelected(r);dialog.current?.showModal();}}>
              <span className="ips60-company-name">{r.name}</span>
              <span className="ips60-company-detail">مشاهده جزئیات <ArrowLeft size={13} aria-hidden="true"/></span>
            </button>
          </th>
          <td role="cell" data-label={columns[1].label}><div className="ips59-position"><strong>{r.activity}</strong>
            <div><span className="ips59-tag" data-tone="blue">{r.segment}</span><span className="ips59-tag" data-tone={r.control==="کنترلی"?"teal":"neutral"}>{r.control}</span>
              <span className="ips59-tag" data-tone={r.stewardship==="سرپرستی مالی"?"gold":r.stewardship==="سرپرستی عملکردی"?"teal":"neutral"}>{r.stewardship}</span></div>
          </div></td>
          <td role="cell" data-label={columns[2].label}>{r.role}</td>
          <td role="cell" data-label={columns[3].label}><ul className="ips59-actions">{r.actions.map((a,j)=><li key={a}><span aria-hidden="true">{fa(j+1)}</span><div>{a}</div></li>)}</ul></td>
          <td role="cell" data-label={columns[4].label}><div className="ips59-expectation">{r.expectation}</div></td>
          <td role="cell" data-label={columns[5].label}>{r.synergies.length?<div className="ips59-synergies">{r.synergies.map(s=><span key={s}><Network size={13} aria-hidden="true"/>{s}</span>)}</div>:<span className="ips60-not-recorded">ثبت نشده</span>}</td>
        </tr>)}</tbody>
      </table>
      {!visible.length&&<p className="ips59-empty">شرکت یا پروژه‌ای با این نام پیدا نشد.</p>}
    </div>
    <dialog className="ips59-management-dialog" ref={dialog} aria-labelledby="ips59-detail-title" onClose={()=>{setSelected(null);opener.current?.focus();}}>
      <header><div><span>جمع‌بندی تفصیلی</span><h2 id="ips59-detail-title">{selected?.name}</h2></div><button type="button" autoFocus onClick={()=>dialog.current?.close()} aria-label="بستن جمع‌بندی تفصیلی"><X size={23}/></button></header>
      {selected&&<div className="ips59-dialog-body" key={selected.name}>
        {selected.name.startsWith("نورد لوله کوثر")&&<aside className="ips59-current-decision"><b>آخرین جهت‌گیری ثبت‌شده در جدول</b><span>{selected.actions[0]}. {selected.actions[1]}.</span><small>روایت تفصیلی زیر، متن نسخه پیشین را حفظ می‌کند.</small></aside>}
        <h3>{legacy?.title??selected.role}</h3>
        {(legacy?.paragraphs??[...selected.actions,selected.expectation]).map((paragraph,i)=><section key={i}><span>{fa(i+1).padStart(2,"۰")}</span><p>{paragraph}</p></section>)}
      </div>}
    </dialog>
  </section>;
}
