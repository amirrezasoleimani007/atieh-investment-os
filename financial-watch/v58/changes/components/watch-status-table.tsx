import {formatNumber,type DisplayMode} from '@/lib/financial-engine';
import {WATCH_SIX_CHARTS,WATCH_SIX_AXES,watchSixBand,type WatchSixBundle} from '@/lib/watch-six';
import type {PlotPoint} from './scatter-chart';
const WATCH_BAND_NAMES={W:'ضعیف',M:'متوسط',G:'مطلوب'} as const;
export default function WatchStatusTable({bundle,previous,chartPoints,mode,company,year}: {
  bundle:WatchSixBundle; previous:WatchSixBundle|null;chartPoints:Map<string,PlotPoint[]>;mode:DisplayMode;company:string;year:number;
}) {
  const badge=(score:number|null)=>{const band=watchSixBand(score);return <span className={`watch-band band-${band??'missing'}`}>{band?WATCH_BAND_NAMES[band]:'داده ناکافی'}</span>};
  const companies=[...new Set([...chartPoints.values()].flat().map(p=>p.company))].sort((a,b)=>a===company?-1:b===company?1:a.localeCompare(b,'fa'));
  return <section className="watch-status-table table-card" aria-label="جدول وضعیت">
    <header><div><span className="eyebrow">خلاصه قابل مقایسه</span><h3>{mode==='trend'?'وضعیت محورهای شرکت':'وضعیت شرکت‌های نمایش‌داده‌شده'}</h3></div><small>{mode==='trend'?company:`${companies.length.toLocaleString('fa-IR')} شرکت`} · {year.toLocaleString('fa-IR',{useGrouping:false})} · امتیاز از ۱۰</small></header>
    <div className="table-scroll"><table>{mode==='trend'?<>
      <thead><tr><th>محور</th><th>امتیاز فعلی</th><th>وضعیت در مدل</th><th>دوره مشابه قبل</th><th>تغییر امتیاز</th></tr></thead>
      <tbody>{WATCH_SIX_AXES.map(({key})=>{
        const a=bundle.axes[key],p=previous?.axes[key].score??null,delta=a.score!==null&&p!==null?a.score-p:null;
        return <tr key={key}><td>{a.label}</td><td className="watch-number">{formatNumber(a.score,2)}</td><td>{badge(a.score)}</td><td className="watch-number">{formatNumber(p,2)}</td><td className={`watch-number ${delta!==null&&Math.abs(delta)>=.25?(delta<0?'watch-down':'watch-up'):''}`} dir="ltr">{delta===null?'—':`${delta>0?'+':''}${formatNumber(delta,2)}`}</td></tr>;
      })}</tbody></>:<>
      <thead><tr><th>شرکت</th>{WATCH_SIX_CHARTS.map(d=><th key={d.key}>{d.xLabel}<br/><small>{d.yLabel}</small></th>)}</tr></thead>
      <tbody>{companies.map(c=><tr key={c} className={c===company?'watch-selected-row':''}><td>{c}{c===company&&<small className="watch-selected-label">منتخب</small>}</td>{WATCH_SIX_CHARTS.map(d=>{
        const p=chartPoints.get(d.key)?.find(p=>p.company===c&&p.year===year);
        return <td key={d.key}>{p?<div className="watch-pair"><span>{badge(p.x)} <b>{formatNumber(p.x,2)}</b></span><span>{badge(p.y)} <b>{formatNumber(p.y,2)}</b></span></div>:<span className="watch-muted">داده ناکافی</span>}</td>;
      })}</tr>)}</tbody></>}</table></div>
    <p className="watch-table-note">{mode==='trend'?'تغییرها نسبت به دوره مشابه سال قبل‌اند؛ نبود مقدار با خط تیره نشان داده می‌شود.':'در هر خانه، سطر اول محور افقی و سطر دوم محور عمودی است. میانگین نمودار فقط شرکت‌های دارای داده را شامل می‌شود.'}</p>
  </section>;
}
