"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Building2, BriefcaseBusiness, Layers3, ShieldCheck, Network, Compass, ChartPie } from "lucide-react";
import register from "@/public/data/portfolio-register.json";
import { aggregateComposition, portfolioPeriod, type Composition } from "@/lib/today-portfolio.mjs";
import type { FinancialCompany } from "./investment-os";

const fa = (n:number, digits=0) => n.toLocaleString("fa-IR",{maximumFractionDigits:digits});
const yearLabel = (n:number) => n.toLocaleString("fa-IR",{useGrouping:false});
const amount = (n:number) => Math.abs(n) < 100_000 && n !== 0
  ? `${fa(n / 10_000, 3)} میلیارد تومان`
  : `${fa(n / 10_000_000, 3)} همت`;
const lenses = [
  {key:"nature",title:"ترکیب بر مبنای ماهیت",icon:Building2,colors:["#256d93","#378e80","#b7843e"]},
  {key:"control",title:"ساختار کنترل",icon:ShieldCheck,colors:["#256d93","#b7843e"]},
  {key:"segment",title:"بخش‌های سرمایه‌گذاری",icon:Compass,colors:["#378e80","#6871a2"]},
  {key:"stewardship",title:"استراتژی سرپرستی",icon:Network,colors:["#256d93","#378e80","#b7843e"]},
] as const;

function CompositionCard({title, Icon, segments, colors, periodKey}:{title:string;Icon:typeof Building2;segments:Composition[];colors:readonly string[];periodKey:string}) {
  const signed = segments.some(s=>s.available && s.value < 0);
  const net = segments.reduce((s,x)=>s+x.value,0);
  const covered = segments.reduce((s,x)=>s+x.available,0);
  const absMax = Math.max(1,...segments.map(s=>Math.abs(s.value)));
  let offset = 0;
  return <article className="ips59-composition">
    <header><span><Icon size={19}/></span><h3>{title}</h3></header>
    <div className="ips59-ring-frame" key={periodKey}>
      {signed ? <div className="ips59-signed-bars" aria-label="مقایسه خالص دسته‌ها؛ سمت چپ منفی و سمت راست مثبت">
        {segments.map((s,i)=><div key={s.label} title={`${s.label}: ${s.available?amount(s.value):"فاقد داده"}`}><i style={{background:s.value<0?"#ba6259":colors[i],width:`${Math.abs(s.value)/absMax*48}%`,left:s.value<0?`${50-Math.abs(s.value)/absMax*48}%`:"50%"}}/></div>)}
      </div> : <><svg viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="63" stroke="#e7eff3" strokeWidth="15" fill="none"/>
        {segments.map((s,i)=>{const fraction=net>0?s.value/net*100:0; const start=offset;offset+=fraction;return fraction>0&&<circle key={s.label} cx="80" cy="80" r="63" pathLength="100" fill="none" stroke={colors[i]} strokeWidth="15" strokeDasharray={`${Math.max(.02,fraction-(segments.filter(p=>p.value>0).length>1?Math.min(1.15,fraction/3):0))} 100`} strokeDashoffset={-start} transform="rotate(-90 80 80)"/>;})}
      </svg><div className="ips59-ring-center"><strong>{covered?fa(net/10_000_000,3):"—"}</strong><small>همت تومان</small></div></>}
    </div>
    <ul>{segments.map((s,i)=><li key={s.label}><i style={{background:signed&&s.value<0?"#ba6259":colors[i]}}/><span>{s.label}<small>{fa(s.available)} از {fa(s.count)} شرکت</small></span><b>{!s.available?"فاقد داده":signed?amount(s.value):net>0?`${fa(100*s.value/net,1)}٪`:amount(s.value)}</b></li>)}</ul>
    {signed&&<small className="ips59-chart-note">جمع خالص {amount(net)} · برای مبالغ منفی، مقایسه میله‌ای نمایش داده می‌شود.</small>}
  </article>;
}

export default function PortfolioOverview({financialCompanies}:{financialCompanies:FinancialCompany[]}) {
  const [year,setYear] = useState(1404);
  const [metric,setMetric] = useState<"equity"|"profit">("equity");
  const [scope,setScope] = useState<"all"|"direct"|"group">("direct");
  const years = useMemo(()=>[...new Set(financialCompanies.filter(c=>c.scope==="گروه آتیه").flatMap(c=>["124","136"].flatMap(code=>c.kpiHistory[code]?.map(p=>p.year)??[])))].filter(y=>y>=1403).sort((a,b)=>b-a),[financialCompanies]);
  const rows = useMemo(()=>portfolioPeriod(register.rows,financialCompanies,year,metric,scope),[financialCompanies,year,metric,scope]);
  const covered=rows.filter(r=>r.amount!==null).length;
  return <div className="content-stack ips59-portfolio">
    <section className="panel ips59-overview">
      <div className="ips59-banner"><div className="ips59-banner-icon"><ChartPie size={25}/></div><div><span>روایت امروز / ترکیب سرمایه‌گذاری</span><h2>پرتفوی از چهار نگاه</h2><p>ترکیب مالی شرکت‌ها به تفکیک ماهیت، کنترل، بخش سرمایه‌گذاری و سرپرستی</p></div><aside><b>{fa(covered)} از {fa(rows.length)}</b><small>شرکت دارای داده در {yearLabel(year)}</small></aside></div>
      <div className="ips59-toolbar">
        <label>سال مالی<select aria-label="سال مالی ترکیب پرتفوی" value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option value={y} key={y}>{yearLabel(y)}</option>)}</select></label>
        <div className="ips59-toggle" role="group" aria-label="مبنای مالی">{([["equity","حقوق مالکانه"],["profit","سود خالص"]] as const).map(([v,l])=><button key={v} aria-pressed={metric===v} onClick={()=>setMetric(v)}>{l}</button>)}</div>
        <div className="ips59-toggle" role="group" aria-label="دامنه مالکیت">{([["all","کل شرکت‌ها"],["direct","سهم شرکت آتیه"],["group","سهم گروه آتیه"]] as const).map(([v,l])=><button key={v} aria-pressed={scope===v} onClick={()=>setScope(v)}>{l}</button>)}</div>
      </div>
      <div className="ips59-composition-grid">{lenses.map(({key,title,icon,colors})=><CompositionCard key={key} title={title} Icon={icon} segments={aggregateComposition(rows,key)} colors={colors} periodKey={`${year}-${scope}-${metric}`}/>)}</div>
      <div className="ips59-data-note"><Layers3 size={16}/><div>مبنای طبقه‌بندی و درصد مالکیت: آخرین جدول سهامداری؛ برای سال‌های گذشته نیز همین درصدها اعمال می‌شود. جمع ارقام شرکت‌ها معادل صورت مالی تلفیقی نیست.{metric==="profit"&&" سود خالص، سود نقدی دریافتی نیست."}
      {covered<rows.length&&<small>فاقد داده برای فیلتر انتخاب‌شده: {rows.filter(r=>r.amount===null).map(r=>r.name).join("، ")}.</small>}</div></div>
    </section>
    <section className="panel ips59-register"><div className="section-title"><span><BriefcaseBusiness/></span><div><h2>درصد سهامداری گروه در شرکت‌ها</h2><p>تصویر فعلی مالکیت مستقیم شرکت آتیه فولاد و مالکیت در سطح گروه</p></div></div>
      <div className="ips59-table-scroll" tabIndex={0} role="region" aria-label="جدول درصد سهامداری گروه"><table className="ips59-table"><thead><tr>{["ردیف","شرکت","مالکیت شرکت آتیه فولاد","مالکیت گروه آتیه فولاد","ماهیت","وضعیت","جایگاه پرتفوی","استراتژی سرپرستی"].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead>
        <tbody>{register.rows.map(r=><tr key={r.index} style={{"--row":r.index} as CSSProperties}><td>{fa(r.index)}</td><th scope="row">{r.name}</th>{[r.direct,r.group].map((v,i)=><td key={i}><span className="ips59-pct" title={`${fa(v*100,8)}٪`}><b>{fa(v*100,2)}٪</b><i><i style={{width:`${v*100}%`}}/></i></span></td>)}<td>{r.nature}</td><td><span className="ips59-tag" data-tone={r.control==="کنترلی"?"teal":"neutral"}>{r.control}</span></td><td>{r.segment}</td><td><span className="ips59-tag" data-tone={r.stewardship==="کنترل مالی"?"gold":r.stewardship==="عملیاتی"?"teal":"blue"}>{r.stewardship}</span></td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
