"use client";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  CircleHelp,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {Sheet, SheetContent, SheetTitle, SheetDescription, SheetClose} from "@/components/ui/sheet";
import names from "@/public/data/isic-persian-names.json";
import {
  ISIC_INDICATORS,
  ISIC_PRESETS,
  MIN_ISIC_WEIGHT_COVERAGE,
  calculateRankDelta,
  rankSingleIndicator,
} from "@/lib/movement-model.mjs";

export type IsicActivity = {
  code: string;
  name: string;
  parentId: number | null;
  parentName?: string | null;
  isicLevel: string;
  indicators: Record<string, number | null>;
  score: number | null;
  rank: number | null;
  percentiles: Record<string, number> | null;
  normalizedWeights: Record<string, number> | null;
  contributions: Record<string, number> | null;
  weightCoverage: number;
  mappingStatus: string;
  mappingEligible?: boolean;
  dataStatus: string;
  dataPeriod?: {
    start: number | null;
    end: number | null;
    latestCommonYear: number | null;
  };
};
export type IsicResult = {
  activities: IsicActivity[];
  sectors?: Record<number, { score: number | null }>;
};
type Activity = IsicActivity;
type Result = IsicResult;
type Row = { id: number; name: string };
type View = "combined" | "indicator";
type Filter = "all" | "top" | "bottom" | "up" | "down";
const fa = (n: number | null | undefined, d = 1) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString("fa-IR", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
export const activityName = (row: { code: string; name: string }) =>
  (names as Record<string, string>)[String(row.code)] ||
  "فعالیت نام‌گذاری‌نشده";
const hints: Record<string, string> = {
  economicSize: "حجم ارزش افزوده فعالیت",
  valueCreation: "نسبت ارزش افزوده به تولید",
  investment: "سرمایه‌گذاری ثابت نسبت به ارزش افزوده",
  productivity: "ارزش افزوده به ازای شاغل",
  employmentGrowth: "نرخ رشد اشتغال",
  firmGrowth: "نرخ رشد تعداد بنگاه‌ها",
};
const raw = (key: string, n: number | null | undefined) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : key === "economicSize"
      ? `${fa(n, 0)} دلار`
      : key === "productivity"
        ? `${fa(n, 0)} دلار/نفر`
        : `${fa(n * 100, 1)}٪`;
const period = (row: Activity) =>
  row.dataPeriod?.start && row.dataPeriod.end
    ? `${row.dataPeriod.start.toLocaleString("fa-IR",{useGrouping:false})} تا ${row.dataPeriod.end.toLocaleString("fa-IR",{useGrouping:false})}`
    : "دوره ثبت نشده";
const delta = (
  base: number | null | undefined,
  current: number | null | undefined,
) =>
  base == null || current == null ? null : calculateRankDelta(base, current);
export default function IsicAnalysis({
  rows,
  result,
  baseline,
  preset,
  weights,
  customWeights,
  onPreset,
  onCustom,
  onNext,
}: {
  rows: Row[];
  result: Result;
  baseline: Result;
  preset: string;
  weights: Record<string, number>;
  customWeights: Record<string, number>;
  onPreset: (key: string) => void;
  onCustom: (key: string, value: number) => void;
  onNext: () => void;
}) {
  const [view, setView] = useState<View>("combined"),
    [level, setLevel] = useState("ISIC 4-digit"),
    [indicator, setIndicator] = useState("investment"),
    [parent, setParent] = useState("all"),
    [filter, setFilter] = useState<Filter>("all"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState<string | null>(null);
  const parentNames = useMemo(
    () => new Map(rows.map((row) => [row.id, row.name])),
    [rows],
  );
  const baseRank = useMemo(
    () => new Map(baseline.activities.map((row) => [row.code, row.rank])),
    [baseline],
  );
  const universe = result.activities.filter(
    (row) => row.isicLevel === level && row.score != null,
  );
  const ranking: Activity[] =
    view === "combined"
      ? [...universe].sort(
          (a, b) =>
            (b.score ?? 0) - (a.score ?? 0) || a.code.localeCompare(b.code),
        )
      : (rankSingleIndicator(universe, indicator) as Activity[]);
  const currentRank = new Map(
    ranking.map((row, index) => [row.code, index + 1]),
  );
  const filtered = ranking.filter(
    (row) =>
      (parent === "all" || row.parentId === Number(parent)) &&
      (!query ||
        `${activityName(row)} ${row.name} ${row.code} ${parentNames.get(row.parentId ?? -1) ?? ""}`
          .toLocaleLowerCase("fa")
          .includes(query.trim().toLocaleLowerCase("fa"))),
  );
  const byRise = [...filtered].sort(
    (a, b) =>
      (delta(baseRank.get(b.code), b.rank) ?? 0) -
      (delta(baseRank.get(a.code), a.rank) ?? 0),
  );
  const shown =
    filter === "top"
      ? filtered.slice(0, 10)
      : filter === "bottom"
        ? filtered.slice(-10).reverse()
        : filter === "up"
          ? byRise.slice(0, 10)
          : filter === "down"
            ? byRise.slice(-10).reverse()
            : filtered;
  const detail =
    result.activities.find((row) => row.code === selected) ?? null;
  const parentIds = [
    ...new Set(
      result.activities
        .filter((row) => row.parentId != null && row.mappingEligible)
        .map((row) => row.parentId!),
    ),
  ].sort((a, b) =>
    (parentNames.get(a) ?? "").localeCompare(parentNames.get(b) ?? "", "fa"),
  );
  const unscored = result.activities.filter(
    (row) => row.isicLevel === level && row.score == null,
  );
  const selectedIndicator = ISIC_INDICATORS.find(
    (item) => item.key === indicator,
  )!;
  return (
    <div className="isic-experience isic-experience-v30">
      <header className="movement-section-title isic-title">
        <div>
          <span className="movement-step-kicker">گام ۲ · شواهد اقتصادی</span>
          <h2>ارزیابی تفصیلی فرصت‌ها</h2>
          <p>مقایسه و رتبه‌بندی زیر‌بخش‌های اقتصادی دارای اطلاعات تفصیلی</p>
        </div>
        <div className="isic-level-switch" aria-label="سطح فعالیت">
          <button
            className={level === "ISIC 4-digit" ? "active" : ""}
            onClick={() => {
              setLevel("ISIC 4-digit");
              setSelected(null);
            }}
          >
            فعالیت‌های ۴ رقمی
          </button>
          <button
            className={level === "ISIC 3-digit" ? "active" : ""}
            onClick={() => {
              setLevel("ISIC 3-digit");
              setSelected(null);
            }}
          >
            فعالیت‌های ۳ رقمی
          </button>
        </div>
      </header>
      <section className="isic-scenario">
        <div className="isic-scenario-head">
          <span>
            <SlidersHorizontal /> سناریوی تحلیل
          </span>
          <small>تغییر سناریو، امتیاز و رتبه را فوراً بازمحاسبه می‌کند.</small>
        </div>
        <div className="isic-scenario-tabs">
          {Object.entries(ISIC_PRESETS).map(([key, item]) => (
            <button
              key={key}
              className={preset === key ? "active" : ""}
              onClick={() => onPreset(key)}
            >
              {item.label}
            </button>
          ))}
          <button
            className={preset === "custom" ? "active" : ""}
            onClick={() => onPreset("custom")}
          >
            سفارشی
          </button>
        </div>
        {preset === "custom" && (
          <div className="isic-custom-weights">
            {ISIC_INDICATORS.map((item) => (
              <label key={item.key}>
                <span title={hints[item.key]}>
                  {item.label}
                  <CircleHelp />
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={customWeights[item.key]}
                  onChange={(e) => onCustom(item.key, Number(e.target.value))}
                />
                <b>{fa(weights[item.key], 1)}٪</b>
              </label>
            ))}
          </div>
        )}
      </section>
      <div className="isic-view-tabs">
        <button
          className={view === "combined" ? "active" : ""}
          onClick={() => setView("combined")}
        >
          <BarChart3 /> رتبه‌بندی ترکیبی
        </button>
        <button
          className={view === "indicator" ? "active" : ""}
          onClick={() => setView("indicator")}
        >
          <SlidersHorizontal /> تحلیل شاخص‌ها
        </button>
      </div>
      <section className="isic-command-strip" aria-label="خلاصه فضای تحلیل">
        <article>
          <span>جامعه قابل مقایسه</span>
          <b>{fa(universe.length, 0)}</b>
          <small>فعالیت دارای امتیاز معتبر</small>
        </article>
        <article>
          <span>سناریوی فعال</span>
          <b>
            {preset === "custom"
              ? "سفارشی"
              : ISIC_PRESETS[preset as keyof typeof ISIC_PRESETS]?.label ??
                "متوازن"}
          </b>
          <small>وزن‌های قابل بازگشت و مقایسه</small>
        </article>
        <article>
          <span>فعالیت منتخب</span>
          <b>{detail ? fa(detail.score, 1) : "—"}</b>
          <small>{detail ? activityName(detail) : "بدون انتخاب"}</small>
        </article>
        <article>
          <span>پوشش داده منتخب</span>
          <b>{detail ? `${fa(detail.weightCoverage, 0)}٪` : "—"}</b>
          <small>داده مفقود، امتیاز صفر نیست</small>
        </article>
      </section>
      {view === "indicator" && (
        <div className="isic-indicator-picker">
          <span>شاخص مورد بررسی</span>
          <div>
            {ISIC_INDICATORS.map((item) => (
              <button
                key={item.key}
                className={indicator === item.key ? "active" : ""}
                title={hints[item.key]}
                onClick={() => setIndicator(item.key)}
              >
                {item.label}
                <CircleHelp />
              </button>
            ))}
          </div>
          <p>
            {hints[indicator]}؛ رتبه‌ها فقط در میان فعالیت‌های معتبرِ همین سطح
            محاسبه شده‌اند.
          </p>
        </div>
      )}
      <div className="isic-tools">
        <label className="isic-search">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجوی زیر‌بخش…"
          />
        </label>
        <label>
          حوزه مادر
          <select value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="all">همه حوزه‌ها</option>
            {parentIds.map((id) => (
              <option key={id} value={id}>
                {parentNames.get(id)}
              </option>
            ))}
          </select>
        </label>
        <div className="isic-quick-filters">
          {[
            ["all", "همه"],
            ["top", "۱۰ برتر"],
            ["bottom", "۱۰ پایین‌تر"],
            ["up", "بیشترین صعود"],
            ["down", "بیشترین نزول"],
          ].map(([key, title]) => (
            <button
              key={key}
              className={filter === key ? "active" : ""}
              onClick={() => setFilter(key as Filter)}
            >
              {title}
            </button>
          ))}
        </div>
      </div>
      <div className="isic-master-layout full-ranking">
        <section className="isic-ranking-card">
          <header>
            <div>
              <b>
                {view === "combined"
                  ? "رتبه‌بندی زیر‌بخش‌ها"
                  : `رتبه‌بندی بر پایه ${selectedIndicator.label}`}
              </b>
              <small>{fa(shown.length, 0)} فعالیت قابل مقایسه</small>
            </div>
            <span>
              {level === "ISIC 4-digit"
                ? "سطح تفصیلی ۴ رقمی"
                : "سطح تجمیعی ۳ رقمی"}
            </span>
          </header>
          <div className="movement-table-wrap">
            <table className="movement-table isic-clean-table">
              <thead>
                {view === "combined" ? (
                  <tr>
                    <th>رتبه</th>
                    <th>زیر‌بخش</th>
                    <th>حوزه مادر</th>
                    <th title="نتیجه وزن‌دار شش شاخص">امتیاز تفصیلی (?)</th>
                    <th title="اختلاف رتبه با سناریوی متوازن">
                      تغییر رتبه (?)
                    </th>
                    <th />
                  </tr>
                ) : (
                  <tr>
                    <th>رتبه</th>
                    <th>زیر‌بخش</th>
                    <th>حوزه مادر</th>
                    <th title={hints[indicator]}>
                      مقدار واقعی {selectedIndicator.label} (?)
                    </th>
                    <th>صدک</th>
                    <th />
                  </tr>
                )}
              </thead>
              <tbody>
                {shown.map((row) => {
                  const change = delta(baseRank.get(row.code), row.rank);
                  return (
                    <tr
                      key={row.code}
                      className={detail?.code === row.code ? "selected" : ""}
                      tabIndex={0}
                      aria-selected={detail?.code === row.code}
                      onClick={() => setSelected(row.code)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(row.code);
                        }
                      }}
                    >
                      <td>
                        <span className="isic-rank">
                          {fa(currentRank.get(row.code), 0)}
                        </span>
                      </td>
                      <td>
                        <button className="isic-name-button" onClick={() => setSelected(row.code)}>{activityName(row)}</button>
                        <small title={`${row.name} · ${row.code}`}>
                          مشاهده منطق امتیاز
                        </small>
                      </td>
                      <td>
                        <span className="parent-badge">
                          {parentNames.get(row.parentId ?? -1) ??
                            "نگاشت چندگانه"}
                        </span>
                      </td>
                      {view === "combined" ? (
                        <>
                          <td>
                            <div className="score-cell">
                              <strong>{fa(row.score, 1)}</strong>
                              <i>
                                <em style={{ width: `${row.score ?? 0}%` }} />
                              </i>
                            </div>
                          </td>
                          <td>
                            <span
                              className={
                                change != null && change > 0
                                  ? "rank-up"
                                  : change != null && change < 0
                                    ? "rank-down"
                                    : "rank-flat"
                              }
                            >
                              {change == null
                                ? "—"
                                : change > 0
                                  ? `↑ ${fa(change, 0)}`
                                  : change < 0
                                    ? `↓ ${fa(-change, 0)}`
                                    : "بدون تغییر"}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <b>{raw(indicator, row.indicators[indicator])}</b>
                          </td>
                          <td>
                            <div className="percentile-cell">
                              <i>
                                <em
                                  style={{
                                    width: `${row.percentiles?.[indicator] ?? 0}%`,
                                  }}
                                />
                              </i>
                              <strong>
                                {fa(row.percentiles?.[indicator], 0)}
                              </strong>
                            </div>
                          </td>
                        </>
                      )}
                      <td>
                        <ChevronLeft />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!shown.length && (
              <div className="isic-empty-result">
                فعالیتی با این فیلترها یافت نشد؛ عبارت جست‌وجو یا حوزه مادر را تغییر دهید.
              </div>
            )}
          </div>
        </section>
        {detail && (
          <Sheet open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelected(null);}}><SheetContent side="left" className="isic-activity-sheet" dir="rtl" showCloseButton={false}><SheetClose className="isic-sheet-close" aria-label="بستن جزئیات فعالیت">بستن ×</SheetClose><aside className="isic-detail-panel">
            <header>
              <SheetDescription>تحلیل فعالیت منتخب</SheetDescription>
              <SheetTitle>{activityName(detail)}</SheetTitle>
              <small>
                کد فعالیت {detail.code.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])}
              </small>
            </header>
            <div className="isic-detail-summary">
              <div>
                <span>امتیاز تفصیلی</span>
                <b>{fa(detail.score, 1)}</b>
                <i>
                  <em style={{ width: `${detail.score ?? 0}%` }} />
                </i>
              </div>
              <dl>
                <div>
                  <dt>حوزه مادر</dt>
                  <dd>
                    {parentNames.get(detail.parentId ?? -1) ??
                      detail.mappingStatus}
                  </dd>
                </div>
                <div>
                  <dt>رتبه</dt>
                  <dd>{fa(detail.rank, 0)}</dd>
                </div>
                <div>
                  <dt>وضعیت داده</dt>
                  <dd>{detail.dataStatus}</dd>
                </div>
                <div>
                  <dt>دوره داده</dt>
                  <dd>{period(detail)}</dd>
                </div>
                <div>
                  <dt>پوشش وزن</dt>
                  <dd>{fa(detail.weightCoverage, 1)}٪</dd>
                </div>
              </dl>
            </div>
            <div className="isic-factor-list">
              {ISIC_INDICATORS.map((item) => {
                const percentile = detail.percentiles?.[item.key] ?? null;
                return (
                  <article key={item.key}>
                    <div>
                      <span title={hints[item.key]}>
                        {item.label}
                        <CircleHelp />
                      </span>
                      <b>{raw(item.key, detail.indicators[item.key])}</b>
                    </div>
                    <i>
                      <em style={{ width: `${percentile ?? 0}%` }} />
                    </i>
                    <footer>
                      <span>صدک {fa(percentile, 1)}</span>
                      <span>
                        وزن {fa(detail.normalizedWeights?.[item.key], 1)}٪
                      </span>
                      <strong>
                        سهم امتیاز {fa(detail.contributions?.[item.key], 2)}
                      </strong>
                    </footer>
                  </article>
                );
              })}
            </div>
            <details className="isic-score-method">
              <summary>
                کنترل محاسبه و جمع سهم شاخص‌ها <ChevronLeft />
              </summary>
              <div>
                {ISIC_INDICATORS.map((item) => (
                  <p key={item.key}>
                    <span>{item.label}</span>
                    <small>
                      وزن مؤثر {fa(detail.normalizedWeights?.[item.key], 1)}٪
                    </small>
                    <b>سهم {fa(detail.contributions?.[item.key], 2)}</b>
                  </p>
                ))}
              </div>
              <footer>
                <span>جمع سهم شاخص‌ها</span>
                <b>
                  {fa(
                    Object.values(detail.contributions ?? {}).reduce(
                      (sum, value) => sum + value,
                      0,
                    ),
                    2,
                  )}
                </b>
                <small>برابر با امتیاز تفصیلی نهایی</small>
              </footer>
            </details>
          </aside></SheetContent></Sheet>
        )}

      </div>
      <details className="isic-unscored">
        <summary>
          {fa(unscored.length, 0)} فعالیت فاقد داده کافی — مشاهده
        </summary>
        <div>
          {unscored.map((row) => (
            <p key={row.code}>
              <button className="isic-name-button" onClick={() => setSelected(row.code)}>{activityName(row)}</button>
              <span>
                {row.dataStatus} · پوشش وزن {fa(row.weightCoverage, 0)}٪
              </span>
            </p>
          ))}
        </div>
      </details>
      <footer className="movement-footnote">
        <CircleHelp />
        <span>
          داده مفقود صفر نیست. رتبه ۳ و ۴ رقمی جداست و حداقل{" "}
          {fa(MIN_ISIC_WEIGHT_COVERAGE, 0)}٪ پوشش وزن لازم است.
        </span>
        <button onClick={onNext}>
          اولویت‌های راهبردی مدیریت <ArrowLeft />
        </button>
      </footer>
    </div>
  );
}
