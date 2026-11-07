"use client";

import { useRef, useState } from "react";
import { ArrowLeft, Building2, Compass, ChartNoAxesCombined, Target, ShieldCheck, X, Search, Network } from "lucide-react";
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
const columns=["شرکت یا پروژه","جایگاه در پرتفوی","نقش در سبد","جمع‌بندی راهبردی و اقدام اولویت‌دار","انتظار آتیه","هم‌افزایی درون‌گروهی"];

export default function ManagementNarratives() {
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState<typeof summaries[number] | null>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const opener=useRef<HTMLButtonElement>(null);
  const visible=summaries.filter(r=>!query.trim()||normalizeCompany(r.name).includes(normalizeCompany(query)));
  const legacy=selected&&management.companies.find(c=>normalizeCompany(c.name)===normalizeCompany(selected.name));
  return <section className="panel ips59-management">
    <div className="ips59-banner"><div className="ips59-banner-icon"><ShieldCheck size={26}/></div><div><span>روایت امروز / خروجی مدیریتی</span><h2>نمای راهبردی شرکت‌ها و پروژه‌ها</h2><p>نقش هر سرمایه‌گذاری، اقدام اولویت‌دار، انتظار آتیه و فرصت همکاری درون گروه</p></div><aside><b>{fa(summaries.length)}</b><small>شرکت و پروژه</small></aside></div>
    <div className="ips59-management-tools"><label><Search size={17}/><input value={query} placeholder="جست‌وجوی نام شرکت یا پروژه" aria-label="جست‌وجوی شرکت در جمع‌بندی" onChange={e=>setQuery(e.target.value)}/></label><p>برای مطالعه جمع‌بندی تفصیلی روی نام شرکت بزنید.</p><span aria-live="polite">{fa(visible.length)} مورد</span></div>
    <div className="ips59-table-scroll" tabIndex={0} role="region" aria-label="جدول جمع‌بندی مدیریتی"><table className="ips59-table ips59-management-table">
      <thead><tr>{columns.map(h=><th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{visible.map((r,i)=><tr key={r.name} style={{"--row":i} as React.CSSProperties}>
        <th scope="row"><button type="button" className="ips59-company-link" onClick={e=>{opener.current=e.currentTarget;setSelected(r);dialog.current?.showModal();}}>{r.name}<ArrowLeft size={16}/></button></th>
        <td data-label={columns[1]}><div className="ips59-position"><strong>{r.activity}</strong><div><span className="ips59-tag" data-tone="blue">{r.segment}</span><span className="ips59-tag" data-tone={r.control==="کنترلی"?"teal":"neutral"}>{r.control}</span><span className="ips59-tag" data-tone={r.stewardship==="سرپرستی مالی"?"gold":"neutral"}>{r.stewardship}</span></div></div></td>
        <td data-label={columns[2]}>{r.role}</td>
        <td data-label={columns[3]}><ul className="ips59-actions">{r.actions.map(a=><li key={a}>{a}</li>)}</ul></td>
        <td data-label={columns[4]}><div className="ips59-expectation">{r.expectation}</div></td>
        <td data-label={columns[5]}>{r.synergies.length?<div className="ips59-synergies">{r.synergies.map(s=><span key={s}><Network size={13}/>{s}</span>)}</div>:"—"}</td>
      </tr>)}</tbody>
    </table>{!visible.length&&<p className="ips59-empty">شرکت یا پروژه‌ای با این نام پیدا نشد.</p>}</div>
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
