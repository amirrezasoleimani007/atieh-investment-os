"use client";

import { useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Factory, Layers3, CircleDot, Waves, Gem, Paintbrush, ChartColumnIncreasing, FileText, Table2 } from "lucide-react";
import SteelChainAnalysis from "@/components/steel-chain-analysis";
import { CompanyMarketLinks, CompanyMarketNarrative, type MarketKey } from "@/components/company-narratives";
import markets from "@/public/data/industry-markets.json";

type Datum = { label: string; value: number; high?: number; qualifier?: string; tone?: string; forecast?: boolean };
type Chart = { title: string; unit: string; kind: string; note: string; items: Datum[] };
const icons = [Waves, CircleDot, Layers3, Gem, Paintbrush];
const digits = (v: number) => v.toLocaleString("fa-IR", { maximumFractionDigits: 2 });
const valueLabel = (d: Datum) => `${d.qualifier ? `${d.qualifier} ` : ""}${digits(d.value)}${d.high ? ` تا ${digits(d.high)}` : ""}`;
const colorOf = (d: Datum) => d.tone === "gold" ? "#bc8428" : d.tone === "green" ? "#29826e" : "#146ab4";
const displayNote = (note:string) => note
  .replace("مقادیر ظرفیت از نمودار پاورپوینت استخراج شده‌اند. متن گزارش، ", "")
  .replace(" ذکر می‌کند. برچسب سال‌های راهنمای نمودار مبنا نیست؛ عرضه طبق متن و عنوان دسته، مربوط به ۱۴۰۴ است.", " است.")
  .replace("نرخ بهره‌برداری عیناً از متن گزارش؛ ", "")
  .replace("در گزارش ", "")
  .replace("برآورد گزارش است", "پیش‌بینی است")
  .replace("بر اساس اطلاعات وزارت صمت مندرج در پاورپوینت؛ ", "")
  .replace("در منبع ارائه نشده است", "تفکیک نشده است");

function MarketChart({ chart }: { chart: Chart }) {
  const [table, setTable] = useState(false);
  const [focus, setFocus] = useState<number | null>(null);
  const max = Math.max(...chart.items.map(d => d.high ?? d.value));
  return <article className={`im-chart im-chart-${chart.kind}`}>
    <header><div><span className="im-eyebrow">{chart.unit}</span><h3>{chart.title}</h3></div><button className="im-table-toggle" onClick={() => setTable(!table)} aria-pressed={table}><Table2 size={17}/>{table ? "نمای نمودار" : "جدول اعداد"}</button></header>
    {table ? <div className="im-table-wrap"><table><caption className="sr-only">{chart.title}</caption><thead><tr><th scope="col">شاخص</th><th scope="col">مقدار ({chart.unit})</th></tr></thead><tbody>{chart.items.map(d => <tr key={d.label}><th scope="row">{d.label}</th><td>{valueLabel(d)}{d.forecast && <small>پیش‌بینی / مشروط</small>}</td></tr>)}</tbody></table></div> : chart.kind === "gauge" ? <div className="im-gauge-layout"><div className="im-gauge"><svg viewBox="0 0 200 200" role="img" aria-label={`${chart.items[0].label}: ${valueLabel(chart.items[0])} درصد`}><circle cx="100" cy="100" r="82" fill="none" stroke="#e6edf0" strokeWidth="15"/><circle cx="100" cy="100" r="82" fill="none" stroke={colorOf(chart.items[0])} strokeWidth="15" strokeLinecap="round" pathLength="100" strokeDasharray={`${chart.items[0].value} 100`} transform="rotate(-90 100 100)"/></svg><div><b>{valueLabel(chart.items[0])}<small>٪</small></b><span>{chart.items[0].label}</span></div></div><p>{displayNote(chart.note)}</p></div> : <>
      <div className="im-bars" style={{ "--cols": chart.items.length } as CSSProperties}>
        <div className="im-gridlines" aria-hidden="true">{[0,1,2,3].map(n => <i key={n}/>)}</div>
        {chart.items.map((d, i) => <button key={d.label} className={`im-bar-item ${focus !== null && focus !== i ? "im-dim" : ""}`} onMouseEnter={() => setFocus(i)} onMouseLeave={() => setFocus(null)} onFocus={() => setFocus(i)} onBlur={() => setFocus(null)} onClick={() => setFocus(focus === i ? null : i)} aria-label={`${d.label}: ${valueLabel(d)} ${chart.unit}${d.forecast ? "، پیش‌بینی" : ""}`} style={{ "--bar-color": colorOf(d), "--bar-height": `${(d.high ?? d.value) / max * 100}%`, "--delay": `${i * 75}ms` } as CSSProperties}>
          <div className="im-column-zone"><div className={`im-column ${d.forecast ? "im-forecast" : ""}`}><b>{valueLabel(d)}</b>{d.high && <span className="im-range-cap" style={{ height: `${(d.high-d.value)/d.high*100}%` }}/>}</div></div>
          <span className="im-bar-label">{d.label}</span><small>{d.forecast ? "پیش‌بینی / مشروط" : d.qualifier ? "حد پایین گزارش‌شده" : d.high ? "بازه برآورد" : "مقدار گزارش‌شده"}</small>
        </button>)}
      </div>
      <p className="im-chart-note">{displayNote(chart.note)}</p>
    </>}
  </article>;
}

export default function MarketIndustries() {
  const [selected, setSelected] = useState<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  if(company) return <CompanyMarketNarrative id={company} onBack={()=>setCompany(null)}/>;
  const market = markets.find(m => m.id === selected);
  if (selected === "steel") return <><SteelChainAnalysis onBack={() => setSelected(null)}/><CompanyMarketLinks market="steel" onSelect={setCompany}/></>;
  if (market) return <section className="im-detail" style={{ "--industry-accent": market.color } as CSSProperties} aria-label={market.title}>
    <div className="im-detail-nav"><button onClick={() => setSelected(null)}><ArrowRight size={19}/> همه بازارها</button><label><span>انتخاب بازار</span><select aria-label="انتخاب بازار" value={selected ?? ""} onChange={e => setSelected(e.target.value)}><option value="steel">تحلیل زنجیره فولاد</option>{markets.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label></div>
    <header className="im-detail-header"><span className="im-eyebrow">جایگاه بازار / {market.subtitle}</span><h2>{market.title}</h2><p>{market.lead}</p></header>
    <div className="im-metrics">{market.metrics.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
    <div className="im-section-heading"><ChartColumnIncreasing/><div><h3>تصویر کمی بازار</h3><p>ظرفیت، مصرف و تقاضا</p></div></div>
    <div className="im-charts">{market.charts.map((c, i) => <MarketChart key={`${market.id}-${i}`} chart={c}/>)}</div>
    <section className="im-narrative"><header><FileText/><div><h3>روایت بازار</h3><p>چشم‌انداز، محدودیت‌ها و فرصت‌ها</p></div></header><div>{market.paragraphs.filter(p=>!p.heading.includes("مأخذ")&&!p.heading.includes("منبع")).map((p, i) => <article key={p.heading}><span className="im-paragraph-number">{digits(i+1).padStart(2,"۰")}</span><div><h4>{p.heading}</h4><p>{p.text}</p></div></article>)}</div></section>
    <CompanyMarketLinks market={market.id as MarketKey} onSelect={setCompany}/>
  </section>;
  return <section className="im-hub" aria-label="بازارهای پرتفوی">
    <header className="im-hub-header"><div><span className="im-eyebrow">روایت امروز / جایگاه بازار</span><h2>بازارهای پرتفوی</h2><p>صنعت موردنظر را انتخاب کنید و ظرفیت، تقاضا و شرایط بازار آن را ببینید.</p></div><span className="im-hub-count"><b>۶</b>حوزه تحلیلی</span></header>
    <div className="im-market-grid im-six-markets">{[{id:"steel",title:"تحلیل زنجیره فولاد",subtitle:"از مواد اولیه تا محصولات تخت",color:"#145a92"},...markets].map((m,i)=>{const Icon=i===0?Factory:icons[i-1];return <article key={m.id} className="im-market-tile" style={{"--industry-accent":m.color} as CSSProperties}><button className="im-tile-primary" onClick={()=>setSelected(m.id)}><span className="im-tile-top"><span className="im-tile-icon"><Icon size={29}/></span><small>{digits(i+1).padStart(2,"۰")}</small></span><h3>{m.title}</h3><p>{m.subtitle}</p><span className="im-tile-footer">تحلیل بازار <ArrowLeft size={19}/></span></button><CompanyMarketLinks market={m.id as MarketKey} onSelect={setCompany} compact/></article>})}</div>
  </section>;
}
