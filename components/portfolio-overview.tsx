"use client";
import { useState, type ComponentType } from "react";
import { Layers3, BriefcaseBusiness, ChartNoAxesCombined, Wallet, Building2 } from "lucide-react";
import { ParentingBadge } from "./company-narratives";
import data from "@/public/data/portfolio-book-1404.json";

type Company = typeof data.companies[number];
type Segment = {label:string;value:number;color:string};
type Props = {portfolio:{name:string;control:string;horizon:string}[];Donut:ComponentType<{title:string;note:string;segments:Segment[];centerLabel?:string}>};
const fa=(n:number,d=2)=>n.toLocaleString("fa-IR",{minimumFractionDigits:d,maximumFractionDigits:d});
// Source amounts are million IRR: /10,000 => billion toman; /10,000,000 => trillion toman (همت).
const trillion=(n:number)=>fa(n/10_000_000);
const rows=data.companies;
const sum=(key:"equity"|"attributedEquity"|"profit"|"attributedProfit")=>rows.reduce((s,c)=>s+c[key],0);
const totals={equity:sum("equity"),attributedEquity:sum("attributedEquity"),profit:sum("profit"),attributedProfit:sum("attributedProfit")};
const colors=["#075cab","#d4a14d","#39866e","#7654a7"];
export default function PortfolioOverview({portfolio,Donut}:Props){
 const [scope,setScope]=useState<"all"|"atieh">("atieh");
 const [metric,setMetric]=useState<"equity"|"profit">("equity");
 const value=(c:Company)=>metric==="equity"?(scope==="all"?c.equity:c.attributedEquity):(scope==="all"?c.profit:c.attributedProfit);
 const classification=(c:Company)=>portfolio.find(p=>p.name===c.name);
 const aggregate=(label:(c:Company)=>string):Segment[]=>Object.entries(rows.reduce((m,c)=>{const k=label(c);m[k]=(m[k]??0)+value(c);return m;},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]).map(([label,value],i)=>({label,value,color:colors[i%colors.length]}));
 const ranked=[...rows].sort((a,b)=>b.attributedEquity-a.attributedEquity);
 const card=(kind:"equity"|"profit",title:string)=>{
  const share=kind==="equity"?totals.attributedEquity:totals.attributedProfit;
  return <article className={`portfolio-value-card ${kind}`}><header>{kind==="equity"?<Wallet/>:<ChartNoAxesCombined/>}<span>{title}</span><small>۱۴۰۴</small></header><div className="portfolio-total-number">{trillion(share)} <small>همت تومان</small></div><footer>{kind==="equity"?"ارزش دفتری سهم آتیه از حقوق مالکانه شرکت‌ها":"سهم آتیه از سود خالص؛ به معنی سود نقدی دریافتی نیست"}</footer></article>;
 };
 return <div className="content-stack portfolio-book-overview">
  <div className="portfolio-book-heading"><span><Building2 size={18}/> تصویر پرتفوی در پایان ۱۴۰۴</span><small>۱۰ شرکت · مبالغ نمایشی: همت تومان</small></div>
  <section className="portfolio-value-grid">{card("equity","ارزش دفتری سهم آتیه")}{card("profit","سهم آتیه از سود خالص")}</section>
  <section className="panel portfolio-lenses"><div className="section-title"><span><Layers3/></span><div><h2>ترکیب پرتفوی از دو نگاه</h2><p>مبنای نمایش: {scope==="all"?"کل شرکت‌ها، بدون اعمال درصد مالکیت":"سهم آتیه، بر اساس مبالغ منتسب جدول"} · {metric==="equity"?"حقوق مالکانه":"سود خالص"}</p></div></div><div className="portfolio-lens-controls"><div role="group" aria-label="دامنه نمایش"><button aria-pressed={scope==="all"} onClick={()=>setScope("all")}>کل شرکت‌ها</button><button aria-pressed={scope==="atieh"} onClick={()=>setScope("atieh")}>سهم آتیه</button></div><div role="group" aria-label="مبنای نمودار"><button aria-pressed={metric==="equity"} onClick={()=>setMetric("equity")}>ارزش دفتری</button><button aria-pressed={metric==="profit"} onClick={()=>setMetric("profit")}>سود خالص</button></div></div><div className="composition-grid"><Donut title="ترکیب بر مبنای ماهیت" note="طبقه‌بندی جدول سال ۱۴۰۴" segments={aggregate(c=>c.nature)}/><Donut title="ساختار کنترل" note="طبقه‌بندی کنترلی موجود در نرم‌افزار" segments={aggregate(c=>classification(c)?.control??"تعیین‌نشده")}/><Donut title="هسته و مجاور" note="بازرگانی/خدماتی: هسته؛ سایر فعالیت‌ها: مجاور" segments={aggregate(c=>c.nature==="بازرگانی/خدماتی"?"هسته؛ بازرگانی/خدماتی":"کسب‌وکارهای مجاور")}/></div></section>
  <section className="panel ownership-panel"><div className="section-title"><span><BriefcaseBusiness/></span><div><h2>درصد سهامداری گروه در شرکت‌ها</h2><p>سهم مالکیت، وزن هر شرکت در پرتفوی و جایگاه راهبردی آن</p></div></div><div className="ownership-table-wrap"><table><thead><tr><th>شرکت</th><th>درصد سهامداری گروه</th><th>سهم از پرتفوی</th><th>ماهیت</th><th>وضعیت</th><th>جایگاه</th><th>استراتژی سرپرستی</th></tr></thead><tbody>{ranked.map(c=>{const control=classification(c)?.control??"تعیین‌نشده",horizon=c.nature==="بازرگانی/خدماتی"?"هسته":"مجاور",share=c.attributedEquity/totals.attributedEquity;return <tr key={c.name}><td><b>{c.name}</b></td><td><span className="ownership-value">{fa(c.ownershipPercent,0)}٪</span></td><td><div className="portfolio-share-cell"><b>{fa(share*100,1)}٪</b><i><span style={{width:`${share*100}%`}}/></i></div></td><td>{c.nature}</td><td><span className={`status-pill ${control==="کنترلی"?"controlled":""}`}>{control}</span></td><td><span className={`horizon-pill ${horizon==="هسته"?"core":""}`}>{horizon}</span></td><td><ParentingBadge name={c.name} compact/></td></tr>;})}</tbody></table></div></section>
 </div>;
}
