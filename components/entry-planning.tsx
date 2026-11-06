"use client";
import {zoneFor,MATRIX_THRESHOLDS} from "@/lib/movement-zones.mjs";
import {ENTRY_MODES,type EntryMode,type SelectionTrace,type Collaboration} from "@/lib/entry-route.mjs";

import {
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { HORIZONS, YEARS, ISIC_INDICATORS, selectionScore } from "@/lib/movement-model.mjs";

export type EntryOpportunity = {
  proximity?:number|null; proximityHint?:string; proximityReason?:string; market?:number; strategic?:number; mission?:string; missionCondition?:string; focus?:string; detailEvidence?:{ indicators:Record<string,number|null>;percentiles:Record<string,number>|null;normalizedWeights:Record<string,number>|null;contributions:Record<string,number>|null;dataPeriod?:{start:number|null;end:number|null} };
  entryMode?:EntryMode; selectionTrace?:SelectionTrace;
  key: string;
  name: string;
  parentName: string;
  parentId: number;
  child: boolean;
  macro: number;
  detail: number | null;
  management: number | null;
  entryPriority: number;
  horizon: "core" | "adjacent" | "transform";
};

type Weights = { macro: number; detail: number; board: number };
type PlanItem = { entryMode?:EntryMode; selectionTrace?:SelectionTrace; share:number; priorityRank?:number; parentId?:number };
const fa = (value: number | null | undefined, digits = 1) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("fa-IR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
const horizonLabel = (key: string) =>
  HORIZONS.find((item) => item.key === key)?.label ?? "—";

export default function EntryPlanning({
  opportunities,
  baskets,
  activeYear,
  onYear,
  weights,
  onWeights,
  plan,
  onAdd,
  onRemove,
  onRank,
  onMode,
}: {
  baskets: Record<number,Record<string,PlanItem>>;
  opportunities: EntryOpportunity[];
  activeYear: number;
  onYear: (year: number) => void;
  weights: Weights;
  onWeights: (weights: Weights) => void;
  plan: Record<string, PlanItem>;
  onAdd: (item: EntryOpportunity,mode:EntryMode|undefined,collaboration?:Collaboration) => void;
  onMode:(key:string,mode:EntryMode)=>void;
  onRemove: (key: string) => void;
  onRank: (key: string, rank: number) => void;
}) {
  const [pending,setPending]=useState<EntryOpportunity|null>(null);
  const [route,setRoute]=useState<Collaboration>({goal:"",mechanism:"",commitment:"",nextStep:"",condition:"",alternative:""});
  const [order,setOrder]=useState("priority");
  const show=(item:EntryOpportunity)=>{setRoute(plan[item.key]?.selectionTrace?.collaboration??{goal:"",mechanism:"",commitment:"",nextStep:"",condition:"",alternative:""});setPending(item);};
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [showWeights, setShowWeights] = useState(false);
  const normalizedTotal = weights.macro + weights.detail + weights.board;
  const visible = useMemo(
    () =>
      opportunities.filter(
        (item) =>
          !query || `${item.name} ${item.parentName}`.includes(query.trim()),
      ),
    [opportunities, query],
  );
  const parents = visible
    .filter((item) => !item.child || !visible.some(p=>!p.child&&p.parentId===item.parentId))
    .sort(
      (a, b) => (order==="proximity"?(b.proximity??-1)-(a.proximity??-1):b.entryPriority - a.entryPriority) || a.parentId - b.parentId,
    );
  const childrenByParent = useMemo(() => {
    const result = new Map<number, EntryOpportunity[]>();
    for (const item of visible.filter((row) => row.child))
      result.set(
        item.parentId,
        [...(result.get(item.parentId) ?? []), item].sort(
          (a, b) => b.entryPriority - a.entryPriority,
        ),
      );
    return result;
  }, [visible]);
  const selected = Object.entries(plan)
    .map(([key, value]) => ({
      item: opportunities.find((row) => row.key === key),
      key,
      ...value,
    }))
    .filter(
      (
        row,
      ): row is {
        item: EntryOpportunity;
        key: string;
        share: number; priorityRank?:number; entryMode?:EntryMode; selectionTrace?:SelectionTrace;
        parentId: number;
      } => Boolean(row.item),
    );
  const selectedParentConflict = (item: EntryOpportunity) =>
    item.child
      ? Object.hasOwn(plan, `parent:${item.parentId}`)
      : Object.keys(plan).some(
          (key) =>
            key.startsWith("activity:") &&
            opportunities.find((row) => row.key === key)?.parentId ===
              item.parentId,
        );

  const scoreRange=(item:EntryOpportunity)=>{
    const values=[selectionScore(item.macro,item.detail,item.management,weights).score??item.entryPriority];
    const keys=["macro","detail","board"] as const;
    for(const from of keys)for(const to of keys)if(from!==to&&weights[from]>=5){
      const adjusted={...weights,[from]:weights[from]-5,[to]:weights[to]+5};
      const v=selectionScore(item.macro,item.detail,item.management,adjusted).score;
      if(v!=null)values.push(v);
    }
    return [Math.min(...values),Math.max(...values)];
  };
  const evidence=(item:EntryOpportunity)=>selectionScore(item.macro,item.detail,item.management,weights).components.map(c=>`${({macro:"حوزه مادر",detail:"تفصیلی",board:"مدیریت"} as Record<string,string>)[c.key]} ${fa(c.effectiveWeight)}٪`).join(" · ");
  return (
    <div className="entry-planning-workspace">
      {pending&&<div className="entry-route-overlay"><section role="dialog" aria-modal="true" aria-labelledby="entry-route-title" className="entry-route-choice movement-decision-card" onKeyDown={e=>{if(e.key==="Escape")setPending(null);if(e.key==="Tab"){const controls=Array.from(e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),select,input,summary"));const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
      <header><div><span>کارت تصمیم فرصت</span><h3 id="entry-route-title">{pending.name}</h3></div><button autoFocus onClick={()=>setPending(null)} aria-label="بستن">×</button></header>
      <p>{pending.mission}{pending.missionCondition&&" · شرط: "+pending.missionCondition} · {pending.focus??"بدون نظر تمرکز"} · {pending.child?"مختصات حوزه مادر: "+pending.parentName:"مختصات حوزه"} · نزدیکی به بازرگانی فولاد {fa(pending.proximity)} از ۱۰۰</p>
      {pending.market!=null&&pending.strategic!=null&&<div className="movement-mini-matrix"><svg viewBox="0 0 140 100" width="140" height="100" role="img" aria-label="نقطه روی ماتریس فرصت"><rect x="0" y="0" width="140" height="100" fill="#e9f0f8"/>{[MATRIX_THRESHOLDS.medium,MATRIX_THRESHOLDS.high].map(t=><path key={t} d={`M${5+(t-.5)/9*130} 0V100M0 ${95-(t-.5)/9*90}H140`} stroke="#91a8c2"/>)}<circle cx={5+(pending.market-.5)/9*130} cy={95-(pending.strategic-.5)/9*90} r="5" fill="#0b559f"/></svg><div>جذابیت: {fa(pending.market)} · تناسب: {fa(pending.strategic)}<br/>خانه: {zoneFor(pending.market,pending.strategic).title}<br/>{zoneFor(pending.market,pending.strategic).decision}</div></div>}
      <details open><summary>چرا اولویت ورود {fa(pending.entryPriority)} است؟</summary>
      {selectionScore(pending.macro,pending.detail,pending.management,weights).components.map(c=><div key={c.key} className="movement-score-factor"><span>{({macro:"حوزه",detail:"تفصیلی",board:"مدیریت"} as Record<string,string>)[c.key]} · وزن مؤثر {fa(c.effectiveWeight)}٪</span><meter min="0" max="100" value={c.value*c.effectiveWeight/100}/><b>{fa(c.value*c.effectiveWeight/100)}</b></div>)}
      <small>دامنه امتیاز با جابه‌جایی ۵ واحد درصد وزن: {scoreRange(pending).map(v=>fa(v)).join(" تا ")}</small><br/><small>{pending.detail==null?"داده تفصیلی موجود نیست. ":""}{pending.management==null?"نظر مدیریت ثبت نشده است.":""}</small></details>
      {pending.detailEvidence&&<details><summary>منشأ امتیاز تفصیلی · دوره {fa(pending.detailEvidence.dataPeriod?.start,0)} تا {fa(pending.detailEvidence.dataPeriod?.end,0)}</summary>{ISIC_INDICATORS.map(x=>{const d=pending.detailEvidence!;return <div className="movement-score-factor" key={x.key}><span title={x.source}>{x.label} · مقدار خام {fa(d.indicators[x.key],2)} · صدک {fa(d.percentiles?.[x.key])} · وزن {fa(d.normalizedWeights?.[x.key])}٪</span><meter min="0" max="100" value={d.contributions?.[x.key]??0}/><b>{fa(d.contributions?.[x.key],2)}</b></div>})}</details>}
      <details><summary>مسیر همکاری پیشنهادی (اختیاری)</summary><p>نوع همکاری را بر اساس شواهد ثبت کنید. اگر شواهد کافی نیست، فقط اقدام بررسی را بنویسید.</p>{pending.proximityHint&&<p><b>سرنخ مدل ارتباط با هسته{pending.child?" (حوزه مادر)":""}:</b> {pending.proximityHint} · {pending.proximityReason}</p>}<div className="movement-route-fields">
      <label>هدف<select value={route.goal} onChange={e=>setRoute({...route,goal:e.target.value})}><option value="">تعیین نشده</option>{["توسعه تأمین و فروش","خدمات یا فرآوری","توسعه ظرفیت صنعتی"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>سازوکار<select value={route.mechanism} onChange={e=>setRoute({...route,mechanism:e.target.value})}><option value="">تعیین نشده</option>{["قرارداد تجاری","استفاده از ظرفیت شریک","مشارکت صنعتی","خرید سهم","توسعه مستقل"].map(x=><option key={x}>{x}</option>)}</select></label>
      <label>سطح تعهد<select value={route.commitment} onChange={e=>setRoute({...route,commitment:e.target.value})}><option value="">تعیین نشده</option>{["بررسی و مذاکره","آزمون محدود","اجرای مرحله‌ای","تعهد پس از تصویب"].map(x=><option key={x}>{x}</option>)}</select></label>
      {([["nextStep","قدم اول"],["condition","شرط پیشروی"],["alternative","مسیر جایگزین"],["rankReason","دلیل ترتیب مدیریت"]] as const).map(([k,label])=><label key={k}>{label}<input maxLength={300} value={route[k]??""} onChange={e=>setRoute({...route,[k]:e.target.value})}/></label>)}</div></details>
      <footer><button onClick={()=>{onAdd(pending,plan[pending.key]?.entryMode,route);setPending(null);}}>{plan[pending.key]?"ثبت تغییرات کارت":"افزودن برای بررسی"}</button><button onClick={()=>setPending(null)}>بستن</button></footer></section></div>}
      <header className="entry-planning-head">
        <div>
          <span>گام چهارم · برنامه ورود</span>
          <h2>برنامه‌ریزی ورود به فرصت‌ها</h2>
          <p>
            فرصت‌های هر سال را انتخاب و رتبه پیشنهادی ورود را ثبت کنید. رتبه کمتر، تقدم بیشتری در تخصیص سرمایه دارد.
          </p>
        </div>
        <label>
          <span>سال برنامه ورود</span>
          <select
            value={activeYear}
            onChange={(event) => onYear(Number(event.target.value))}
          >
            {YEARS.map((year) => (
              <option key={year} value={year}>
                {year.toLocaleString("fa-IR", {useGrouping:false})}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="entry-priority-model">
        <header>
          <div>
            <span>مدل اولویت ورود</span>
            <b>ترکیب سه شاهد مستقل، با حذف خودکار مؤلفه فاقد داده</b>
          </div>
          <button onClick={() => setShowWeights((value) => !value)}>
            {showWeights ? "بستن تنظیم وزن‌ها" : "مشاهده و تنظیم وزن‌ها"}
            <ChevronDown />
          </button>
        </header>
        <div className="entry-formula-strip">
          <span>
            <b>{fa(weights.macro, 0)}٪</b> امتیاز حوزه در مدل ۷۷ بخشی
          </span>
          <i />
          <span>
            <b>{fa(weights.detail, 0)}٪</b> امتیاز تفصیلی
          </span>
          <i />
          <span>
            <b>{fa(weights.board, 0)}٪</b> اولویت مدیریت
          </span>
          <strong
            className={
              Math.abs(normalizedTotal - 100) < 0.01 ? "valid" : "invalid"
            }
          >
            جمع {fa(normalizedTotal, 0)}٪
          </strong>
        </div>
        {showWeights && (
          <div className="entry-weight-controls">
            {(
              [
                ["macro", "مدل ۷۷ بخشی"],
                ["detail", "تحلیل تفصیلی"],
                ["board", "اولویت مدیریت"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <span>{label}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights[key]}
                  onChange={(event) =>
                    onWeights({ ...weights, [key]: Number(event.target.value) })
                  }
                />
                <b>{fa(weights[key], 0)}٪</b>
              </label>
            ))}
          </div>
        )}
        <p>
          <CircleHelp /> اگر امتیاز تفصیلی یا نظر مدیریت موجود نباشد، وزن آن حذف
          و وزن اجزای موجود نرمال می‌شود؛ داده مفقود هرگز صفر نیست.
        </p>
      </section>

      <nav className="entry-year-strip" aria-label="سال‌های برنامه ورود">{YEARS.map(y=>{const values=Object.values(baskets[y]??{});return <button key={y} className={activeYear===y?"active":""} onClick={()=>onYear(y)}><b>{y.toLocaleString("fa-IR",{useGrouping:false})}</b><small>{!values.length?"خالی":`${fa(values.length,0)} فرصت منتخب`}</small></button>;})}</nav>
      <section className="entry-opportunity-table">
        <header>
          <div>
            <h3>فرصت‌های قابل ورود در {activeYear.toLocaleString("fa-IR", {useGrouping:false})}</h3>
            <span>
              {opportunities.length.toLocaleString("fa-IR")} فرصت مجاز یا مشروط
            </span>
          </div>
          <label>
            <Search />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجوی حوزه یا زیر‌بخش…"
            />
          </label>
        </header>
        <label>مرتب‌سازی <select value={order} onChange={e=>setOrder(e.target.value)}><option value="priority">اولویت ورود</option><option value="proximity">نزدیکی به بازرگانی فولاد</option></select></label>
        <div className="movement-table-wrap">
          <table className="movement-table entry-table">
            <thead>
              <tr>
                <th>فرصت</th>
                <th>نزدیکی به بازرگانی فولاد</th>
                <th>اولویت ورود</th>
                <th>وضعیت بررسی</th>
                <th>اقدام</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((parent) => {
                const children = parent.child ? [] : childrenByParent.get(parent.parentId) ?? [];
                const open = expanded.has(parent.parentId);
                return (
                  <Fragment key={parent.key}>
                    <tr className={children.length ? "entry-parent-row" : ""}>
                      <td>
                        <div className="entry-name">
                          {children.length ? (
                            <button
                              onClick={() =>
                                setExpanded((old) => {
                                  const next = new Set(old);
                                  if (next.has(parent.parentId))
                                    next.delete(parent.parentId);
                                  else next.add(parent.parentId);
                                  return next;
                                })
                              }
                            >
                              {open ? <ChevronDown /> : <ChevronLeft />}
                            </button>
                          ) : (
                            <span />
                          )}
                          <div>
                            <b>{parent.name}</b>
                            {children.length > 0 && (
                              <small>
                                {children.length.toLocaleString("fa-IR")}{" "}
                                زیر‌بخش مستقل
                              </small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{fa(parent.proximity)}{parent.child&&<small> · حوزه مادر</small>}</td>
                      <td>
                        <strong className="entry-score">
                          {fa(parent.entryPriority)}<details className="effective-weight-note"><summary>وزن‌های مؤثر</summary><small>{evidence(parent)}</small></details>
                        </strong>
                      </td>
                      <td>
                        <span className={`horizon-tag ${parent.horizon}`}>
                          {parent.focus??horizonLabel(parent.horizon)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="entry-add"
                          disabled={
                            selectedParentConflict(parent) ||
                            Math.abs(normalizedTotal - 100) >= 0.01
                          }
                          onClick={() => show(parent)}
                        >
                          {Object.hasOwn(plan, parent.key) ? (
                            "مشاهده انتخاب"
                          ) : (
                            <>
                              <Plus /> بررسی فرصت
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                    {open &&
                      children.map((child) => (
                        <tr key={child.key} className="entry-child-row">
                          <td>
                            <span className="entry-branch" />
                            <b>{child.name}</b>
                          </td>
                          <td>{fa(child.proximity)} <small>· حوزه مادر</small></td>
                          <td>
                            <strong>{fa(child.entryPriority)}</strong><details className="effective-weight-note"><summary>وزن‌های مؤثر</summary><small>{evidence(child)}</small></details>
                          </td>
                          <td>
                            <span className={`horizon-tag ${child.horizon}`}>
                              {child.focus??horizonLabel(child.horizon)}
                            </span>
                          </td>
                          <td>
                            <button
                              className="entry-add"
                              disabled={
                                selectedParentConflict(child) ||
                                Math.abs(normalizedTotal - 100) >= 0.01
                              }
                              onClick={() => show(child)}
                            >
                              {Object.hasOwn(plan, child.key) ? (
                                "مشاهده انتخاب"
                              ) : (
                                <>
                                  <Plus /> بررسی
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="annual-entry-plan">
        <header>
          <div>
            <span>برنامه ورود سال {activeYear.toLocaleString("fa-IR", {useGrouping:false})}</span>
            <h3>سرمایه‌گذاری‌های جدید منتخب</h3>
          </div>
          <div className="entry-total"><small>انتخاب‌های سال</small><b>{fa(selected.length,0)}</b><span>رتبه کمتر = تقدم بیشتر</span></div>
        </header>
        <div className="entry-mode-summary">{Object.entries(ENTRY_MODES).map(([key,mode])=><article data-mode={key} key={key}><span>{mode.target}</span><b>{fa(selected.filter(r=>r.entryMode===key).length,0)} فرصت</b><small>{mode.label}</small></article>)}{selected.some(r=>!r.entryMode)&&<article><span>انتخاب‌های نسخه قبلی</span><b>{fa(selected.filter(r=>!r.entryMode).length,0)}</b><small>مسیر ورود را تعیین کنید</small></article>}</div><p className="entry-rank-guide">رتبه پیشنهادی به تخصیص سرمایه منتقل می‌شود. امتیاز علمی و نیاز مالی هر طرح مستقل باقی می‌مانند. سهم‌های نسخه‌های قبلی فقط در سوابق نگهداری می‌شوند.</p>
        {selected.length ? (
          <div className="movement-table-wrap">
            <table className="movement-table selected-entry-table">
              <thead>
                <tr>
                  <th>فرصت منتخب</th>
                  <th>حوزه مادر</th>
                  <th>مسیر ورود و هسته هدف</th>
                  <th>افق</th>
                  <th>اولویت ورود</th>
                  <th>رتبه پیشنهادی ورود</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {selected
                  .sort((a,b)=>(a.priorityRank??9999)-(b.priorityRank??9999)||b.item.entryPriority-a.item.entryPriority)
                  .map((row) => (
                    <tr key={row.key}>
                      <td>
                        <b>{row.item.name}</b>
                      </td>
                      <td>{row.item.parentName}</td><td><label className="entry-mode-tag" data-mode={row.entryMode??'unknown'}><select aria-label={`مسیر ورود ${row.item.name}`} value={row.entryMode??''} onChange={e=>onMode(row.key,e.target.value as EntryMode)}><option value="" disabled>مسیر تعیین نشده</option>{Object.entries(ENTRY_MODES).map(([key,m])=><option key={key} value={key}>{m.label}</option>)}</select><small>{row.entryMode?ENTRY_MODES[row.entryMode].target:'در دست بررسی'}</small></label></td>
                      <td>
                        <span className={`horizon-tag ${row.item.horizon}`}>
                          {horizonLabel(row.item.horizon)}
                        </span>
                      </td>
                      <td>
                        <strong>{fa(row.item.entryPriority)}</strong>
                      </td>
                      <td>
                        <label className="allocation-input">
                          <input type="number" min="1" step="1" aria-label={`رتبه ورود ${row.item.name}`} value={row.priorityRank??""} onChange={event=>onRank(row.key,Math.max(1,Math.round(Number(event.target.value)||1)))}/><span>ترتیب مدیریت</span>
                        </label>{row.selectionTrace?.collaboration?.rankReason&&<small>{row.selectionTrace.collaboration.rankReason}</small>}
                      </td>
                      <td>
                        <button
                          className="remove-item"
                          aria-label={`حذف ${row.item.name} از برنامه ورود`}
                          title="حذف از برنامه ورود"
                          onClick={() => onRemove(row.key)}
                        >
                          <X />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="entry-empty">
            <b>هنوز فرصتی برای این سال انتخاب نشده است.</b>
            <p>
              از جدول بالا، فرصت‌های مناسب را مستقیماً به برنامه ورود اضافه
              کنید.
            </p>
          </div>
        )}

      </section>
    </div>
  );
}
