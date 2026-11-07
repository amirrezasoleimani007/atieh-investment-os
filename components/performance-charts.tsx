"use client";

import { useId, useState, type CSSProperties } from "react";
import { LineChart } from "lucide-react";
import { consecutivePairs, type PerformancePeriod, type ScatterPeriod } from "@/lib/today-portfolio.mjs";

const fa=(n:number,digits=0)=>n.toLocaleString("fa-IR",{maximumFractionDigits:digits});
export const financialYearLabel=(year:number)=>year.toLocaleString("fa-IR",{useGrouping:false});
const faScore=(n:number|null)=>n===null?"—":fa(n,2);

const cells=["#f7dfdf","#f9e7e3","#f8efe2","#f9e7e3","#f8efe2","#eaf3e7","#f8efe2","#eaf3e7","#cfeade"];
export function ScatterZones(){
  return <div className="ips59-scatter-zones" aria-hidden="true">{[7,8,9,4,5,6,1,2,3].map(cell=><div key={cell} data-cell={cell} style={{background:cells[cell-1]}}><span>{fa(cell)}</span></div>)}</div>;
}

export function ScatterJourney({points}:{points:ScatterPeriod[]}){
  const arrow=useId();
  const observed=points.filter(p=>p.cell!==null);
  const pairs=consecutivePairs(points,p=>p.cell!==null);
  const latest=observed.at(-1);
  return <>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="ips59-scatter-route" aria-hidden="true">
      <defs><marker id={arrow} markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" viewBox="0 0 5 5"><path d="M0 0L5 2.5L0 5Z" fill="#125a81"/></marker></defs>
      {pairs.map(([a,b],i)=><line className="ips59-route-segment" key={b.year} x1={a.x!*10} x2={b.x!*10} y1={100-a.y!*10} y2={100-b.y!*10} pathLength="1" vectorEffect="non-scaling-stroke" markerEnd={`url(#${arrow})`} style={{"--route-i":i} as CSSProperties}/>)}
      {pairs.map(([a,b],i)=>a.x===b.x&&a.y===b.y?null:<circle key={a.year} className="ips59-motion-tracer" r="1.35" fill="#107b70" opacity="0"><animateMotion begin={`${i*.095}s`} dur=".38s" path={`M${a.x!*10},${100-a.y!*10} L${b.x!*10},${100-b.y!*10}`}/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.15;.85;1" dur=".38s" begin={`${i*.095}s`}/></circle>)}
    </svg>
    {observed.map((p,i)=><button type="button" key={p.year} className={`ips59-route-point ${p===latest?"latest":""}`} aria-label={`سال ${financialYearLabel(p.year)}؛ خانه ${fa(p.cell!)}؛ محور افقی ${faScore(p.x)}؛ محور عمودی ${faScore(p.y)}`} title={`${financialYearLabel(p.year)} · خانه ${fa(p.cell!)} | ${faScore(p.x)}، ${faScore(p.y)}`} style={{left:`${p.x!*10}%`,bottom:`${p.y!*10}%`,"--route-i":i} as CSSProperties}><span>{financialYearLabel(p.year)}</span></button>)}
    {!latest&&<div className="ips59-empty-scatter">داده کافی برای این دو محور وجود ندارد.</div>}
  </>;
}

export function ScatterJourneyPeriods({points}:{points:ScatterPeriod[]}){
  return <div className="ips59-route-years" aria-label="وضعیت هر سال">{points.map(p=><span key={p.year} data-missing={p.cell===null}><b>{financialYearLabel(p.year)}</b>{p.cell===null?"فاقد داده":`خانه ${fa(p.cell)}`}</span>)}</div>;
}

export function PerformanceTrend({name,periods,year}:{name:string;periods:PerformancePeriod[];year:number}){
  const [view,setView]=useState<"score"|"rank">("score");
  const gradient=useId();
  const maxRank=Math.max(2,...periods.map(p=>p.peers));
  const x=(p:PerformancePeriod)=>periods.length<2?360:56+(periods.findIndex(y=>y.year===p.year)/(periods.length-1))*624;
  const y=(value:number)=>view==="score"?214-value*17.5:39+(value-1)/(maxRank-1)*175;
  const ticks=view==="score"?[0,2,4,6,8,10]:[1,...Array.from({length:Math.min(maxRank-1,4)},(_,i)=>1+Math.ceil((i+1)*(maxRank-1)/Math.min(maxRank-1,4)))];
  const usable=(p:PerformancePeriod)=>p[view]!==null;
  const points=periods.filter(usable);
  const pairs=consecutivePairs(periods,usable);
  return <section className="panel ips59-trend">
    <div className="section-title"><span><LineChart/></span><div><h2>روند سالانه امتیاز و رتبه عملکرد</h2><p>{name} · محاسبه همه سال‌ها با وزن‌های فعال بالا</p></div></div>
    <div className="ips59-trend-body">
      <div className="ips59-toggle" role="group" aria-label="شاخص روند عملکرد"><button type="button" aria-pressed={view==="score"} onClick={()=>setView("score")}>امتیاز از ۱۰</button><button type="button" aria-pressed={view==="rank"} onClick={()=>setView("rank")}>رتبه در گروه</button></div>
      {points.length?<svg className="ips59-trend-svg" key={view+name} viewBox="0 0 720 256" role="img" aria-label={`روند سالانه ${view==="score"?"امتیاز":"رتبه"} ${name}`}>
        <defs><linearGradient id={gradient} x1="0%" y1="0%" x2="0%" y2="100%"><stop stopColor="#239f97" stopOpacity=".20"/><stop offset="1" stopColor="#239f97" stopOpacity="0"/></linearGradient></defs>
        {ticks.map(t=><g key={t}><line x1="45" x2="692" y1={y(t)} y2={y(t)} stroke="#dce8ee"/><text x="34" y={y(t)+4} textAnchor="end">{fa(t)}</text></g>)}
        {periods.map(p=><g key={p.year}>{p.year===year&&<rect x={x(p)-16} y="24" width="32" height="196" rx="10" fill="#dfeeed" opacity=".55"/>}<text x={x(p)} y="240" textAnchor="middle" fontWeight={p.year===year?800:400}>{financialYearLabel(p.year)}</text></g>)}
        {pairs.map(([a,b],i)=><g key={b.year}>{view==="score"&&<path d={`M ${x(a)} 214 L ${x(a)} ${y(a[view]!)} L ${x(b)} ${y(b[view]!)} L ${x(b)} 214 Z`} fill={`url(#${gradient})`}/>}<line className="ips59-trend-line" pathLength="1" x1={x(a)} x2={x(b)} y1={y(a[view]!)} y2={y(b[view]!)} style={{"--route-i":i} as CSSProperties}/></g>)}
        {points.map(p=><g key={p.year}><circle cx={x(p)} cy={y(p[view]!)} r={p.year===year?7:5} fill="#17867e" stroke="#fff" strokeWidth="2"><title>{`${financialYearLabel(p.year)} · امتیاز ${faScore(p.score)} · رتبه ${faScore(p.rank)} از ${fa(p.peers)}`}</title></circle><text x={x(p)} y={y(p[view]!)-12} textAnchor="middle" fontWeight="800">{faScore(p[view])}</text></g>)}
      </svg>:<p className="ips59-empty">برای این شرکت، داده کافی برای امتیازدهی و رتبه‌بندی ثبت نشده است.</p>}
      <div className="ips59-trend-periods">{periods.map(p=><div key={p.year} data-active={p.year===year}><b>{financialYearLabel(p.year)}</b><span>امتیاز {faScore(p.score)}</span><small>{p.rank===null?"فاقد رتبه":`رتبه ${fa(p.rank)} از ${fa(p.peers)} شرکت`}</small></div>)}</div>
      <p className="ips59-chart-note">رتبه ۱ بالاترین است. رتبه هر سال فقط بین شرکت‌های دارای امتیاز در همان سال و گروه محاسبه می‌شود. سال بدون داده به خط روند متصل نمی‌شود.</p>
    </div>
  </section>;
}
