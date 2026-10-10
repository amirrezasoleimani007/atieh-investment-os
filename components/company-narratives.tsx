"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, Building2, Compass, ChartNoAxesCombined, Target, ShieldCheck } from "lucide-react";
import marketData from "@/public/data/company-market-narratives.json";
import management from "@/public/data/management-narratives.json";

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


const financialCompanies = ["صنایع برش ورق فولادی مبارکه", "توکا رنگ فولاد سپاهان", "کارگزاری مبین سرمایه", "ورق خودرو چهارمحال بختیاری", "صندوق پژوهش و فناوری مواد پیشرفته و انرژی"];
const strategicCompanies = ["فولاد متیل", "آتیه صنعت افق نقش جهان", "پولای بهیز", "آتیه تجارت نقش جهان قشم", "نورد لوله کوثر صنعت اسپادانا"];
const normalizeCompany = (name:string) => name.replace(/^(شرکت|هلدینگ)\s+/, "").replace(/ي/g,"ی").replace(/ك/g,"ک").replace(/چهارمحال و بختیاری/g,"چهارمحال بختیاری").replace(/\s+/g," ").trim();
export function ParentingBadge({name, compact=false}:{name:string;compact?:boolean}) {
 const key=normalizeCompany(name);
 const mode=financialCompanies.includes(key)?"financial":strategicCompanies.includes(key)?"strategic":null;
 if(!mode) return null;
 return <span className={`parenting-badge parenting-${mode}${compact?" parenting-compact":""}`}><Image src={`/parenting/${mode}.webp`} width={60} height={60} alt="" unoptimized /><span>سرپرستی با کنترل {mode==="financial"?"مالی":"راهبردی"}</span></span>;
}

export default function ManagementNarratives() {
  const [selected,setSelected]=useState(0);
  const company=management.companies[selected];
  return <section className="management-final"><header className="management-final-head"><div><span className="overline">خروجی نهایی روایت امروز</span><h2>جمع‌بندی مدیریتی</h2></div><label>شرکت موردنظر<select value={selected} onChange={e=>setSelected(Number(e.target.value))}>{management.companies.map((c,i)=><option value={i} key={c.name}>{c.name} — {financialCompanies.includes(normalizeCompany(c.name))?"کنترل مالی":"کنترل راهبردی"}</option>)}</select></label></header><div className="management-final-layout"><nav aria-label="انتخاب شرکت برای جمع‌بندی">{management.companies.map((c,i)=><button key={c.name} aria-current={selected===i?"true":undefined} onClick={()=>setSelected(i)}><span>{fa(i+1).padStart(2,"۰")}</span><div className="management-company-label"><strong>{c.name}</strong><ParentingBadge name={c.name} compact /></div><ArrowLeft size={16}/></button>)}</nav><article className="management-exact" key={selected}><header><ShieldCheck size={30}/><div><div className="management-company-heading"><span>{company.name}</span><ParentingBadge name={company.name}/></div><h3>{company.title}</h3></div></header><div className="management-prose">{company.paragraphs.map((text,i)=><section key={i}><span className="management-paragraph-index">{fa(i+1).padStart(2,"۰")}</span><p>{text}</p></section>)}</div><footer><span>{fa(selected+1)} از {fa(management.companies.length)} شرکت</span><button disabled={selected===management.companies.length-1} onClick={()=>setSelected(selected+1)}>شرکت بعدی <ArrowLeft size={17}/></button></footer></article></div></section>;
}
