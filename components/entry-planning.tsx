"use client";

import {
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { HORIZONS, YEARS, selectionScore } from "@/lib/movement-model.mjs";

export type EntryOpportunity = {
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
type PlanItem = { share:number; priorityRank?:number; parentId?:number };
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
}: {
  baskets: Record<number,Record<string,PlanItem>>;
  opportunities: EntryOpportunity[];
  activeYear: number;
  onYear: (year: number) => void;
  weights: Weights;
  onWeights: (weights: Weights) => void;
  plan: Record<string, PlanItem>;
  onAdd: (item: EntryOpportunity) => void;
  onRemove: (key: string) => void;
  onRank: (key: string, rank: number) => void;
}) {
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
    .filter((item) => !item.child)
    .sort(
      (a, b) => b.entryPriority - a.entryPriority || a.parentId - b.parentId,
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
        share: number; priorityRank?:number;
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

  const evidence=(item:EntryOpportunity)=>selectionScore(item.macro,item.detail,item.management,weights).components.map(c=>`${({macro:"کلان",detail:"تفصیلی",board:"مدیریت"} as Record<string,string>)[c.key]} ${fa(c.effectiveWeight)}٪`).join(" · ");
  return (
    <div className="entry-planning-workspace">
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
        <div className="movement-table-wrap">
          <table className="movement-table entry-table">
            <thead>
              <tr>
                <th>فرصت</th>
                <th>حوزه مادر</th>
                <th>امتیاز حوزه</th>
                <th>تفصیلی</th>
                <th>مدیریت</th>
                <th>اولویت ورود</th>
                <th>جایگاه</th>
                <th>اقدام</th>
              </tr>
            </thead>
            <tbody>
              {parents.map((parent) => {
                const children = childrenByParent.get(parent.parentId) ?? [];
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
                      <td>
                        <span className="parent-badge">حوزه اصلی</span>
                      </td>
                      <td>{fa(parent.macro)}</td>
                      <td>{fa(parent.detail)}</td>
                      <td>{parent.management==null?"بدون نظر":fa(parent.management,0)}</td>
                      <td>
                        <strong className="entry-score">
                          {fa(parent.entryPriority)}<details className="effective-weight-note"><summary>وزن‌های مؤثر</summary><small>{evidence(parent)}</small></details>
                        </strong>
                      </td>
                      <td>
                        <span className={`horizon-tag ${parent.horizon}`}>
                          {horizonLabel(parent.horizon)}
                        </span>
                      </td>
                      <td>
                        <button
                          className="entry-add"
                          disabled={
                            Object.hasOwn(plan, parent.key) ||
                            selectedParentConflict(parent) ||
                            Math.abs(normalizedTotal - 100) >= 0.01
                          }
                          onClick={() => onAdd(parent)}
                        >
                          {Object.hasOwn(plan, parent.key) ? (
                            "در برنامه"
                          ) : (
                            <>
                              <Plus /> افزودن به برنامه ورود{" "}
                              {activeYear.toLocaleString("fa-IR", {useGrouping:false})}
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
                          <td>
                            <span className="parent-badge">
                              {child.parentName}
                            </span>
                          </td>
                          <td>{fa(child.macro)}</td>
                          <td>{fa(child.detail)}</td>
                          <td>{child.management==null?"بدون نظر":fa(child.management,0)}</td>
                          <td>
                            <strong>{fa(child.entryPriority)}</strong><details className="effective-weight-note"><summary>وزن‌های مؤثر</summary><small>{evidence(child)}</small></details>
                          </td>
                          <td>
                            <span className={`horizon-tag ${child.horizon}`}>
                              {horizonLabel(child.horizon)}
                            </span>
                          </td>
                          <td>
                            <button
                              className="entry-add"
                              disabled={
                                Object.hasOwn(plan, child.key) ||
                                selectedParentConflict(child) ||
                                Math.abs(normalizedTotal - 100) >= 0.01
                              }
                              onClick={() => onAdd(child)}
                            >
                              {Object.hasOwn(plan, child.key) ? (
                                "در برنامه"
                              ) : (
                                <>
                                  <Plus /> افزودن
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
        <p className="entry-rank-guide">رتبه پیشنهادی به تخصیص سرمایه منتقل می‌شود. امتیاز علمی و نیاز مالی هر طرح مستقل باقی می‌مانند. سهم‌های نسخه‌های قبلی فقط در سوابق نگهداری می‌شوند.</p>
        {selected.length ? (
          <div className="movement-table-wrap">
            <table className="movement-table selected-entry-table">
              <thead>
                <tr>
                  <th>فرصت منتخب</th>
                  <th>حوزه مادر</th>
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
                      <td>{row.item.parentName}</td>
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
                          <input type="number" min="1" step="1" aria-label={`رتبه ورود ${row.item.name}`} value={row.priorityRank??""} onChange={event=>onRank(row.key,Math.max(1,Math.round(Number(event.target.value)||1)))}/><span>رتبه</span>
                        </label>
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
