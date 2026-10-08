"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, RotateCcw, Sparkles } from "lucide-react";
import {
  FUNDING_SOURCES,
  SOURCE_WATERFALL,
  normalizedSourceOrder,
  sourcePolicyRequiresReason,
  type CapitalOutput,
  type FundingSource,
  type SourcePolicy,
} from "@/lib/capital-allocation.mjs";

const needLabel = (need: string) =>
  need
    .replace("توسعه / CAPEX رشد", "توسعه / سرمایه‌گذاری رشد")
    .replace("سرمایه‌گذاری مالی / پرتفویی", "سرمایه‌گذاری مالی / پرتفویی بورسی");

const NEED_INTENT: Record<string, string> = {
  "سرمایه در گردش": "تطبیق سررسید منبع با چرخه عملیات و پرهیز از مصرف منابع یک‌باره برای نیاز تکرارشونده",
  "نگهداشت / نوسازی / الزامات": "حفظ تداوم عملیات و تأمین الزامات ضروری با کمترین فشار کوتاه‌مدت بر نقدینگی",
  "توسعه / CAPEX رشد": "تأمین سرمایه متناسب با دوره ساخت، بلوغ طرح و زمان رسیدن به جریان نقد",
  "تملک / سرمایه‌گذاری راهبردی": "تقسیم ریسک مالکیت و حفظ انعطاف مالی در تصمیم‌های بزرگ و راهبردی",
  "تقویت ساختار مالی": "آزادسازی سرمایه و اصلاح ترکیب بدهی و حقوق صاحبان سهام پیش از ایجاد تعهد تازه",
  "سرمایه‌گذاری مالی / پرتفویی": "حفظ نقدشوندگی و جلوگیری از تأمین دارایی مالی با بدهی نامتناسب",
};

const SOURCE_GUIDANCE: Record<string, Partial<Record<FundingSource, string>>> = {
  "سرمایه در گردش": {
    shortDebt: "متناسب با چرخه کوتاه عملیات و بازپرداخت از فروش",
    internal: "پوشش پایدار بدون افزایش اهرم مالی",
    partner: "برای کسری ساختاری یا افزایش پایدار مقیاس",
    longDebt: "برای بخش پایدار نیاز یا بازتنظیم سررسید",
    disposal: "منبع غیرتکرارشونده؛ فقط با تصمیم و برنامه روشن",
  },
  "نگهداشت / نوسازی / الزامات": {
    internal: "گزینه طبیعی برای مخارج ضروری و قابل پیش‌بینی",
    disposal: "تبدیل دارایی کم‌بازده به ظرفیت عملیاتی ضروری",
    longDebt: "متناسب با عمر مفید تجهیز یا نوسازی",
    partner: "برای نوسازی بزرگ یا مشارکت فناورانه",
    shortDebt: "گزینه پشتیبان برای شکاف زمانی کوتاه",
  },
  "توسعه / CAPEX رشد": {
    longDebt: "تطبیق بازپرداخت با دوره ساخت و بهره‌برداری",
    internal: "کاهش ریسک تأمین و حفظ مالکیت",
    partner: "تقسیم ریسک اجرا، بازار یا فناوری",
    disposal: "بازآرایی پرتفوی برای تأمین رشد اولویت‌دار",
    shortDebt: "صرفاً برای پل مالی کوتاه و قابل بازپرداخت",
  },
  "تملک / سرمایه‌گذاری راهبردی": {
    partner: "تقسیم ریسک معامله و افزودن قابلیت صنعتی",
    internal: "حفظ کنترل و سرعت تصمیم در حد ظرفیت آزاد",
    longDebt: "برای دارایی دارای جریان نقد و بازپرداخت روشن",
    disposal: "جایگزینی دارایی کم‌اولویت با دارایی راهبردی",
    shortDebt: "فقط به‌عنوان پل تا تأمین قطعی معامله",
  },
  "تقویت ساختار مالی": {
    disposal: "آزادسازی سرمایه محبوس و کاهش فشار مالی",
    partner: "تقویت حقوق صاحبان سهام و ظرفیت اهرمی",
    internal: "حفظ سود و بازسازی تدریجی ترازنامه",
    longDebt: "بازتنظیم سررسید؛ نه ایجاد بدهی بدون اصلاح",
    shortDebt: "آخرین گزینه و فقط برای عبور از شکاف موقت",
  },
  "سرمایه‌گذاری مالی / پرتفویی": {
    internal: "منبع پایه برای سبد نقدشونده و قابل مدیریت",
    disposal: "چرخش سرمایه از دارایی کم‌بازده به سبد هدف",
    partner: "سبد یا ابزار مشترک با حدود مالکیت روشن",
    longDebt: "فقط با بازده و سررسید کاملاً منطبق",
    shortDebt: "گزینه استثنایی؛ ریسک نوسان و تمدید بالا است",
  },
};

const fa = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("fa-IR", { maximumFractionDigits: 0 });

export default function SourceOrderPolicy({
  policy,
  onChange,
  output,
  baselineOutput,
}: {
  policy: SourcePolicy;
  onChange: (policy: SourcePolicy) => void;
  output: CapitalOutput;
  baselineOutput: CapitalOutput;
}) {
  const needs = Object.keys(SOURCE_WATERFALL);
  const [selectedNeed, setSelectedNeed] = useState(needs[0]);
  const order = useMemo(
    () => normalizedSourceOrder(selectedNeed, policy.orders?.[selectedNeed]),
    [selectedNeed, policy.orders],
  );
  const setOrder = (next: FundingSource[]) =>
    onChange({ ...policy, orders: { ...policy.orders, [selectedNeed]: next } });
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };
  const reset = () =>
    onChange({
      liquidityMode: policy.liquidityMode,
      liquidityReason: policy.liquidityReason,
      liquiditySources: policy.liquiditySources,
      dedicatedFirst: true,
      allowedSources: policy.allowedSources,
    });
  const reasonRequired=sourcePolicyRequiresReason(policy);

  return (
    <section className="source-order-policy source-policy-v2">
      <header className="source-policy-hero">
        <div>
          <span><Sparkles /> سیاست آبشار منابع</span>
          <h3>اولویت تأمین مالی بر اساس نوع نیاز</h3>
          <p>ابتدا منابع مجاز این نوع نیاز را مشخص کنید؛ سپس ترتیب استفاده را بچینید. ظرفیت واقعی، سقف بدهی، نرخ مجاز و حداقل اجرای طرح همیشه کنترل می‌شوند. مجاز بودن منبع، تأیید تناسب سررسید یا صرفه اقتصادی آن نیست.</p>
        </div>
        <button className="policy-reset" onClick={reset}><RotateCcw /> بازگشت به ترتیب مصوب</button>
      </header>

      <div className="need-policy-selector" role="tablist" aria-label="انتخاب نوع نیاز مالی">
        {needs.map((need, index) => {
          const needOrder = normalizedSourceOrder(need, policy.orders?.[need]);
          return (
            <button key={need} role="tab" aria-selected={selectedNeed === need} className={selectedNeed === need ? "active" : ""} onClick={() => setSelectedNeed(need)}>
              <span>{(index + 1).toLocaleString("fa-IR")}</span>
              <div><b>{needLabel(need)}</b><small>اولویت نخست: {FUNDING_SOURCES[needOrder[0]].label}</small></div>
              <em>۵ روش</em>
            </button>
          );
        })}
      </div>

      <div className="source-policy-editor">
        <div className="source-policy-context">
          <span>نوع نیاز منتخب</span>
          <h4>{needLabel(selectedNeed)}</h4>
          <p>{NEED_INTENT[selectedNeed]}</p>
          <div className="policy-legend"><i /> اولویت بالاتر یعنی استفاده زودتر؛ منبع غیرمجاز در محاسبه مصرف نمی‌شود.</div>
        </div>
        <ol className="source-priority-list">
          {order.map((source, index) => (
            <li key={source} className={index === 0 ? "primary" : index === order.length - 1 ? "fallback" : ""}>
              <strong>{(index + 1).toLocaleString("fa-IR")}</strong>
              <div><b>{FUNDING_SOURCES[source].label}</b><small>{SOURCE_GUIDANCE[selectedNeed]?.[source]}</small></div>
              <label className="source-eligible"><input type="checkbox" aria-label={`مجاز بودن ${FUNDING_SOURCES[source].label} برای ${needLabel(selectedNeed)}`} checked={(policy.allowedSources?.[selectedNeed]??order).includes(source)} onChange={e=>{const current=policy.allowedSources?.[selectedNeed]??order;onChange({...policy,allowedSources:{...policy.allowedSources,[selectedNeed]:e.target.checked?[...current,source]:current.filter(s=>s!==source)}});}}/>مجاز</label>
              <span>{index === 0 ? "اولویت نخست" : index === order.length - 1 ? "پشتیبان نهایی" : `اولویت ${(index + 1).toLocaleString("fa-IR")}`}</span>
              <nav>
                <button disabled={index === 0} aria-label={`افزایش تقدم ${FUNDING_SOURCES[source].label}`} onClick={() => move(index, -1)}><ArrowUp /></button>
                <button disabled={index === order.length - 1} aria-label={`کاهش تقدم ${FUNDING_SOURCES[source].label}`} onClick={() => move(index, 1)}><ArrowDown /></button>
              </nav>
            </li>
          ))}
        </ol>
      </div>

      <div className="source-order-toolbar policy-options">
        <label><input type="checkbox" checked={policy.dedicatedFirst !== false} onChange={(event) => onChange({ ...policy, dedicatedFirst: event.target.checked })} /><span><Check /> منبع اختصاصی هر طرح پیش از منابع عمومی بررسی شود</span></label>
        <label className="source-policy-reason"><span>دلیل تغییر سیاست {reasonRequired&&<b>الزامی برای تصویب</b>}</span><input aria-invalid={reasonRequired&&!policy.reason?.trim()} value={policy.reason ?? ""} onChange={(event) => onChange({ ...policy, reason: event.target.value })} placeholder="مثلاً: مصوبه هیئت‌مدیره، محدودیت نقدینگی یا شرط سهامدار" /></label>
      </div>

      <div className="source-policy-impact"><h4>اثر زنده سیاست بر تأمین طرح‌ها</h4>{output.results.map((item) => { const baseline = baselineOutput.results.find((row) => row.id === item.id); const delta = item.executed - (baseline?.executed ?? 0); return <p key={item.id}><b>{item.name}</b><span>{fa(item.executed)} میلیارد تومان · {Math.abs(delta) < 0.01 ? "میزان تأمین بدون تغییر" : `${delta > 0 ? "افزایش" : "کاهش"} ${fa(Math.abs(delta))}`}</span></p>; })}</div>
      <details className="source-policy-comparison"><summary>مقایسه تخصیص با ترتیب مصوب</summary><p>هر دو محاسبه با طرح‌ها، رتبه مدیریتی، نیاز و منابع یکسان اجرا می‌شوند؛ تفاوت در ترتیب و مجاز بودن منابع است.</p><div className="table-scroll"><table><thead><tr><th>منبع</th><th>ترتیب مصوب</th><th>سیاست جاری</th></tr></thead><tbody>{Object.entries(FUNDING_SOURCES).map(([key, value]) => <tr key={key}><td>{value.label}</td><td>{fa(baselineOutput.used[key as keyof typeof baselineOutput.used])}</td><td>{fa(output.used[key as keyof typeof output.used])}</td></tr>)}</tbody></table></div><p>تأمین با ترتیب مصوب: {fa(baselineOutput.totalExecuted)} · تأمین با سیاست جاری: {fa(output.totalExecuted)} میلیارد تومان</p></details>
    </section>
  );
}
