"use client";
import {formatFinancialValue} from "@/lib/financial-display.mjs";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import MarketIndustries from "@/components/market-industries";
import ManagementNarratives from "@/components/company-narratives";
import MovementPath from "@/components/movement-path-v29";
import {
  MOVEMENT_BASELINE,
  auditCurrentPortfolio,
  baselineHorizon,
} from "@/lib/movement-model.mjs";
import { priorityScore } from "@/lib/priority-score.mjs";
import {
  applyManagementAdjustment,
  MAX_MANAGEMENT_EFFECT,
  normalizeManagementAdjustments,
} from "@/lib/management-adjustment.mjs";
import { financialScenarioScore } from "@/lib/financial-scenario.mjs";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  Compass,
  FileSearch,
  Gauge,
  Layers3,
  Landmark,
  LineChart,
  Map as MapIcon,
  Network,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  calculateOpportunityNetwork,
  calculateStrategicFit,
  FIT_MODEL_V22,
  plotPercent,
} from "@/lib/strategic-fit.mjs";

type Dimension = { score: number | null; coverage: number; label: string };
type Kpi = {
  label: string;
  value: number | null;
  previous: number | null;
  score: number | null;
  unit: string;
};
type KpiPoint = {
  year: number;
  value: number;
  score: number | null;
  unit: string;
  label: string;
};
type FinancialCompany = {
  name: string;
  scope: string;
  nature: string;
  year: number;
  rank: number | null;
  score: number | null;
  classification: string;
  coverage: number;
  dimensions: Record<string, Dimension>;
  annualScores: Record<string, number | null>;
  yearlyDimensions: Record<string, Record<string, Dimension>>;
  scatterAxes: Record<string, number | null>;
  kpis: Record<string, Kpi>;
  kpiHistory: Partial<Record<string, KpiPoint[]>>;
};
type Company = {
  name: string;
  nature: string;
  year: number;
  rank: number | null;
  score: number | null;
  classification: string;
  coverage: number;
  dimensions: Record<string, Dimension>;
  annualScores: Record<string, number | null>;
  kpis: Record<string, Kpi>;
  market: Record<string, number>;
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    sourceNote: string;
  };
};
type PortfolioItem = {
  name: string;
  assets: number | null;
  ownership: number | null;
  attributableValue: number | null;
  portfolioShare: number | null;
  nature: string;
  control: string;
  horizon: string;
};
type AdjacentKey =
  "downstream" | "financeDirect" | "mineral" | "steelSupport" | "paint";
type Opportunity = {
  id: number;
  name: string;
  ioCode: number;
  ioActivity: string;
  opportunityRaw: number;
  xPlotBaseline: number;
  coreFit: number;
  adjacentEffective: Record<AdjacentKey, number>;
  adjacentFit: number;
  adjacentDriver: string;
  financeEnablement: number;
  transformFit: number;
  yRawBaseline: number;
  yPlotBaseline: number;
  closest: string;
  closeness: number;
  secondClosest: string;
  secondCloseness: number;
  gap: number;
  synergyPair: string;
  synergy: number;
  optionalityRaw: number;
  optionality: number;
  nextPaths: string[];
  verticalTrade: number;
  verticalSteel: number;
  verticalAdjacent: number;
  leontiefTotal: number;
};
type OpportunityRelatedness = {
  model: string;
  ids: number[];
  names: string[];
  matrix: number[][];
};
type IsicRow = {
  description: string;
  isic: string;
  sectorCode: string;
  sector: string;
};
type MovementMasterRecord = {
  code: string;
  name: string;
  isicLevel: string;
  parentId: number | null;
  parentName: string | null;
  include: boolean;
  mappingConfidence: string | null;
  quality: string | null;
  readiness: string | null;
  availableIndicators: number;
  dataPeriod?: {
    start: number | null;
    end: number | null;
    latestCommonYear: number | null;
  };
  indicators: Record<string, number | null>;
};
type Sector = {
  id: number;
  name: string;
  criteria: {
    growth: number;
    valueAdded: number;
    megatrends: number;
    inflation: number;
    fxExposure: number;
  };
  baselineOpportunity: number;
};
type Manifest = {
  snapshot: string;
  sectors: number;
  companies: number;
  isicRows: number;
  strategicFitModel: string;
  strategicFitIoBaseYear: number;
};
type TodayStep = 1 | 2 | 3 | 4 | 5 | 6;
type MainPath = "home" | "today" | "growth" | "movement" | "capital";
type FinanceView = "scatter" | "ranking" | "kpi";
type GrowthView = "inputs" | "ranking" | "matrix";
type CriterionKey = keyof Sector["criteria"];
type CriterionMode =
  "distribution" | "ranking" | "comparison" | "extremes" | "intensity";
type PortfolioHorizon = "core" | "adjacent" | "transform";
type PortfolioWeights = Record<PortfolioHorizon, number>;

const TODAY_STEPS = [
  {
    id: 1 as const,
    title: "پرتفوی امروز",
    question: "چه داریم؟",
    icon: BriefcaseBusiness,
  },
  {
    id: 2 as const,
    title: "وضعیت مالی",
    question: "شرکت‌ها چگونه عمل می‌کنند؟",
    icon: Activity,
  },
  {
    id: 3 as const,
    title: "جایگاه بازار",
    question: "در چه بازاری قرار گرفته‌ایم؟",
    icon: Compass,
  },
  {
    id: 4 as const,
    title: "تشخیص راهبردی",
    question: "قوت، ضعف، فرصت و تهدید چیست؟",
    icon: Radar,
  },
  {
    id: 5 as const,
    title: "ماتریس مک‌کنزی",
    question: "هر شرکت واقعاً کجا ایستاده است؟",
    icon: MapIcon,
  },
  {
    id: 6 as const,
    title: "جمع‌بندی مدیریتی",
    question: "مسئله چیست و چه باید کرد؟",
    icon: Sparkles,
  },
];

const MATRIX = {
  1: {
    title: "سرمایه‌گذاری و رشد",
    state: "بازار جذاب | عملکرد مالی قوی",
    body: "شرکت از منظر شرایط بازار و توان مالی در موقعیت مطلوبی قرار دارد و ظرفیت مناسبی برای توسعه و خلق ارزش بیشتر دارد.",
    action:
      "افزایش سرمایه‌گذاری، توسعه ظرفیت، افزایش سهم بازار، توسعه محصول و تخصیص منابع با اولویت بالا.",
  },
  2: {
    title: "توسعه هدفمند",
    state: "بازار جذاب | عملکرد مالی متوسط",
    body: "فرصت‌های بازار مناسب است، اما عملکرد مالی شرکت هنوز به سطح مطلوب نرسیده است. توسعه باید همزمان با تقویت بنیان‌های مالی انجام شود.",
    action:
      "سرمایه‌گذاری انتخابی، رفع گلوگاه‌های عملیاتی، بهبود سودآوری و تقویت ساختار مالی پیش از توسعه گسترده.",
  },
  3: {
    title: "بازسازی برای رشد",
    state: "بازار جذاب | عملکرد مالی ضعیف",
    body: "شرکت در بازاری با ظرفیت رشد مناسب فعالیت می‌کند، اما ضعف مالی مانع بهره‌برداری کامل از فرصت‌های موجود شده است.",
    action:
      "اجرای برنامه بازسازی، اصلاح سرمایه در گردش، کاهش هزینه‌ها، ارتقای بهره‌وری و مشروط‌کردن سرمایه‌گذاری جدید به تحقق برنامه اصلاحی.",
  },
  4: {
    title: "رشد گزینشی",
    state: "بازار متوسط | عملکرد مالی قوی",
    body: "شرکت از توان مالی مناسبی برخوردار است، اما ظرفیت رشد بازار محدودتر است. توسعه باید صرفاً در حوزه‌های دارای بازده جذاب انجام شود.",
    action:
      "حفظ موقعیت رقابتی، سرمایه‌گذاری گزینشی، تمرکز بر پروژه‌های با بازده بالا و استفاده بهینه از جریان نقد.",
  },
  5: {
    title: "حفظ و بهبود",
    state: "بازار متوسط | عملکرد مالی متوسط",
    body: "شرکت در موقعیتی متعادل قرار دارد و در شرایط فعلی نیازمند توسعه تهاجمی یا کاهش جدی سرمایه‌گذاری نیست.",
    action:
      "حفظ موقعیت، بهبود تدریجی حاشیه سود و بازده سرمایه، ارتقای بهره‌وری و پایش مستمر عملکرد.",
  },
  6: {
    title: "اصلاح و بازآرایی",
    state: "بازار متوسط | عملکرد مالی ضعیف",
    body: "ظرفیت بازار محدود به متوسط است و عملکرد مالی شرکت نیز نیازمند اصلاح است. تخصیص منابع جدید باید با احتیاط انجام شود.",
    action:
      "اجرای برنامه اصلاحی زمان‌دار، کاهش سرمایه درگیر، کنترل هزینه‌ها، تعیین اهداف عملکردی و بازنگری در ادامه حضور در صورت عدم بهبود.",
  },
  7: {
    title: "حفظ سودآور",
    state: "بازار کم‌جذاب | عملکرد مالی قوی",
    body: "شرکت علی‌رغم حضور در بازاری با چشم‌انداز محدود، همچنان از عملکرد مالی مطلوبی برخوردار است و می‌تواند منبع مناسبی برای ایجاد جریان نقد باشد.",
    action:
      "حفظ عملیات سودآور، محدودکردن سرمایه‌گذاری توسعه‌ای، افزایش بهره‌وری و استفاده از جریان نقد برای فرصت‌های جذاب‌تر.",
  },
  8: {
    title: "برداشت و کنترل سرمایه",
    state: "بازار کم‌جذاب | عملکرد مالی متوسط",
    body: "ظرفیت رشد بازار پایین است و عملکرد مالی نیز مزیت قابل‌توجهی ایجاد نمی‌کند. اولویت، حفاظت از سرمایه و کاهش منابع درگیر است.",
    action:
      "محدودسازی CAPEX، کاهش سرمایه در گردش، آزادسازی منابع، فروش دارایی‌های غیرمولد و تمرکز بر تولید جریان نقد.",
  },
  9: {
    title: "خروج یا بازنگری بنیادی",
    state: "بازار کم‌جذاب | عملکرد مالی ضعیف",
    body: "شرکت همزمان با ضعف عملکرد مالی، در بازاری با چشم‌انداز نامناسب قرار دارد و ادامه تخصیص منابع نیازمند توجیه استراتژیک مشخص است.",
    action:
      "بررسی واگذاری، ادغام، کوچک‌سازی، توقف فعالیت‌های کم‌بازده یا اجرای بازسازی بنیادی در صورت وجود ضرورت استراتژیک.",
  },
} as Record<
  number,
  { title: string; state: string; body: string; action: string }
>;

const FINANCE_LENSES = [
  { key: "score", label: "امتیاز کل" },
  { key: "profitability", label: "سودمحور" },
  { key: "growth", label: "رشد‌محور" },
  { key: "cashQuality", label: "نقدینگی و کیفیت سود" },
  { key: "capitalReturn", label: "ارزش‌آفرینی" },
  { key: "resilience", label: "تاب‌آوری" },
  { key: "workingCapital", label: "بهره‌وری" },
];
const RANK_METRICS = [
  {
    key: "growth",
    label: "رشد",
    long: "رشد و پویایی عملکرد",
    base: 20,
    color: "#7654cf",
  },
  {
    key: "profitability",
    label: "سودآوری",
    long: "سودآوری عملیاتی",
    base: 15,
    color: "#176cb5",
  },
  {
    key: "capitalReturn",
    label: "ارزش‌آفرینی",
    long: "ارزش‌آفرینی سرمایه",
    base: 20,
    color: "#4255b8",
  },
  {
    key: "cashQuality",
    label: "کیفیت سود",
    long: "کیفیت سود و نقدسازی",
    base: 15,
    color: "#1689a0",
  },
  {
    key: "resilience",
    label: "تاب‌آوری",
    long: "تاب‌آوری مالی و نقدینگی",
    base: 20,
    color: "#37866f",
  },
  {
    key: "workingCapital",
    label: "بهره‌وری",
    long: "بهره‌وری و سرمایه در گردش",
    base: 10,
    color: "#c98b31",
  },
];
const RANK_SCENARIOS: Record<
  string,
  { label: string; focus?: string; description: string }
> = {
  balanced: { label: "متوازن", description: "وزن‌های پایه مدل شش‌بُعدی مصوب" },
  growth: {
    label: "رشد‌محور",
    focus: "growth",
    description: "تأکید بیشتر بر رشد درآمد و سود",
  },
  profitability: {
    label: "سودآوری‌محور",
    focus: "profitability",
    description: "تأکید بیشتر بر سودآوری عملیاتی",
  },
  valueCreation: {
    label: "ارزش‌آفرینی‌محور",
    focus: "capitalReturn",
    description: "تمرکز بر فاصله بازده سرمایه از هزینه سرمایه",
  },
  cashQuality: {
    label: "نقدسازی‌محور",
    focus: "cashQuality",
    description: "تأکید بر کیفیت سود و جریان نقد آزاد",
  },
  resilience: {
    label: "تاب‌آوری‌محور",
    focus: "resilience",
    description: "تمرکز بر بدهی، پوشش هزینه مالی و نقدینگی",
  },
  efficiency: {
    label: "بهره‌وری‌محور",
    focus: "workingCapital",
    description: "تأکید بر گردش دارایی و چرخه تبدیل نقد",
  },
};
const SCATTER_DEFS = [
  {
    phase: "فاز ۱",
    title: "رشد عملیاتی در برابر سودآوری عملیاتی",
    x: "scatterOperationalGrowth",
    y: "scatterOperatingProfitability",
    xLabel: "رشد عملیاتی",
    yLabel: "سودآوری عملیاتی",
    action:
      "کیفیت رشد، ترکیب فروش، بهای تمام‌شده و مقیاس‌پذیری عملیات پایش شود.",
  },
  {
    phase: "فاز ۲",
    title: "بهره‌وری منابع در برابر ارزش‌آفرینی سرمایه",
    x: "scatterResourceProductivity",
    y: "scatterCapitalValueCreation",
    xLabel: "بهره‌وری منابع",
    yLabel: "ارزش‌آفرینی سرمایه",
    action: "ROCE، اسپرد ROIC−WACC و دارایی‌های کم‌بازده بازبینی شوند.",
  },
  {
    phase: "فاز ۳",
    title: "توان نقدینگی در برابر سلامت ساختار مالی",
    x: "scatterLiquidityStrength",
    y: "scatterFinancialStructure",
    xLabel: "توان نقدینگی",
    yLabel: "سلامت ساختار مالی",
    action:
      "اهرم مالی، سررسید بدهی، پوشش بهره و برنامه سرمایه در گردش کنترل شوند.",
  },
  {
    phase: "فاز ۴",
    title: "کیفیت سود در برابر قدرت تولید جریان نقد آزاد",
    x: "scatterEarningsQuality",
    y: "scatterFcfGeneration",
    xLabel: "کیفیت سود",
    yLabel: "تولید جریان نقد آزاد",
    action: "تبدیل EBITDA به وجه نقد، مخارج سرمایه‌ای و چرخه نقد بررسی شوند.",
  },
];
const GROWTH_CRITERIA: {
  key: CriterionKey;
  label: string;
  short: string;
  color: string;
  benefit: boolean;
  description: string;
}[] = [
  {
    key: "growth",
    label: "رشد ارزش افزوده",
    short: "رشد",
    color: "#176cb5",
    benefit: true,
    description: "نرخ رشد واقعی ارزش افزوده بخش",
  },
  {
    key: "valueAdded",
    label: "حجم ارزش افزوده",
    short: "حجم",
    color: "#39866e",
    benefit: true,
    description: "اندازه ارزش افزوده ایجادشده در اقتصاد",
  },
  {
    key: "megatrends",
    label: "اثر مگاترندها",
    short: "مگاترند",
    color: "#7654a7",
    benefit: true,
    description: "شدت اثر روندهای کلان آینده بر بخش",
  },
  {
    key: "inflation",
    label: "اثر تورم",
    short: "تورم",
    color: "#d09a43",
    benefit: false,
    description: "آسیب‌پذیری بخش در برابر فشارهای تورمی",
  },
  {
    key: "fxExposure",
    label: "اثر نرخ ارز",
    short: "ارز",
    color: "#bd6658",
    benefit: false,
    description: "میزان مواجهه بخش با نوسان نرخ ارز",
  },
];
const CRITERION_MODES: { key: CriterionMode; label: string }[] = [
  { key: "distribution", label: "توزیع" },
  { key: "ranking", label: "رتبه‌بندی" },
  { key: "comparison", label: "مقایسه بخش‌ها" },
  { key: "extremes", label: "برتر و ضعیف‌تر" },
  { key: "intensity", label: "شدت اثر" },
];
const NATURE_COLORS = [
  "#0d5ca8",
  "#d09a43",
  "#4c8c7c",
  "#7959a9",
  "#bd6658",
  "#427b9d",
];
const fa = (v: number | null | undefined, d = 1) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("fa-IR", {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      });
const faInt = (v: number) =>
  v.toLocaleString("fa-IR", { maximumFractionDigits: 0 });
const pct = (v: number | null | undefined, d = 0) =>
  v == null ? "—" : `${fa(v * 100, d)}٪`;
const normalize = (v: string) =>
  v
    .replaceAll("ي", "ی")
    .replaceAll("ك", "ک")
    .replaceAll("‌", " ")
    .replace(/\s+/g, " ")
    .trim();

const compact = formatFinancialValue;
function scoreOf(c: FinancialCompany | Company, lens: string) {
  return financialScenarioScore(c, lens);
}
function matrixCell(financial: number, market: number) {
  const mb = market >= 6.67 ? 0 : market >= 3.34 ? 1 : 2;
  const fb = financial >= 6.67 ? 0 : financial >= 3.34 ? 1 : 2;
  return mb * 3 + fb + 1;
}
type DonutSegment = { label: string; value: number; color: string };
function SegmentedDonut({
  title,
  note,
  segments,
  centerLabel,
}: {
  title: string;
  note: string;
  segments: DonutSegment[];
  centerLabel?: string;
}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0) || 1;
  const gradient = segments
    .map((item, index) => {
      const start =
        (segments
          .slice(0, index)
          .reduce((sum, segment) => sum + segment.value, 0) /
          total) *
        100;
      const end = start + (item.value / total) * 100;
      return `${item.color} ${start}% ${end}%`;
    })
    .join(",");
  const lead = [...segments].sort((a, b) => b.value - a.value)[0];
  return (
    <article className="composition-card">
      <div className="composition-head">
        <span>{title}</span>
        <small>{note}</small>
      </div>
      <div className="composition-body">
        <div
          className="segmented-donut"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div>
            <strong>{centerLabel ?? pct(lead.value / total, 1)}</strong>
            <small>{lead.label}</small>
          </div>
        </div>
        <div className="composition-legend">
          {segments.map((item) => (
            <div key={item.label}>
              <i style={{ background: item.color }} />
              <span>{item.label}</span>
              <b>{pct(item.value / total, 1)}</b>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function Header({
  onHome,
  onNavigate,
  path,
  manifest,
}: {
  onHome: () => void;
  onNavigate: (path: MainPath) => void;
  path: MainPath;
  manifest: Manifest;
}) {
  return (
    <header className="app-header">
      <button className="brand" onClick={onHome} aria-label="صفحه اصلی">
        <Image
          src="/atieh-logo.png"
          width="58"
          height="58"
          alt="آتیه فولاد"
          unoptimized
          priority
        />
        <span>
          <b>سامانه هوشمند خط‌مشی سرمایه‌گذاری</b>
          <small>گروه سرمایه‌گذاری آتیه فولاد نقش جهان</small>
        </span>
      </button>
      {path !== "home" && (
        <nav className="main-route-links" aria-label="مسیرهای اصلی">
          {[
            { id: "today" as const, label: "روایت امروز" },
            { id: "growth" as const, label: "پتانسیل رشد" },
            { id: "movement" as const, label: "مسیر حرکت" },
            { id: "capital" as const, label: "تخصیص سرمایه" },
          ].map((item) => (
            <button
              key={item.id}
              className={path === item.id ? "active" : ""}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
      <div className="header-context">
        <span className="live">
          <i /> داده‌های مدل فعال
        </span>
        <span>به‌روزرسانی {manifest.snapshot}</span>
        {path !== "home" && (
          <button className="ghost-button" onClick={onHome}>
            صفحه اصلی <ArrowLeft size={17} />
          </button>
        )}
      </div>
    </header>
  );
}

function Home({ onChoose }: { onChoose: (path: MainPath) => void }) {
  return (
    <main className="entry-page">
      <div className="entry-aura aura-one" />
      <div className="entry-aura aura-two" />
      <section className="entry-intro">
        <span className="overline">مرکز تصمیم‌گیری سرمایه‌گذاری</span>
        <div className="home-brand-signature">گروه سرمایه‌گذاری آتیه فولاد نقش جهان<small>واحد مدیریت سرمایه‌گذاری آتیه فولاد نقش جهان</small></div>
        <h1>
          <span className="hero-line">از شناخت واقعیت امروز</span>
          <span className="hero-line hero-gold">تا انتخاب مسیر رشد فردا</span>
        </h1>
        <p>
          چهار مسیر پیوسته برای شناخت وضعیت، کشف فرصت، طراحی حرکت و تخصیص
          واقعی سرمایه.
        </p>
      </section>
      <section className="path-grid">
        <button
          className="path-card path-today"
          onClick={() => onChoose("today")}
        >
          <span className="path-number">۰۱</span>
          <div className="path-icon">
            <Activity />
          </div>
          <div>
            <small>مسیر شناخت</small>
            <h2>روایت امروز</h2>
            <p>پرتفوی، عملکرد مالی، بازار، تحلیل راهبردی و جمع‌بندی مدیریتی</p>
          </div>
          <span className="path-action">
            ورود به روایت امروز <ArrowLeft />
          </span>
        </button>
        <button
          className="path-card path-growth"
          onClick={() => onChoose("growth")}
        >
          <span className="path-number">۰۲</span>
          <div className="path-icon">
            <TrendingUp />
          </div>
          <div>
            <small>مسیر آینده</small>
            <h2>شناسایی پتانسیل‌های رشد</h2>
            <p>رتبه‌بندی ۷۷ فرصت، سنجش تناسب راهبردی و جست‌وجوی فعالیت‌ها</p>
          </div>
          <span className="path-action">
            ورود به موتور رشد <ArrowLeft />
          </span>
        </button>
        <button
          className="path-card path-movement"
          onClick={() => onChoose("movement")}
        >
          <span className="path-number">۰۳</span>
          <div className="path-icon">
            <Compass />
          </div>
          <div>
            <small>گذار به آینده</small>
            <h2>مسیر حرکت</h2>
            <p>
              جهت‌گیری پرتفوی، ارزیابی تفصیلی و برنامه‌ریزی ورود فرصت‌ها
            </p>
          </div>
          <span className="path-action">
            ورود به مسیر حرکت <ArrowLeft />
          </span>
        </button>
        <button
          className="path-card path-capital"
          onClick={() => onChoose("capital")}
        >
          <span className="path-number">۰۴</span>
          <div className="path-icon">
            <Landmark />
          </div>
          <div>
            <small>تبدیل سیاست به اجرا</small>
            <h2>تخصیص سرمایه</h2>
            <p>
              ظرفیت مالی، منابع قابل اتکا، پرونده‌های اجرایی و خروجی مدیریتی
            </p>
          </div>
          <span className="path-action">
            ورود به تخصیص سرمایه <ArrowLeft />
          </span>
        </button>
      </section>
      <div className="entry-foot">
        <span>شناخت</span>
        <i />
        <span>فرصت</span>
        <i />
        <span>حرکت</span>
        <i />
        <span>تخصیص</span>
      </div>
    </main>
  );
}

function TodayIntro({ onStep }: { onStep: (step: TodayStep) => void }) {
  return (
    <section className="today-intro">
      <div className="page-lead">
        <span className="overline">مسیر شش‌گانه شناخت</span>
        <h1>روایت امروز</h1>
        <p>
          هر تصمیم درست از یک روایت منسجم آغاز می‌شود. این مسیر، واقعیت پرتفوی
          را در شش ایستگاه از «چه داریم؟» تا «چه باید کرد؟» روشن می‌کند.
        </p>
      </div>
      <div className="journey-line journey-line-premium">
        <svg className="today-journey-connect" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="todayPath"><stop stopColor="#be964b"/><stop offset="1" stopColor="#157d88"/></linearGradient></defs><path d="M850 135 H160 V300 H850 V465 H160" fill="none" stroke="url(#todayPath)" strokeWidth="2"/><path d="M850 135 H160 V300 H850 V465 H160" fill="none" stroke="#d4ad65" strokeWidth="4" strokeDasharray="5 1000" className="today-path-signal"/></svg>
        {TODAY_STEPS.map(({ id, title, question, icon: Icon }, index) => (
          <button
            key={id}
            className="journey-node"
            onClick={() => onStep(id)}
            style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}
          >
            <span className="journey-index">۰{id.toLocaleString("fa-IR")}</span>
            <span className="journey-icon">
              <Icon />
            </span>
            <span>
              <b>{title}</b>
              <small>{question}</small>
            </span>
            <ChevronLeft className="node-arrow" />
          </button>
        ))}
      </div>
    </section>
  );
}
function StepNav({
  active,
  onChange,
}: {
  active: TodayStep;
  onChange: (step: TodayStep) => void;
}) {
  return (
    <aside className="step-nav">
      <div className="step-nav-title">
        <span>روایت امروز</span>
        <small>۶ ایستگاه تصمیم</small>
      </div>
      <div className="step-list">
        {TODAY_STEPS.map(({ id, title, icon: Icon }) => (
          <button
            key={id}
            className={active === id ? "active" : ""}
            onClick={() => onChange(id)}
          >
            <span>۰{id.toLocaleString("fa-IR")}</span>
            <Icon />
            <b>{title}</b>
          </button>
        ))}
      </div>
    </aside>
  );
}
function StepFrame({
  step,
  onStep,
  children,
}: {
  step: TodayStep;
  onStep: (s: TodayStep) => void;
  children: React.ReactNode;
}) {
  const info = TODAY_STEPS[step - 1];
  return (
    <div className="step-shell">
      <StepNav active={step} onChange={onStep} />
      <main className="step-content">
        <div className="step-heading">
          <div>
            <span className="overline">
              ایستگاه ۰{step.toLocaleString("fa-IR")}
            </span>
            <h1>{info.title}</h1>
            <p>{info.question}</p>
          </div>
          <div className="step-controls">
            <button
              disabled={step === 1}
              onClick={() => onStep((step - 1) as TodayStep)}
            >
              <ChevronRight /> قبلی
            </button>
            <button
              disabled={step === 6}
              onClick={() => onStep((step + 1) as TodayStep)}
            >
              بعدی <ChevronLeft />
            </button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

function PortfolioView({ portfolio }: { portfolio: PortfolioItem[] }) {
  const total = portfolio.reduce((s, i) => s + (i.attributableValue ?? 0), 0);
  const natureLabel = (nature: string) =>
    /بازرگانی/.test(nature)
      ? "خدمات بازرگانی"
      : /پایین.?دستی|زنجیره فولاد/.test(nature)
        ? "زنجیره پایین‌دستی فولاد"
        : nature;
  const aggregate = (labeler: (item: PortfolioItem) => string) =>
    Object.entries(
      portfolio.reduce(
        (map, item) => {
          const key = labeler(item);
          map[key] = (map[key] ?? 0) + (item.portfolioShare ?? 0);
          return map;
        },
        {} as Record<string, number>,
      ),
    ).sort((a, b) => b[1] - a[1]);
  const natureEntries = aggregate((item) => natureLabel(item.nature));
  const controlEntries = aggregate((item) => item.control);
  const horizonEntries = aggregate((item) =>
    item.horizon === "هسته" ? "هسته اصلی؛ خدمات بازرگانی" : "کسب‌وکارهای مجاور",
  );
  const natureColors = [
    "#075cab",
    "#d4a14d",
    "#39866e",
    "#7654a7",
    "#bf6559",
    "#3487a0",
  ];
  return (
    <div className="content-stack">
      <section className="summary-strip">
        <div>
          <small>ارزش منتسب پرتفوی</small>
          <strong>{fa(total / 1_000_000, 1)} همت</strong>
        </div>
        <div>
          <small>تعداد شرکت</small>
          <strong>{faInt(portfolio.length)}</strong>
        </div>
        <div>
          <small>سهم هسته اصلی</small>
          <strong>
            {pct(horizonEntries.find(([k]) => k.startsWith("هسته"))?.[1], 1)}
          </strong>
        </div>
        <div>
          <small>افق تحولی</small>
          <strong>نداریم</strong>
        </div>
      </section>
      <section className="panel portfolio-lenses">
        <div className="section-title">
          <span>
            <Layers3 />
          </span>
          <div>
            <h2>ترکیب واقعی ارزش دارایی پرتفوی</h2>
            <p>
              هر نمودار بر اساس ستون «سهم از پرتفوی» فایل درصد سهامداری محاسبه
              شده است
            </p>
          </div>
        </div>
        <div className="composition-grid">
          <SegmentedDonut
            title="ترکیب بر مبنای ماهیت"
            note="سهم هر حوزه از ارزش منتسب"
            segments={natureEntries.map(([label, value], i) => ({
              label,
              value,
              color: natureColors[i % natureColors.length],
            }))}
          />
          <SegmentedDonut
            title="ساختار کنترل"
            note="کنترلی در برابر غیرکنترلی"
            segments={controlEntries.map(([label, value], i) => ({
              label,
              value,
              color: i === 0 ? "#39866e" : "#a9bbc3",
            }))}
          />
          <SegmentedDonut
            title="هسته و مجاور"
            note="تعریف راهبردی پرتفوی موجود"
            segments={horizonEntries.map(([label, value], i) => ({
              label,
              value,
              color: i === 0 ? "#d4a14d" : "#215f88",
            }))}
          />
        </div>
        <div className="core-declaration">
          <span>
            <Target />
          </span>
          <div>
            <strong>هسته اصلی پرتفوی: خدمات بازرگانی</strong>
            <p>
              تمام ماهیت‌های دیگر در حلقه کسب‌وکارهای مجاور قرار می‌گیرند؛ در
              وضعیت فعلی، پرتفوی کسب‌وکار تحولی تعریف نشده است.
            </p>
          </div>
        </div>
      </section>
      <section className="panel ownership-panel">
        <div className="section-title">
          <span>
            <BriefcaseBusiness />
          </span>
          <div>
            <h2>درصد سهامداری گروه در شرکت‌ها</h2>
            <p>سهم مالکیت، وزن هر شرکت در پرتفوی و جایگاه راهبردی آن</p>
          </div>
        </div>
        <div className="ownership-table-wrap">
          <table>
            <thead>
              <tr>
                <th>شرکت</th>
                <th>درصد سهامداری گروه</th>
                <th>سهم از پرتفوی</th>
                <th>ماهیت</th>
                <th>وضعیت</th>
                <th>جایگاه</th>
              </tr>
            </thead>
            <tbody>
              {[...portfolio]
                .sort(
                  (a, b) => (b.portfolioShare ?? 0) - (a.portfolioShare ?? 0),
                )
                .map((item) => (
                  <tr key={item.name}>
                    <td>
                      <b>{item.name}</b>
                    </td>
                    <td>
                      <span className="ownership-value">
                        {item.ownership == null
                          ? "—"
                          : `${fa(item.ownership * 100, 2)}٪`}
                      </span>
                    </td>
                    <td>
                      <div className="portfolio-share-cell">
                        <b>{pct(item.portfolioShare, 1)}</b>
                        <i>
                          <span
                            style={{
                              width: `${(item.portfolioShare ?? 0) * 100}%`,
                            }}
                          />
                        </i>
                      </div>
                    </td>
                    <td>{natureLabel(item.nature)}</td>
                    <td>
                      <span
                        className={`status-pill ${item.control === "کنترلی" ? "controlled" : ""}`}
                      >
                        {item.control}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`horizon-pill ${item.horizon === "هسته" ? "core" : ""}`}
                      >
                        {item.horizon}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ScatterChart({
  rows,
  selected,
  onSelect,
  definition,
}: {
  rows: FinancialCompany[];
  selected?: string;
  onSelect: (name: string) => void;
  definition: (typeof SCATTER_DEFS)[number];
}) {
  return (
    <article className="scatter-card">
      <header>
        <span>{definition.phase}</span>
        <div>
          <h3>{definition.title}</h3>
          <small>امتیازهای استانداردشده صفر تا ده</small>
        </div>
      </header>
      <div className="scatter-wrap compact-scatter">
        <div className="axis-label y-label">{definition.yLabel}</div>
        <div className="scatter-plot">
          <div className="scatter-grid" />
          {rows.map((c, index) => {
            const x = c.scatterAxes?.[definition.x],
              y = c.scatterAxes?.[definition.y];
            if (x == null || y == null) return null;
            return (
              <button
                aria-label={c.name}
                key={c.name}
                className={`scatter-point ${selected === c.name ? "selected" : ""}`}
                style={
                  {
                    left: `${x * 10}%`,
                    bottom: `${y * 10}%`,
                    "--point": NATURE_COLORS[index % NATURE_COLORS.length],
                  } as React.CSSProperties
                }
                onClick={() => onSelect(c.name)}
              >
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
        <div className="axis-label x-label">{definition.xLabel}</div>
      </div>
    </article>
  );
}
function policyBand(value: number | null | undefined) {
  return value == null
    ? "فاقد داده"
    : value >= 6.66
      ? "قوی"
      : value >= 3.33
        ? "متوسط"
        : "ضعیف";
}
function scoreWithWeights(
  c: FinancialCompany,
  weights: Record<string, number>,
) {
  const valid = RANK_METRICS.filter((m) => c.dimensions[m.key]?.score != null);
  const total = valid.reduce((s, m) => s + weights[m.key], 0);
  return total
    ? valid.reduce(
        (s, m) =>
          s + ((c.dimensions[m.key].score ?? 0) * weights[m.key]) / total,
        0,
      )
    : null;
}
function redistribute(
  weights: Record<string, number>,
  key: string,
  next: number,
) {
  const bounded = Math.max(5, Math.min(40, next));
  const others = RANK_METRICS.map((m) => m.key).filter((k) => k !== key);
  const otherTotal = others.reduce((s, k) => s + weights[k], 0) || 1;
  const remaining = 100 - bounded;
  return Object.fromEntries([
    [key, bounded],
    ...others.map((k) => [k, (weights[k] / otherTotal) * remaining]),
  ]);
}
function FinancialRadar({ company }: { company: FinancialCompany }) {
  const entries = RANK_METRICS.map((metric) => ({
    label: metric.label,
    value: company.dimensions[metric.key]?.score ?? 0,
  }));
  const center = 150,
    radius = 104;
  const point = (value: number, index: number, extra = 0) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / entries.length,
      r = ((radius + extra) * value) / 10;
    return `${center + Math.cos(angle) * r},${center + Math.sin(angle) * r}`;
  };
  return (
    <div className="financial-radar">
      <svg
        viewBox="0 0 300 300"
        role="img"
        aria-label={`پروفایل شش بعدی ${company.name}`}
      >
        {[2.5, 5, 7.5, 10].map((level) => (
          <polygon
            key={level}
            points={entries.map((_, i) => point(level, i)).join(" ")}
          />
        ))}
        {entries.map((_, i) => {
          const [x, y] = point(10, i).split(",");
          return <line key={i} x1={center} y1={center} x2={x} y2={y} />;
        })}
        <polygon
          className="financial-radar-area"
          points={entries.map((entry, i) => point(entry.value, i)).join(" ")}
        />
        {entries.map((entry, i) => {
          const [x, y] = point(10, i, 24).split(",");
          const [cx, cy] = point(entry.value, i).split(",");
          return (
            <g key={entry.label}>
              <circle cx={cx} cy={cy} r="4" />
              <text x={x} y={y} textAnchor="middle">
                {entry.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
function KpiHistoryChart({
  company,
  code,
}: {
  company: FinancialCompany;
  code: string;
}) {
  const points = company.kpiHistory?.[code] ?? [];
  const max = Math.max(...points.map((p) => Math.abs(p.value)), 1);
  const current = points.at(-1),
    previous = points.at(-2);
  const delta =
    current && previous && previous.value !== 0
      ? (current.value - previous.value) / Math.abs(previous.value)
      : null;
  return (
    <section className="panel history-card">
      <header>
        <div>
          <span>روند مقدار واقعی</span>
          <h2>{current?.label ?? company.kpis[code]?.label}</h2>
          <p>{company.name} · مقادیر واقعی و بدون تبدیل به امتیاز</p>
        </div>
        <div
          className={`history-delta ${delta != null && delta < 0 ? "down" : "up"}`}
        >
          <small>تغییر آخرین دوره</small>
          <strong>
            {delta == null ? "—" : `${delta >= 0 ? "+" : ""}${pct(delta, 1)}`}
          </strong>
        </div>
      </header>
      <div className="history-bars">
        {points.map((point, index) => {
          const prev = points[index - 1];
          const change =
            prev && prev.value !== 0
              ? (point.value - prev.value) / Math.abs(prev.value)
              : null;
          return (
            <div className="history-column" key={point.year}>
              <span className="bar-value">
                {compact(point.value, point.unit)}
              </span>
              <div className="bar-stage">
                <i
                  className={point.value < 0 ? "negative" : ""}
                  style={{
                    height: `${Math.max(7, (Math.abs(point.value) / max) * 100)}%`,
                  }}
                />
              </div>
              <b>
                {point.year.toLocaleString("fa-IR", { useGrouping: false })}
              </b>
              <small className={change != null && change < 0 ? "down" : "up"}>
                {change == null
                  ? "دوره پایه"
                  : `${change >= 0 ? "▲" : "▼"} ${pct(Math.abs(change), 0)}`}
              </small>
            </div>
          );
        })}
      </div>
      <footer>
        واحد ثبت‌شده در پایگاه داده: {current?.unit || "واحد ثبت نشده"} · عدد روی هر ستون مقدار واقعی همان دوره است
      </footer>
    </section>
  );
}
function FinancialView({
  financialCompanies,
}: {
  financialCompanies: FinancialCompany[];
}) {
  const [scope, setScope] = useState("گروه آتیه"),
    [view, setView] = useState<FinanceView>("scatter");
  const scoped = useMemo(
    () => financialCompanies.filter((c) => c.scope === scope),
    [financialCompanies, scope],
  );
  const [selectedName, setSelectedName] = useState(
    financialCompanies.find((c) => c.scope === "گروه آتیه")?.name ?? "",
  );
  const selected = scoped.find((c) => c.name === selectedName) ?? scoped[0];
  const [kpiCode, setKpiCode] = useState("111");
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(RANK_METRICS.map((m) => [m.key, m.base])),
  );
  const [scenario, setScenario] = useState("balanced");
  const ranking = useMemo(
    () =>
      scoped
        .map((c) => ({ ...c, dynamicScore: scoreWithWeights(c, weights) }))
        .sort((a, b) => (b.dynamicScore ?? -1) - (a.dynamicScore ?? -1)),
    [scoped, weights],
  );
  const availableKpiCodes = selected
    ? Object.keys(selected.kpiHistory ?? {})
        .filter((code) => selected.kpiHistory?.[code]?.length)
        .sort((a, b) => (Number(a) || 9999) - (Number(b) || 9999))
    : [];
  const applyScenario = (key: string) => {
    const config = RANK_SCENARIOS[key];
    let next = Object.fromEntries(RANK_METRICS.map((m) => [m.key, m.base]));
    if (config.focus) next = redistribute(next, config.focus, 35);
    if (key === "efficiency") next = redistribute(next, "profitability", 10);
    setWeights(next);
    setScenario(key);
  };
  return (
    <div className="content-stack">
      <div className="workspace-toolbar">
        <div className="segmented">
          {["گروه آتیه", "گروه متیل"].map((item) => (
            <button
              key={item}
              className={scope === item ? "active" : ""}
              onClick={() => {
                setScope(item);
                setSelectedName(
                  financialCompanies.find((c) => c.scope === item)?.name ?? "",
                );
              }}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="view-tabs">
          {(
            [
              { id: "scatter", label: "دیده‌بان مالی", icon: LineChart },
              { id: "ranking", label: "رتبه‌نمای عملکرد", icon: BarChart3 },
              { id: "kpi", label: "روند واقعی عملکرد", icon: Gauge },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "scatter" && (
        <>
          <section className="scatter-dashboard">
            <div className="section-title scatter-title">
              <span>
                <LineChart />
              </span>
              <div>
                <h2>دیده‌بان مالی؛ چهار منظر عملکرد</h2>
                <p>
                  همان منطق مصوب نرم‌افزار مالی برای {scope}؛ انتخاب هر نقطه،
                  سیاست شرکت را به‌روزرسانی می‌کند
                </p>
              </div>
            </div>
            <div className="scatter-grid-cards">
              {SCATTER_DEFS.map((def) => (
                <ScatterChart
                  key={def.phase}
                  rows={scoped}
                  selected={selected?.name}
                  onSelect={setSelectedName}
                  definition={def}
                />
              ))}
            </div>
          </section>
          {selected && (
            <section className="panel policy-board">
              <header>
                <div>
                  <span className="overline">سیاست‌گذاری زیر نمودارها</span>
                  <h2>تشخیص چهارگانه {selected.name}</h2>
                </div>
                <strong>
                  {fa(selected.score)}
                  <small>امتیاز کل</small>
                </strong>
              </header>
              <div className="policy-grid">
                {SCATTER_DEFS.map((def) => {
                  const x = selected.scatterAxes?.[def.x],
                    y = selected.scatterAxes?.[def.y];
                  return (
                    <article key={def.phase}>
                      <span>{def.phase}</span>
                      <h3>{def.title}</h3>
                      <div>
                        <b>
                          {def.xLabel}: {policyBand(x)}
                        </b>
                        <b>
                          {def.yLabel}: {policyBand(y)}
                        </b>
                      </div>
                      <p>{def.action}</p>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
      {view === "ranking" && (
        <>
          <section className="panel weight-engine">
            <header>
              <div>
                <span className="overline">موتور سناریوسازی</span>
                <h2>وزن‌دهی زنده رتبه‌نمای عملکرد</h2>
                <p>
                  تغییر وزن‌ها فوراً امتیاز و رتبه را بازآرایی می‌کند؛ ماتریس
                  مک‌کنزی عمداً از این نما حذف شده است.
                </p>
              </div>
              <button onClick={() => applyScenario("balanced")}>
                بازگشت به وزن پایه
              </button>
            </header>
            <div className="scenario-pills">
              {Object.entries(RANK_SCENARIOS).map(([key, item]) => (
                <button
                  key={key}
                  className={scenario === key ? "active" : ""}
                  onClick={() => applyScenario(key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="weight-grid">
              <div className="weight-sliders">
                {RANK_METRICS.map((metric) => (
                  <label
                    key={metric.key}
                    style={{ "--metric": metric.color } as React.CSSProperties}
                  >
                    <span>
                      <i />
                      <b>{metric.long}</b>
                      <strong>{fa(weights[metric.key], 0)}٪</strong>
                    </span>
                    <input
                      type="range"
                      min="5"
                      max="40"
                      value={Math.round(weights[metric.key])}
                      onChange={(e) => {
                        setWeights(
                          redistribute(
                            weights,
                            metric.key,
                            Number(e.target.value),
                          ),
                        );
                        setScenario("custom");
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="weight-summary">
                <div
                  className="weight-donut-new"
                  style={{
                    background: `conic-gradient(${RANK_METRICS.map((m, i) => {
                      const start = RANK_METRICS.slice(0, i).reduce(
                        (s, x) => s + weights[x.key],
                        0,
                      );
                      return `${m.color} ${start}% ${start + weights[m.key]}%`;
                    }).join(",")})`,
                  }}
                >
                  <span>
                    <b>
                      {fa(
                        Object.values(weights).reduce((s, v) => s + v, 0),
                        0,
                      )}
                      ٪
                    </b>
                    <small>جمع وزن فعال</small>
                  </span>
                </div>
                <p>
                  {RANK_SCENARIOS[scenario]?.description ??
                    "ترکیب سفارشی وزن‌ها"}
                </p>
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="section-title">
              <span>
                <BarChart3 />
              </span>
              <div>
                <h2>رتبه‌بندی پویای شرکت‌ها</h2>
                <p>
                  امتیاز شش‌بُعدی با وزن‌های فعال و بازتوزیع وزن داده‌های موجود
                </p>
              </div>
            </div>
            <div className="ranking-list">
              {ranking.map((c, index) => (
                <button
                  key={c.name}
                  className={
                    selected?.name === c.name ? "selected-ranking" : ""
                  }
                  onClick={() => setSelectedName(c.name)}
                >
                  <span className="rank-no">
                    {(index + 1).toLocaleString("fa-IR")}
                  </span>
                  <div>
                    <b>{c.name}</b>
                    <small>
                      {c.classification} · پوشش داده {pct(c.coverage)}
                    </small>
                  </div>
                  <span className="rank-track">
                    <i style={{ width: `${(c.dynamicScore ?? 0) * 10}%` }} />
                  </span>
                  <strong>{fa(c.dynamicScore)}</strong>
                </button>
              ))}
            </div>
          </section>
          {selected && (
            <section className="ranking-analysis-grid">
              <article className="panel financial-radar-card">
                <div className="section-title">
                  <span>
                    <Radar />
                  </span>
                  <div>
                    <h2>پروفایل شش‌بُعدی شرکت منتخب</h2>
                    <p>{selected.name}</p>
                  </div>
                </div>
                <FinancialRadar company={selected} />
                <div className="dimension-detail-list">
                  {RANK_METRICS.map((metric) => (
                    <div key={metric.key}>
                      <i style={{ background: metric.color }} />
                      <span>{metric.long}</span>
                      <b>{fa(selected.dimensions[metric.key]?.score)}</b>
                    </div>
                  ))}
                </div>
              </article>
              <article className="panel dimension-table-card">
                <div className="section-title">
                  <span>
                    <Layers3 />
                  </span>
                  <div>
                    <h2>جدول کامل امتیاز ابعاد</h2>
                    <p>مقایسه بخش‌به‌بخش تمام شرکت‌های {scope}</p>
                  </div>
                </div>
                <div className="dimension-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>رتبه</th>
                        <th>شرکت</th>
                        {RANK_METRICS.map((metric) => (
                          <th key={metric.key}>{metric.label}</th>
                        ))}
                        <th>امتیاز فعال</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((company, index) => (
                        <tr
                          key={company.name}
                          className={
                            company.name === selected.name ? "active" : ""
                          }
                          onClick={() => setSelectedName(company.name)}
                        >
                          <td>{(index + 1).toLocaleString("fa-IR")}</td>
                          <td>
                            <b>{company.name}</b>
                          </td>
                          {RANK_METRICS.map((metric) => (
                            <td key={metric.key}>
                              <span
                                className={`dimension-score ${policyBand(company.dimensions[metric.key]?.score)}`}
                              >
                                {fa(company.dimensions[metric.key]?.score)}
                              </span>
                            </td>
                          ))}
                          <td>
                            <strong>{fa(company.dynamicScore)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          )}
        </>
      )}
      {view === "kpi" && selected && (
        <>
          <section className="panel kpi-controls enhanced">
            <div className="selector-field">
              <label>شرکت</label>
              <select
                value={selected.name}
                onChange={(e) => {
                  setSelectedName(e.target.value);
                  const c = scoped.find((x) => x.name === e.target.value);
                  if (c && !c.kpiHistory?.[kpiCode])
                    setKpiCode(Object.keys(c.kpiHistory ?? {})[0] ?? "111");
                }}
              >
                {scoped.map((c) => (
                  <option key={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="selector-field kpi-selector-wide">
              <label>انتخاب شاخص از فهرست کامل</label>
              <select
                value={
                  selected.kpiHistory?.[kpiCode]
                    ? kpiCode
                    : availableKpiCodes[0]
                }
                onChange={(e) => setKpiCode(e.target.value)}
              >
                {availableKpiCodes.map((code) => (
                  <option value={code} key={code}>
                    {code} — {selected.kpiHistory?.[code]?.[0]?.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="actual-note">
              <Gauge />
              <span>
                <b>کارنامه واقعی مالی</b>
                <small>
                  {availableKpiCodes.length.toLocaleString("fa-IR")} شاخص قابل
                  انتخاب
                </small>
              </span>
            </div>
          </section>
          <KpiHistoryChart
            company={selected}
            code={
              selected.kpiHistory?.[kpiCode] ? kpiCode : availableKpiCodes[0]
            }
          />
        </>
      )}
    </div>
  );
}

function MarketPlaceholder() {
  return (
    <section className="placeholder-stage">
      <div className="placeholder-orbit">
        <Compass />
        <i />
        <i />
        <i />
      </div>
      <span className="overline">ساختار آماده اتصال داده</span>
      <h2>روایت کلان بازار در حال تدوین است</h2>
      <p>
        این ایستگاه برای نمایش اندازه و رشد بازار، نیروهای پیشران، ساختار رقابت
        و ریسک‌های کلان آماده شده است. تا ورود داده‌های معتبر، هیچ عدد یا نتیجه
        فرضی نمایش داده نمی‌شود.
      </p>
      <div className="future-grid">
        <article>
          <TrendingUp />
          <b>اندازه و مسیر رشد</b>
          <small>روند تقاضا و ظرفیت بازار</small>
        </article>
        <article>
          <Network />
          <b>ساختار رقابت</b>
          <small>بازیگران و موانع ورود</small>
        </article>
        <article>
          <ShieldCheck />
          <b>ریسک و پایداری</b>
          <small>پیشران‌ها و تهدیدهای کلان</small>
        </article>
      </div>
    </section>
  );
}
function MarketView() {
  return <MarketIndustries />;
}

function SwotView({ companies }: { companies: Company[] }) {
  const available = companies.filter(
    (c) =>
      c.swot.strengths.length +
        c.swot.weaknesses.length +
        c.swot.opportunities.length +
        c.swot.threats.length >
      0,
  );
  const [name, setName] = useState(available[0]?.name ?? "");
  const company = available.find((c) => c.name === name) ?? available[0];
  if (!company) return <MarketPlaceholder />;
  const blocks = [
    { key: "strengths", title: "قوت‌ها", letter: "S", tone: "strength" },
    { key: "weaknesses", title: "ضعف‌ها", letter: "W", tone: "weakness" },
    {
      key: "opportunities",
      title: "فرصت‌ها",
      letter: "O",
      tone: "opportunity",
    },
    { key: "threats", title: "تهدیدها", letter: "T", tone: "threat" },
  ] as const;
  return (
    <div className="content-stack">
      <section className="panel company-picker">
        <label>شرکت مورد بررسی</label>
        <select value={company.name} onChange={(e) => setName(e.target.value)}>
          {available.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </select>
        <span>{company.swot.sourceNote}</span>
      </section>
      <section className="swot-grid">
        {blocks.map((block) => (
          <article key={block.key} className={`swot-card ${block.tone}`}>
            <div className="swot-head">
              <span>{block.letter}</span>
              <div>
                <h2>{block.title}</h2>
                <small>{company.name}</small>
              </div>
            </div>
            <ol>
              {company.swot[block.key].map((item, index) => (
                <li key={`${block.key}-${index}`}>
                  <span>{(index + 1).toLocaleString("fa-IR")}</span>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </section>
    </div>
  );
}

function RadarChart({ company }: { company: Company }) {
  const entries = Object.entries(company.market).filter(
    ([key]) => key !== "کل",
  );
  if (!entries.length)
    return <div className="empty-chart">داده بازار موجود نیست</div>;
  const center = 150,
    radius = 105;
  const points = entries
    .map(([, value], i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / entries.length,
        r = (radius * value) / 10;
      return `${center + Math.cos(a) * r},${center + Math.sin(a) * r}`;
    })
    .join(" ");
  return (
    <div className="radar-chart">
      <svg
        viewBox="0 0 300 300"
        role="img"
        aria-label="رادار بخش‌های امتیاز بازار"
      >
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <polygon
            key={level}
            points={entries
              .map((_, i) => {
                const a = -Math.PI / 2 + (i * Math.PI * 2) / entries.length;
                return `${center + Math.cos(a) * radius * level},${center + Math.sin(a) * radius * level}`;
              })
              .join(" ")}
          />
        ))}
        {entries.map((_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / entries.length;
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={center + Math.cos(a) * radius}
              y2={center + Math.sin(a) * radius}
            />
          );
        })}
        <polygon className="radar-area" points={points} />
        {entries.map(([label, value], i) => {
          const a = -Math.PI / 2 + (i * Math.PI * 2) / entries.length;
          const x = center + Math.cos(a) * (radius + 25),
            y = center + Math.sin(a) * (radius + 25);
          return (
            <g key={label}>
              <text x={x} y={y} textAnchor="middle">
                {label}
              </text>
              <circle
                cx={center + (Math.cos(a) * radius * value) / 10}
                cy={center + (Math.sin(a) * radius * value) / 10}
                r="4"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function McKinseyView({ companies }: { companies: Company[] }) {
  const available = companies.filter(
    (c) => c.market?.["کل"] != null && c.score != null,
  );
  const [lens, setLens] = useState("score"),
    [name, setName] = useState(available[0]?.name ?? ""),
    [settingsOpen, setSettingsOpen] = useState(false),
    [effectLimit, setEffectLimit] = useState(MAX_MANAGEMENT_EFFECT),
    [managementEffects, setManagementEffects] = useState<
      Record<string, { financial: number; market: number }>
  >({});
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedLimitValue = localStorage.getItem("ips-mckinsey-effect-limit");
        const storedLimit = Number(storedLimitValue);
        const limit = storedLimitValue !== null && Number.isFinite(storedLimit)
          ? Math.max(0, Math.min(MAX_MANAGEMENT_EFFECT, storedLimit))
          : MAX_MANAGEMENT_EFFECT;
        const stored = JSON.parse(
          localStorage.getItem("ips-mckinsey-management-effects") ?? "{}",
        );
        setEffectLimit(limit);
        setManagementEffects(normalizeManagementAdjustments(stored, limit));
      } catch {
        setEffectLimit(MAX_MANAGEMENT_EFFECT);
        setManagementEffects({});
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const selected = available.find((c) => c.name === name) ?? available[0];
  const persistEffects = (
    next: Record<string, { financial: number; market: number }>,
  ) => {
    setManagementEffects(next);
    localStorage.setItem("ips-mckinsey-management-effects", JSON.stringify(next));
  };
  const updateEffect = (
    company: string,
    axis: "financial" | "market",
    value: number,
  ) => {
    const current = managementEffects[company] ?? { financial: 0, market: 0 };
    persistEffects({
      ...managementEffects,
      [company]: normalizeManagementAdjustments(
        { [company]: { ...current, [axis]: value } },
        effectLimit,
      )[company],
    });
  };
  const updateLimit = (value: number) => {
    const limit = Math.max(0, Math.min(MAX_MANAGEMENT_EFFECT, value));
    const next = normalizeManagementAdjustments(managementEffects, limit);
    setEffectLimit(limit);
    localStorage.setItem("ips-mckinsey-effect-limit", String(limit));
    persistEffects(next);
  };
  const adjustedScores = available.map((company) => {
    const baseFinancial = scoreOf(company, lens);
    const baseMarket = company.market["کل"];
    const effects = managementEffects[company.name] ?? {
      financial: 0,
      market: 0,
    };
    return {
      company,
      baseFinancial,
      baseMarket,
      financial:
        baseFinancial == null
          ? null
          : applyManagementAdjustment(
              baseFinancial,
              effects.financial,
              effectLimit,
            ),
      market: applyManagementAdjustment(
        baseMarket,
        effects.market,
        effectLimit,
      ),
      effects,
    };
  });
  const points = adjustedScores
    .map((row) => {
      const { financial, market } = row;
      return financial == null || market == null
        ? null
        : {
            ...row,
            financial,
            market,
            displayFinancial: financial,
            displayMarket: market,
          };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);
  const active =
    points.find((p) => p.company.name === selected?.name) ?? points[0];
  const cell = active
    ? matrixCell(active.displayFinancial, active.displayMarket)
    : 5;
  const order = [3, 2, 1, 6, 5, 4, 9, 8, 7];
  const lensLabel =
    FINANCE_LENSES.find((x) => x.key === lens)?.label ?? "امتیاز کل";
  return (
    <div className="content-stack">
      <section className="panel matrix-toolbar premium">
        <div>
          <label>سناریوی امتیاز مالی</label>
          <div className="lens-buttons">
            {FINANCE_LENSES.map((item) => (
              <button
                key={item.key}
                className={lens === item.key ? "active" : ""}
                onClick={() => setLens(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <small>
            {lens === "score"
              ? "جایگاه بر اساس امتیاز کل مالی و امتیاز کل بازار تعیین می‌شود"
              : `«${lensLabel}» امتیاز ترکیبی شش‌بُعدی با تأکید ۳۵٪ بر مؤلفه منتخب است`}
          </small>
        </div>
        <div className="selector-field">
          <label>شرکت منتخب</label>
          <select
            value={selected?.name}
            onChange={(e) => setName(e.target.value)}
          >
            {available.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <button
          className={`advanced-score-trigger ${settingsOpen ? "active" : ""}`}
          onClick={() => setSettingsOpen((value) => !value)}
        >
          <span><Gauge /></span>
          <div>
            <b>تنظیمات پیشرفته تحلیل مدیریت</b>
            <small>
              {Object.values(managementEffects).filter(
                (value) => value.financial !== 0 || value.market !== 0,
              ).length.toLocaleString("fa-IR")} شرکت دارای تعدیل
            </small>
          </div>
          <ChevronLeft />
        </button>
      </section>
      {settingsOpen && (
        <section className="panel management-adjustment-panel">
          <header>
            <div>
              <span>لایه تحلیل مدیریت</span>
              <h2>تنظیم اثر مستقل بر مالی و بازار</h2>
              <p>
                امتیاز مرجع محفوظ می‌ماند؛ درصد انتخابی فقط امتیاز مؤثر و جایگاه
                شرکت در ماتریس را تغییر می‌دهد.
              </p>
            </div>
            <label className="effect-limit-control">
              <span>سقف مجاز اثر</span>
              <input
                type="range"
                min="0"
                max={MAX_MANAGEMENT_EFFECT}
                step="1"
                value={effectLimit}
                onChange={(event) => updateLimit(Number(event.target.value))}
              />
              <b>{fa(effectLimit, 0)}٪</b>
            </label>
          </header>
          <div className="adjustment-table-wrap">
            <table className="adjustment-table">
              <thead>
                <tr>
                  <th>شرکت</th>
                  <th>اثر مالی</th>
                  <th>اثر بازار</th>
                  <th>نتیجه مؤثر</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {adjustedScores.map((row) => (
                  <tr
                    key={row.company.name}
                    className={row.company.name === selected?.name ? "selected" : ""}
                    onClick={() => setName(row.company.name)}
                  >
                    <td><b>{row.company.name}</b></td>
                    <td>
                      <label className="effect-slider financial">
                        <input
                          type="range"
                          min={-effectLimit}
                          max={effectLimit}
                          step="1"
                          value={row.effects.financial}
                          onChange={(event) =>
                            updateEffect(
                              row.company.name,
                              "financial",
                              Number(event.target.value),
                            )
                          }
                        />
                        <strong>{row.effects.financial > 0 ? "+" : ""}{fa(row.effects.financial, 0)}٪</strong>
                      </label>
                    </td>
                    <td>
                      <label className="effect-slider market">
                        <input
                          type="range"
                          min={-effectLimit}
                          max={effectLimit}
                          step="1"
                          value={row.effects.market}
                          onChange={(event) =>
                            updateEffect(
                              row.company.name,
                              "market",
                              Number(event.target.value),
                            )
                          }
                        />
                        <strong>{row.effects.market > 0 ? "+" : ""}{fa(row.effects.market, 0)}٪</strong>
                      </label>
                    </td>
                    <td>
                      <span className="effective-score-pair">
                        <i>مالی {fa(row.financial)}</i>
                        <i>بازار {fa(row.market)}</i>
                      </span>
                    </td>
                    <td>
                      <button
                        className="reset-effect"
                        disabled={!row.effects.financial && !row.effects.market}
                        onClick={(event) => {
                          event.stopPropagation();
                          updateEffect(row.company.name, "financial", 0);
                          const next = {
                            ...managementEffects,
                            [row.company.name]: { financial: 0, market: 0 },
                          };
                          persistEffects(next);
                        }}
                      >بازنشانی</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer>
            <ShieldCheck />
            <span>دامنه هر تعدیل از منفی سقف تا مثبت سقف است و امتیاز نهایی همیشه در بازه صفر تا ده باقی می‌ماند.</span>
          </footer>
        </section>
      )}
      <section className="matrix-layout">
        <article className="panel matrix-panel premium-matrix">
          <div className="matrix-y-title">
            <b>جذابیت بازار</b><span className="axis-high">زیاد</span><span className="axis-low">کم</span>
          </div>
          <div className="mckinsey-grid">
            {order.map((id) => (
              <div
                key={id}
                className={`matrix-cell cell-${id} ${id === cell ? "active" : ""}`}
              >
                <b>{MATRIX[id].title}</b>
                <small>
                  {points
                    .filter(
                      (p) =>
                        matrixCell(p.displayFinancial, p.displayMarket) === id,
                    )
                    .length.toLocaleString("fa-IR")}{" "}
                  شرکت
                </small>
              </div>
            ))}
            {points.map((point, index) => (
              <button
                key={point.company.name}
                className={`matrix-dot ${point.company.name === selected?.name ? "selected" : ""}`}
                onClick={() => setName(point.company.name)}
                style={
                  {
                    left: `${point.displayFinancial * 10}%`,
                    bottom: `${point.displayMarket * 10}%`,
                    "--dot-color": NATURE_COLORS[index % NATURE_COLORS.length],
                  } as React.CSSProperties
                }
              >
                <span>{point.company.name}</span>
              </button>
            ))}
          </div>
          <div className="matrix-x-title">
            <span>کم / ضعیف</span><b>عملکرد مالی</b><span>زیاد / قوی</span>
          </div>
        </article>
        <aside className="panel matrix-insight premium-insight">
          <div className="insight-company">
            <span className="cell-badge">
              خانه {cell.toLocaleString("fa-IR")}
            </span>
            <small>{lensLabel}</small>
            <h3>{selected?.name}</h3>
          </div>
          <h2>{MATRIX[cell].title}</h2>
          <b>{MATRIX[cell].state}</b>
          <p>{MATRIX[cell].body}</p>
          <div className="strategy-action">
            <small>جهت‌گیری پیشنهادی</small>
            <strong>{MATRIX[cell].action}</strong>
          </div>
          <dl>
            <div>
              <dt>امتیاز مؤثر مالی</dt>
              <dd>{fa(active?.financial)}</dd>
              <small>
                کل مالی {fa(selected?.score)} · سناریوی {lensLabel} {fa(active?.baseFinancial)} · اثر {active?.effects.financial ? `${active.effects.financial > 0 ? "+" : ""}${fa(active.effects.financial, 0)}٪` : "بدون تعدیل"}
              </small>
            </div>
            <div>
              <dt>امتیاز مؤثر بازار</dt>
              <dd>{fa(active?.market)}</dd>
              <small>مرجع {fa(active?.baseMarket)} · اثر {active?.effects.market ? `${active.effects.market > 0 ? "+" : ""}${fa(active.effects.market, 0)}٪` : "بدون تعدیل"}</small>
            </div>
          </dl>
          <div className="decision-trace">
            <Target />
            <p>
              <b>منطق جایگاه</b>
              <span>
                جایگاه مستقیماً از امتیاز مؤثر مالی در سناریوی «{lensLabel}» و
                امتیاز کل بازار فایل مرجع تعیین شده است. تعدیل هر شرکت فقط همان
                شرکت را جابه‌جا می‌کند.
              </span>
            </p>
          </div>
        </aside>
      </section>
      {selected && (
        <section className="panel radar-section">
          <div className="section-title">
            <span>
              <Radar />
            </span>
            <div>
              <h2>رادار جذابیت بازار و سگمنت‌ها</h2>
              <p>جزئیات مؤلفه‌های بازار برای {selected.name}</p>
            </div>
          </div>
          <RadarChart company={selected} />
          <div className="radar-values">
            {Object.entries(selected.market)
              .filter(([k]) => k !== "کل")
              .map(([k, v]) => (
                <div key={k}>
                  <span>{k}</span>
                  <b>{fa(v)}</b>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Today({
  companies,
  financialCompanies,
  portfolio,
}: {
  companies: Company[];
  financialCompanies: FinancialCompany[];
  portfolio: PortfolioItem[];
}) {
  const [intro, setIntro] = useState(true),
    [step, setStep] = useState<TodayStep>(1);
  const open = (s: TodayStep) => {
    setStep(s);
    setIntro(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  if (intro)
    return (
      <main className="app-page">
        <TodayIntro onStep={open} />
      </main>
    );
  return (
    <StepFrame step={step} onStep={open}>
      {step === 1 && <PortfolioView portfolio={portfolio} />}{" "}
      {step === 2 && <FinancialView financialCompanies={financialCompanies} />}{" "}
      {step === 3 && <MarketView />}{" "}
      {step === 4 && <SwotView companies={companies} />}{" "}
      {step === 5 && <McKinseyView companies={companies} />}{" "}
      {step === 6 && <ManagementNarratives />}
    </StepFrame>
  );
}

function criterionText(key: CriterionKey, value: number) {
  if (key === "valueAdded") return fa(value, 0);
  if (key === "megatrends") return `${fa(value, 2)} از ۱۰`;
  return `${fa(value * 100, 2)}٪`;
}
function redistributeCriteria(
  weights: Record<CriterionKey, number>,
  key: CriterionKey,
  next: number,
) {
  const bounded = Math.max(5, Math.min(50, next)),
    others = GROWTH_CRITERIA.map((item) => item.key).filter(
      (item) => item !== key,
    ),
    sum = others.reduce((total, item) => total + weights[item], 0) || 1,
    remaining = 100 - bounded;
  return Object.fromEntries([
    [key, bounded],
    ...others.map((item) => [item, (weights[item] / sum) * remaining]),
  ]) as Record<CriterionKey, number>;
}
function calculateOpportunity(
  sectors: Sector[],
  weights: Record<CriterionKey, number>,
) {
  const total =
      Object.values(weights).reduce((sum, value) => sum + value, 0) || 1,
    denominators = Object.fromEntries(
      GROWTH_CRITERIA.map((item) => [
        item.key,
        Math.sqrt(
          sectors.reduce(
            (sum, sector) => sum + sector.criteria[item.key] ** 2,
            0,
          ),
        ) || 1,
      ]),
    ) as Record<CriterionKey, number>;
  const weighted = sectors.map((sector) => ({
    sector,
    values: Object.fromEntries(
      GROWTH_CRITERIA.map((item) => [
        item.key,
        ((sector.criteria[item.key] / denominators[item.key]) *
          weights[item.key]) /
          total,
      ]),
    ) as Record<CriterionKey, number>,
  }));
  const positive = Object.fromEntries(
      GROWTH_CRITERIA.map((item) => [
        item.key,
        item.benefit
          ? Math.max(...weighted.map((row) => row.values[item.key]))
          : Math.min(...weighted.map((row) => row.values[item.key])),
      ]),
    ) as Record<CriterionKey, number>,
    negative = Object.fromEntries(
      GROWTH_CRITERIA.map((item) => [
        item.key,
        item.benefit
          ? Math.min(...weighted.map((row) => row.values[item.key]))
          : Math.max(...weighted.map((row) => row.values[item.key])),
      ]),
    ) as Record<CriterionKey, number>;
  const scored = weighted.map((row) => {
    const good = Math.sqrt(
        GROWTH_CRITERIA.reduce(
          (sum, item) => sum + (row.values[item.key] - positive[item.key]) ** 2,
          0,
        ),
      ),
      bad = Math.sqrt(
        GROWTH_CRITERIA.reduce(
          (sum, item) => sum + (row.values[item.key] - negative[item.key]) ** 2,
          0,
        ),
      );
    return { ...row.sector, opportunity: bad / (good + bad) };
  });
  const sorted = [...scored].sort(
      (a, b) => b.opportunity - a.opportunity || a.id - b.id,
    ),
    rank = new Map(sorted.map((row, index) => [row.id, index + 1]));
  const baselineSorted = [...sectors].sort(
      (a, b) => b.baselineOpportunity - a.baselineOpportunity || a.id - b.id,
    ),
    baselineRank = new Map(
      baselineSorted.map((row, index) => [row.id, index + 1]),
    );
  return scored
    .map((row) => ({
      ...row,
      rank: rank.get(row.id) ?? 77,
      baselineRank: baselineRank.get(row.id) ?? 77,
      x: 0.5 + (9 * (77 - (rank.get(row.id) ?? 77))) / 76,
    }))
    .sort((a, b) => a.rank - b.rank);
}
const MATRIX_THRESHOLDS = FIT_MODEL_V22.matrix;
function zoneFor(x: number, y: number) {
  const xb =
      x >= MATRIX_THRESHOLDS.high ? 2 : x >= MATRIX_THRESHOLDS.medium ? 1 : 0,
    yb =
      y >= MATRIX_THRESHOLDS.high ? 2 : y >= MATRIX_THRESHOLDS.medium ? 1 : 0;
  const zones = [
    [
      {
        title: "کم‌اولویت",
        decision: "عدم تخصیص منابع و صرفاً رصد تغییرات بنیادین.",
      },
      {
        title: "حفظ در رادار",
        decision: "پایش محدود؛ ورود تنها با محرک راهبردی روشن.",
      },
      {
        title: "توانمندسازی داخلی",
        decision: "تناسب مناسب است، اما جذابیت رشد هنوز ورود را توجیه نمی‌کند.",
      },
    ],
    [
      {
        title: "پایش انتخابی",
        decision: "اطلاعات تکمیلی گردآوری و ورود در مقیاس آزمایشی بررسی شود.",
      },
      {
        title: "بررسی تکمیلی",
        decision:
          "فرصت متعادل است؛ تصمیم به مزیت اجرایی و شریک مناسب وابسته است.",
      },
      {
        title: "هم‌افزایی مشروط",
        decision:
          "از قابلیت موجود استفاده شود، اما سرمایه‌گذاری مرحله‌ای باقی بماند.",
      },
    ],
    [
      {
        title: "پایش فرصت",
        decision:
          "بازار جذاب است؛ پیش از ورود باید شکاف قابلیت پرتفوی رفع شود.",
      },
      {
        title: "توسعه انتخابی",
        decision: "ورود هدفمند با شریک یا مدل کم‌سرمایه در اولویت بررسی است.",
      },
      {
        title: "اولویت ورود",
        decision:
          "فرصت هم‌زمان جذاب و متناسب است؛ مطالعه ورود و تخصیص منابع آغاز شود.",
      },
    ],
  ][xb][yb];
  return zones;
}
function mappedSectorIds(code: string) {
  return code
    .split("/")
    .map((part) => Number(part.trim()))
    .filter(Number.isFinite);
}
const PORTFOLIO_HORIZONS: {
  key: PortfolioHorizon;
  label: string;
  question: string;
  color: string;
  fitKey: "coreFit" | "adjacentFit" | "transformFit";
  focus: PortfolioWeights;
}[] = [
  {
    key: "core",
    label: "هسته اصلی",
    question: "اتکا به قابلیت‌های تثبیت‌شده",
    color: "#176cb5",
    fitKey: "coreFit",
    focus: { core: 70, adjacent: 20, transform: 10 },
  },
  {
    key: "adjacent",
    label: "کسب‌وکارهای مجاور",
    question: "توسعه بر پایه پیوندهای نزدیک",
    color: "#d09a43",
    fitKey: "adjacentFit",
    focus: { core: 35, adjacent: 55, transform: 10 },
  },
  {
    key: "transform",
    label: "فرصت‌های تحول‌گرا",
    question: "ساخت قابلیت‌های آینده",
    color: "#7654a7",
    fitKey: "transformFit",
    focus: { core: 30, adjacent: 20, transform: 50 },
  },
];
function redistributePortfolio(
  weights: PortfolioWeights,
  key: PortfolioHorizon,
  next: number,
) {
  const bounded = Math.max(0, Math.min(90, next)),
    others = PORTFOLIO_HORIZONS.map((item) => item.key).filter(
      (item) => item !== key,
    ),
    sum = others.reduce((total, item) => total + weights[item], 0) || 1,
    remaining = 100 - bounded;
  return Object.fromEntries([
    [key, bounded],
    ...others.map((item) => [item, (weights[item] / sum) * remaining]),
  ]) as PortfolioWeights;
}
function levelText(value: number) {
  return value >= MATRIX_THRESHOLDS.high
    ? "بالا"
    : value >= MATRIX_THRESHOLDS.medium
      ? "میانه"
      : "پایین";
}
function capabilityPortfolioCompanies(
  capability: string,
  portfolio: PortfolioItem[],
) {
  const matches = (item: PortfolioItem) => {
    const nature = normalize(item.nature),
      label = normalize(capability);
    if (label.includes("بازرگانی")) return nature.includes("بازرگانی");
    if (label.includes("پایین دستی")) return nature.includes("پایین دستی");
    if (label.includes("مالی")) return nature.includes("خدمات مالی");
    if (label.includes("کانی") || label.includes("معدنی"))
      return nature.includes("کانی");
    if (label.includes("جانبی")) return nature.includes("جانبی");
    if (label.includes("رنگ")) return nature.includes("رنگ");
    return false;
  };
  return portfolio
    .filter(matches)
    .sort((a, b) => (b.portfolioShare ?? 0) - (a.portfolioShare ?? 0));
}
function synergyNarrative(value: number) {
  if (value >= MATRIX_THRESHOLDS.high)
    return "ظرفیت هم‌افزایی بالا است؛ دو قابلیت منتخب می‌توانند مبنای یک مسیر ورود مشترک و قابل اتکا باشند.";
  if (value >= MATRIX_THRESHOLDS.medium)
    return "ظرفیت هم‌افزایی در سطح میانه است؛ همکاری دو قابلیت معنادار است، اما باید با یک اقدام آزمایشی و شواهد اجرایی تکمیل شود.";
  return "ظرفیت هم‌افزایی فعلاً محدود است؛ ورود بهتر است بر شریک تخصصی یا توسعه تدریجی قابلیت تکیه کند.";
}
function optionalityNarrative(value: number) {
  if (value >= MATRIX_THRESHOLDS.high)
    return "این فرصت یک دروازه توسعه قوی است و می‌تواند دسترسی گروه به چند حوزه مرتبط و جذاب را تسهیل کند.";
  if (value >= MATRIX_THRESHOLDS.medium)
    return "این فرصت چند مسیر توسعه معنادار باز می‌کند، اما ارزش آن‌ها به ترتیب ورود و کیفیت اجرای مرحله نخست وابسته است.";
  return "اثر شبکه‌ای این فرصت محدودتر است؛ تصمیم ورود باید بیشتر بر منطق خود فرصت متکی باشد تا گزینه‌های بعدی.";
}
function dominantHorizon(row: Opportunity, weights: PortfolioWeights) {
  return [...PORTFOLIO_HORIZONS].sort(
    (a, b) => row[b.fitKey] * weights[b.key] - row[a.fitKey] * weights[a.key],
  )[0];
}

function CriterionPanel({
  sectors,
  active,
  mode,
  setMode,
  compareIds,
  setCompareIds,
}: {
  sectors: Sector[];
  active: CriterionKey;
  mode: CriterionMode;
  setMode: (mode: CriterionMode) => void;
  compareIds: number[];
  setCompareIds: (ids: number[]) => void;
}) {
  const meta = GROWTH_CRITERIA.find((item) => item.key === active)!;
  const ordered = [...sectors].sort((a, b) =>
      meta.benefit
        ? b.criteria[active] - a.criteria[active]
        : a.criteria[active] - b.criteria[active],
    ),
    values = sectors.map((sector) => sector.criteria[active]),
    min = Math.min(...values),
    max = Math.max(...values),
    span = max - min || 1,
    bins = Array.from({ length: 10 }, (_, index) => ({
      start: min + (span * index) / 10,
      count: 0,
    }));
  values.forEach(
    (value) =>
      bins[Math.min(9, Math.floor(((value - min) / span) * 10))].count++,
  );
  const normalized = (value: number) => (value - min) / span;
  return (
    <section
      className="panel criterion-panel"
      style={{ "--criterion": meta.color } as React.CSSProperties}
    >
      <header>
        <div>
          <span>{meta.short}</span>
          <div>
            <h2>{meta.label}</h2>
            <p>{meta.description} · پوشش کامل ۷۷ بخش</p>
          </div>
        </div>
        <nav>
          {CRITERION_MODES.map((item) => (
            <button
              key={item.key}
              className={mode === item.key ? "active" : ""}
              onClick={() => setMode(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      {mode === "distribution" && (
        <div className="distribution-chart">
          {bins.map((bin, index) => (
            <div key={index}>
              <span>{bin.count.toLocaleString("fa-IR")}</span>
              <i
                style={{
                  height: `${Math.max(6, (bin.count / Math.max(...bins.map((item) => item.count))) * 100)}%`,
                }}
              />
              <small>{criterionText(active, bin.start)}</small>
            </div>
          ))}
        </div>
      )}
      {mode === "ranking" && (
        <div className="criterion-ranking">
          {ordered.slice(0, 15).map((sector, index) => (
            <div key={sector.id}>
              <span>{(index + 1).toLocaleString("fa-IR")}</span>
              <b>{sector.name}</b>
              <i>
                <em
                  style={{
                    width: `${Math.max(2, (meta.benefit ? normalized(sector.criteria[active]) : 1 - normalized(sector.criteria[active])) * 100)}%`,
                  }}
                />
              </i>
              <strong>{criterionText(active, sector.criteria[active])}</strong>
            </div>
          ))}
        </div>
      )}
      {mode === "comparison" && (
        <div className="criterion-comparison">
          <div className="comparison-selectors">
            {[0, 1, 2].map((index) => (
              <select
                key={index}
                value={compareIds[index]}
                onChange={(event) => {
                  const next = [...compareIds];
                  next[index] = Number(event.target.value);
                  setCompareIds(next);
                }}
              >
                {sectors.map((sector) => (
                  <option value={sector.id} key={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            ))}
          </div>
          <div className="comparison-columns">
            {compareIds.map((id) => {
              const sector = sectors.find((item) => item.id === id)!;
              return (
                <article key={id}>
                  <strong>
                    {criterionText(active, sector.criteria[active])}
                  </strong>
                  <i>
                    <span
                      style={{
                        height: `${Math.max(8, normalized(sector.criteria[active]) * 100)}%`,
                      }}
                    />
                  </i>
                  <b>{sector.name}</b>
                </article>
              );
            })}
          </div>
        </div>
      )}
      {mode === "extremes" && (
        <div className="extreme-grid">
          <section>
            <h3>پنج بخش برتر</h3>
            {ordered.slice(0, 5).map((sector, index) => (
              <div key={sector.id}>
                <span>{(index + 1).toLocaleString("fa-IR")}</span>
                <b>{sector.name}</b>
                <strong>
                  {criterionText(active, sector.criteria[active])}
                </strong>
              </div>
            ))}
          </section>
          <section className="weak">
            <h3>پنج بخش ضعیف‌تر</h3>
            {ordered
              .slice(-5)
              .reverse()
              .map((sector, index) => (
                <div key={sector.id}>
                  <span>{(77 - index).toLocaleString("fa-IR")}</span>
                  <b>{sector.name}</b>
                  <strong>
                    {criterionText(active, sector.criteria[active])}
                  </strong>
                </div>
              ))}
          </section>
        </div>
      )}
      {mode === "intensity" && (
        <div className="intensity-view">
          <div className="intensity-strip">
            {ordered.map((sector) => (
              <button
                key={sector.id}
                title={`${sector.name}: ${criterionText(active, sector.criteria[active])}`}
                style={{
                  opacity: 0.22 + 0.78 * normalized(sector.criteria[active]),
                }}
              />
            ))}
          </div>
          <div className="intensity-list">
            {ordered.map((sector) => (
              <div key={sector.id}>
                <b>{sector.name}</b>
                <span>{criterionText(active, sector.criteria[active])}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Growth({
  sectors,
  opportunities,
  opportunityRelatedness,
  isic,
  portfolio,
}: {
  sectors: Sector[];
  opportunities: Opportunity[];
  opportunityRelatedness: OpportunityRelatedness;
  isic: IsicRow[];
  portfolio: PortfolioItem[];
}) {
  const [view, setView] = useState<GrowthView>("inputs");
  const [weights, setWeights] = useState<Record<CriterionKey, number>>({
    ...MOVEMENT_BASELINE.opportunityWeights,
  });
  const [portfolioWeights, setPortfolioWeights] = useState<PortfolioWeights>({
    ...MOVEMENT_BASELINE.fitWeights,
  });
  const [activeCriterion, setActiveCriterion] =
      useState<CriterionKey>("growth"),
    [criterionMode, setCriterionMode] = useState<CriterionMode>("distribution"),
    [compareIds, setCompareIds] = useState([1, 2, 3]),
    [selectedId, setSelectedId] = useState(opportunities[0]?.id ?? 1),
    [query, setQuery] = useState("");
  const ranking = useMemo(
    () => calculateOpportunity(sectors, weights),
    [sectors, weights],
  );
  const rankById = useMemo(
    () => new Map(ranking.map((row) => [row.id, row])),
    [ranking],
  );
  const strategicRows = useMemo<
    { id: number; strategicRaw: number; dynamicY: number; baselineY: number }[]
  >(
    () => calculateStrategicFit(opportunities, portfolioWeights),
    [opportunities, portfolioWeights],
  );
  const strategicById = useMemo(
    () => new Map(strategicRows.map((row) => [row.id, row])),
    [strategicRows],
  );
  const networkRows = useMemo<
    {
      id: number;
      optionalityRaw: number;
      optionality: number;
      nextPaths: string[];
    }[]
  >(
    () =>
      calculateOpportunityNetwork(
        opportunities,
        opportunityRelatedness,
        ranking,
      ),
    [opportunities, opportunityRelatedness, ranking],
  );
  const networkById = useMemo(
    () => new Map(networkRows.map((row) => [row.id, row])),
    [networkRows],
  );
  const matrixRows = useMemo(
    () =>
      opportunities.map((opportunity) => {
        const scored = rankById.get(opportunity.id)!,
          fit = strategicById.get(opportunity.id)!,
          network = networkById.get(opportunity.id)!;
        return {
          ...opportunity,
          ...scored,
          ...fit,
          ...network,
          priority: priorityScore(scored.x, fit.dynamicY),
          horizon: dominantHorizon({ ...opportunity, ...fit }, portfolioWeights)
            .key,
        };
      }),
    [opportunities, rankById, strategicById, networkById, portfolioWeights],
  );
  const selected =
      matrixRows.find((row) => row.id === selectedId) ?? matrixRows[0],
    zone = selected ? zoneFor(selected.x, selected.dynamicY) : zoneFor(5, 5),
    baselineZone = selected
      ? zoneFor(selected.x, selected.baselineY)
      : zoneFor(5, 5),
    fitDelta = selected ? selected.dynamicY - selected.baselineY : 0,
    positionStability =
      baselineZone.title !== zone.title
        ? "حساس به سیاست فعال"
        : Math.abs(fitDelta) < 0.8
          ? "پایدار در ناحیه"
          : "جابه‌جایی درون ناحیه",
    leadHorizon = selected
      ? dominantHorizon(selected, portfolioWeights)
      : PORTFOLIO_HORIZONS[0];
  const primaryCompanies = selected
      ? capabilityPortfolioCompanies(selected.closest, portfolio)
      : [],
    secondaryCompanies = selected
      ? capabilityPortfolioCompanies(selected.secondClosest, portfolio)
      : [];
  const results = useMemo(() => {
    const q = normalize(query);
    if (q.length < 2) return [];
    const tokens = q.split(" ").filter(Boolean);
    return isic
      .map((row) => {
        const description = normalize(row.description),
          haystack = normalize(`${row.description} ${row.isic} ${row.sector}`),
          words = haystack.split(/[^\p{L}\p{N}]+/u).filter(Boolean),
          matches = tokens.every((token) =>
            words.some((word) => word.startsWith(token)),
          ),
          score =
            description === q
              ? 4
              : description.startsWith(q)
                ? 3
                : description.includes(q)
                  ? 2
                  : matches
                    ? 1
                    : 0;
        return { row, score };
      })
      .filter((item) => item.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.row.description.localeCompare(b.row.description, "fa"),
      )
      .slice(0, 60)
      .map((item) => item.row);
  }, [isic, query]);
  const openMapped = (sectorId: number) => {
    const match = matrixRows.find((item) => item.id === sectorId);
    if (match) {
      setSelectedId(match.id);
      requestAnimationFrame(() =>
        document
          .getElementById("opportunity-matrix-stage")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  };
  const steps = [
    { id: "inputs" as const, label: "ورودی‌ها و وزن‌دهی", icon: Layers3 },
    { id: "ranking" as const, label: "رتبه‌بندی فرصت‌ها", icon: BarChart3 },
    { id: "matrix" as const, label: "ماتریس و تصمیم", icon: MapIcon },
  ];
  return (
    <main className="app-page growth-journey">
      <header className="growth-journey-head">
        <div>
          <span className="overline">مسیر آینده</span>
          <h1>شناسایی پتانسیل‌های رشد</h1>
          <p>
            از پنج مؤلفه ورودی تا تصمیم راهبردی برای هر یک از ۷۷ فرصت اقتصادی
          </p>
        </div>
        <nav>
          {steps.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => setView(id)}
            >
              <span>{(index + 1).toLocaleString("fa-IR")}</span>
              <Icon />
              <b>{label}</b>
            </button>
          ))}
        </nav>
      </header>
      {view === "inputs" && (
        <div className="growth-stack">
          <section className="growth-architecture">
            <div className="criteria-nodes">
              {GROWTH_CRITERIA.map((item, index) => (
                <button
                  key={item.key}
                  className={activeCriterion === item.key ? "active" : ""}
                  style={
                    {
                      "--node": item.color,
                      "--delay": `${index * 60}ms`,
                    } as React.CSSProperties
                  }
                  onClick={() => setActiveCriterion(item.key)}
                >
                  <span>{(index + 1).toLocaleString("fa-IR")}</span>
                  <div>
                    <b>{item.label}</b>
                    <small>{fa(weights[item.key], 0)}٪ وزن فعال</small>
                  </div>
                  <ChevronLeft />
                </button>
              ))}
            </div>
            <div className="architecture-lines">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <button
              className="evaluation-core"
              onClick={() => setView("ranking")}
            >
              <span>
                <Target />
              </span>
              <small>موتور ارزیابی و رتبه‌بندی</small>
              <b>محاسبه ۷۷ فرصت</b>
              <ArrowLeft />
            </button>
          </section>
          <section className="panel growth-weight-console">
            <header>
              <div>
                <span className="overline">وزن‌دهی مدل</span>
                <h2>تنظیم اهمیت مؤلفه‌های پتانسیل رشد</h2>
                <p>
                  جمع وزن‌ها همواره ۱۰۰ درصد باقی می‌ماند و رتبه‌ها هم‌زمان
                  محاسبه می‌شوند.
                </p>
              </div>
              <button
                onClick={() =>
                  setWeights({
                    growth: 25,
                    valueAdded: 25,
                    megatrends: 20,
                    inflation: 10,
                    fxExposure: 20,
                  })
                }
              >
                بازگشت به وزن پایه
              </button>
            </header>
            <div>
              {GROWTH_CRITERIA.map((item) => (
                <label
                  key={item.key}
                  style={{ "--criterion": item.color } as React.CSSProperties}
                >
                  <span>
                    <i />
                    <b>{item.label}</b>
                    <strong>{fa(weights[item.key], 0)}٪</strong>
                  </span>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={Math.round(weights[item.key])}
                    onChange={(event) =>
                      setWeights(
                        redistributeCriteria(
                          weights,
                          item.key,
                          Number(event.target.value),
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <footer>
              <div>
                <small>جمع وزن فعال</small>
                <strong>
                  {fa(
                    Object.values(weights).reduce(
                      (sum, value) => sum + value,
                      0,
                    ),
                    0,
                  )}
                  ٪
                </strong>
              </div>
              <button onClick={() => setView("ranking")}>
                اجرای محاسبات و مشاهده رتبه‌ها <ArrowLeft />
              </button>
            </footer>
          </section>
          <CriterionPanel
            sectors={sectors}
            active={activeCriterion}
            mode={criterionMode}
            setMode={setCriterionMode}
            compareIds={compareIds}
            setCompareIds={setCompareIds}
          />
        </div>
      )}
      {view === "ranking" && (
        <div className="growth-stack">
          <section className="growth-result-head">
            <div>
              <span className="overline">خروجی محاسبه چندمعیاره</span>
              <h2>رتبه‌بندی پویای ۷۷ فرصت</h2>
              <p>
                تغییر رتبه نسبت به وزن‌های پایه در کنار امتیاز فعلی نمایش داده
                می‌شود.
              </p>
            </div>
            <button onClick={() => setView("inputs")}>
              <Gauge /> اصلاح وزن‌ها
            </button>
          </section>
          <section className="panel full-opportunity-ranking">
            <div className="ranking-header">
              <span>رتبه</span>
              <span>فرصت اقتصادی</span>
              <span>پتانسیل رشد</span>
              <span>تغییر رتبه</span>
              <span />
            </div>
            {ranking.map((row) => {
              const delta = row.baselineRank - row.rank;
              return (
                <button
                  key={row.id}
                  onClick={() => {
                    setSelectedId(row.id);
                    setView("matrix");
                  }}
                >
                  <span>{row.rank.toLocaleString("fa-IR")}</span>
                  <div>
                    <b>{row.name}</b>
                    <i>
                      <em style={{ width: `${plotPercent(row.x)}%` }} />
                    </i>
                  </div>
                  <strong>{fa(row.x, 2)}</strong>
                  <span
                    className={
                      delta > 0 ? "up" : delta < 0 ? "down" : "neutral"
                    }
                  >
                    {delta === 0
                      ? "بدون تغییر"
                      : `${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toLocaleString("fa-IR")} رتبه`}
                  </span>
                  <ChevronLeft />
                </button>
              );
            })}
          </section>
        </div>
      )}
      {view === "matrix" && selected && (
        <div className="growth-stack matrix-decision-stage">
          <section className="growth-result-head">
            <div>
              <span className="overline">نمای کل پرتفوی فرصت‌ها</span>
              <h2>ماتریس پتانسیل رشد و تناسب راهبردی</h2>
              <p>
                سیاست پرتفوی را تغییر دهید و جابه‌جایی زنده هر ۷۷ فرصت را در
                محور تناسب راهبردی ببینید.
              </p>
            </div>
            <button onClick={() => setView("ranking")}>
              <BarChart3 /> مشاهده رتبه‌ها
            </button>
          </section>
          <section className="panel portfolio-policy-lab">
            <header>
              <div>
                <span className="overline">سیاست پرتفوی</span>
                <h2>لنز تصمیم‌گیری گروه را انتخاب کنید</h2>
                <p>
                  وزن هسته، مجاور و تحول‌گرا مستقیماً در همان منطق تناسب راهبردی
                  مدل اعمال می‌شود.
                </p>
              </div>
              <button
                onClick={() =>
                  setPortfolioWeights({ core: 60, adjacent: 30, transform: 10 })
                }
              >
                بازگشت به ترکیب پایه ۶۰ / ۳۰ / ۱۰
              </button>
            </header>
            <div className="horizon-policy-grid">
              {PORTFOLIO_HORIZONS.map((item, index) => {
                const Icon =
                  index === 0 ? Target : index === 1 ? Network : Sparkles;
                return (
                  <button
                    key={item.key}
                    className={leadHorizon.key === item.key ? "leading" : ""}
                    style={{ "--horizon": item.color } as React.CSSProperties}
                    onClick={() => setPortfolioWeights(item.focus)}
                  >
                    <span>
                      <Icon />
                    </span>
                    <div>
                      <small>{item.question}</small>
                      <b>{item.label}</b>
                      <em>تمرکز سریع</em>
                    </div>
                    <strong>{fa(portfolioWeights[item.key], 0)}٪</strong>
                  </button>
                );
              })}
            </div>
            <div className="policy-live-controls">
              <div
                className="policy-orbit"
                style={{
                  background: `conic-gradient(${PORTFOLIO_HORIZONS[0].color} 0 ${portfolioWeights.core}%,${PORTFOLIO_HORIZONS[1].color} ${portfolioWeights.core}% ${portfolioWeights.core + portfolioWeights.adjacent}%,${PORTFOLIO_HORIZONS[2].color} ${portfolioWeights.core + portfolioWeights.adjacent}% 100%)`,
                }}
              >
                <span>
                  <b>۷۷</b>
                  <small>فرصت در حرکت</small>
                </span>
              </div>
              <div className="portfolio-sliders">
                {PORTFOLIO_HORIZONS.map((item) => (
                  <label
                    key={item.key}
                    style={{ "--horizon": item.color } as React.CSSProperties}
                  >
                    <span>
                      <i />
                      <b>{item.label}</b>
                      <strong>{fa(portfolioWeights[item.key], 0)}٪</strong>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      value={Math.round(portfolioWeights[item.key])}
                      onChange={(event) =>
                        setPortfolioWeights(
                          redistributePortfolio(
                            portfolioWeights,
                            item.key,
                            Number(event.target.value),
                          ),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="policy-live-note">
                <ShieldCheck />
                <div>
                  <b>بازآرایی زنده ماتریس</b>
                  <p>
                    امتیاز خام هم‌راستایی با وزن فعال محاسبه و سپس با یک مقیاس
                    ثابت به محدوده نمایشی ۰٫۵ تا ۹٫۵ منتقل می‌شود؛ بنابراین
                    تغییر سیاست باعث رتبه‌بندی اجباری مجدد نقاط نمی‌شود و محور
                    رشد مستقل می‌ماند.
                  </p>
                </div>
              </div>
            </div>
          </section>
          <section
            id="opportunity-matrix-stage"
            className="panel premium-opportunity-matrix"
          >
            <header>
              <div>
                <span>نقشه تصمیم ۷۷ فرصت</span>
                <h3>هر نقطه یک مسیر بالقوه برای رشد گروه است</h3>
              </div>
              <div className="matrix-legend">
                {PORTFOLIO_HORIZONS.map((item) => (
                  <span key={item.key}>
                    <i style={{ background: item.color }} />
                    {item.label}
                  </span>
                ))}
              </div>
            </header>
            <div className="matrix-canvas-wrap">
              <div className="premium-matrix-y">
                <span>تناسب زیاد</span>
                <b>تناسب راهبردی با پرتفوی گروه</b>
                <span>تناسب کم</span>
              </div>
              <div className="premium-matrix-canvas">
                <div className="matrix-glow" />
                <div className="premium-zones">
                  {Array.from({ length: 9 }, (_, index) => {
                    const x = index % 3,
                      y = 2 - Math.floor(index / 3),
                      sample = zoneFor(
                        x === 2 ? 8 : x === 1 ? 5 : 2,
                        y === 2 ? 8 : y === 1 ? 5 : 2,
                      );
                    return (
                      <div
                        key={index}
                        className={`premium-zone premium-zone-${x}-${y}`}
                      >
                        <span>{sample.title}</span>
                      </div>
                    );
                  })}
                </div>
                {matrixRows.map((row) => {
                  const horizon = dominantHorizon(row, portfolioWeights);
                  return (
                    <button
                      key={row.id}
                      aria-label={row.name}
                      className={`premium-opportunity-point ${row.id === selected.id ? "selected" : ""}`}
                      style={
                        {
                          left: `${plotPercent(row.x)}%`,
                          bottom: `${plotPercent(row.dynamicY)}%`,
                          "--point": horizon.color,
                        } as React.CSSProperties
                      }
                      onClick={() => setSelectedId(row.id)}
                    >
                      <i />
                      <span>
                        <b>{row.name}</b>
                        <small>{zoneFor(row.x, row.dynamicY).title}</small>
                      </span>
                    </button>
                  );
                })}
                {Math.abs(fitDelta) > 0.03 && (
                  <div
                    className="selected-movement"
                    style={{
                      left: `${plotPercent(selected.x)}%`,
                      bottom: `${plotPercent(Math.min(selected.baselineY, selected.dynamicY))}%`,
                      height: `${Math.abs(plotPercent(selected.dynamicY) - plotPercent(selected.baselineY))}%`,
                    }}
                  >
                    <i />
                  </div>
                )}
                <div
                  className="baseline-point"
                  style={{
                    left: `${plotPercent(selected.x)}%`,
                    bottom: `${plotPercent(selected.baselineY)}%`,
                  }}
                  title="جایگاه در ترکیب پایه"
                />
              </div>
              <div className="premium-matrix-x">
                <span>پتانسیل کمتر</span>
                <b>پتانسیل رشد</b>
                <span>پتانسیل بیشتر</span>
              </div>
            </div>
            <footer>
              <span>
                <i className="current-dot" />
                جایگاه تحت سیاست فعلی
              </span>
              <span>
                <i className="base-dot" />
                جایگاه ترکیب پایه
              </span>
              <b>
                نقاط بر اساس افقی رنگ شده‌اند که بیشترین سهم را در تناسب فعلی
                آن‌ها دارد.
              </b>
            </footer>
          </section>
          <section
            id="selected-opportunity-story"
            className="panel opportunity-story executive-story"
            aria-live="polite"
          >
            <header className="executive-story-head">
              <div>
                <span>روایت مدیریتی فرصت منتخب</span>
                <h2>{selected.name}</h2>
                <p>از سیگنال تصمیم تا مسیرهای توسعه بعدی</p>
              </div>
              <div className="priority-hero">
                <span>امتیاز اولویت سرمایه‌گذاری</span>
                <strong>
                  {fa(selected.priority, 1)}
                  <small>از ۱۰۰</small>
                </strong>
                <p>شاخص تکمیلی مقایسه؛ نه پیش‌بینی بازده</p>
              </div>
              <div className="story-status-line">
                <span>
                  رتبه رشد <b>{selected.rank.toLocaleString("fa-IR")}</b> از ۷۷
                </span>
                <span>
                  پتانسیل رشد <b>{fa(selected.x, 2)}</b>
                  <small>{levelText(selected.x)}</small>
                </span>
                <span>
                  هم‌راستایی <b>{fa(selected.dynamicY, 2)}</b>
                  <small>{levelText(selected.dynamicY)}</small>
                </span>
                <strong>{zone.title}</strong>
              </div>
            </header>
            <div className="executive-story-flow">
              <article className="story-chapter strategic-signal">
                <div className="story-chapter-marker">
                  <span>۱</span>
                  <Sparkles />
                </div>
                <div className="story-chapter-content">
                  <small>این فرصت چه می‌گوید؟</small>
                  <h3>سیگنال راهبردی</h3>
                  <p className="story-lead">{zone.decision}</p>
                  <p>
                    این فرصت از نظر پتانسیل رشد در سطح{" "}
                    <b>{levelText(selected.x)}</b> و از نظر هم‌راستایی با پرتفوی
                    فعلی در سطح <b>{levelText(selected.dynamicY)}</b> قرار دارد.
                    در ترکیب کنونی، بیشترین پشتوانه آن از افق{" "}
                    <b>{leadHorizon.label}</b> تأمین می‌شود؛ بنابراین سیاست
                    مناسب باید با ظرفیت واقعی این افق هماهنگ باشد.
                  </p>
                  {Math.abs(fitDelta) > 0.05 && (
                    <p
                      className={`story-policy-shift ${fitDelta > 0 ? "positive" : "negative"}`}
                    >
                      با تغییر سیاست نسبت به ترکیب پایه، هم‌راستایی این فرصت{" "}
                      {fitDelta > 0 ? "تقویت" : "تضعیف"} شده است
                      {baselineZone.title !== zone.title
                        ? ` و از «${baselineZone.title}» به «${zone.title}» منتقل شده است.`
                        : "، اما منطق راهبردی ناحیه آن تغییر نکرده است."}
                    </p>
                  )}
                </div>
              </article>
              <article className="story-chapter portfolio-connection">
                <div className="story-chapter-marker">
                  <span>۲</span>
                  <BriefcaseBusiness />
                </div>
                <div className="story-chapter-content">
                  <small>به کدام بخش‌های فعلی ما نزدیک است؟</small>
                  <h3>اتصال به پرتفوی</h3>
                  <p>
                    قوی‌ترین اتصال این فرصت به قابلیت{" "}
                    <b>«{selected.closest}»</b> با شدت{" "}
                    {fa(selected.closeness, 2)} از ۱۰ است. قابلیت{" "}
                    <b>«{selected.secondClosest}»</b> با شدت{" "}
                    {fa(selected.secondCloseness, 2)} در جایگاه دوم قرار دارد و
                    فاصله دو اتصال {fa(selected.gap, 2)} واحد است.
                  </p>
                  <div className="portfolio-link-list">
                    <div className="portfolio-link-row">
                      <div>
                        <span>قابلیت نخست</span>
                        <b>{selected.closest}</b>
                      </div>
                      <div className="connection-meter">
                        <i
                          style={{
                            width: `${Math.max(3, selected.closeness * 10)}%`,
                          }}
                        />
                      </div>
                      <strong>{fa(selected.closeness, 2)}</strong>
                      <div className="company-pills">
                        {primaryCompanies.length ? (
                          primaryCompanies.map((company) => (
                            <span key={company.name}>{company.name}</span>
                          ))
                        ) : (
                          <em>شرکت متناظر مستقیم در پرتفوی ثبت نشده است</em>
                        )}
                      </div>
                    </div>
                    <div className="portfolio-link-row secondary">
                      <div>
                        <span>قابلیت دوم</span>
                        <b>{selected.secondClosest}</b>
                      </div>
                      <div className="connection-meter">
                        <i
                          style={{
                            width: `${Math.max(3, selected.secondCloseness * 10)}%`,
                          }}
                        />
                      </div>
                      <strong>{fa(selected.secondCloseness, 2)}</strong>
                      <div className="company-pills">
                        {secondaryCompanies.length ? (
                          secondaryCompanies.map((company) => (
                            <span key={company.name}>{company.name}</span>
                          ))
                        ) : (
                          <em>شرکت متناظر مستقیم در پرتفوی ثبت نشده است</em>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
              <article className="story-chapter synergy-narrative">
                <div className="story-chapter-marker">
                  <span>۳</span>
                  <Network />
                </div>
                <div className="story-chapter-content">
                  <small>ترکیب قابلیت‌ها چه ظرفیتی می‌سازد؟</small>
                  <h3>هم‌افزایی</h3>
                  <div className="synergy-bridge">
                    <div>
                      <span>قابلیت نخست</span>
                      <b>{selected.closest}</b>
                    </div>
                    <div className="synergy-score">
                      <small>پتانسیل هم‌افزایی</small>
                      <strong>{fa(selected.synergy, 2)}</strong>
                      <span>از ۱۰</span>
                    </div>
                    <div>
                      <span>قابلیت دوم</span>
                      <b>{selected.secondClosest}</b>
                    </div>
                  </div>
                  <p>{synergyNarrative(selected.synergy)}</p>
                  <p className="model-guardrail">
                    این عدد، ظرفیت همکاری دو قابلیت موجود است و «امتیاز جدید
                    فرصت پس از هم‌افزایی» محسوب نمی‌شود.
                  </p>
                </div>
              </article>
              <article className="story-chapter development-path">
                <div className="story-chapter-marker">
                  <span>۴</span>
                  <Compass />
                </div>
                <div className="story-chapter-content">
                  <small>ورود امروز چه مسیرهایی برای فردا باز می‌کند؟</small>
                  <h3>مسیر توسعه</h3>
                  <div className="optionality-reading">
                    <div
                      className="optionality-dial"
                      style={
                        {
                          "--optionality": `${plotPercent(selected.optionality)}%`,
                        } as React.CSSProperties
                      }
                    >
                      <span>
                        <b>{fa(selected.optionality, 2)}</b>
                        <small>از ۹</small>
                      </span>
                    </div>
                    <p>
                      <b>اختیار راهبردی این فرصت: </b>
                      {optionalityNarrative(selected.optionality)} این ارزیابی
                      با وزن‌های جاری پتانسیل رشد به‌صورت زنده به‌روزرسانی
                      می‌شود.
                    </p>
                  </div>
                  <div className="route-flow">
                    {selected.nextPaths.map((path, index) => (
                      <div key={path}>
                        <span>{(index + 1).toLocaleString("fa-IR")}</span>
                        <div>
                          <small>
                            {index === 0
                              ? "نخستین مسیر قابل‌دسترسی"
                              : index === 1
                                ? "دومین مسیر توسعه"
                                : "سومین دریچه آینده"}
                          </small>
                          <b>{path}</b>
                        </div>
                        {index < selected.nextPaths.length - 1 && <ArrowLeft />}
                      </div>
                    ))}
                  </div>
                </div>
              </article>
              <details className="story-model-details">
                <summary>
                  <span>
                    <ShieldCheck />
                    <b>جزئیات مدل</b>
                    <small>مشاهده امتیازها و شواهد فنی</small>
                  </span>
                  <ChevronLeft />
                </summary>
                <div className="priority-method">
                  <b>روش محاسبه امتیاز اولویت</b>
                  <p>
                    هر محور از دامنه ثابت ۰٫۵ تا ۹٫۵ به صفر تا یک تبدیل می‌شود:
                    (امتیاز محور − ۰٫۵) ÷ ۹. امتیاز اولویت برابر است با ۱۰۰ ×
                    جذر حاصل‌ضرب دو مقدار؛ اهمیت رشد و هم‌راستایی برابر است.
                  </p>
                  <p>
                    این شاخص تکمیلی به درخواست مدیریت اضافه شده و جزو خروجی مصوب
                    اکسل ۲٫۲ نیست. هم‌افزایی و اختیار راهبردی به آن اضافه
                    نمی‌شوند. صفر به معنی پایین‌ترین مختصات نمایشی است، نه نبود
                    مطلق ارزش اقتصادی. سیاست پیشنهادی همچنان بر اساس ناحیه
                    ماتریس تعیین می‌شود.
                  </p>
                </div>
                <div className="model-evidence">
                  <div>
                    <span>پتانسیل رشد</span>
                    <b>{fa(selected.x, 2)}</b>
                  </div>
                  <div>
                    <span>هم‌راستایی راهبردی</span>
                    <b>{fa(selected.dynamicY, 2)}</b>
                  </div>
                  <div>
                    <span>امتیاز خام هم‌راستایی</span>
                    <b>{fa(selected.strategicRaw, 2)}</b>
                  </div>
                  <div>
                    <span>تناسب با هسته</span>
                    <b>{fa(selected.coreFit, 2)}</b>
                  </div>
                  <div>
                    <span>تناسب با مجاور</span>
                    <b>{fa(selected.adjacentFit, 2)}</b>
                  </div>
                  <div>
                    <span>تناسب با تحول‌گرا</span>
                    <b>{fa(selected.transformFit, 2)}</b>
                  </div>
                  <div>
                    <span>توانمندسازی مالی</span>
                    <b>{fa(selected.financeEnablement, 2)}</b>
                  </div>
                  <div>
                    <span>راننده اصلی مجاور</span>
                    <b>{selected.adjacentDriver}</b>
                  </div>
                  <div>
                    <span>ثبات جایگاه</span>
                    <b>{positionStability}</b>
                    <small>
                      {Math.abs(fitDelta) < 0.01
                        ? "بدون تغییر نسبت به مبنا"
                        : `${fitDelta > 0 ? "افزایش" : "کاهش"} ${fa(Math.abs(fitDelta), 2)} واحد`}
                    </small>
                  </div>
                  <div>
                    <span>کد بخش داده–ستانده</span>
                    <b>{selected.ioCode.toLocaleString("fa-IR")}</b>
                  </div>
                </div>
              </details>
            </div>
          </section>
          <details className="panel priority-directory">
            <summary>
              <span>
                <b>امتیاز هر یک از ۷۷ فرصت</b>
                <small>
                  مرتب‌شده بر اساس اولویت تحت ضرایب فعلی؛ مستقل از رتبه رشد
                </small>
              </span>
              <ChevronLeft />
            </summary>
            <div className="priority-directory-list">
              {[...matrixRows]
                .sort((a, b) => b.priority - a.priority || a.id - b.id)
                .map((row, index) => (
                  <button
                    key={row.id}
                    className={row.id === selected.id ? "active" : ""}
                    onClick={() => {
                      setSelectedId(row.id);
                      document
                        .getElementById("selected-opportunity-story")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                  >
                    <span>{faInt(index + 1)}</span>
                    <b>{row.name}</b>
                    <strong>
                      {fa(row.priority, 1)}
                      <small>از ۱۰۰</small>
                    </strong>
                    <ChevronLeft />
                  </button>
                ))}
            </div>
          </details>
          <section className="panel integrated-activity-search">
            <header>
              <div>
                <span>
                  <Search />
                </span>
                <div>
                  <small>جست‌وجوی یکپارچه فعالیت‌ها</small>
                  <h2>فعالیت موردنظر را به فرصت متناظر روی ماتریس وصل کنید</h2>
                  <p>
                    نام فعالیت یا کد طبقه‌بندی را وارد کنید؛ هر صنعت مرتبط
                    جداگانه نمایش داده می‌شود.
                  </p>
                </div>
              </div>
            </header>
            <div className="big-search">
              <Search />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="مثلاً تولید رنگ، حمل‌ونقل یا کد ۲۴۱۰..."
              />
              <kbd>{results.length.toLocaleString("fa-IR")} فعالیت</kbd>
            </div>
            {query.length < 2 ? (
              <div className="search-empty compact">
                <FileSearch />
                <b>حداقل دو حرف یا رقم وارد کنید</b>
                <p>نتیجه مستقیماً روی همین ماتریس انتخاب خواهد شد.</p>
              </div>
            ) : (
              <div className="mapped-results integrated">
                {results.flatMap((row, index) =>
                  mappedSectorIds(row.sectorCode).map(
                    (sectorId, mappingIndex) => {
                      const mapped = matrixRows.find(
                        (item) => item.id === sectorId,
                      );
                      if (!mapped) return [];
                      const mappingCount = mappedSectorIds(
                        row.sectorCode,
                      ).length;
                      return (
                        <button
                          key={`${row.isic}-${index}-${sectorId}`}
                          onClick={() => openMapped(sectorId)}
                        >
                          <span>{row.isic || "—"}</span>
                          <div>
                            <b>{row.description}</b>
                            <small>
                              {mappingCount > 1
                                ? `صنعت مرتبط ${(mappingIndex + 1).toLocaleString("fa-IR")} از ${mappingCount.toLocaleString("fa-IR")}: `
                                : "صنعت متناظر دقیق: "}
                              {mapped.name}
                            </small>
                          </div>
                          <div className="mapped-scores">
                            <span>رشد {levelText(mapped.x)}</span>
                            <span>تناسب {levelText(mapped.dynamicY)}</span>
                            <b>{zoneFor(mapped.x, mapped.dynamicY).title}</b>
                          </div>
                          <ChevronLeft />
                        </button>
                      );
                    },
                  ),
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

export default function InvestmentOS({
  companies,
  financialCompanies,
  portfolio,
  sectors,
  opportunities,
  opportunityRelatedness,
  isic,
  movementMaster,
  manifest,
}: {
  companies: Company[];
  financialCompanies: FinancialCompany[];
  portfolio: PortfolioItem[];
  sectors: Sector[];
  opportunities: Opportunity[];
  opportunityRelatedness: OpportunityRelatedness;
  isic: IsicRow[];
  movementMaster: MovementMasterRecord[];
  manifest: Manifest;
}) {
  const [path, setPath] = useState<MainPath>("home");
  const movementRows = useMemo(() => {
    const baseOpportunity = calculateOpportunity(
      sectors,
      MOVEMENT_BASELINE.opportunityWeights,
    );
    const opportunityById = new Map<number, { id: number; x: number }>(
      baseOpportunity.map((row) => [row.id, row]),
    );
    const baselineFit = calculateStrategicFit(
      opportunities,
      MOVEMENT_BASELINE.fitWeights,
    );
    const fitById = new Map<
      number,
      { id: number; dynamicY: number; baselineY: number }
    >(
      baselineFit.map(
        (row: { id: number; dynamicY: number; baselineY: number }) => [
          row.id,
          row,
        ],
      ),
    );
    return opportunities.map((opportunity) => {
      const scored = opportunityById.get(opportunity.id)!;
      const fit = fitById.get(opportunity.id)!;
      return {
        ...opportunity,
        x: scored.x,
        dynamicY: fit.dynamicY,
        baselineY: fit.baselineY,
        priority: priorityScore(scored.x, fit.dynamicY),
        horizon: baselineHorizon(
          opportunity.coreFit,
          opportunity.adjacentFit,
          opportunity.transformFit,
        ),
      };
    });
  }, [sectors, opportunities]);
  const currentAudit = useMemo(
    () => auditCurrentPortfolio(portfolio),
    [portfolio],
  );
  return (
    <div className="investment-os">
      <Header
        path={path}
        manifest={manifest}
        onHome={() => setPath("home")}
        onNavigate={setPath}
      />
      {path === "home" && <Home onChoose={setPath} />}{" "}
      {path === "today" && (
        <Today
          companies={companies}
          financialCompanies={financialCompanies}
          portfolio={portfolio}
        />
      )}{" "}
      {path === "growth" && (
        <Growth
          sectors={sectors}
          opportunities={opportunities}
          opportunityRelatedness={opportunityRelatedness}
          isic={isic}
          portfolio={portfolio}
        />
      )}{" "}
      {path === "movement" && (
        <MovementPath
          mode="movement"
          onOpenCapital={()=>setPath("capital")}
          rows={movementRows}
          masterData={movementMaster}
          currentPortfolio={portfolio}
          currentAudit={currentAudit}
          dataSnapshot={manifest.snapshot}
        />
      )}
      {path === "capital" && (
        <MovementPath
          mode="capital"
          rows={movementRows}
          masterData={movementMaster}
          currentPortfolio={portfolio}
          currentAudit={currentAudit}
          dataSnapshot={manifest.snapshot}
        />
      )}
    </div>
  );
}
