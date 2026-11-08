"use client";

import { useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Calculator, Maximize, Minimize, RotateCcw } from "lucide-react";
import { calculateStrategicFit, FIT_MODEL_V22, plotPercent, PORTFOLIO_WEIGHT_MAX, redistributePortfolioWeights, transformFitEvidence } from "@/lib/strategic-fit.mjs";
import { zoneFor } from "@/lib/movement-zones.mjs";
import "@/app/growth-matrix.css";

type Horizon = "core" | "adjacent" | "transform";
type Weights = Record<Horizon,number>;
type FitKey = "coreFit" | "adjacentFit" | "transformFit";
type HorizonDef = { key:Horizon; label:string; color:string; fitKey:FitKey; focus:Weights };
type Criterion = { key:string; label:string; benefit:boolean; weight:number; value:string };
type AdjacentKey = "downstream" | "financeDirect" | "mineral" | "steelSupport" | "paint";
type Point = {
  id:number; name:string; x:number; dynamicY:number; baselineY:number; horizon:Horizon;
  strategicRaw:number; contributions:Weights; coreFit:number; adjacentFit:number; transformFit:number;
  adjacentEffective:Record<AdjacentKey,number>; adjacentDriver:string; ioCode:number; ioActivity:string;
  rank:number; opportunity:number; yPlotBaseline:number;
  topsis:{good:number;bad:number;weighted:Record<string,number>;positive:Record<string,number>;negative:Record<string,number>;denominators:Record<string,number>};
};
type Props = {
  rows:Point[]; selected:Point; onSelect:(id:number)=>void; horizons:HorizonDef[];
  policy:Weights; setPolicy:Dispatch<SetStateAction<Weights>>; basePolicy:Weights;
  criteria:Criterion[]; relatedness:{ids:number[];matrix:number[][]};
};

const fa=(value:number,digits=2)=>value.toLocaleString("fa-IR",{maximumFractionDigits:digits,useGrouping:false});
const signed=(value:number,digits=3)=>Math.abs(value)<.5*10**-digits?"۰":`${value>0?"+":"−"}${fa(Math.abs(value),digits)}`;
const ticks=[FIT_MODEL_V22.plot.min,FIT_MODEL_V22.matrix.medium,FIT_MODEL_V22.matrix.high,FIT_MODEL_V22.plot.max];
const focusTitles:Record<Horizon,string>={core:"تمرکز بر هسته",adjacent:"تمرکز بر مجاور",transform:"تمرکز بر تحول"};
const capabilities:[AdjacentKey,string][]=[["downstream","پایین‌دستی فولاد"],["financeDirect","خدمات مالی مستقیم"],["mineral","کانی غیرفلزی"],["steelSupport","پشتیبانی زنجیره فولاد"],["paint","رنگ صنعتی"]];

export default function GrowthMatrix({rows, selected, onSelect, horizons, policy, setPolicy, basePolicy, criteria, relatedness}:Props) {
  const [expanded,setExpanded]=useState(false),[showDetails,setShowDetails]=useState(false);
  const base=useMemo(()=>calculateStrategicFit([selected],basePolicy)[0],[selected,basePolicy]);
  const transform=useMemo(()=>showDetails?transformFitEvidence(rows,relatedness,selected.id):null,[rows,relatedness,selected.id,showDetails]);
  const oldZone=zoneFor(selected.x,base.dynamicY), newZone=zoneFor(selected.x,selected.dynamicY);
  const yDelta=selected.dynamicY-base.dynamicY;
  const moved=Math.abs(yDelta)>1e-9;
  const changedZone=oldZone.title!==newZone.title;
  const position={left:`${plotPercent(selected.x)}%`,bottom:`${plotPercent(base.dynamicY)}%`};
  const samePolicy=(other:Weights)=>horizons.every(h=>policy[h.key]===other[h.key]);
  const criterionWeight=criteria.reduce((sum,c)=>sum+c.weight,0)||1;
  const colors=Object.fromEntries(horizons.map(h=>[h.key,h.color]));

  return <section id="opportunity-matrix-stage" className={`growth-matrix-v62${expanded?" gm62-large":""}`}>
    <div className="gm62-controls panel">
      <div className="gm62-toolbar">
        <div><h3>وزن سیاست پرتفوی</h3><small>سهم هر افق در محاسبه تناسب</small></div>
        <div className="gm62-presets" role="group" aria-label="ترکیب‌های سیاست پرتفوی">
          <button type="button" aria-pressed={samePolicy(basePolicy)} onClick={()=>setPolicy({...basePolicy})}><RotateCcw size={14}/>ترکیب پایه</button>
          {horizons.map(h=><button type="button" key={h.key} aria-pressed={samePolicy(h.focus)} onClick={()=>setPolicy({...h.focus})}>{focusTitles[h.key]}</button>)}
        </div>
        <strong className="gm62-total">جمع وزن‌ها <b>{fa(horizons.reduce((n,h)=>n+policy[h.key],0),0)}٪</b></strong>
      </div>
      <div className="gm62-sliders">
        {horizons.map(h=><label key={h.key} style={{"--horizon":h.color} as CSSProperties}>
          <span>{h.label}<b>{fa(policy[h.key],0)}٪</b></span>
          <input type="range" min={0} max={PORTFOLIO_WEIGHT_MAX} step={1} value={policy[h.key]} aria-label={`وزن ${h.label}`} aria-valuetext={`${fa(policy[h.key],0)} درصد`}
            onChange={e=>{const next=Number(e.target.value);setPolicy(previous=>redistributePortfolioWeights(previous,h.key,next));}}/>
        </label>)}
      </div>
    </div>

    <div className="gm62-workspace">
      <article className="gm62-plot-card panel">
        <header className="gm62-plot-header">
          <div><h3>موقعیت فرصت‌ها</h3><small>{fa(rows.length,0)} بخش اقتصادی</small></div>
          <div className="gm62-plot-tools">
            <select aria-label="انتخاب فرصت در ماتریس" value={selected.id} onChange={e=>onSelect(Number(e.target.value))}>
              {rows.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
            <button type="button" aria-pressed={expanded} onClick={()=>setExpanded(current=>!current)}>
              {expanded?<Minimize size={15}/>:<Maximize size={15}/>} {expanded?"نمای عادی":"نمای بزرگ"}
            </button>
          </div>
        </header>
        <figure className="gm62-figure">
          <div className="gm62-axis-y-title"><ArrowUp size={15} aria-hidden="true"/>تناسب راهبردی · پایین به بالا</div>
          <div className="gm62-axis-y-ticks" aria-hidden="true">
            {[...ticks].reverse().map(t=><span key={t} style={{top:`${100-plotPercent(t)}%`}}>{fa(t,1)}</span>)}
          </div>
          <div className="gm62-plot" role="group" aria-label="ماتریس فرصت‌ها؛ پتانسیل رشد از چپ به راست و تناسب راهبردی از پایین به بالا">
            <div className="gm62-zones" aria-hidden="true">
              {Array.from({length:9},(_,i)=>{
                const x=i%3, y=2-Math.floor(i/3), zone=zoneFor(2+3*x,2+3*y);
                return <div key={i} data-x={x} data-y={y} data-active={zone.title===newZone.title}><span>{zone.title}</span></div>;
              })}
            </div>
            {rows.map(row=>{
              const active=row.id===selected.id;
              return <button type="button" className="gm62-point" key={row.id} aria-label={row.name} aria-pressed={active}
                title={`${row.name} · رشد ${fa(row.x)} · تناسب ${fa(row.dynamicY)}`}
                data-edge={row.x<1.8?"left":row.x>8.2?"right":"center"} data-top={row.dynamicY>7.5}
                style={{left:`${plotPercent(row.x)}%`,bottom:`${plotPercent(row.dynamicY)}%`,"--point":colors[row.horizon]} as CSSProperties}
                onClick={()=>onSelect(row.id)}>
                <i aria-hidden="true"/>{active&&<span aria-hidden="true">{row.name}</span>}
              </button>;
            })}
            {moved&&<div className="gm62-trail" aria-hidden="true" style={{
              left:position.left,bottom:`${Math.min(plotPercent(base.dynamicY),plotPercent(selected.dynamicY))}%`,
              height:`${Math.abs(plotPercent(base.dynamicY)-plotPercent(selected.dynamicY))}%`,
            }}/>}
            <div className="gm62-base-point" aria-hidden="true" style={position}/>
          </div>
          <div className="gm62-axis-x-ticks" aria-hidden="true">{ticks.map(t=><span key={t} style={{left:`${plotPercent(t)}%`}}>{fa(t,1)}</span>)}</div>
          <figcaption className="gm62-axis-x-title"><ArrowRight size={15} aria-hidden="true"/>پتانسیل رشد · کم در چپ، زیاد در راست</figcaption>
        </figure>
        <footer className="gm62-legend">
          <span><i className="gm62-key-base"/>ترکیب پایه</span><span><i className="gm62-key-active"/>ترکیب فعال</span>
          {horizons.map(h=><span key={h.key}><i style={{background:h.color}}/>{h.label}</span>)}
          <small>رنگ هر نقطه: افق با بیشترین سهم در تناسب</small>
        </footer>
      </article>

      <aside className="gm62-calculation panel" aria-label="محاسبه زنده فرصت منتخب">
        <div className="gm62-calc-heading"><Calculator size={19}/><h3>این نقطه چطور محاسبه شد؟</h3></div>
        <h4>{selected.name}</h4>
        <div className="gm62-metrics">
          <div><span>رشد · محور افقی</span><strong>{fa(selected.x)}</strong><small>مستقل از وزن پرتفوی</small></div>
          <div><span>تناسب · محور عمودی</span><strong><bdi>{fa(base.dynamicY)}</bdi><span aria-hidden="true">←</span><bdi>{fa(selected.dynamicY)}</bdi></strong><small>{yDelta>0&&moved?<ArrowUp size={12}/>:yDelta<0&&moved?<ArrowDown size={12}/>:null}{moved?`${signed(yDelta)} واحد جابه‌جایی`:"بدون جابه‌جایی نسبت به پایه"}</small></div>
        </div>
        <table className="gm62-live-table">
          <thead><tr><th scope="col">افق</th><th scope="col">تناسب</th><th scope="col">وزن فعال</th><th scope="col">سهم خام</th><th scope="col" title="تغییر نسبت به ترکیب پایه">Δ پایه</th></tr></thead>
          <tbody>{horizons.map(h=><tr key={h.key}><th scope="row"><i style={{background:h.color}}/>{h.key==="core"?"هسته":h.key==="adjacent"?"مجاور":"تحول‌گرا"}</th>
            <td>{fa(selected[h.fitKey])}</td><td>{fa(policy[h.key],0)}٪<small className="gm62-base-weight">پایه {fa(basePolicy[h.key],0)}٪</small></td><td>{fa(selected.contributions[h.key],3)}</td>
            <td><bdi>{signed(selected.contributions[h.key]-base.contributions[h.key])}</bdi></td></tr>)}</tbody>
          <tfoot><tr><th colSpan={3} scope="row">امتیاز خام</th><td>{fa(selected.strategicRaw,3)}</td><td><bdi>{signed(selected.strategicRaw-base.strategicRaw)}</bdi></td></tr></tfoot>
        </table>
        <p className="gm62-raw-note">خامِ پایه: <b>{fa(base.strategicRaw,3)}</b> · هر سهم = تناسب افق × وزن آن؛ Δ نسبت به ترکیب پایه است.</p>
        <div className="gm62-zone-result" data-changed={changedZone}>
          <small>{changedZone?"تغییر ناحیه تصمیم":"ناحیه تصمیم بدون تغییر"}</small>
          <strong>{changedZone?`${oldZone.title} ← ${newZone.title}`:newZone.title}</strong>
        </div>
        <button className="gm62-details-button" type="button" aria-expanded={showDetails} aria-controls="gm62-model-details" onClick={()=>setShowDetails(value=>!value)}>
          {showDetails?"بستن جزئیات محاسبه":"جزئیات محاسبه و منشأ داده‌ها"} <ArrowDown size={15} aria-hidden="true"/>
        </button>
      </aside>
    </div>

    <div className="gm62-detail-region" id="gm62-model-details" hidden={!showDetails}>
      {showDetails&&<>
        <section className="panel gm62-model-card">
          <h3>۱. محاسبه پتانسیل رشد</h3>
          <p>هر مقدار بر طول بردار همان معیار در {fa(rows.length,0)} بخش تقسیم و در وزن نسبی ضرب می‌شود. برای معیار سود، مقدار بزرگ‌تر و برای معیار هزینه، مقدار کوچک‌تر مطلوب است.</p>
          <div className="gm62-evidence-grid">
            {criteria.map(c=><article key={c.key}>
              <header><b>{c.label}</b><small>{c.benefit?"سود":"هزینه"}</small></header>
              <dl><div><dt>مقدار ورودی</dt><dd>{c.value}</dd></div><div><dt>وزن نسبی</dt><dd>{fa(c.weight/criterionWeight*100,1)}٪</dd></div>
                <div><dt>مخرج نرمال‌سازی</dt><dd>{fa(selected.topsis.denominators[c.key],4)}</dd></div><div><dt>امتیاز موزون</dt><dd>{fa(selected.topsis.weighted[c.key],5)}</dd></div>
                <div><dt>ایده‌آل مطلوب</dt><dd>{fa(selected.topsis.positive[c.key],5)}</dd></div><div><dt>ایده‌آل نامطلوب</dt><dd>{fa(selected.topsis.negative[c.key],5)}</dd></div></dl>
            </article>)}
          </div>
          <p>فاصله تا مطلوب <b>{fa(selected.topsis.good,5)}</b>، فاصله تا نامطلوب <b>{fa(selected.topsis.bad,5)}</b>. امتیاز خام TOPSIS = فاصله تا نامطلوب ÷ مجموع دو فاصله = <b>{fa(selected.opportunity,4)}</b>.</p>
          <p>رتبه <b>{fa(selected.rank,0)} از {fa(rows.length,0)}</b> روی بازه ثابت ۰٫۵ تا ۹٫۵ نگاشت شده است: <b>{fa(selected.x,3)}</b>. مختصات افقی = ۰٫۵ + ۹ × (۷۷ − رتبه) ÷ ۷۶.</p>
        </section>
        <section className="panel gm62-model-card">
          <h3>۲. منشأ سه امتیاز تناسب</h3>
          <div className="gm62-fit-evidence">
            <article><h4>هسته · {fa(selected.coreFit,3)}</h4><p>امتیاز ثبت‌شده در مدل مرجع ۲٫۲؛ بر مبنای پیوند با زنجیره فولاد و لنگرهای بازرگانی و انبارداری. کد داده–ستانده: <b>{fa(selected.ioCode,0)}</b> · {selected.ioActivity}.</p></article>
            <article><h4>مجاور · {fa(selected.adjacentFit,3)}</h4><p>بیشترین امتیازِ پنج قابلیت زیر انتخاب می‌شود.</p>
              <dl>{capabilities.map(([key,label])=><div key={key} data-best={selected.adjacentEffective[key]===selected.adjacentFit}><dt>{label}</dt><dd>{fa(selected.adjacentEffective[key],3)}</dd></div>)}</dl>
            </article>
            <article><h4>تحول‌گرا · {fa(selected.transformFit,3)}</h4><p>میانگین وزنی مرز عملیاتی بخش‌ها؛ وزن از شدت ارتباط شبکه‌ای با فرصت منتخب می‌آید.</p>
              {transform&&<><small>سه سهم بزرگ‌تر از امتیاز تحول‌گرا</small><dl>{transform.top.map(row=><div key={row.id}><dt>{row.name}<small>{fa(row.weight*100,2)}٪ وزن شبکه × {fa(row.frontier,3)}</small></dt><dd>{fa(row.contribution,3)}</dd></div>)}<div><dt>مجموع سهم سایر بخش‌ها</dt><dd>{fa(transform.remainder,3)}</dd></div></dl></>}
            </article>
          </div>
          <p>منبع امتیازهای ساختاری: مدل مرجع هم‌راستایی و داده–ستانده ۷۷ بخش، نسخه ۲٫۲. تغییر وزن سیاست، امتیازهای پایه سه افق را تغییر نمی‌دهد.</p>
        </section>
        <section className="panel gm62-model-card">
          <h3>۳. از امتیاز خام تا محور عمودی</h3>
          <p>امتیاز خامِ <b>{fa(base.strategicRaw,3)}</b> در ترکیب پایه و <b>{fa(selected.strategicRaw,3)}</b> در ترکیب فعال، با نگاشت ثابت زیر به محور عمودی تبدیل می‌شود. شیب در سه بازه یکسان نیست.</p>
          <div className="gm62-bands">{[
            {raw:"تا ۲٫۲۵",plot:"۰٫۵ تا ۳٫۵",formula:"۰٫۵ + ۳ × (خام ÷ ۲٫۲۵)",active:selected.strategicRaw<2.25},
            {raw:"۲٫۲۵ تا ۳٫۵۰",plot:"۳٫۵ تا ۶٫۵",formula:"۳٫۵ + ۳ × [(خام − ۲٫۲۵) ÷ ۱٫۲۵]",active:selected.strategicRaw>=2.25&&selected.strategicRaw<3.5},
            {raw:"از ۳٫۵۰",plot:"۶٫۵ تا ۹٫۵",formula:"۶٫۵ + ۳ × [(کمینهٔ (خام، ۸٫۴۰) − ۳٫۵۰) ÷ ۴٫۹۰]",active:selected.strategicRaw>=3.5},
          ].map(band=><div key={band.raw} data-active={band.active}><span>خام: {band.raw}</span><b>محور: {band.plot}</b><small>{band.formula}</small></div>)}</div>
          <p>مرزهای ناحیه روی نمودار <b>۳٫۵</b> و <b>۶٫۵</b> هستند. امتیاز خام از ۸٫۴۰ به بالا در سقف نمایشی ۹٫۵ قرار می‌گیرد.</p>
        </section>
      </>}
    </div>
  </section>;
}
