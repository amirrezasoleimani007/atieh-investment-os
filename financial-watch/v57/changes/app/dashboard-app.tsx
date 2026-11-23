"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as XLSX from "xlsx";
import BatchImport from '@/components/batch-import';
import type {ImportTarget} from '@/lib/batch-import';
import {serializeWorkspace,deserializeWorkspace,downloadText} from '@/lib/data-reliability';
import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  CircleGauge,
  CircleDollarSign,
  ClipboardCheck,
  Database,
  Download,
  FileCheck2,
  FileDown,
  FileSpreadsheet,
  Filter,
  Home,
  ImageDown,
  Info,
  Layers3,
  LoaderCircle,
  Menu,
  PanelTop,
  Package,
  Printer,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Table2,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import ScatterChart from "@/components/scatter-chart";
import {selectReportModel, type ReportKind} from '@/lib/report-period';
import FinancialWatchPolicy from "@/components/financial-watch-policy";
import IntelligentReport from "@/components/intelligent-report";
import {ReportEntry,ReportWorkspace,ReportEmpty} from "@/components/report-entry";
import WatchStatusTable from "@/components/watch-status-table";
import DynamicRankingPage from "@/components/dynamic-ranking";
import PerformanceBenchmark from "@/components/performance-benchmark";
import InvestmentAnalysis from "@/components/investment-analysis";
import {
  DimensionContributionChart,
  MiniSparkline,
  RankingBars,
  ScoreGauge,
  ScoreTrendChart,
  ScoreTrendMatrix,
  WaterfallChart,
} from "@/components/performance-charts";
import {
  CHART_DEFINITIONS,
  DEFAULT_SETTINGS,
  REQUIRED_COLUMNS,
  SCATTER_BOUNDARIES,
  bandLabel,
  buildAxisMatrix,
  buildFinancialModel,
  buildChartPoint,
  chartNarrative,
  formatCompact,
  formatNumber,
  managementInsights,
  normalizeText,
  settingsAreValid,
  trendDescription,
  type AxisBundle,
  type AxisKey,
  type AxisResult,
  type Band,
  type BubbleMetric,
  type ChartDefinition,
  type ChartPoint,
  type DataIssue,
  type DisplayMode,
  type FinancialModel,
  type FinancialRecord,
  type ModelSettings,
} from "@/lib/financial-engine";
import {
  PERFORMANCE_DIMENSION_KEYS,
  buildPerformanceMatrix,
  distributionForYear,
  performanceRows,
  type PerformanceDimensionKey,
  type PerformanceMatrix,
  type PerformanceResult,
} from "@/lib/performance-engine";
import { parseFinancialWorkbook } from "@/lib/workbook-parser";
import { parseMarketWorkbook, type MarketModel } from "@/lib/market-engine";
import { parseBenchmarkWorkbook, type BenchmarkModel } from "@/lib/benchmark-engine";
import { parseProductionWorkbook, type ProductionModel } from "@/lib/investment-engine";
import { parseProfitWorkbook, type ProfitModel } from "@/lib/profit-engine";
import {
  parseAssetWorkbook,
  parseEquipmentWorkbook,
  parseMetilActivityWorkbook,
  type AssetModel,
  type EquipmentModel,
  type MetilActivityModel,
} from "@/lib/investment-data-engine";

type AppTab = "report" | "analysis" | "performance" | "benchmark" | "investment" | "data" | "quality" | "settings" | "outputs";
type HoldingSelection = "atieh" | "metil";
type HoldingModels = Record<HoldingSelection, FinancialModel | null>;
type HoldingFlags = Record<HoldingSelection, boolean>;
type HoldingErrors = Record<HoldingSelection, string>;

const HOLDING_KEYS: HoldingSelection[] = ["atieh", "metil"];

const HOLDING_LABELS: Record<HoldingSelection, string> = {
  atieh: "آتیه فولاد نقش جهان",
  metil: "فولاد متیل",
};

const HOLDING_SHORT_LABELS: Record<HoldingSelection, string> = {
  atieh: "آتیه فولاد",
  metil: "فولاد متیل",
};

const PERFORMANCE_AXIS_KEYS: AxisKey[] = [
  "profitability",
  "cashQuality",
  "capitalReturn",
  "growth",
  "resilience",
  "workingCapital",
];

const BUBBLE_OPTIONS: { value: BubbleMetric; label: string }[] = [
  { value: "none", label: "اندازه ثابت" },
  { value: "revenue", label: "درآمد عملیاتی" },
  { value: "assets", label: "جمع دارایی‌ها" },
  { value: "investedCapital", label: "سرمایه‌گذاری انجام‌شده" },
];

const DISPLAY_OPTIONS: { value: DisplayMode; label: string }[] = [
  { value: "trend", label: "مسیر سه‌ساله شرکت" },
  { value: "portfolio", label: "مقایسه کل پرتفوی" },
  { value: "peers", label: "شرکت‌های هم‌ماهیت" },
];

const ISSUE_LABELS: Record<DataIssue["type"], string> = {
  'unit-mismatch':'واحد مبلغ نامعتبر',
  "missing-column": "ستون مفقود",
  "invalid-year": "سال نامعتبر",
  "missing-company": "نام شرکت مفقود",
  "missing-variable": "متغیر مفقود",
  "missing-score": "نمره خالی",
  "invalid-score": "نمره غیرعددی",
  "out-of-range": "نمره خارج از دامنه",
  duplicate: "رکورد تکراری",
  "missing-required-variable": "شاخص تحلیلی مفقود",
  "incomplete-year": "سال ناقص",
  "nature-conflict": "اختلاف ماهیت",
  "nature-imputed": "ماهیت تکمیل‌شده",
  "invalid-score-scale": "دامنه محدود نمره",
};

const BAND_COLORS: Record<Band, string> = {
  weak: "red",
  medium: "amber",
  good: "green",
};

type DataView = "profile" | "trend" | "compare" | "export";

const DATA_CATEGORIES = [
  "همه",
  "درآمد و سود",
  "جریان نقد",
  "ترازنامه و نقدینگی",
  "سرمایه در گردش",
  "بازده و ارزش‌آفرینی",
  "رشد و بهره‌وری",
  "سایر",
] as const;

type DataCategory = (typeof DATA_CATEGORIES)[number];

function dataCategory(variable: string): Exclude<DataCategory, "همه"> {
  const value = variable.toLowerCase();
  if (/roic|roce|wacc|eva|اسپرد|ارزش.?آفرینی|بازده سرمایه|بازده حقوق/.test(value)) return "بازده و ارزش‌آفرینی";
  if (/dso|dio|dpo|ccc|وصول|نگهداری موجودی|پرداخت بدهی|سرمایه در گردش/.test(value)) return "سرمایه در گردش";
  if (/جریان نقد|fcf|ocf|cfo|کیفیت سود/.test(value)) return "جریان نقد";
  if (/رشد|cagr|بهره.?وری|گردش دارایی|گردش موجودی|گردش مطالبات/.test(value)) return "رشد و بهره‌وری";
  if (/دارایی|بدهی|حقوق صاحبان|موجودی نقد|موجودی مواد|دریافتنی|پرداختنی|نقدینگی|نسبت جاری|نسبت آنی|اهرم/.test(value)) return "ترازنامه و نقدینگی";
  if (/درآمد|فروش|بهای تمام|سود|زیان|حاشیه|ebit|ebitda/.test(value)) return "درآمد و سود";
  return "سایر";
}

function recordValue(record: FinancialRecord | undefined) {
  return record?.value ?? null;
}

function getRecord(model: FinancialModel, company: string, year: number, normalizedVariable: string) {
  return model.index.get(company)?.get(year)?.get(normalizedVariable);
}

function latestChange(model: FinancialModel, company: string, normalizedVariable: string, latestYear: number) {
  const years = model.years.filter((year) => year <= latestYear).sort((a, b) => b - a);
  const current = recordValue(getRecord(model, company, years[0], normalizedVariable));
  const previous = recordValue(getRecord(model, company, years[1], normalizedVariable));
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

function scoreBandClass(score: number | null) {
  if (score === null) return "empty";
  if (score >= 7) return "good";
  if (score >= 4) return "medium";
  return "weak";
}

function loadStoredSettings(): ModelSettings {
  if (typeof window === "undefined") return structuredClone(DEFAULT_SETTINGS);
  try {
    const stored = window.localStorage.getItem("ips-financial-model-settings-v4");
    if (stored) {
      const parsed = JSON.parse(stored) as ModelSettings;
      const merged: ModelSettings = {
        ...structuredClone(DEFAULT_SETTINGS),
        ...parsed,
        weights: {
          ...structuredClone(DEFAULT_SETTINGS.weights),
          ...parsed.weights,
        },
        performance: {
          ...structuredClone(DEFAULT_SETTINGS.performance),
          ...(parsed.performance ?? {}),
          dimensionWeights: {
            ...DEFAULT_SETTINGS.performance.dimensionWeights,
            ...(parsed.performance?.dimensionWeights ?? {}),
          },
          dimensionWeightsByNature: {
            production: {
              ...DEFAULT_SETTINGS.performance.dimensionWeightsByNature.production,
              ...(parsed.performance?.dimensionWeightsByNature?.production ?? {}),
            },
            trade: {
              ...DEFAULT_SETTINGS.performance.dimensionWeightsByNature.trade,
              ...(parsed.performance?.dimensionWeightsByNature?.trade ?? {}),
            },
            service: {
              ...DEFAULT_SETTINGS.performance.dimensionWeightsByNature.service,
              ...(parsed.performance?.dimensionWeightsByNature?.service ?? {}),
            },
            financial: {
              ...DEFAULT_SETTINGS.performance.dimensionWeightsByNature.financial,
              ...(parsed.performance?.dimensionWeightsByNature?.financial ?? {}),
            },
          },
          historyWeights: {
            ...DEFAULT_SETTINGS.performance.historyWeights,
            ...(parsed.performance?.historyWeights ?? {}),
          },
          twoYearWeights: {
            ...DEFAULT_SETTINGS.performance.twoYearWeights,
            ...(parsed.performance?.twoYearWeights ?? {}),
          },
        },
      };
      if (settingsAreValid(merged)) return merged;
    }
  } catch {
    // Corrupted device-local preferences are ignored.
  }
  return structuredClone(DEFAULT_SETTINGS);
}

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

function percent(value: number) {
  return new Intl.NumberFormat("fa-IR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function safeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*]+/g, "-").trim();
}

async function parseExcelFile(file: File): Promise<FinancialModel> {
  const data = await file.arrayBuffer();
  return parseFinancialWorkbook(data, file.name);
}

async function parseMarketFile(file: File): Promise<MarketModel> {
  const data = await file.arrayBuffer();
  return parseMarketWorkbook(data, file.name);
}

async function parseProductFile(file: File): Promise<ProductionModel> {
  const data = await file.arrayBuffer();
  return parseProductionWorkbook(data, file.name);
}

async function downloadTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([
    [...REQUIRED_COLUMNS],
    [
      "تولیدی",
      "نام شرکت",
      1404,
      "حاشیه سود عملیاتی",
      501,
      "درصد",
      0.18,
      7.5,
      "مطلوب",
    ],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "دیتا");
  XLSX.writeFile(workbook, "قالب-ورودی-داشبورد-مالی.xlsx");
}

function downloadMarketTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["شرکت", "بخش", "امتیاز"],
    ["فولاد متیل", "کل", 7.075],
    ["فولاد متیل", "اندازه و ضرورت", 8.15],
    ["فولاد متیل", "رشد و آینده", 5.3125],
    ["فولاد متیل", "پایداری و تنوع", 7.1],
    ["فولاد متیل", "رقابت و ورود", 6.8],
    ["فولاد متیل", "توسعه و ریسک", 7.4],
  ]);
  sheet["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 12 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "ارزیابی بازار");
  XLSX.writeFile(workbook, "قالب-دیتابیس-ارزیابی-بازار.xlsx");
}

function FileDrop({
  onFile,
  busy,
  compact = false,
}: {
  onFile: (file: File) => void;
  busy: boolean;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      className={`file-drop ${dragging ? "dragging" : ""} ${compact ? "compact" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onFile(file);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.currentTarget.value = "";
        }}
      />
      {busy ? (
        <LoaderCircle className="spin" size={compact ? 18 : 30} />
      ) : (
        <Upload size={compact ? 18 : 30} />
      )}
      {!compact && (
        <>
          <strong>{busy ? "در حال خواندن و اعتبارسنجی…" : "فایل Excel را اینجا رها کنید"}</strong>
          <span>فرمت‌های XLSX، XLS و CSV · پردازش امن در مرورگر</span>
        </>
      )}
      <button
        className={compact ? "text-button" : "primary-button"}
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {compact ? "جایگزینی فایل" : "انتخاب فایل از رایانه"}
      </button>
    </div>
  );
}

function QualityStat({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "good" | "warning" | "danger";
}) {
  return (
    <div className={`quality-stat ${tone}`}>
      <span className="quality-icon">{icon}</span>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function DatabaseUploadCard({
  holding,
  model,
  busy,
  error,
  duplicateConfirmed,
  onDuplicateConfirmed,
  onFile,
  onClear,
}: {
  holding: HoldingSelection;
  model: FinancialModel | null;
  busy: boolean;
  error: string;
  duplicateConfirmed: boolean;
  onDuplicateConfirmed: (value: boolean) => void;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <article className={`database-upload-card ${model ? "ready" : ""}`}>
      <header>
        <span className="database-card-icon">
          <Building2 size={20} />
        </span>
        <div>
          <strong>{HOLDING_LABELS[holding]}</strong>
          <small>
            {holding === "atieh"
              ? "دیتابیس شرکت‌های اصلی پرتفوی آتیه"
              : "دیتابیس شرکت‌های سرویس‌سنتر گروه متیل"}
          </small>
        </div>
        <b className={model ? "ready" : "waiting"}>
          {model ? <Check size={13} /> : <Database size={13} />}
          {model ? "آماده" : "در انتظار فایل"}
        </b>
      </header>

      {!model ? (
        <FileDrop onFile={onFile} busy={busy} />
      ) : (
        <div className="database-file-ready">
          <div className="file-ready-header">
            <span className="file-icon">
              <FileSpreadsheet size={22} />
            </span>
            <div>
              <strong>{model.fileName}</strong>
              <span>
                {model.summary.totalRecords.toLocaleString("fa-IR")} رکورد ·{" "}
                {model.summary.companies.toLocaleString("fa-IR")} شرکت
              </span>
            </div>
            <button type="button" className="icon-button" onClick={onClear} aria-label={`حذف فایل ${HOLDING_LABELS[holding]}`}>
              <X size={16} />
            </button>
          </div>

          <div className="database-mini-stats">
            <span><Building2 size={15} /><b>{model.summary.companies.toLocaleString("fa-IR")}</b> شرکت</span>
            <span><FileCheck2 size={15} /><b>{percent(model.summary.rankingScoreCompleteness)}</b> پوشش ۱۳ شاخص رتبه</span>
            <span><AlertTriangle size={15} /><b>{model.summary.warnings.toLocaleString("fa-IR")}</b> هشدار</span>
          </div>

          {model.missingColumns.length > 0 ? (
            <div className="validation-callout danger">
              <AlertTriangle size={17} />
              <div>
                <strong>ساختار فایل کامل نیست</strong>
                <span>ستون‌های مفقود: {model.missingColumns.join("، ")}</span>
              </div>
            </div>
          ) : (
            <div className="validation-callout success compact">
              <Check size={17} />
              <div>
                <strong>ساختار فایل تأیید شد</strong>
                <span>دیتابیس برای تحلیل و سوییچ داخل داشبورد آماده است.</span>
              </div>
            </div>
          )}

          {model.duplicateCount > 0 && (
            <label className="duplicate-confirm">
              <input
                type="checkbox"
                checked={duplicateConfirmed}
                onChange={(event) => onDuplicateConfirmed(event.target.checked)}
              />
              آخرین رکورد از هر گروه تکراری برای محاسبه استفاده شود.
            </label>
          )}

          <FileDrop onFile={onFile} busy={busy} compact />
        </div>
      )}
      {error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}
    </article>
  );
}

function MarketDatabaseUploadCard({
  model,
  busy,
  error,
  onFile,
  onClear,
}: {
  model: MarketModel | null;
  busy: boolean;
  error: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <article className={`database-upload-card market-upload-card ${model ? "ready" : ""}`}>
      <header>
        <span className="database-card-icon"><Target size={20} /></span>
        <div><strong>دیتابیس ارزیابی بازار</strong><small>ورودی اختیاری برای ماتریس راهبردی آتیه فولاد</small></div>
        <b className={model ? "ready" : "optional"}>{model ? <Check size={13} /> : <Database size={13} />}{model ? "آماده" : "اختیاری"}</b>
      </header>
      {!model ? (
        <>
          <FileDrop onFile={onFile} busy={busy} />
          <button type="button" className="market-template-link" onClick={downloadMarketTemplate}><FileDown size={14} />دریافت قالب نمونه بازار</button>
        </>
      ) : (
        <div className="database-file-ready">
          <div className="file-ready-header">
            <span className="file-icon"><FileSpreadsheet size={22} /></span>
            <div><strong>{model.fileName}</strong><span>{model.summary.totalRows.toLocaleString("fa-IR")} ردیف · {model.summary.companies.toLocaleString("fa-IR")} شرکت</span></div>
            <button type="button" className="icon-button" onClick={onClear} aria-label="حذف فایل ارزیابی بازار"><X size={16} /></button>
          </div>
          <div className="database-mini-stats">
            <span><Building2 size={15} /><b>{model.summary.validTotals.toLocaleString("fa-IR")}</b> امتیاز کل معتبر</span>
            <span><AlertTriangle size={15} /><b>{model.summary.errors.toLocaleString("fa-IR")}</b> خطا</span>
            <span><Info size={15} /><b>{model.summary.warnings.toLocaleString("fa-IR")}</b> هشدار</span>
          </div>
          <div className={`validation-callout ${model.summary.errors ? "danger" : "success"} compact`}>
            {model.summary.errors ? <AlertTriangle size={17} /> : <Check size={17} />}
            <div><strong>{model.summary.errors ? "فایل با خطاهای قابل بررسی بارگذاری شد" : "ساختار فایل بازار تأیید شد"}</strong><span>{model.summary.errors ? "ردیف‌های سالم قابل استفاده‌اند؛ جزئیات در ماژول نمایش داده می‌شود." : "ماتریس راهبردی در رتبه‌نمای آتیه فعال است."}</span></div>
          </div>
          <FileDrop onFile={onFile} busy={busy} compact />
        </div>
      )}
      {error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}
    </article>
  );
}

function BenchmarkDatabaseUploadCard({
  model,
  busy,
  error,
  onFile,
  onClear,
}: {
  model: BenchmarkModel | null;
  busy: boolean;
  error: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <article className={`database-upload-card benchmark-upload-card ${model ? "ready" : ""}`}>
      <header>
        <span className="database-card-icon"><TrendingUp size={20} /></span>
        <div><strong>دیتابیس پایش تطبیقی عملکرد</strong><small>مقایسه ۱۴۰۴ با ۱۴۰۳ برای شرکت‌های آتیه و رقبا</small></div>
        <b className={model ? "ready" : "optional"}>{model ? <Check size={13} /> : <Database size={13} />}{model ? "آماده" : "اختیاری"}</b>
      </header>
      {!model ? (
        <FileDrop onFile={onFile} busy={busy} />
      ) : (
        <div className="database-file-ready">
          <div className="file-ready-header">
            <span className="file-icon"><FileSpreadsheet size={22} /></span>
            <div><strong>{model.fileName}</strong><span>{model.summary.rows.toLocaleString("fa-IR")} رکورد · {model.summary.companies.toLocaleString("fa-IR")} شرکت</span></div>
            <button type="button" className="icon-button" onClick={onClear} aria-label="حذف فایل پایش تطبیقی"><X size={16} /></button>
          </div>
          <div className="database-mini-stats">
            <span><Building2 size={15} /><b>{model.summary.atiehCompanies.toLocaleString("fa-IR")}</b> شرکت آتیه</span>
            <span><Target size={15} /><b>{model.summary.competitors.toLocaleString("fa-IR")}</b> رقیب</span>
            <span><FileCheck2 size={15} /><b>{Math.round(model.summary.completeness * 100).toLocaleString("fa-IR")}٪</b> پوشش</span>
          </div>
          <div className="validation-callout success compact">
            <Check size={17} /><div><strong>ساختار فایل مقایسه تأیید شد</strong><span>ماژول پایش تطبیقی عملکرد آماده استفاده است.</span></div>
          </div>
          <FileDrop onFile={onFile} busy={busy} compact />
        </div>
      )}
      {error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}
    </article>
  );
}

function ProductDatabaseUploadCard({
  model,
  busy,
  error,
  onFile,
  onClear,
}: {
  model: ProductionModel | null;
  busy: boolean;
  error: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <article className={`database-upload-card product-upload-card ${model ? "ready" : ""}`}>
      <header>
        <span className="database-card-icon"><Activity size={20} /></span>
        <div><strong>دیتابیس تولید و بهره‌برداری</strong><small>ورودی ماژول تحلیل سرمایه‌گذاری و مسیر بودجه ۱۴۰۵</small></div>
        <b className={model ? "ready" : "optional"}>{model ? <Check size={13} /> : <Database size={13} />}{model ? "آماده" : "اختیاری"}</b>
      </header>
      {!model ? <FileDrop onFile={onFile} busy={busy} /> : (
        <div className="database-file-ready">
          <div className="file-ready-header">
            <span className="file-icon"><FileSpreadsheet size={22} /></span>
            <div><strong>{model.fileName}</strong><span>{model.summary.validRows.toLocaleString("fa-IR")} ردیف · {model.summary.companies.toLocaleString("fa-IR")} شرکت · {model.summary.years.toLocaleString("fa-IR")} سال</span></div>
            <button type="button" className="icon-button" onClick={onClear} aria-label="حذف فایل تولید"><X size={16} /></button>
          </div>
          <div className="database-mini-stats">
            <span><Building2 size={15} /><b>{model.summary.companies.toLocaleString("fa-IR")}</b> شرکت</span>
            <span><Activity size={15} /><b>{model.summary.productionLines.toLocaleString("fa-IR")}</b> رکورد خط تولید</span>
            <span><AlertTriangle size={15} /><b>{model.summary.warnings.toLocaleString("fa-IR")}</b> هشدار</span>
          </div>
          <div className="validation-callout success compact"><Check size={17} /><div><strong>ساختار فایل تولید تأیید شد</strong><span>ماژول تحلیل سرمایه‌گذاری آماده استفاده است.</span></div></div>
          <FileDrop onFile={onFile} busy={busy} compact />
        </div>
      )}
      {error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}
    </article>
  );
}

function ProfitDatabaseUploadCard({ model, busy, error, onFile, onClear }: {
  model: ProfitModel | null;
  busy: boolean;
  error: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return <article className={`database-upload-card profit-upload-card ${model ? "ready" : ""}`}>
    <header><span className="database-card-icon"><CircleDollarSign size={20} /></span><div><strong>دیتابیس سود و بودجه (Profit)</strong><small>محصول، سود ناخالص و سناریوی بودجه ۱۴۰۵</small></div><b className={model ? "ready" : "optional"}>{model ? <Check size={13} /> : <Database size={13} />}{model ? "آماده" : "اختیاری"}</b></header>
    {!model ? <FileDrop onFile={onFile} busy={busy} /> : <div className="database-file-ready"><div className="file-ready-header"><span className="file-icon"><FileSpreadsheet size={22} /></span><div><strong>{model.fileName}</strong><span>{model.summary.validRows.toLocaleString("fa-IR")} ردیف · {model.summary.companies.toLocaleString("fa-IR")} شرکت · {model.summary.budgetCompanies.toLocaleString("fa-IR")} بودجه</span></div><button type="button" className="icon-button" onClick={onClear} aria-label="حذف فایل Profit"><X size={16} /></button></div><div className="database-mini-stats"><span><Package size={15} /><b>{model.records.filter((row) => !row.isTotal).length.toLocaleString("fa-IR")}</b> ردیف محصول</span><span><Target size={15} /><b>{model.summary.budgetCompanies.toLocaleString("fa-IR")}</b> شرکت بودجه‌دار</span><span><AlertTriangle size={15} /><b>{model.summary.warnings.toLocaleString("fa-IR")}</b> هشدار</span></div><div className={`validation-callout ${model.summary.warnings ? "warning" : "success"} compact`}>{model.summary.warnings ? <AlertTriangle size={17} /> : <Check size={17} />}<div><strong>{model.summary.warnings ? "فایل با کنترل‌های کیفیت بارگذاری شد" : "ساختار Profit تأیید شد"}</strong><span>حاشیه سود و بهای تمام‌شده در موتور مجدداً محاسبه می‌شوند.</span></div></div><FileDrop onFile={onFile} busy={busy} compact /></div>}
    {error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}
  </article>;
}

function AssetDatabaseUploadCard({ model, busy, error, onFile, onClear }: {
  model: AssetModel | null;
  busy: boolean;
  error: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return <article className={`database-upload-card asset-upload-card ${model ? "ready" : ""}`}>
    <header><span className="database-card-icon"><Boxes size={20} /></span><div><strong>دارایی‌های تجمیع‌شده</strong><small>تجهیزات و ارزش دفتری شرکت‌های آتیه و متیل</small></div><b className={model ? "ready" : "optional"}>{model ? <Check size={13} /> : <Database size={13} />}{model ? "آماده" : "اختیاری"}</b></header>
    {!model ? <FileDrop onFile={onFile} busy={busy} /> : <div className="database-file-ready"><div className="file-ready-header"><span className="file-icon"><FileSpreadsheet size={22} /></span><div><strong>{model.fileName}</strong><span>{model.summary.validRows.toLocaleString("fa-IR")} قلم · {model.summary.companies.toLocaleString("fa-IR")} شرکت · {model.summary.groups.toLocaleString("fa-IR")} گروه</span></div><button type="button" className="icon-button" onClick={onClear} aria-label="حذف فایل دارایی‌ها"><X size={16} /></button></div><div className="database-mini-stats"><span><Building2 size={15} /><b>{model.summary.companies.toLocaleString("fa-IR")}</b> شرکت</span><span><Boxes size={15} /><b>{model.summary.validRows.toLocaleString("fa-IR")}</b> قلم دارایی</span><span><AlertTriangle size={15} /><b>{model.issues.length.toLocaleString("fa-IR")}</b> کسری مبلغ</span></div><div className="validation-callout success compact"><Check size={17} /><div><strong>ساختار دارایی‌ها تأیید شد</strong><span>مبالغ در تحلیل به میلیون ریال نمایش داده می‌شوند.</span></div></div><FileDrop onFile={onFile} busy={busy} compact /></div>}
    {error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}
  </article>;
}

function MetilActivityUploadCard({ model, busy, error, onFile, onClear }: {
  model: MetilActivityModel | null;
  busy: boolean;
  error: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return <article className={`database-upload-card metil-activity-upload-card ${model ? "ready" : ""}`}>
    <header><span className="database-card-icon"><Package size={20} /></span><div><strong>فعالیت گروه متیل</strong><small>فروش و خدمات سال ۱۴۰۴ به تفکیک محصول</small></div><b className={model ? "ready" : "optional"}>{model ? <Check size={13} /> : <Database size={13} />}{model ? "آماده" : "اختیاری"}</b></header>
    {!model ? <FileDrop onFile={onFile} busy={busy} /> : <div className="database-file-ready"><div className="file-ready-header"><span className="file-icon"><FileSpreadsheet size={22} /></span><div><strong>{model.fileName}</strong><span>{model.summary.validRows.toLocaleString("fa-IR")} رکورد · {model.summary.companies.toLocaleString("fa-IR")} شرکت · سال {model.summary.year?.toLocaleString("fa-IR", { useGrouping: false }) ?? "—"}</span></div><button type="button" className="icon-button" onClick={onClear} aria-label="حذف فایل فعالیت متیل"><X size={16} /></button></div><div className="database-mini-stats"><span><Building2 size={15} /><b>{model.summary.companies.toLocaleString("fa-IR")}</b> شرکت</span><span><Package size={15} /><b>{model.summary.products.toLocaleString("fa-IR")}</b> محصول</span><span><FileCheck2 size={15} /><b>{model.summary.validRows.toLocaleString("fa-IR")}</b> رکورد معتبر</span></div><div className="validation-callout success compact"><Check size={17} /><div><strong>ساختار فعالیت متیل تأیید شد</strong><span>نمودارهای مبلغ فروش، خدمات و حجم فروش آماده‌اند.</span></div></div><FileDrop onFile={onFile} busy={busy} compact /></div>}
    {error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}
  </article>;
}

function MetilEquipmentUploadCard({ model, busy, error, onFile, onClear }: {
  model: EquipmentModel | null;
  busy: boolean;
  error: string;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  return <article className={`database-upload-card metil-equipment-upload-card ${model ? "ready" : ""}`}>
    <header><span className="database-card-icon"><Wrench size={20} /></span><div><strong>تجهیزات گروه متیل</strong><small>نوع تجهیز، دامنه عملکرد و ظرفیت تک‌شیفت</small></div><b className={model ? "ready" : "optional"}>{model ? <Check size={13} /> : <Database size={13} />}{model ? "آماده" : "اختیاری"}</b></header>
    {!model ? <FileDrop onFile={onFile} busy={busy} /> : <div className="database-file-ready"><div className="file-ready-header"><span className="file-icon"><FileSpreadsheet size={22} /></span><div><strong>{model.fileName}</strong><span>{model.summary.validRows.toLocaleString("fa-IR")} تجهیز · {model.summary.companies.toLocaleString("fa-IR")} شرکت · {model.summary.equipmentTypes.toLocaleString("fa-IR")} نوع</span></div><button type="button" className="icon-button" onClick={onClear} aria-label="حذف فایل تجهیزات متیل"><X size={16} /></button></div><div className="database-mini-stats"><span><Building2 size={15} /><b>{model.summary.companies.toLocaleString("fa-IR")}</b> شرکت</span><span><Wrench size={15} /><b>{model.summary.validRows.toLocaleString("fa-IR")}</b> تجهیز</span><span><AlertTriangle size={15} /><b>{model.issues.length.toLocaleString("fa-IR")}</b> هشدار</span></div><div className="validation-callout success compact"><Check size={17} /><div><strong>ساختار تجهیزات متیل تأیید شد</strong><span>ظرفیت واقعی، اسمی و دامنه ضخامت و عرض آماده تحلیل است.</span></div></div><FileDrop onFile={onFile} busy={busy} compact /></div>}
    {error && <div className="inline-error"><AlertTriangle size={15} />{error}</div>}
  </article>;
}

function UploadScreen({
  models,
  marketModel,
  benchmarkModel,
  productModel,
  profitModel,
  assetModel,
  metilActivityModel,
  equipmentModel,
  marketBusy,
  marketError,
  benchmarkBusy,
  benchmarkError,
  productBusy,
  productError,
  profitBusy,
  profitError,
  assetBusy,
  assetError,
  metilActivityBusy,
  metilActivityError,
  equipmentBusy,
  equipmentError,
  busy,
  errors,
  duplicateConfirmed,
  onDuplicateConfirmed,
  onFile,
  onMarketFile,
  onBenchmarkFile,
  onProductFile,
  onProfitFile,
  onAssetFile,
  onMetilActivityFile,
  onEquipmentFile,
  onOpenModule,
  onClear,
  onClearMarket,
  onClearBenchmark,
  onClearProduct,
  onClearProfit,
  onClearAsset,
  onClearMetilActivity,
  onClearEquipment,
}: {
  models: HoldingModels;
  marketModel: MarketModel | null;
  benchmarkModel: BenchmarkModel | null;
  productModel: ProductionModel | null;
  profitModel: ProfitModel | null;
  assetModel: AssetModel | null;
  metilActivityModel: MetilActivityModel | null;
  equipmentModel: EquipmentModel | null;
  marketBusy: boolean;
  marketError: string;
  benchmarkBusy: boolean;
  benchmarkError: string;
  productBusy: boolean;
  productError: string;
  profitBusy: boolean;
  profitError: string;
  assetBusy: boolean;
  assetError: string;
  metilActivityBusy: boolean;
  metilActivityError: string;
  equipmentBusy: boolean;
  equipmentError: string;
  busy: HoldingFlags;
  errors: HoldingErrors;
  duplicateConfirmed: HoldingFlags;
  onDuplicateConfirmed: (holding: HoldingSelection, value: boolean) => void;
  onFile: (holding: HoldingSelection, file: File) => void;
  onMarketFile: (file: File) => void;
  onBenchmarkFile: (file: File) => void;
  onProductFile: (file: File) => void;
  onProfitFile: (file: File) => void;
  onAssetFile: (file: File) => void;
  onMetilActivityFile: (file: File) => void;
  onEquipmentFile: (file: File) => void;
  onOpenModule: (module: Extract<AppTab, "analysis" | "performance" | "benchmark" | "investment" | "data">) => void;
  onClear: (holding: HoldingSelection) => void;
  onClearMarket: () => void;
  onClearBenchmark: () => void;
  onClearProduct: () => void;
  onClearProfit: () => void;
  onClearAsset: () => void;
  onClearMetilActivity: () => void;
  onClearEquipment: () => void;
}) {
  const blocking = HOLDING_KEYS.some((key) => {
    const model = models[key];
    return !model || model.missingColumns.length > 0 || (model.duplicateCount > 0 && !duplicateConfirmed[key]);
  });
  const readyCount = HOLDING_KEYS.filter((key) => models[key]).length;
  return (
    <main className="upload-page">
      <header className="upload-header">
        <div className="brand-lockup">
          <span className="brand-mark">
            <BarChart3 size={22} />
          </span>
          <div>
            <strong>سامانه هوشمند ارزیابی مالی پرتفوی</strong>
            <span>هلدینگ آتیه فولاد · IPS Finance</span>
          </div>
        </div>
        <button type="button" className="outline-button" onClick={downloadTemplate}>
          <FileDown size={17} />
          دانلود قالب استاندارد
        </button>
      </header>

      <section className="upload-hero">
        <div className="hero-copy">
          <span className="product-badge">
            <Sparkles size={15} />
            تحلیل چندبعدی عملکرد شرکت‌های زیرمجموعه
          </span>
          <h1>سامانه تحلیل مالی و راهبری سرمایه آتیه</h1>
          <p>
            دو دیتابیس مالی آتیه فولاد و فولاد متیل را بارگذاری کنید؛ فایل‌های بازار،
            مقایسه عملکرد، تولید، دارایی‌ها، فعالیت و تجهیزات متیل نیز تحلیل‌های تخصصی سامانه را تکمیل می‌کنند.
          </p>
          <div className="hero-proof">
            <span>
              <BarChart3 size={18} /> دیدبان مالی
            </span>
            <span>
              <CircleGauge size={18} /> رتبه‌نمای عملکرد
            </span>
            <span>
              <Database size={18} /> مرکز داده
            </span>
          </div>
        </div>
        <div className="upload-panel dual-upload-panel">
          <div className="dual-upload-heading">
            <span>ورودی هم‌زمان</span>
            <div>
              <strong>دیتابیس‌های مالی و ورودی‌های تخصصی تحلیل را بارگذاری کنید</strong>
              <small>دو فایل مالی برای ورود لازم‌اند؛ ورودی‌های تخصصی تحلیل بازار، سرمایه‌گذاری، دارایی و فعالیت را تکمیل می‌کنند.</small>
            </div>
            <b>{readyCount.toLocaleString("fa-IR")} از ۲ مالی آماده{marketModel ? " · بازار" : ""}{benchmarkModel ? " · مقایسه" : ""}{productModel ? " · تولید" : ""}{profitModel ? " · Profit" : ""}{assetModel ? " · دارایی" : ""}{metilActivityModel ? " · متیل ۱۴۰۴" : ""}{equipmentModel ? " · تجهیزات متیل" : ""}</b>
          </div>

          <section className="upload-input-group primary-inputs">
            <header><span>ورودی‌های اصلی</span><strong>دو دیتابیس مالی موردنیاز برای ورود به سامانه</strong></header>
            <div className="database-upload-grid">
              {HOLDING_KEYS.map((key) => (
                <DatabaseUploadCard
                  key={key}
                  holding={key}
                  model={models[key]}
                  busy={busy[key]}
                  error={errors[key]}
                  duplicateConfirmed={duplicateConfirmed[key]}
                  onDuplicateConfirmed={(value) => onDuplicateConfirmed(key, value)}
                  onFile={(file) => onFile(key, file)}
                  onClear={() => onClear(key)}
                />
              ))}
            </div>
          </section>

          <section className="upload-input-group supporting-inputs">
            <header><span>ورودی‌های تکمیلی</span><strong>برای فعال‌سازی تحلیل بازار، سرمایه‌گذاری، دارایی و عملیات</strong></header>
            <div className="database-upload-grid">
              <MarketDatabaseUploadCard
                model={marketModel}
                busy={marketBusy}
                error={marketError}
                onFile={onMarketFile}
                onClear={onClearMarket}
              />
              <BenchmarkDatabaseUploadCard
                model={benchmarkModel}
                busy={benchmarkBusy}
                error={benchmarkError}
                onFile={onBenchmarkFile}
                onClear={onClearBenchmark}
              />
              <ProductDatabaseUploadCard
                model={productModel}
                busy={productBusy}
                error={productError}
                onFile={onProductFile}
                onClear={onClearProduct}
              />
              <ProfitDatabaseUploadCard model={profitModel} busy={profitBusy} error={profitError} onFile={onProfitFile} onClear={onClearProfit} />
              <AssetDatabaseUploadCard model={assetModel} busy={assetBusy} error={assetError} onFile={onAssetFile} onClear={onClearAsset} />
              <MetilActivityUploadCard model={metilActivityModel} busy={metilActivityBusy} error={metilActivityError} onFile={onMetilActivityFile} onClear={onClearMetilActivity} />
              <MetilEquipmentUploadCard model={equipmentModel} busy={equipmentBusy} error={equipmentError} onFile={onEquipmentFile} onClear={onClearEquipment} />
            </div>
          </section>

          <div className="dual-upload-action">
            <div>
              <ShieldCheck size={18} />
              <span>فایل‌ها فقط در مرورگر پردازش می‌شوند و به سرور ارسال نمی‌شوند.</span>
            </div>
          </div>

          {!blocking && (
            <section className="upload-module-launcher" aria-label="انتخاب بخش سامانه">
              <header>
                <span><Check size={16} />هر دو دیتابیس آماده‌اند</span>
                <div>
                  <strong>بخش موردنظر را انتخاب کنید</strong>
                  <small>در هر زمان می‌توانید بدون بارگذاری دوباره فایل‌ها به این صفحه بازگردید.</small>
                </div>
              </header>
              <div className="upload-module-grid">
                <button type="button" className="analysis" onClick={() => onOpenModule("analysis")}>
                  <span className="module-launch-icon"><BarChart3 size={28} /></span>
                  <div><strong>دیدبان مالی</strong><small>تحلیل نمودارهای اسکاتر و جایگاه شرکت‌ها</small></div>
                  <ArrowLeft size={19} />
                </button>
                <button type="button" className="performance" onClick={() => onOpenModule("performance")}>
                  <span className="module-launch-icon"><CircleGauge size={28} /></span>
                  <div><strong>رتبه‌نمای عملکرد</strong><small>امتیازدهی، وزن‌دهی و رتبه‌بندی پویا</small></div>
                  <ArrowLeft size={19} />
                </button>
                <button type="button" className="data" onClick={() => onOpenModule("data")}>
                  <span className="module-launch-icon"><Database size={28} /></span>
                  <div><strong>مرکز داده مالی</strong><small>مشاهده، مقایسه و دریافت داده‌ها</small></div>
                  <ArrowLeft size={19} />
                </button>
                {benchmarkModel && (
                  <button type="button" className="benchmark" onClick={() => onOpenModule("benchmark")}>
                    <span className="module-launch-icon"><TrendingUp size={28} /></span>
                    <div><strong>پایش تطبیقی عملکرد</strong><small>مقایسه شرکت‌های آتیه با رقبا در سال ۱۴۰۴</small></div>
                    <ArrowLeft size={19} />
                  </button>
                )}
                <button type="button" className="investment" onClick={() => onOpenModule("investment")}>
                    <span className="module-launch-icon"><Target size={28} /></span>
                    <div><strong>تحلیل سرمایه‌گذاری</strong><small>سرمایه، بهره‌برداری تولید و بهره‌وری دارایی‌ها</small></div>
                    <ArrowLeft size={19} />
                  </button>
              </div>
            </section>
          )}
        </div>
      </section>

      <section className="upload-steps">
        {[
          ["۰۱", "بارگذاری", "فایل اصلی بدون تغییر باقی می‌ماند."],
          ["۰۲", "کنترل کیفیت", "خطاها، کسری‌ها و تکرارها شناسایی می‌شوند."],
          ["۰۳", "تحلیل و امتیاز", "ماتریس‌های مالی و مدل شش‌بُعدی عملکرد محاسبه می‌شوند."],
          ["۰۴", "داده و مقایسه", "عدد خام، روند و مقایسه شرکت‌ها قابل مشاهده و دریافت است."],
        ].map(([number, title, copy]) => (
          <article key={number}>
            <span>{number}</span>
            <div>
              <strong>{title}</strong>
              <p>{copy}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function ScoreCard({
  axis,
  previous,
  onOpen,
}: {
  axis: AxisResult;
  previous: number | null;
  onOpen: () => void;
}) {
  const delta = axis.score === null || previous === null ? null : axis.score - previous;
  const band = axis.band;
  return (
    <button type="button" className={`score-card ${band ?? "empty"}`} onClick={onOpen}>
      <div className="score-card-top">
        <span>{axis.label}</span>
        <span className={`status-pill ${band ? BAND_COLORS[band] : "gray"}`}>
          {bandLabel(band)}
        </span>
      </div>
      <div className="score-card-main">
        <strong>{formatNumber(axis.score, 2)}</strong>
        <span>از ۱۰</span>
      </div>
      <div className="score-card-foot">
        {delta === null ? (
          <span className="delta neutral">بدون مبنای مقایسه</span>
        ) : Math.abs(delta) < 0.05 ? (
          <span className="delta neutral">بدون تغییر معنادار</span>
        ) : delta > 0 ? (
          <span className="delta up">
            <TrendingUp size={15} /> {formatNumber(Math.abs(delta), 2)} بهبود
          </span>
        ) : (
          <span className="delta down">
            <TrendingDown size={15} /> {formatNumber(Math.abs(delta), 2)} افت
          </span>
        )}
        <span className="coverage">پوشش {percent(axis.coverage)}</span>
      </div>
    </button>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  wide = false,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`select-field ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      <div>
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {children}
        </select>
        <ChevronDown size={15} />
      </div>
    </label>
  );
}

function CalculationDetails({
  axes,
  openAxis,
  onClose,
}: {
  axes: Record<AxisKey, AxisResult>;
  openAxis: AxisKey | null;
  onClose: () => void;
}) {
  if (!openAxis) return null;
  const axis = axes[openAxis];
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="calculation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`جزئیات محاسبه ${axis.label}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">حسابرسی امتیاز</p>
            <h3>{axis.label}</h3>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="بستن">
            <X size={18} />
          </button>
        </header>
        <div className="formula-box">
          <span>فرمول فعال</span>
          <strong>{axis.formula}</strong>
        </div>
        <div className="drawer-score">
          <div>
            <span>امتیاز نهایی</span>
            <strong>{formatNumber(axis.score, 2)}</strong>
          </div>
          <div>
            <span>پوشش داده</span>
            <strong>{percent(axis.coverage)}</strong>
          </div>
          <div>
            <span>طبقه</span>
            <strong>{bandLabel(axis.band)}</strong>
          </div>
        </div>
        <div className="component-list">
          {axis.components.map((component) => (
            <article key={component.key}>
              <div className="component-title">
                <div>
                  <strong>{component.label}</strong>
                  <span>{component.variable}</span>
                </div>
                <b>{formatNumber(component.score, 2)}</b>
              </div>
              <div className="component-math">
                <span>وزن اصلی {percent(component.originalWeight)}</span>
                <span>وزن تعدیل‌شده {percent(component.adjustedWeight)}</span>
                <span>سهم در نتیجه {formatNumber(component.contribution, 2)}</span>
              </div>
              {component.method && <p>{component.method}</p>}
            </article>
          ))}
        </div>
        {axis.warnings.length > 0 && (
          <div className="drawer-warnings">
            {axis.warnings.map((warning) => (
              <p key={warning}>
                <AlertTriangle size={15} />
                {warning}
              </p>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function buildPointsForDefinition({
  model,
  matrix,
  definition,
  selectedCompany,
  selectedYear,
  displayMode,
  natureFilter,
  bubbleMetric,
  settings,
}: {
  model: FinancialModel;
  matrix: Map<string, Map<number, AxisBundle>>;
  definition: ChartDefinition;
  selectedCompany: string;
  selectedYear: number;
  displayMode: DisplayMode;
  natureFilter: string;
  bubbleMetric: BubbleMetric;
  settings: ModelSettings;
}) {
  if (displayMode === "trend") {
    return [...(matrix.get(selectedCompany)?.values() ?? [])]
      .filter((bundle) => bundle.year <= selectedYear)
      .sort((a, b) => a.year - b.year)
      .map((bundle) =>
        buildChartPoint(model, bundle, definition, selectedCompany, bubbleMetric, settings),
      )
      .filter((point): point is ChartPoint => point !== null)
      .slice(-3);
  }
  const selectedNature = model.natureByCompany.get(selectedCompany) ?? "";
  return model.companies
    .filter((company) => {
      const nature = model.natureByCompany.get(company) ?? "";
      if (displayMode === "peers") return nature === selectedNature;
      return natureFilter === "همه" || nature === natureFilter;
    })
    .map((company) => matrix.get(company)?.get(selectedYear))
    .filter((bundle): bundle is AxisBundle => Boolean(bundle))
    .map((bundle) =>
      buildChartPoint(model, bundle, definition, selectedCompany, bubbleMetric, settings),
    )
    .filter((point): point is ChartPoint => point !== null);
}

function SummaryAnalysis({
  bundle,
  chartPoints,
}: {
  bundle: AxisBundle;
  chartPoints: Map<string, ChartPoint[]>;
}) {
  const insights = managementInsights(bundle);
  return (
    <section className="analysis-grid">
      <article className="analysis-card wide">
        <header>
          <div>
            <p className="eyebrow">جمع‌بندی مدیریتی</p>
            <h3>تصویر مالی {bundle.company}</h3>
          </div>
          <span className="analysis-year">{bundle.year}</span>
        </header>
        <div className="insight-columns">
          <div>
            <span className="insight-label good">نقاط قوت</span>
            {insights.strengths.map((axis) => (
              <p key={axis.key}>
                <Check size={16} /> {axis.label} با امتیاز {formatNumber(axis.score, 2)}
              </p>
            ))}
          </div>
          <div>
            <span className="insight-label danger">نقاط قابل بهبود</span>
            {insights.weaknesses.map((axis) => (
              <p key={axis.key}>
                <Target size={16} /> {axis.label} با امتیاز {formatNumber(axis.score, 2)}
              </p>
            ))}
          </div>
          <div>
            <span className="insight-label warning">هشدارها</span>
            {(insights.warnings.length ? insights.warnings : ["هشدار قاعده‌محور بااهمیتی شناسایی نشد."]).map(
              (warning) => (
                <p key={warning}>
                  <AlertTriangle size={16} /> {warning}
                </p>
              ),
            )}
          </div>
        </div>
      </article>
      <article className="analysis-card action-card">
        <header>
          <div>
            <p className="eyebrow">اولویت اقدام</p>
            <h3>پیشنهادهای مدیریتی</h3>
          </div>
        </header>
        <ol>
          {(insights.actions.length
            ? insights.actions
            : ["حفظ انضباط مالی و پایش ماهانه شاخص‌های دارای روند نزولی."]
          ).map((action, index) => (
            <li key={action}>
              <span>{(index + 1).toLocaleString("fa-IR")}</span>
              {action}
            </li>
          ))}
        </ol>
      </article>
      <article className="analysis-card trend-card">
        <header>
          <div>
            <p className="eyebrow">روند سه‌ساله</p>
            <h3>جهت حرکت</h3>
          </div>
        </header>
        <div className="trend-list">
          {CHART_DEFINITIONS.map((definition) => {
            const points = chartPoints.get(definition.key) ?? [];
            const first = points[0];
            const last = points[points.length - 1];
            const improved =
              first && last ? last.x + last.y - first.x - first.y : 0;
            return (
              <div key={definition.key}>
                <span className={`trend-icon ${improved >= 0 ? "up" : "down"}`}>
                  {improved >= 0 ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}
                </span>
                <div>
                  <strong>{definition.title}</strong>
                  <span>{trendDescription(points)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </section>
  );
}

function AnalyticalTable({
  chartPoints,
}: {
  chartPoints: Map<string, ChartPoint[]>;
}) {
  return (
    <section className="table-card">
      <header>
        <div>
          <p className="eyebrow">خلاصه چهار منظر</p>
          <h3>جدول تحلیلی شرکت</h3>
        </div>
        <Table2 size={20} />
      </header>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>نمودار</th>
              <th>محور افقی</th>
              <th>محور عمودی</th>
              <th>ناحیه فعلی</th>
              <th>روند سه‌ساله</th>
              <th>تفسیر</th>
            </tr>
          </thead>
          <tbody>
            {CHART_DEFINITIONS.map((definition) => {
              const points = chartPoints.get(definition.key) ?? [];
              const current = points[points.length - 1];
              return (
                <tr key={definition.key}>
                  <td>
                    <strong>{definition.title}</strong>
                  </td>
                  <td>{current ? formatNumber(current.x, 2) : "—"}</td>
                  <td>{current ? formatNumber(current.y, 2) : "—"}</td>
                  <td>{current?.regionTitle ?? "داده ناکافی"}</td>
                  <td>{trendDescription(points)}</td>
                  <td>{current?.interpretation ?? "امکان تفسیر وجود ندارد."}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function CompanyDashboard({
  model,
  matrix,
  settings,
  selectedCompany,
  setSelectedCompany,
  selectedYear,
  setSelectedYear,
  natureFilter,
  setNatureFilter,
  displayMode,
  setDisplayMode,
  bubbleMetric,
  setBubbleMetric,
  showAverage,
  setShowAverage,
  showLabels,
  setShowLabels,
  highlightSelected,
  setHighlightSelected,
  reportRef, reportFilter,
}: {
  model: FinancialModel;
  matrix: Map<string, Map<number, AxisBundle>>;
  settings: ModelSettings;
  selectedCompany: string;
  setSelectedCompany: (company: string) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  natureFilter: string;
  setNatureFilter: (nature: string) => void;
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  bubbleMetric: BubbleMetric;
  setBubbleMetric: (metric: BubbleMetric) => void;
  showAverage: boolean;
  setShowAverage: (value: boolean) => void;
  showLabels: boolean;
  setShowLabels: (value: boolean) => void;
  highlightSelected: boolean;
  setHighlightSelected: (value: boolean) => void;
  reportRef: React.RefObject<HTMLDivElement | null>;
  reportFilter?: React.ReactNode;
}) {
  const bundle = matrix.get(selectedCompany)?.get(selectedYear);
  const chartPoints = useMemo(() => {
    const entries = CHART_DEFINITIONS.map((definition) => [
      definition.key,
      buildPointsForDefinition({
        model,
        matrix,
        definition,
        selectedCompany,
        selectedYear,
        displayMode,
        natureFilter,
        bubbleMetric,
        settings,
      }),
    ] as const);
    return new Map(entries);
  }, [
    model,
    matrix,
    settings,
    selectedCompany,
    selectedYear,
    displayMode,
    natureFilter,
    bubbleMetric,
  ]);
  const trendOnlyPoints = useMemo(() => {
    const entries = CHART_DEFINITIONS.map((definition) => [
      definition.key,
      buildPointsForDefinition({
        model,
        matrix,
        definition,
        selectedCompany,
        selectedYear,
        displayMode: "trend",
        natureFilter,
        bubbleMetric,
        settings,
      }),
    ] as const);
    return new Map(entries);
  }, [model, matrix, settings, selectedCompany, selectedYear, natureFilter, bubbleMetric]);
  const previousBundle = useMemo(() => [...(matrix.get(selectedCompany)?.values() ?? [])]
    .filter((item) => item.year === selectedYear - 1)
    .sort((a, b) => b.year - a.year)[0] ?? null, [matrix, selectedCompany, selectedYear]);

  const eligibleCompanies = model.companies.filter(company => {
    const nature=matrix.get(company)?.get(selectedYear)?.nature;
    if(displayMode==='trend') return company===selectedCompany;
    if(displayMode==='peers') return nature===bundle?.nature;
    return natureFilter==='همه'||nature===natureFilter;
  });
  return (
    <div ref={reportRef} className="dashboard-report watch-v53">
      <section className="watch-filter-panel no-print" aria-label="فیلترهای دیده‌بان مالی">
        <header><div className="watch-filter-heading"><Filter size={19}/><div><h2>دیده‌بان مالی</h2><span>موقعیت شرکت، در یک نگاه</span></div></div>
          <div className="watch-mode-switch" role="group" aria-label="حالت نمایش">
            {DISPLAY_OPTIONS.map(option=><button type="button" key={option.value} aria-pressed={displayMode===option.value} className={displayMode===option.value?'active':''} onClick={()=>setDisplayMode(option.value)}>{option.label.replace('مسیر سه‌ساله شرکت','مسیر چندساله')}</button>)}
          </div>
        </header>
        <div className="watch-main-filters">
          <SelectField label="شرکت منتخب" value={selectedCompany} onChange={setSelectedCompany} wide>{model.companies.map(c=><option key={c}>{c}</option>)}</SelectField>
          {reportFilter}
          <SelectField label="سال مرجع" value={selectedYear} onChange={v=>setSelectedYear(Number(v))}>{[...model.years].reverse().map(y=><option key={y} value={y}>{y.toLocaleString('fa-IR',{useGrouping:false})}</option>)}</SelectField>
          {displayMode==='portfolio' && <SelectField label="ماهیت شرکت‌ها" value={natureFilter} onChange={setNatureFilter}><option value="همه">همه ماهیت‌ها</option>{model.natures.map(n=><option key={n}>{n}</option>)}</SelectField>}
        </div>
        <footer><span className="watch-scope">{displayMode==='trend'?'حداکثر سه دوره هم‌نوع تا سال مرجع؛ حرکت از قدیم به جدید':displayMode==='peers'?`هم‌ماهیت با شرکت منتخب · ${bundle?.nature??'ماهیت نامشخص'}`:'شرکت‌های پرتفوی در دوره انتخاب‌شده'}</span>
          {displayMode!=='trend'&&<details className="watch-display-options"><summary>گزینه‌های نمایش <ChevronDown size={14}/></summary><div>
            <SelectField label="اندازه نقاط" value={bubbleMetric} onChange={v=>setBubbleMetric(v as BubbleMetric)}>{BUBBLE_OPTIONS.map(o=><option value={o.value} key={o.value}>{o.label}</option>)}</SelectField>
            <label><input type="checkbox" checked={showAverage} onChange={e=>setShowAverage(e.target.checked)}/>میانگین گروه</label>
            <label><input type="checkbox" checked={showLabels} onChange={e=>setShowLabels(e.target.checked)}/>نام همه شرکت‌ها</label>
            <label><input type="checkbox" checked={highlightSelected} onChange={e=>setHighlightSelected(e.target.checked)}/>تأکید بر شرکت منتخب</label>
          </div></details>}
        </footer>
      </section>
      {!bundle?<div className="empty-state"><AlertTriangle size={25}/><p>برای این شرکت و دوره داده‌ای موجود نیست؛ شرکت، سال یا نوع گزارش را تغییر دهید.</p></div>:<>
        <section className="charts-grid watch-charts-grid" aria-label="چهار ماتریس وضعیت مالی">
          {CHART_DEFINITIONS.map(definition=><ScatterChart key={`${definition.key}-${displayMode}-${selectedCompany}-${selectedYear}-${model.reportKind}`} definition={definition} points={chartPoints.get(definition.key)??[]} showAverage={showAverage&&displayMode!=='trend'} showLabels={showLabels&&displayMode!=='trend'} showTrend={displayMode==='trend'} highlightSelected={highlightSelected} reportKind={model.reportKind} expectedCount={eligibleCompanies.length}/>)}
        </section>
        <FinancialWatchPolicy bundle={bundle} reportKind={model.reportKind}/>
        <WatchStatusTable bundle={bundle} previous={previousBundle} chartPoints={displayMode==='trend'?trendOnlyPoints:chartPoints} mode={displayMode} company={selectedCompany} year={selectedYear}/>

      </>}
    </div>
  );
}


// Retained for backward-compatible exports and legacy model audit screens.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PerformancePage({
  model,
  performanceMatrix,
  selectedCompany,
  setSelectedCompany,
  selectedYear,
  setSelectedYear,
}: {
  model: FinancialModel;
  performanceMatrix: PerformanceMatrix;
  selectedCompany: string;
  setSelectedCompany: (value: string) => void;
  selectedYear: number;
  setSelectedYear: (value: number) => void;
}) {
  const [nature, setNature] = useState("همه");
  const [query, setQuery] = useState("");
  const [openDimension, setOpenDimension] = useState<PerformanceDimensionKey | null>(null);
  const result = performanceMatrix.get(selectedCompany)?.get(selectedYear) ?? null;
  const ranking = performanceRows(performanceMatrix, selectedYear, nature).filter((item) =>
    item.company.includes(query.trim()),
  );
  const companyHistory = [...(performanceMatrix.get(selectedCompany)?.values() ?? [])]
    .filter((item) => item.year <= selectedYear)
    .sort((a, b) => a.year - b.year);
  const scoreDistribution = useMemo(
    () => distributionForYear(performanceMatrix, selectedYear),
    [performanceMatrix, selectedYear],
  );

  if (!result) {
    return (
      <div className="empty-state">
        <AlertTriangle size={28} />
        برای شرکت و سال انتخاب‌شده امتیاز قابل نمایش وجود ندارد.
      </div>
    );
  }

  const previousResult = performanceMatrix.get(selectedCompany)?.get(selectedYear - 1);
  const scoreDelta =
    result.finalScore !== null && previousResult?.finalScore !== null && previousResult?.finalScore !== undefined
      ? result.finalScore - previousResult.finalScore
      : null;
  const openResult = openDimension ? result.dimensions[openDimension] : null;

  return (
    <div className="performance-page performance-v2">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">ماژول دوم · رتبه‌نمای عملکرد</p>
          <h2>امتیازدهی، رتبه‌بندی و ارزیابی عملکرد مالی</h2>
          <span>مدل شش‌بُعدی، تعدیلات ارزش‌آفرینی و روند، جریمه‌های ریسک و رتبه نسبی.</span>
        </div>
      </section>

      <section className="filter-card compact">
        <div className="filter-grid">
          <SelectField label="شرکت" value={selectedCompany} onChange={setSelectedCompany} wide>
            {model.companies.map((company) => <option key={company} value={company}>{company}</option>)}
          </SelectField>
          <SelectField label="سال" value={selectedYear} onChange={(value) => setSelectedYear(Number(value))}>
            {[...model.years].reverse().map((year) => (
              <option key={year} value={year}>{year.toLocaleString("fa-IR", { useGrouping: false })}</option>
            ))}
          </SelectField>
          <SelectField label="ماهیت رتبه‌بندی" value={nature} onChange={setNature}>
            <option value="همه">همه ماهیت‌ها</option>
            {model.natures.map((item) => <option key={item} value={item}>{item}</option>)}
          </SelectField>
          <label className="search-field">
            <span>جست‌وجو در رتبه‌بندی</span>
            <div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام شرکت" /></div>
          </label>
        </div>
      </section>

      <section className={`performance-hero-v2 ${result.classification ?? "unreliable"}`}>
        <div className="performance-hero-copy">
          <div className="hero-company-line">
            <div>
              <span>{result.nature || "ماهیت نامشخص"}</span>
              <h3>{result.company}</h3>
              <p>سال {result.year.toLocaleString("fa-IR", { useGrouping: false })}</p>
            </div>
            <span className={`performance-class ${result.classification ?? "unreliable"}`}>
              {result.classificationLabel}
            </span>
          </div>
          <p className="performance-narrative">{result.narrative}</p>
          <div className="hero-risk-strip">
            <span><ShieldCheck size={16} />اطمینان {result.confidenceLabel}</span>
            <span><AlertTriangle size={16} />{result.penalties.length.toLocaleString("fa-IR")} هشدار ریسک</span>
            <span className={scoreDelta === null ? "neutral" : scoreDelta >= 0 ? "up" : "down"}>
              {scoreDelta === null ? "بدون مبنای سال قبل" : `${formatNumber(Math.abs(scoreDelta), 2)} ${scoreDelta >= 0 ? "بهبود" : "افت"}`}
            </span>
          </div>
        </div>
        <ScoreGauge score={result.finalScore} />
        <div className="performance-hero-metrics">
          <div><span>امتیاز مطلق</span><strong>{formatNumber(result.absoluteScore, 2)}</strong></div>
          <div><span>امتیاز نسبی</span><strong>{formatNumber(result.relativeScore, 2)}</strong><small>{result.comparisonGroup}</small></div>
          <div><span>پایه کالیبره‌شده</span><strong>{formatNumber(result.calibratedBaseScore, 2)}</strong><small>۷۵٪ مطلق + ۲۵٪ نسبی</small></div>
          <div><span>امتیاز سه‌ساله</span><strong>{formatNumber(result.weightedHistoryScore, 2)}</strong><small>{result.historyLabel}</small></div>
          <div><span>رتبه کل پرتفوی</span><strong>{result.ranking.overallRank?.toLocaleString("fa-IR") ?? "—"}</strong><small>از {result.ranking.totalCompanies.toLocaleString("fa-IR")}</small></div>
          <div><span>رتبه هم‌ماهیت</span><strong>{result.ranking.peerRank?.toLocaleString("fa-IR") ?? "—"}</strong><small>از {result.ranking.peerCompanies.toLocaleString("fa-IR")}</small></div>
          <div><span>پوشش مدل</span><strong>{percent(result.baseCoverage)}</strong><small>{result.confidenceLabel}</small></div>
          <div><span>صدک عملکرد</span><strong>{result.ranking.percentile === null ? "—" : `${formatNumber(result.ranking.percentile, 0)}٪`}</strong></div>
          <div><span>نسخه مدل</span><strong className="model-version-value">{result.modelVersion}</strong><small>ثبت‌شده در گزارش خروجی</small></div>
        </div>
      </section>

      {result.warnings.some((warning) => warning.includes("نیازمند کالیبراسیون")) && (
        <div className="validation-callout danger">
          <AlertTriangle size={18} />
          <div>
            <strong>مدل نیازمند کالیبراسیون</strong>
            <span>{result.warnings.find((warning) => warning.includes("نیازمند کالیبراسیون"))}</span>
          </div>
        </div>
      )}

      <section className="performance-score-grid-v2">
        {PERFORMANCE_DIMENSION_KEYS.map((key) => {
          const dimension = result.dimensions[key];
          const history = companyHistory
            .map((item) => item.dimensions[key].score)
            .filter((score): score is number => score !== null);
          return (
            <button
              type="button"
              key={key}
              className={`dimension-card ${scoreBandClass(dimension.score)}`}
              onClick={() => setOpenDimension(key)}
            >
              <div className="dimension-card-heading">
                <div>
                  <span>{dimension.label}</span>
                  <small>وزن مدل {Math.round(dimension.modelWeight * 100).toLocaleString("fa-IR")}٪</small>
                </div>
                <strong>{formatNumber(dimension.score, 2)}</strong>
              </div>
              <div className="dimension-card-body">
                <MiniSparkline values={history} />
                <dl>
                  <div><dt>سهم پایه</dt><dd>{formatNumber(dimension.baseContribution, 2)}</dd></div>
                  <div><dt>تغییر سالانه</dt><dd className={dimension.yearOverYearChange === null ? "" : dimension.yearOverYearChange >= 0 ? "up" : "down"}>{dimension.yearOverYearChange === null ? "—" : formatNumber(dimension.yearOverYearChange, 2)}</dd></div>
                  <div><dt>رتبه بُعدی</dt><dd>{dimension.portfolioRank?.toLocaleString("fa-IR") ?? "—"}</dd></div>
                </dl>
              </div>
              <span className="dimension-more">مشاهده فرمول و مؤلفه‌ها</span>
            </button>
          );
        })}
      </section>

      <section className="performance-chart-grid">
        <article className="performance-chart-card wide">
          <header><div><p className="eyebrow">ردیابی ساخت امتیاز</p><h3>آبشار امتیاز پایه تا امتیاز نهایی</h3></div><Info size={18} /></header>
          <WaterfallChart result={result} />
        </article>
        <article className="performance-chart-card">
          <header><div><p className="eyebrow">سهم ابعاد</p><h3>سهم هر بُعد در امتیاز پایه</h3></div></header>
          <DimensionContributionChart result={result} />
        </article>
        <article className="performance-chart-card">
          <header><div><p className="eyebrow">روند امتیاز</p><h3>امتیاز پایه و نهایی در طول زمان</h3></div></header>
          <ScoreTrendChart results={companyHistory} />
        </article>
        <article className="performance-chart-card">
          <header><div><p className="eyebrow">مقایسه پرتفوی</p><h3>ده شرکت نخست رتبه‌بندی</h3></div></header>
          <RankingBars rows={ranking} selectedCompany={selectedCompany} />
        </article>
        <article className="performance-chart-card wide">
          <header><div><p className="eyebrow">ماتریس امتیاز و روند</p><h3>جایگاه شرکت‌ها بر اساس امتیاز نهایی و شیب سه‌ساله</h3></div></header>
          <ScoreTrendMatrix rows={ranking} selectedCompany={selectedCompany} />
        </article>
      </section>

      <section className="table-card score-distribution-card">
        <header><div><p className="eyebrow">کنترل کالیبراسیون</p><h3>توزیع امتیاز نهایی پرتفوی</h3></div><span className="table-note-inline">این کنترل امتیازها را تغییر نمی‌دهد.</span></header>
        <div className="distribution-summary"><span>میانگین <b>{formatNumber(scoreDistribution.mean, 2)}</b></span><span>میانه <b>{formatNumber(scoreDistribution.median, 2)}</b></span><span>انحراف معیار <b>{formatNumber(scoreDistribution.standardDeviation, 2)}</b></span><span>حداقل <b>{formatNumber(scoreDistribution.minimum, 2)}</b></span><span>حداکثر <b>{formatNumber(scoreDistribution.maximum, 2)}</b></span></div>
        <div className="score-histogram">
          {([
            ["ممتاز", scoreDistribution.classes.excellent],
            ["مطلوب", scoreDistribution.classes.desirable],
            ["متوسط", scoreDistribution.classes.average],
            ["ضعیف", scoreDistribution.classes.weak],
            ["بحرانی", scoreDistribution.classes.critical],
          ] as const).map(([label, count]) => (
            <div key={label}>
              <span>{label}</span>
              <i style={{ width: `${scoreDistribution.count ? Math.max(8, count / scoreDistribution.count * 100) : 0}%` }} />
              <b>{count.toLocaleString("fa-IR")}</b>
            </div>
          ))}
        </div>
      </section>

      <section className="risk-audit-grid">
        <article className="audit-card">
          <header><div><p className="eyebrow">تعدیلات</p><h3>ارزش‌آفرینی و روند</h3></div></header>
          <div className="audit-lines">
            <div><span>تعدیل ROIC−WACC</span><strong className={result.valueCreationAdjustment >= 0 ? "up" : "down"}>{result.valueCreationAdjustment >= 0 ? "+" : ""}{formatNumber(result.valueCreationAdjustment, 2)}</strong><small>{result.valueCreationEvidence}</small></div>
            <div><span>تعدیل روند</span><strong className={result.trendAdjustment >= 0 ? "up" : "down"}>{result.trendAdjustment >= 0 ? "+" : ""}{formatNumber(result.trendAdjustment, 2)}</strong><small>{result.trendLabel}</small></div>
          </div>
        </article>
        <article className="audit-card">
          <header><div><p className="eyebrow">جریمه‌های ریسک</p><h3>{formatNumber(result.totalPenalty, 2)} امتیاز کسر شده</h3></div></header>
          <div className="risk-list">
            {result.penalties.length ? result.penalties.map((penalty) => (
              <div key={penalty.key} className={penalty.severity}>
                <AlertTriangle size={16} />
                <div><strong>{penalty.label}</strong><span>{penalty.evidence}</span></div>
                <b>−{formatNumber(penalty.value, 2)}</b>
              </div>
            )) : <div className="risk-empty"><ShieldCheck size={18} />جریمه ریسک فعالی ثبت نشده است.</div>}
          </div>
        </article>
      </section>

      <section className="table-card performance-table-card">
        <header>
          <div><p className="eyebrow">رتبه‌بندی پرتفوی</p><h3>رتبه مطلق و نسبی شرکت‌ها در سال {selectedYear.toLocaleString("fa-IR", { useGrouping: false })}</h3></div>
          <span className="table-count">{ranking.length.toLocaleString("fa-IR")} شرکت</span>
        </header>
        <div className="table-scroll performance-matrix">
          <table>
            <thead><tr><th>رتبه</th><th>شرکت</th><th>ماهیت</th><th>نهایی</th><th>مطلق</th><th>نسبی</th><th>پایه کالیبره</th><th>سه‌ساله</th>{PERFORMANCE_DIMENSION_KEYS.map((key) => <th key={key}>{result.dimensions[key].label}</th>)}<th>طبقه</th><th>پوشش</th><th>تغییر رتبه</th></tr></thead>
            <tbody>
              {ranking.map((item) => (
                <tr key={item.company} className={item.company === selectedCompany ? "selected-row" : ""} onClick={() => setSelectedCompany(item.company)}>
                  <td>{item.ranking.overallRank?.toLocaleString("fa-IR") ?? "—"}</td>
                  <td><button type="button" className="company-link">{item.company}</button></td>
                  <td>{item.nature || "—"}</td>
                  <td><strong>{formatNumber(item.finalScore, 2)}</strong></td>
                  <td>{formatNumber(item.absoluteScore, 2)}</td>
                  <td>{formatNumber(item.relativeScore, 2)}</td>
                  <td>{formatNumber(item.calibratedBaseScore, 2)}</td>
                  <td>{formatNumber(item.weightedHistoryScore, 2)}</td>
                  {PERFORMANCE_DIMENSION_KEYS.map((key) => <td key={key}><span className={`score-cell ${scoreBandClass(item.dimensions[key].score)}`}>{formatNumber(item.dimensions[key].score, 1)}</span></td>)}
                  <td><span className={`performance-class mini ${item.classification ?? "unreliable"}`}>{item.classificationLabel}</span></td>
                  <td>{percent(item.baseCoverage)}</td>
                  <td>{item.ranking.rankChange === null ? "—" : `${item.ranking.rankChange > 0 ? "+" : ""}${item.ranking.rankChange.toLocaleString("fa-IR")}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {openResult && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={() => setOpenDimension(null)}>
          <aside className="calculation-drawer performance-drawer" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span>جزئیات قابل حسابرسی</span><h3>{openResult.label}</h3></div>
              <button type="button" className="icon-button" onClick={() => setOpenDimension(null)} aria-label="بستن"><X size={18} /></button>
            </header>
            <div className="drawer-score">
              <div><span>امتیاز مطلق بُعد</span><strong>{formatNumber(openResult.absoluteScore, 2)}</strong></div>
              <div><span>امتیاز نسبی بُعد</span><strong>{formatNumber(openResult.relativeScore, 2)}</strong></div>
              <div><span>امتیاز کالیبره بُعد</span><strong>{formatNumber(openResult.calibratedScore, 2)}</strong></div>
              <div><span>پوشش شاخص‌ها</span><strong>{percent(openResult.coverage)}</strong></div>
              <div><span>سهم در پایه</span><strong>{formatNumber(openResult.baseContribution, 2)}</strong></div>
            </div>
            <div className="formula-box"><span>فرمول فعال</span><p>{openResult.formula}</p></div>
            <div className="component-list">
              {openResult.components.map((component) => (
                <article key={component.key}>
                  <div><strong>{component.label}</strong><span>{component.method ?? component.variable}</span></div>
                  <div className="component-values">
                    <span>مقدار <b>{formatNumber(component.value, 2)} {component.unit}</b></span>
                    <span>مطلق <b>{formatNumber(component.absoluteScore ?? null, 2)}</b></span>
                    <span>نسبی <b>{formatNumber(component.relativeScore ?? null, 2)}</b></span>
                    <span>تعدیل‌شده <b>{formatNumber(component.adjustedScore ?? component.score, 2)}</b></span>
                    <span>وزن مؤثر <b>{percent(component.adjustedWeight)}</b></span>
                    <span>سهم <b>{formatNumber(component.contribution, 2)}</b></span>
                  </div>
                </article>
              ))}
            </div>
            {!!openResult.warnings.length && <div className="drawer-warnings">{openResult.warnings.map((warning) => <p key={warning}><AlertTriangle size={15} />{warning}</p>)}</div>}
          </aside>
        </div>
      )}
    </div>
  );
}

function TrendChart({
  years,
  series,
  unit,
}: {
  years: number[];
  series: { name: string; color: string; values: (number | null)[] }[];
  unit: string;
}) {
  const [hoverPoint, setHoverPoint] = useState<{
    name: string;
    year: number;
    value: number;
    color: string;
    x: number;
    y: number;
  } | null>(null);
  const width = 760;
  const height = 270;
  const padding = { top: 28, right: 28, bottom: 42, left: 76 };
  const values = series.flatMap((item) => item.values.filter((value): value is number => value !== null));
  if (!values.length) return <div className="trend-chart-empty"><BarChart3 size={24} />برای این شاخص مقدار عددی قابل ترسیم وجود ندارد.</div>;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { const spread = Math.abs(min || 1) * 0.1; min -= spread; max += spread; }
  const range = max - min;
  const x = (index: number) => padding.left + (years.length <= 1 ? (width - padding.left - padding.right) / 2 : (index / (years.length - 1)) * (width - padding.left - padding.right));
  const y = (value: number) => padding.top + ((max - value) / range) * (height - padding.top - padding.bottom);
  const ticks = Array.from({ length: 5 }, (_, index) => max - (range * index) / 4);
  const showPoint = (
    event: ReactPointerEvent<SVGCircleElement>,
    item: { name: string; color: string },
    year: number,
    value: number,
  ) => {
    const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!bounds) return;
    setHoverPoint({
      name: item.name,
      year,
      value,
      color: item.color,
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    });
  };
  return (
    <div className="data-trend-chart" onPointerLeave={() => setHoverPoint(null)}>
      <div className="trend-legend">{series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}{unit && <b>{unit}</b>}</div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="نمودار روند شاخص">
        {ticks.map((tick) => <g key={tick}><line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} className="trend-grid-line" /><text x={padding.left - 10} y={y(tick) + 4} className="trend-y-label">{formatNumber(tick, 1)}</text></g>)}
        {years.map((year, index) => <text key={year} x={x(index)} y={height - 14} className="trend-x-label">{year.toLocaleString("fa-IR", { useGrouping: false })}</text>)}
        {series.map((item) => {
          const points = item.values.map((value, index) => value === null ? null : `${x(index)},${y(value)}`).filter((point): point is string => point !== null);
          return <g key={item.name}>{points.length > 1 && <polyline points={points.join(" ")} fill="none" stroke={item.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}{item.values.map((value, index) => value === null ? null : <circle key={`${item.name}-${years[index]}`} cx={x(index)} cy={y(value)} r="6" fill="#fff" stroke={item.color} strokeWidth="3" tabIndex={0} onPointerEnter={(event) => showPoint(event, item, years[index], value)} onPointerMove={(event) => showPoint(event, item, years[index], value)} onFocus={() => setHoverPoint({ name: item.name, year: years[index], value, color: item.color, x: (x(index) / width) * 100, y: (y(value) / height) * 100 })} onBlur={() => setHoverPoint(null)}><title>{item.name} · {years[index]} · {formatNumber(value, 2)} {unit}</title></circle>)}</g>;
        })}
      </svg>
      {hoverPoint && (
        <div className="data-point-tooltip" style={{ left: `${Math.max(15, Math.min(85, hoverPoint.x))}%`, top: `${Math.max(12, Math.min(82, hoverPoint.y))}%` }} role="status">
          <span style={{ background: hoverPoint.color }} />
          <div><strong>{hoverPoint.name}</strong><small>سال {hoverPoint.year.toLocaleString("fa-IR", { useGrouping: false })}</small></div>
          <b>{formatNumber(hoverPoint.value, 2)} {unit}</b>
        </div>
      )}
    </div>
  );
}

async function writeDataWorkbook(rows: Record<string, string | number | null>[], sheetName: string, fileName: string) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, fileName);
}

function recordToExportRow(record: FinancialRecord) {
  return { شرکت: record.company, ماهیت: record.nature, سال: record.year, دسته: dataCategory(record.variable), متغیر: record.variable, "کد متغیر": record.code, واحد: record.unit, مقدار: record.value, "تبدیل به شاخص": record.indexedValue, نمره: record.score };
}

function LegacyDataCenterPage({
  model,
  selectedCompany,
  setSelectedCompany,
  selectedYear,
  setSelectedYear,
}: {
  model: FinancialModel;
  selectedCompany: string;
  setSelectedCompany: (company: string) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
}) {
  const [view, setView] = useState<"profile" | "compare" | "raw">("profile");
  const [category, setCategory] = useState<DataCategory>("همه");
  const [query, setQuery] = useState("");
  const [selectedVariable, setSelectedVariable] = useState(model.validRecords[0]?.normalizedVariable ?? "");
  const [compareCompany, setCompareCompany] = useState(model.companies.find((company) => company !== selectedCompany) ?? selectedCompany);
  const comparisonCompany = compareCompany === selectedCompany
    ? model.companies.find((company) => company !== selectedCompany) ?? selectedCompany
    : compareCompany;
  const [rawCompany, setRawCompany] = useState("همه");
  const [rawYear, setRawYear] = useState("همه");
  const [scoreFilter, setScoreFilter] = useState("همه");
  const normalizedQuery = query.trim().toLowerCase();

  const variableMap = new Map<string, FinancialRecord>();
  model.validRecords.filter((record) => record.company === selectedCompany).forEach((record) => { if (!variableMap.has(record.normalizedVariable)) variableMap.set(record.normalizedVariable, record); });
  const profileVariables = [...variableMap.values()].filter((record) => (category === "همه" || dataCategory(record.variable) === category) && (!normalizedQuery || record.variable.toLowerCase().includes(normalizedQuery) || record.code.toLowerCase().includes(normalizedQuery))).sort((a, b) => a.variable.localeCompare(b.variable, "fa"));
  const activeProfileRecord = variableMap.get(selectedVariable) ?? profileVariables[0] ?? variableMap.values().next().value;
  const activeVariable = activeProfileRecord?.normalizedVariable ?? "";
  const profileTrend = model.years.map((year) => recordValue(getRecord(model, selectedCompany, year, activeVariable)));
  const companyRecords = model.validRecords.filter((record) => record.company === selectedCompany);
  const companyScoreCoverage = companyRecords.length ? companyRecords.filter((record) => record.score !== null).length / companyRecords.length : 0;

  const compareVariableMap = new Map<string, FinancialRecord>();
  model.validRecords.filter((record) => (record.company === selectedCompany || record.company === comparisonCompany) && record.year === selectedYear).forEach((record) => { if (!compareVariableMap.has(record.normalizedVariable)) compareVariableMap.set(record.normalizedVariable, record); });
  const compareVariables = [...compareVariableMap.values()].filter((record) => (category === "همه" || dataCategory(record.variable) === category) && (!normalizedQuery || record.variable.toLowerCase().includes(normalizedQuery) || record.code.toLowerCase().includes(normalizedQuery))).sort((a, b) => a.variable.localeCompare(b.variable, "fa"));
  const activeCompareRecord = compareVariableMap.get(selectedVariable) ?? compareVariables[0] ?? compareVariableMap.values().next().value;
  const activeCompareVariable = activeCompareRecord?.normalizedVariable ?? "";
  const comparisonSeries = [
    { name: selectedCompany, color: "#1d4ed8", values: model.years.map((year) => recordValue(getRecord(model, selectedCompany, year, activeCompareVariable))) },
    { name: comparisonCompany, color: "#0f9f6e", values: model.years.map((year) => recordValue(getRecord(model, comparisonCompany, year, activeCompareVariable))) },
  ];
  const rawRecords = model.records.filter((record) =>
    (rawCompany === "همه" || record.company === rawCompany) &&
    (rawYear === "همه" || record.year === Number(rawYear)) &&
    (category === "همه" || dataCategory(record.variable) === category) &&
    (scoreFilter === "همه" || (scoreFilter === "دارای نمره" && record.score !== null) || (scoreFilter === "بدون نمره" && record.score === null)) &&
    (!normalizedQuery || record.company.toLowerCase().includes(normalizedQuery) || record.variable.toLowerCase().includes(normalizedQuery) || record.code.toLowerCase().includes(normalizedQuery))
  ).sort((a, b) => a.company.localeCompare(b.company, "fa") || b.year - a.year || a.variable.localeCompare(b.variable, "fa"));

  async function exportCurrentView() {
    if (view === "raw") return writeDataWorkbook(rawRecords.map(recordToExportRow), "داده خام", "مرکز-داده-خام.xlsx");
    if (view === "compare") {
      const rows = compareVariables.map((record) => {
        const first = getRecord(model, selectedCompany, selectedYear, record.normalizedVariable);
        const second = getRecord(model, comparisonCompany, selectedYear, record.normalizedVariable);
        const firstValue = recordValue(first), secondValue = recordValue(second);
        return { دسته: dataCategory(record.variable), متغیر: record.variable, واحد: first?.unit ?? second?.unit ?? "", [`${selectedCompany} - مقدار`]: firstValue, [`${selectedCompany} - نمره`]: first?.score ?? null, [`${comparisonCompany} - مقدار`]: secondValue, [`${comparisonCompany} - نمره`]: second?.score ?? null, اختلاف: firstValue !== null && secondValue !== null ? firstValue - secondValue : null };
      });
      return writeDataWorkbook(rows, "مقایسه شرکت‌ها", `مقایسه-${safeFileName(selectedCompany)}-${safeFileName(comparisonCompany)}.xlsx`);
    }
    const rows = profileVariables.flatMap((record) => model.years.map((year) => { const item = getRecord(model, selectedCompany, year, record.normalizedVariable); return { شرکت: selectedCompany, دسته: dataCategory(record.variable), متغیر: record.variable, سال: year, واحد: item?.unit ?? record.unit, مقدار: item?.value ?? null, نمره: item?.score ?? null }; }));
    return writeDataWorkbook(rows, "پروفایل شرکت", `پروفایل-داده-${safeFileName(selectedCompany)}.xlsx`);
  }

  return (
    <div className="data-center-page">
      <section className="page-title-row"><div><p className="eyebrow">ماژول سوم · مرکز داده</p><h2>مشاهده، مقایسه و دریافت داده‌های مالی</h2><span>مقدار خام، واحد، نمره و روند سالانه بدون جایگزینی مقادیر خالی با صفر.</span></div><button type="button" className="primary-button" onClick={exportCurrentView}><FileSpreadsheet size={17} />خروجی Excel نمای جاری</button></section>
      <section className="data-view-tabs no-print" aria-label="نماهای مرکز داده">{[
        { key: "profile" as const, label: "پروفایل شرکت", icon: <Building2 size={18} /> },
        { key: "compare" as const, label: "مقایسه دو شرکت", icon: <Layers3 size={18} /> },
        { key: "raw" as const, label: "جدول داده خام", icon: <Table2 size={18} /> },
      ].map((item) => <button key={item.key} type="button" className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>{item.icon}{item.label}</button>)}</section>
      <section className="filter-card compact data-filter-card no-print"><div className="filter-grid">
        {view !== "raw" ? <><SelectField label="شرکت مبنا" value={selectedCompany} onChange={setSelectedCompany} wide>{model.companies.map((company) => <option key={company} value={company}>{company}</option>)}</SelectField>{view === "compare" && <><SelectField label="شرکت مقایسه" value={comparisonCompany} onChange={setCompareCompany} wide>{model.companies.map((company) => <option key={company} value={company} disabled={company === selectedCompany}>{company}</option>)}</SelectField><SelectField label="سال مقایسه" value={selectedYear} onChange={(value) => setSelectedYear(Number(value))}>{[...model.years].reverse().map((year) => <option key={year} value={year}>{year.toLocaleString("fa-IR", { useGrouping: false })}</option>)}</SelectField></>}</> : <><SelectField label="شرکت" value={rawCompany} onChange={setRawCompany} wide><option value="همه">همه شرکت‌ها</option>{model.companies.map((company) => <option key={company} value={company}>{company}</option>)}</SelectField><SelectField label="سال" value={rawYear} onChange={setRawYear}><option value="همه">همه سال‌ها</option>{[...model.years].reverse().map((year) => <option key={year} value={year}>{year.toLocaleString("fa-IR", { useGrouping: false })}</option>)}</SelectField><SelectField label="وضعیت نمره" value={scoreFilter} onChange={setScoreFilter}><option value="همه">همه رکوردها</option><option value="دارای نمره">دارای نمره</option><option value="بدون نمره">بدون نمره</option></SelectField></>}
        <SelectField label="گروه شاخص" value={category} onChange={(value) => setCategory(value as DataCategory)}>{DATA_CATEGORIES.map((item) => <option key={item} value={item}>{item === "همه" ? "همه گروه‌ها" : item}</option>)}</SelectField>
        <label className="search-field wide"><span>جست‌وجوی شاخص یا کد</span><div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثلاً حاشیه سود، ROIC یا ۵۰۱" /></div></label>
      </div></section>
      {view === "profile" && <><section className="quality-overview data-overview">
        <QualityStat icon={<Database size={18} />} label="تعداد شاخص‌ها" value={variableMap.size.toLocaleString("fa-IR")} /><QualityStat icon={<PanelTop size={18} />} label="پوشش سالانه" value={`${new Set(companyRecords.map((record) => record.year)).size.toLocaleString("fa-IR")} سال`} /><QualityStat icon={<FileCheck2 size={18} />} label="پوشش نمره" value={percent(companyScoreCoverage)} tone={companyScoreCoverage >= 0.45 ? "good" : "warning"} /><QualityStat icon={<Building2 size={18} />} label="ماهیت شرکت" value={model.natureByCompany.get(selectedCompany) ?? "نامشخص"} />
      </section><section className="data-visual-grid"><article className="data-chart-card"><header><div><p className="eyebrow">روند چندساله</p><h3>{activeProfileRecord?.variable ?? "شاخصی انتخاب نشده است"}</h3></div><SelectField label="شاخص نمودار" value={activeVariable} onChange={setSelectedVariable} wide>{profileVariables.map((record) => <option key={record.normalizedVariable} value={record.normalizedVariable}>{record.variable}</option>)}</SelectField></header><TrendChart years={model.years} series={[{ name: selectedCompany, color: "#1d4ed8", values: profileTrend }]} unit={activeProfileRecord?.unit ?? ""} /></article>
        <article className="data-reading-card"><p className="eyebrow">خوانش سریع</p><h3>{activeProfileRecord?.variable ?? "—"}</h3><div><span>آخرین مقدار</span><strong>{formatNumber(recordValue(getRecord(model, selectedCompany, model.years.at(-1) ?? 0, activeVariable)), 2)}</strong><small>{activeProfileRecord?.unit}</small></div><div><span>تغییر نسبت به سال قبل</span><strong>{latestChange(model, selectedCompany, activeVariable, model.years.at(-1) ?? 0) === null ? "—" : percent(latestChange(model, selectedCompany, activeVariable, model.years.at(-1) ?? 0) ?? 0)}</strong></div><div><span>نمره آخرین سال</span><strong>{formatNumber(getRecord(model, selectedCompany, model.years.at(-1) ?? 0, activeVariable)?.score ?? null, 2)}</strong><small>از ۱۰</small></div></article>
      </section><section className="table-card data-matrix-card"><header><div><p className="eyebrow">صورت داده شرکت</p><h3>{profileVariables.length.toLocaleString("fa-IR")} شاخص قابل نمایش</h3></div><span className="table-note-inline">مقدار اصلی در سطر اول؛ نمره در برچسب کوچک</span></header><div className="table-scroll"><table><thead><tr><th>گروه</th><th>شاخص</th><th>واحد</th>{model.years.map((year) => <th key={year}>{year.toLocaleString("fa-IR", { useGrouping: false })}</th>)}<th>تغییر آخر</th></tr></thead><tbody>
        {profileVariables.map((record) => { const change = latestChange(model, selectedCompany, record.normalizedVariable, model.years.at(-1) ?? 0); return <tr key={record.normalizedVariable} className={record.normalizedVariable === activeVariable ? "selected-row" : ""} onClick={() => setSelectedVariable(record.normalizedVariable)}><td><span className="category-pill">{dataCategory(record.variable)}</span></td><td><button type="button" className="company-link">{record.variable}</button></td><td>{record.unit || "—"}</td>{model.years.map((year) => { const item = getRecord(model, selectedCompany, year, record.normalizedVariable); return <td key={year}><div className="value-score-cell"><strong>{formatNumber(item?.value ?? null, 2)}</strong>{item?.score !== null && item?.score !== undefined && <span>نمره {formatNumber(item.score, 1)}</span>}</div></td>; })}<td><span className={`change-pill ${change === null ? "neutral" : change >= 0 ? "up" : "down"}`}>{change === null ? "—" : percent(change)}</span></td></tr>; })}
      </tbody></table></div></section></>}
      {view === "compare" && <><section className="data-visual-grid"><article className="data-chart-card"><header><div><p className="eyebrow">روند مقایسه‌ای</p><h3>{activeCompareRecord?.variable ?? "شاخصی انتخاب نشده است"}</h3></div><SelectField label="شاخص نمودار" value={activeCompareVariable} onChange={setSelectedVariable} wide>{compareVariables.map((record) => <option key={record.normalizedVariable} value={record.normalizedVariable}>{record.variable}</option>)}</SelectField></header><TrendChart years={model.years} series={comparisonSeries} unit={activeCompareRecord?.unit ?? ""} /></article><article className="comparison-head">{[selectedCompany, comparisonCompany].map((company, index) => { const item = getRecord(model, company, selectedYear, activeCompareVariable); return <div key={company} className={index === 0 ? "primary" : "secondary"}><span>{company}</span><strong>{formatNumber(item?.value ?? null, 2)}</strong><small>{item?.unit ?? activeCompareRecord?.unit}</small><b>نمره {formatNumber(item?.score ?? null, 1)}</b></div>; })}</article></section>
        <section className="table-card data-matrix-card"><header><div><p className="eyebrow">مقایسه رو‌در‌رو</p><h3>{compareVariables.length.toLocaleString("fa-IR")} شاخص در سال {selectedYear.toLocaleString("fa-IR", { useGrouping: false })}</h3></div></header><div className="table-scroll"><table><thead><tr><th>گروه</th><th>شاخص</th><th>واحد</th><th>{selectedCompany}</th><th>نمره</th><th>{comparisonCompany}</th><th>نمره</th><th>اختلاف مقدار</th><th>اختلاف نمره</th></tr></thead><tbody>
          {compareVariables.map((record) => { const first = getRecord(model, selectedCompany, selectedYear, record.normalizedVariable), second = getRecord(model, comparisonCompany, selectedYear, record.normalizedVariable); const firstValue = recordValue(first), secondValue = recordValue(second); const difference = firstValue !== null && secondValue !== null ? firstValue - secondValue : null; const scoreDifference = first?.score !== null && first?.score !== undefined && second?.score !== null && second?.score !== undefined ? first.score - second.score : null; return <tr key={record.normalizedVariable} className={record.normalizedVariable === activeCompareVariable ? "selected-row" : ""} onClick={() => setSelectedVariable(record.normalizedVariable)}><td><span className="category-pill">{dataCategory(record.variable)}</span></td><td><button type="button" className="company-link">{record.variable}</button></td><td>{first?.unit ?? second?.unit ?? "—"}</td><td><strong>{formatNumber(firstValue, 2)}</strong></td><td><span className={`score-cell ${scoreBandClass(first?.score ?? null)}`}>{formatNumber(first?.score ?? null, 1)}</span></td><td><strong>{formatNumber(secondValue, 2)}</strong></td><td><span className={`score-cell ${scoreBandClass(second?.score ?? null)}`}>{formatNumber(second?.score ?? null, 1)}</span></td><td>{formatNumber(difference, 2)}</td><td><span className={`change-pill ${scoreDifference === null ? "neutral" : scoreDifference >= 0 ? "up" : "down"}`}>{scoreDifference === null ? "—" : formatNumber(scoreDifference, 2)}</span></td></tr>; })}
        </tbody></table></div></section></>}
      {view === "raw" && <section className="table-card raw-data-card"><header><div><p className="eyebrow">رکوردهای فایل ورودی</p><h3>{rawRecords.length.toLocaleString("fa-IR")} رکورد منطبق با فیلتر</h3></div>{rawRecords.length > 500 && <span className="table-note-inline">۵۰۰ ردیف نخست نمایش داده شده؛ Excel شامل همه رکوردهاست.</span>}</header><div className="table-scroll raw-data-table"><table><thead><tr><th>ردیف فایل</th><th>شرکت</th><th>ماهیت</th><th>سال</th><th>گروه</th><th>شاخص</th><th>کد</th><th>واحد</th><th>مقدار</th><th>تبدیل به شاخص</th><th>نمره</th><th>وضعیت</th></tr></thead><tbody>
        {rawRecords.slice(0, 500).map((record) => <tr key={`${record.sourceRow}-${record.company}-${record.variable}`}><td>{record.sourceRow.toLocaleString("fa-IR")}</td><td><strong>{record.company || "—"}</strong></td><td>{record.nature || "—"}</td><td>{record.year ? record.year.toLocaleString("fa-IR", { useGrouping: false }) : "—"}</td><td><span className="category-pill">{dataCategory(record.variable)}</span></td><td>{record.variable || "—"}</td><td>{record.code || "—"}</td><td>{record.unit || "—"}</td><td>{formatNumber(record.value, 2)}</td><td>{formatNumber(record.indexedValue, 2)}</td><td>{formatNumber(record.score, 2)}</td><td><span className={`record-status ${record.scoreIssue ? "warning" : "valid"}`}>{record.scoreIssue ? ISSUE_LABELS[record.scoreIssue === "out-of-range" ? "out-of-range" : record.scoreIssue === "invalid" ? "invalid-score" : "missing-score"] : "معتبر"}</span></td></tr>)}
      </tbody></table></div></section>}
    </div>
  );
}

void ScoreCard;
void CalculationDetails;
void LegacyDataCenterPage;
void PERFORMANCE_AXIS_KEYS;

const MAIN_KPIS = [
  "درآمدهای عملیاتی",
  "سود (زیان) عملیاتی",
  "سود (زیان) خالص (عملیات در حال تداوم)",
  "OCF جریان نقد عملیاتی",
  "جمع دارایی‌ها",
  "جمع حقوق مالکانه",
  "بازده سرمایه گذاری ROIC روش دارایی",
  "حاشیه سود عملیاتی",
] as const;

const SERIES_COLORS = ["#1d4ed8", "#0f766e", "#7c3aed", "#d97706", "#dc2626", "#0284c7", "#475569"];

function toggleLimited(values: string[], value: string, limit: number, minimum = 0) {
  if (values.includes(value)) {
    return values.length <= minimum ? values : values.filter((item) => item !== value);
  }
  return values.length >= limit ? values : [...values, value];
}

function yearChange(
  model: FinancialModel,
  company: string,
  year: number,
  variable: string,
): { absolute: number | null; percent: number | null } {
  const current = getRecord(model, company, year, variable)?.value ?? null;
  const previous = getRecord(model, company, year - 1, variable)?.value ?? null;
  if (current === null || previous === null) return { absolute: null, percent: null };
  return {
    absolute: current - previous,
    percent: previous === 0 ? null : (current - previous) / Math.abs(previous),
  };
}

function dataStatus(score: number | null) {
  if (score === null) return "بدون نمره";
  if (score >= 8) return "ممتاز";
  if (score >= 6.5) return "مطلوب";
  if (score >= 5) return "متوسط";
  if (score >= 3.5) return "ضعیف";
  return "بحرانی";
}

async function exportCustomDataWorkbook({
  model,
  companies,
  years,
  variables,
  includeValue,
  includeScore,
  includeChange,
  chartSelections,
}: {
  model: FinancialModel;
  companies: string[];
  years: number[];
  variables: string[];
  includeValue: boolean;
  includeScore: boolean;
  includeChange: boolean;
  chartSelections: string[];
}) {
  const periodLabel = model.reportKind === "half-year" ? "شش‌ماهه" : "سالانه";
  const selected = model.validRecords.filter(
    (record) =>
      companies.includes(record.company) &&
      years.includes(record.year) &&
      variables.includes(record.normalizedVariable),
  );
  const selectedRows = selected.map((record) => {
    const change = yearChange(model, record.company, record.year, record.normalizedVariable);
    return {
      ماهیت: record.nature,
      شرکت: record.company,
      سال: record.year,
      "نوع گزارش": periodLabel,
      "گروه متغیر": dataCategory(record.variable),
      متغیر: record.variable,
      کد: record.code,
      واحد: record.unit,
      مقدار: includeValue ? record.value : null,
      "تبدیل به شاخص": includeValue ? record.indexedValue : null,
      نمره: includeScore ? record.score : null,
      تغییر: includeChange ? change.absolute : null,
      "درصد تغییر": includeChange ? change.percent : null,
    };
  });
  const variableRepresentatives = variables
    .map((variable) => model.validRecords.find((record) => record.normalizedVariable === variable))
    .filter((record): record is FinancialRecord => Boolean(record));
  const comparisonRows = variableRepresentatives.flatMap((variable) =>
    years.map((year) => {
      const row: Record<string, string | number | null> = {
        سال: year,
        "نوع گزارش": periodLabel,
        متغیر: variable.variable,
        واحد: variable.unit,
      };
      for (const company of companies) {
        const record = getRecord(model, company, year, variable.normalizedVariable);
        if (includeValue) row[`${company} | مقدار`] = record?.value ?? null;
        if (includeScore) row[`${company} | نمره`] = record?.score ?? null;
        if (includeChange) {
          row[`${company} | درصد تغییر`] = yearChange(
            model,
            company,
            year,
            variable.normalizedVariable,
          ).percent;
        }
      }
      return row;
    }),
  );
  const trendRows = companies.flatMap((company) =>
    variableRepresentatives.flatMap((variable) =>
      years.map((year) => {
        const record = getRecord(model, company, year, variable.normalizedVariable);
        const change = yearChange(model, company, year, variable.normalizedVariable);
        return {
          شرکت: company,
          متغیر: variable.variable,
          واحد: record?.unit ?? variable.unit,
          سال: year,
        "نوع گزارش": periodLabel,
          مقدار: includeValue ? record?.value ?? null : null,
          نمره: includeScore ? record?.score ?? null : null,
          "درصد تغییر": includeChange ? change.percent : null,
        };
      }),
    ),
  );
  const chartRows = chartSelections.flatMap((chart) => [
    { "عنوان نمودار": chart, "نوع داده پشتیبان": "جدول روند زمانی", توضیح: "داده‌های پشتیبان در شیت «روند زمانی» قرار دارد." },
    ...trendRows.map((row) => ({ "عنوان نمودار": chart, ...row })),
  ]);
  const metadata = [
    ["عنوان", "خروجی سفارشی سامانه تحلیل مالی و راهبری سرمایه آتیه"],
    ["فایل مبنا", model.fileName],
    ["نوع گزارش", periodLabel],
    ["تاریخ تولید", new Date().toISOString()],
    ["شرکت‌ها", companies.join("، ")],
    ["سال‌ها", years.join("، ")],
    ["تعداد متغیر", variables.length],
    ["نوع داده", [includeValue ? "مقدار" : "", includeScore ? "نمره" : "", includeChange ? "تغییر" : ""].filter(Boolean).join("، ")],
    ["نمودارهای منتخب", chartSelections.join("، ") || "بدون نمودار"],
    ["محدودیت", "به‌منظور حسابرسی، مشخصات نمودار و تمام داده‌های پشتیبان در فایل قرار گرفته است."],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(selectedRows), "داده‌های منتخب");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(comparisonRows), "مقایسه شرکت‌ها");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(trendRows), "روند زمانی");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(chartRows), "نمودارهای منتخب");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(metadata), "مشخصات خروجی");
  XLSX.writeFile(workbook, `خروجی-مرکز-داده-مالی-${periodLabel}.xlsx`);
}

function DataCenterPage({
  model,
  view,
  setView,
  reportFilter,
  selectedCompany,
  setSelectedCompany,
  selectedYear,
  setSelectedYear,
}: {
  model: FinancialModel;
  view: DataView;
  setView: (view: DataView) => void;
  reportFilter: React.ReactNode;
  selectedCompany: string;
  setSelectedCompany: (company: string) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
}) {
  const halfYear = model.reportKind === "half-year";
  const periodLabel = halfYear ? "شش‌ماهه" : "سالانه";
  const yearLabel = (year: number) => `${halfYear ? "شش‌ماههٔ " : ""}${year.toLocaleString("fa-IR", { useGrouping: false })}`;
  const [category, setCategory] = useState<DataCategory>("همه");
  const [query, setQuery] = useState("");
  const [selectedVariable, setSelectedVariable] = useState(
    model.validRecords[0]?.normalizedVariable ?? "",
  );
  const [trendCompanies, setTrendCompanies] = useState([selectedCompany]);
  const [trendVariables, setTrendVariables] = useState<string[]>(
    model.validRecords[0]?.normalizedVariable ? [model.validRecords[0].normalizedVariable] : [],
  );
  const [trendDataType, setTrendDataType] = useState<"value" | "score" | "change">("value");
  const [compareCompanies, setCompareCompanies] = useState(
    model.companies.slice(0, Math.min(3, model.companies.length)),
  );
  const [compareMode, setCompareMode] = useState<"value" | "score" | "change">("value");
  const [exportCompanies, setExportCompanies] = useState([selectedCompany]);
  const [exportYears, setExportYears] = useState([selectedYear]);
  const [exportVariables, setExportVariables] = useState<string[]>(
    model.validRecords[0]?.normalizedVariable ? [model.validRecords[0].normalizedVariable] : [],
  );
  const [includeValue, setIncludeValue] = useState(true);
  const [includeScore, setIncludeScore] = useState(true);
  const [includeChange, setIncludeChange] = useState(true);
  const [chartSelections, setChartSelections] = useState<string[]>([]);


  const normalizedQuery = query.trim().toLowerCase();
  const variableMap = new Map<string, FinancialRecord>();
  for (const record of model.validRecords) {
    if (!variableMap.has(record.normalizedVariable)) variableMap.set(record.normalizedVariable, record);
  }
  const variables = [...variableMap.values()]
    .filter(
      (record) =>
        (category === "همه" || dataCategory(record.variable) === category) &&
        (!normalizedQuery ||
          record.variable.toLowerCase().includes(normalizedQuery) ||
          record.code.toLowerCase().includes(normalizedQuery)),
    )
    .sort((a, b) => a.variable.localeCompare(b.variable, "fa"));
  const activeRecord =
    variableMap.get(selectedVariable) ?? variables[0] ?? variableMap.values().next().value;
  const activeVariable = activeRecord?.normalizedVariable ?? "";
  const companyVariableMap = new Map<string, FinancialRecord>();
  for (const record of model.validRecords.filter((item) => item.company === selectedCompany)) {
    if (!companyVariableMap.has(record.normalizedVariable)) {
      companyVariableMap.set(record.normalizedVariable, record);
    }
  }
  const profileVariables = variables.filter((record) =>
    companyVariableMap.has(record.normalizedVariable),
  );
  const activeProfileRecord =
    companyVariableMap.get(selectedVariable) ?? profileVariables[0] ?? companyVariableMap.values().next().value;
  const activeProfileVariable = activeProfileRecord?.normalizedVariable ?? "";
  const activeProfileCurrent = activeProfileVariable
    ? getRecord(model, selectedCompany, selectedYear, activeProfileVariable)
    : undefined;
  const activeProfileChange = activeProfileVariable
    ? yearChange(model, selectedCompany, selectedYear, activeProfileVariable)
    : { absolute: null, percent: null };
  const activeProfileHistory = model.years.map((year) =>
    activeProfileVariable
      ? getRecord(model, selectedCompany, year, activeProfileVariable)?.value ?? null
      : null,
  );
  const activeProfileNumbers = activeProfileHistory.filter((value): value is number => value !== null);
  const activeProfileAverage = activeProfileNumbers.length
    ? activeProfileNumbers.reduce((sum, value) => sum + value, 0) / activeProfileNumbers.length
    : null;
  const companyRecords = model.validRecords.filter(
    (record) => record.company === selectedCompany,
  );
  const companyScoreCoverage = companyRecords.length
    ? companyRecords.filter((record) => record.score !== null).length / companyRecords.length
    : 0;
  const kpis = MAIN_KPIS.map((name) => {
    const normalized = normalizeText(name);
    const record = getRecord(model, selectedCompany, selectedYear, normalized);
    return { name, normalized, record };
  });

  const activeTrendVariables = trendVariables
    .map((variable) => variableMap.get(variable))
    .filter((record): record is FinancialRecord => Boolean(record));
  const mixedUnits =
    trendDataType === "value" &&
    new Set(activeTrendVariables.map((record) => record.unit)).size > 1;
  const trendSeries = trendCompanies.flatMap((company, companyIndex) =>
    activeTrendVariables.map((variable, variableIndex) => {
      const raw = model.years.map((year) => {
        const record = getRecord(model, company, year, variable.normalizedVariable);
        if (trendDataType === "score") return record?.score ?? null;
        if (trendDataType === "change") {
          return yearChange(model, company, year, variable.normalizedVariable).percent;
        }
        return record?.value ?? null;
      });
      const first = raw.find((value): value is number => value !== null && value !== 0) ?? null;
      const values =
        mixedUnits && first !== null
          ? raw.map((value) => (value === null ? null : (value / first) * 100))
          : raw;
      return {
        name:
          activeTrendVariables.length > 1
            ? `${company} · ${variable.variable}`
            : company,
        color: SERIES_COLORS[(companyIndex * activeTrendVariables.length + variableIndex) % SERIES_COLORS.length],
        values,
      };
    }),
  );
  const trendUnit = mixedUnits
    ? "شاخص پایه ۱۰۰"
    : trendDataType === "score"
      ? "امتیاز"
      : trendDataType === "change"
        ? "نسبت تغییر"
        : activeTrendVariables[0]?.unit ?? "";

  const comparisonSeries = compareCompanies.map((company, index) => ({
    name: company,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    values: model.years.map((year) => {
      const record = getRecord(model, company, year, activeVariable);
      if (compareMode === "score") return record?.score ?? null;
      if (compareMode === "change") return yearChange(model, company, year, activeVariable).percent;
      return record?.value ?? null;
    }),
  }));

  const selectedExportCount =
    exportCompanies.length * exportYears.length * Math.max(1, exportVariables.length);
  const selectedCharts = [
    "روند زمانی",
    "مقایسه شرکت‌ها",
    "Heatmap نمرات",
    "پروفایل KPI",
  ];

  const resetDataFilters = () => {
    setCategory("همه");
    setQuery("");
  };

  const viewGuide = {
    profile: { step: "۱", title: "شرکت و سال را انتخاب کنید", help: "سپس یک شاخص را از جدول انتخاب کنید تا عدد، نمره و روند آن در کارت جزئیات نمایش داده شود." },
    trend: { step: "۲", title: "شرکت‌ها و شاخص‌های روند را انتخاب کنید", help: "حداکثر پنج شرکت و سه شاخص را کنار هم ببینید؛ واحدهای متفاوت خودکار هم‌مقیاس می‌شوند." },
    compare: { step: "۳", title: "مقایسه رو‌در‌رو بسازید", help: "سال، نوع مقایسه و دو تا پنج شرکت را انتخاب کنید تا جدول و نمودار هم‌زمان به‌روزرسانی شوند." },
    export: { step: "۴", title: "خروجی سفارشی بسازید", help: "شرکت، سال، شاخص و نوع داده را مرحله‌به‌مرحله انتخاب و فایل Excel حسابرسی‌پذیر دریافت کنید." },
  }[view];

  return (
    <div className="data-center-page data-center-v2">
      <section className="data-center-hero">
        <div className="data-center-title">
          <span className="data-center-icon"><Database size={24} /></span>
          <div>
            <p className="eyebrow">مرکز داده مالی</p>
            <h2>از عدد خام تا تصمیم مدیریتی، در یک میزکار</h2>
            <p>اطلاعات شرکت را بررسی کنید، روندها را بسنجید، شرکت‌ها را کنار هم بگذارید و خروجی حسابرسی‌پذیر بسازید.</p>
          </div>
        </div>
        <div className="data-context-summary">
          <span><Database size={15} />{model.summary.totalRecords.toLocaleString("fa-IR")} رکورد · {periodLabel}</span>
          <span><Building2 size={15} />{model.companies.length.toLocaleString("fa-IR")} شرکت</span>
          <span><PanelTop size={15} />{model.years.length.toLocaleString("fa-IR")} سال</span>
          <button type="button" className="primary-button" onClick={() => setView("export")}><FileSpreadsheet size={17} />خروجی جدید</button>
        </div>
      </section>

      <section className="data-workspace-tabs no-print" aria-label="کارهای مرکز داده">
        {[
          { key: "profile" as const, label: "بررسی شرکت", help: "تصویر کامل یک شرکت در یک سال", icon: <Building2 size={19} /> },
          { key: "trend" as const, label: "روند زمانی", help: "تغییر شاخص‌ها در چند سال", icon: <TrendingUp size={19} /> },
          { key: "compare" as const, label: "مقایسه", help: "مقایسه هم‌زمان چند شرکت", icon: <Layers3 size={19} /> },
          { key: "export" as const, label: "ساخت خروجی", help: "فایل Excel دقیق و سفارشی", icon: <FileSpreadsheet size={19} /> },
        ].map((item) => (
          <button key={item.key} type="button" className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>
            <span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.help}</small></div>
          </button>
        ))}
      </section>

      <section className="data-command-bar no-print">
        <header>
          <div><b className="data-guide-step">{viewGuide.step}</b><strong>{viewGuide.title}</strong><span>{viewGuide.help}</span></div>
          {(category !== "همه" || query) && <button type="button" className="text-button" onClick={resetDataFilters}><RotateCcw size={14} />پاک‌کردن فیلترها</button>}
        </header>
        <div className="data-command-grid">
          {reportFilter}
          {view === "profile" && <SelectField label="شرکت" value={selectedCompany} onChange={setSelectedCompany} wide>{model.companies.map((company) => <option key={company} value={company}>{company}</option>)}</SelectField>}
          {(view === "profile" || view === "compare") && <SelectField label="دوره" value={selectedYear} onChange={(value) => setSelectedYear(Number(value))}>{[...model.years].reverse().map((year) => <option key={year} value={year}>{yearLabel(year)}</option>)}</SelectField>}
          <label className="search-field wide">
            <span>جست‌وجوی شاخص یا کد</span>
            <div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثلاً حاشیه سود، ROIC یا کد متغیر" /></div>
          </label>
        </div>
        <div className="data-category-chips" aria-label="فیلتر گروه شاخص">
          {DATA_CATEGORIES.map((item) => <button type="button" key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item === "همه" ? "همه شاخص‌ها" : item}</button>)}
          <span>{variables.length.toLocaleString("fa-IR")} شاخص منطبق</span>
        </div>
      </section>

      {!model.years.length && <div className="validation-callout">برای این نوع گزارش داده‌ای در فایل فعلی وجود ندارد.</div>}
      {model.years.length > 0 && view === "profile" && (
        <>
          <section className="data-kpi-strip">
            {kpis.slice(0, 4).map(({ name, normalized, record }) => {
              const change = yearChange(model, selectedCompany, selectedYear, normalized);
              return (
                <article key={name}>
                  <div><span>{name}</span><small>{record?.unit || "—"}</small></div>
                  <strong>{formatNumber(record?.value ?? null, 2)}</strong>
                  <footer><span className={change.percent === null ? "neutral" : change.percent >= 0 ? "up" : "down"}>{change.percent === null ? "بدون مبنا" : `${change.percent >= 0 ? "+" : ""}${percent(change.percent)}`}</span><b>امتیاز {formatNumber(record?.score ?? null, 1)}</b></footer>
                </article>
              );
            })}
          </section>
          <section className="data-profile-workspace">
            <article className="table-card data-matrix-card data-browser-card">
              <header><div><p className="eyebrow">مرور شاخص‌ها</p><h3>{profileVariables.length.toLocaleString("fa-IR")} شاخص برای {selectedCompany}</h3></div><span className="table-note-inline">یک ردیف را برای جزئیات انتخاب کنید.</span></header>
              <div className="table-scroll">
              <table className="data-browser-table">
                <thead><tr><th>شاخص</th><th>مقدار و واحد</th><th>امتیاز</th><th>تغییر نسبت به دوره مشابه</th><th>وضعیت</th><th>روند</th></tr></thead>
                <tbody>
                  {profileVariables.map((representative) => {
                    const record = getRecord(model, selectedCompany, selectedYear, representative.normalizedVariable);
                    const change = yearChange(model, selectedCompany, selectedYear, representative.normalizedVariable);
                    const history = model.years
                      .map((year) => getRecord(model, selectedCompany, year, representative.normalizedVariable)?.value ?? null)
                      .filter((value): value is number => value !== null);
                    return (
                      <tr key={representative.normalizedVariable} className={representative.normalizedVariable === activeProfileVariable ? "selected-row" : ""} onClick={() => setSelectedVariable(representative.normalizedVariable)}>
                        <td><button type="button" className="data-variable-name"><strong>{representative.variable}</strong><small><span className="category-pill">{dataCategory(representative.variable)}</span>{representative.code || "بدون کد"}</small></button></td>
                        <td><div className="data-value-cell"><strong>{formatNumber(record?.value ?? null, 2)}</strong><small>{record?.unit || representative.unit || "—"}</small></div></td>
                        <td><span className={`score-cell ${scoreBandClass(record?.score ?? null)}`}>{formatNumber(record?.score ?? null, 1)}</span></td>
                        <td><span className={`change-pill ${change.percent === null ? "neutral" : change.percent >= 0 ? "up" : "down"}`}>{change.percent === null ? "—" : percent(change.percent)}</span></td>
                        <td><span className={`record-status ${scoreBandClass(record?.score ?? null)}`}>{dataStatus(record?.score ?? null)}</span></td>
                        <td><MiniSparkline values={history} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </article>
            <aside className="data-inspector-card">
              <header><div><p className="eyebrow">جزئیات شاخص انتخاب‌شده</p><h3>{activeProfileRecord?.variable ?? "شاخصی انتخاب نشده است"}</h3><span>{dataCategory(activeProfileRecord?.variable ?? "")} · {activeProfileRecord?.code || "بدون کد"}</span></div><span className={`record-status ${scoreBandClass(activeProfileCurrent?.score ?? null)}`}>{dataStatus(activeProfileCurrent?.score ?? null)}</span></header>
              <div className="data-inspector-reading"><div><span>مقدار سال {selectedYear.toLocaleString("fa-IR", { useGrouping: false })}</span><strong>{formatNumber(activeProfileCurrent?.value ?? null, 2)}</strong><small>{activeProfileCurrent?.unit || activeProfileRecord?.unit || "—"}</small></div><b>امتیاز {formatNumber(activeProfileCurrent?.score ?? null, 1)} از ۱۰</b></div>
              <TrendChart years={model.years} series={[{ name: selectedCompany, color: "#1d4ed8", values: activeProfileHistory }]} unit={activeProfileCurrent?.unit || activeProfileRecord?.unit || ""} />
              <dl className="data-inspector-stats">
                <div><dt>تغییر سالانه</dt><dd className={activeProfileChange.percent === null ? "neutral" : activeProfileChange.percent >= 0 ? "up" : "down"}>{activeProfileChange.percent === null ? "—" : percent(activeProfileChange.percent)}</dd></div>
                <div><dt>میانگین دوره</dt><dd>{formatNumber(activeProfileAverage, 2)}</dd></div>
                <div><dt>کمینه دوره</dt><dd>{activeProfileNumbers.length ? formatNumber(Math.min(...activeProfileNumbers), 2) : "—"}</dd></div>
                <div><dt>بیشینه دوره</dt><dd>{activeProfileNumbers.length ? formatNumber(Math.max(...activeProfileNumbers), 2) : "—"}</dd></div>
              </dl>
              <footer><span><FileCheck2 size={15} />پوشش نمره شرکت {percent(companyScoreCoverage)}</span><span><Building2 size={15} />{model.natureByCompany.get(selectedCompany) ?? "ماهیت نامشخص"}</span></footer>
            </aside>
          </section>
        </>
      )}

      {model.years.length > 0 && view === "trend" && (
        <>
          <section className="selection-workbench">
            <article>
              <header><span>۱</span><div><strong>شرکت‌ها</strong><small>حداکثر پنج شرکت</small></div></header>
              <div className="selection-chips">{model.companies.map((company) => <button type="button" key={company} className={trendCompanies.includes(company) ? "active" : ""} onClick={() => setTrendCompanies((current) => toggleLimited(current, company, 5, 1))}>{company}</button>)}</div>
            </article>
            <article>
              <header><span>۲</span><div><strong>متغیرها</strong><small>حداکثر سه متغیر</small></div></header>
              <div className="variable-checklist">{variables.slice(0, 75).map((record) => <label key={record.normalizedVariable}><input type="checkbox" checked={trendVariables.includes(record.normalizedVariable)} onChange={() => setTrendVariables((current) => toggleLimited(current, record.normalizedVariable, 3, 1))} /><span>{record.variable}</span><small>{record.unit}</small></label>)}</div>
            </article>
            <article className="trend-options">
              <header><span>۳</span><div><strong>نوع داده</strong><small>مبنای نمایش نمودار</small></div></header>
              <SelectField label="نوع داده" value={trendDataType} onChange={(value) => setTrendDataType(value as typeof trendDataType)}>
                <option value="value">مقدار خام</option><option value="score">نمره</option><option value="change">درصد تغییر</option>
              </SelectField>
              <p className="trend-helper"><Info size={15} />برای مقایسه متغیرهایی با واحد متفاوت، سامانه آن‌ها را با سال پایه ۱۰۰ هم‌مقیاس می‌کند.</p>
            </article>
          </section>
          {mixedUnits && <div className="data-warning"><AlertTriangle size={17} />متغیرهای با واحد متفاوت به شاخص پایه ۱۰۰ تبدیل شدند تا روی یک محور قابل مقایسه باشند.</div>}
          <section className="data-chart-card trend-main-card">
            <header><div><p className="eyebrow">تحلیل روند</p><h3>{activeTrendVariables.map((record) => record.variable).join(" · ") || "متغیری انتخاب نشده است"}</h3></div><span className="table-count">روند خطی</span></header>
            <TrendChart years={model.years} series={trendSeries} unit={trendUnit} />
          </section>
          <section className="table-card">
            <header><div><p className="eyebrow">داده پشتیبان نمودار</p><h3>مقادیر سالانه انتخاب‌شده</h3></div></header>
            <div className="table-scroll"><table><thead><tr><th>شرکت / متغیر</th>{model.years.map((year) => <th key={year}>{yearLabel(year)}</th>)}</tr></thead><tbody>{trendSeries.map((series) => <tr key={series.name}><td><strong>{series.name}</strong></td>{series.values.map((value, index) => <td key={`${series.name}-${model.years[index]}`}>{formatNumber(value, 2)}</td>)}</tr>)}</tbody></table></div>
          </section>
        </>
      )}

      {model.years.length > 0 && view === "compare" && (
        <>
          <section className="compare-control-card">
            <div>
              <span>انتخاب شرکت‌ها؛ حداقل دو و حداکثر پنج</span>
              <div className="selection-chips">{model.companies.map((company) => <button type="button" key={company} className={compareCompanies.includes(company) ? "active" : ""} onClick={() => setCompareCompanies((current) => toggleLimited(current, company, 5, 2))}>{company}</button>)}</div>
            </div>
            <SelectField label="نوع مقایسه" value={compareMode} onChange={(value) => setCompareMode(value as typeof compareMode)}>
              <option value="value">مقدار خام</option><option value="score">نمره</option><option value="change">درصد تغییر</option>
            </SelectField>
            <SelectField label="شاخص نمودار" value={activeVariable} onChange={setSelectedVariable} wide>
              {variables.map((record) => <option key={record.normalizedVariable} value={record.normalizedVariable}>{record.variable}</option>)}
            </SelectField>
          </section>
          <section className="data-visual-grid">
            <article className="data-chart-card">
              <header><div><p className="eyebrow">روند مقایسه‌ای</p><h3>{activeRecord?.variable ?? "شاخص انتخاب نشده"}</h3></div></header>
              <TrendChart years={model.years} series={comparisonSeries} unit={compareMode === "score" ? "امتیاز" : compareMode === "change" ? "نسبت تغییر" : activeRecord?.unit ?? ""} />
            </article>
            <article className="comparison-head multi">
              {compareCompanies.map((company, index) => {
                const record = getRecord(model, company, selectedYear, activeVariable);
                const value = compareMode === "score" ? record?.score ?? null : compareMode === "change" ? yearChange(model, company, selectedYear, activeVariable).percent : record?.value ?? null;
                return <div key={company} style={{ borderColor: SERIES_COLORS[index % SERIES_COLORS.length] }}><span>{company}</span><strong>{formatNumber(value, 2)}</strong><small>{compareMode === "score" ? "امتیاز" : compareMode === "change" ? "نسبت" : record?.unit ?? activeRecord?.unit}</small></div>;
              })}
            </article>
          </section>
          <section className="table-card data-matrix-card">
            <header><div><p className="eyebrow">مقایسه چندشرکتی</p><h3>{variables.length.toLocaleString("fa-IR")} شاخص در سال {selectedYear.toLocaleString("fa-IR", { useGrouping: false })}</h3></div></header>
            <div className="table-scroll"><table><thead><tr><th>گروه</th><th>شاخص</th><th>واحد</th>{compareCompanies.map((company) => <th key={company}>{company}</th>)}<th>میانگین</th><th>بهترین</th></tr></thead><tbody>
              {variables.map((representative) => {
                const values = compareCompanies.map((company) => {
                  const record = getRecord(model, company, selectedYear, representative.normalizedVariable);
                  if (compareMode === "score") return record?.score ?? null;
                  if (compareMode === "change") return yearChange(model, company, selectedYear, representative.normalizedVariable).percent;
                  return record?.value ?? null;
                });
                const numeric = values.filter((value): value is number => value !== null);
                return <tr key={representative.normalizedVariable} onClick={() => setSelectedVariable(representative.normalizedVariable)}><td><span className="category-pill">{dataCategory(representative.variable)}</span></td><td><button type="button" className="company-link">{representative.variable}</button></td><td>{compareMode === "score" ? "امتیاز" : compareMode === "change" ? "نسبت" : representative.unit || "—"}</td>{values.map((value, index) => <td key={`${representative.normalizedVariable}-${compareCompanies[index]}`}><strong>{formatNumber(value, 2)}</strong></td>)}<td>{numeric.length ? formatNumber(numeric.reduce((sum, value) => sum + value, 0) / numeric.length, 2) : "—"}</td><td>{numeric.length ? formatNumber(Math.max(...numeric), 2) : "—"}</td></tr>;
              })}
            </tbody></table></div>
          </section>
        </>
      )}

      {model.years.length > 0 && view === "export" && (
        <section className="export-builder">
          <div className="export-builder-main">
            <article>
              <header><span>۱</span><div><h3>انتخاب شرکت‌ها</h3><p>{exportCompanies.length.toLocaleString("fa-IR")} شرکت انتخاب شده است.</p></div></header>
              <div className="selection-chips">{model.companies.map((company) => <button type="button" key={company} className={exportCompanies.includes(company) ? "active" : ""} onClick={() => setExportCompanies((current) => toggleLimited(current, company, model.companies.length, 1))}>{company}</button>)}</div>
            </article>
            <article>
              <header><span>۲</span><div><h3>انتخاب سال‌ها</h3><p>{exportYears.length.toLocaleString("fa-IR")} سال انتخاب شده است.</p></div></header>
              <div className="selection-chips">{model.years.map((year) => <button type="button" key={year} className={exportYears.includes(year) ? "active" : ""} onClick={() => setExportYears((current) => toggleLimited(current.map(String), String(year), model.years.length, 1).map(Number))}>{yearLabel(year)}</button>)}</div>
            </article>
            <article>
              <header><span>۳</span><div><h3>انتخاب متغیرها</h3><p>{exportVariables.length.toLocaleString("fa-IR")} متغیر انتخاب شده است.</p></div></header>
              <div className="variable-checklist export-variables">{variables.map((record) => <label key={record.normalizedVariable}><input type="checkbox" checked={exportVariables.includes(record.normalizedVariable)} onChange={() => setExportVariables((current) => toggleLimited(current, record.normalizedVariable, variables.length, 1))} /><span>{record.variable}</span><small>{record.unit}</small></label>)}</div>
            </article>
            <article>
              <header><span>۴</span><div><h3>نوع داده</h3><p>حداقل یک نوع داده را فعال نگه دارید.</p></div></header>
              <div className="export-type-grid">
                <label><input type="checkbox" checked={includeValue} onChange={(event) => setIncludeValue(event.target.checked)} /><strong>مقدار خام</strong><span>عدد و واحد ثبت‌شده</span></label>
                <label><input type="checkbox" checked={includeScore} onChange={(event) => setIncludeScore(event.target.checked)} /><strong>نمره</strong><span>مقیاس صفر تا ۱۰</span></label>
                <label><input type="checkbox" checked={includeChange} onChange={(event) => setIncludeChange(event.target.checked)} /><strong>تغییر</strong><span>مقدار و درصد سالانه</span></label>
              </div>
            </article>
            <article>
              <header><span>۵</span><div><h3>نمودارهای منتخب</h3><p>مشخصات و داده پشتیبان هر نمودار به فایل اضافه می‌شود.</p></div></header>
              <div className="selection-chips">{selectedCharts.map((chart) => <button type="button" key={chart} className={chartSelections.includes(chart) ? "active" : ""} onClick={() => setChartSelections((current) => toggleLimited(current, chart, selectedCharts.length))}>{chartSelections.includes(chart) ? <Check size={14} /> : null}{chart}</button>)}</div>
            </article>
          </div>
          <aside className="export-cart">
            <span className="output-icon"><FileSpreadsheet size={25} /></span>
            <h3>سبد خروجی</h3>
            <dl>
              <div><dt>شرکت</dt><dd>{exportCompanies.length.toLocaleString("fa-IR")}</dd></div>
              <div><dt>سال</dt><dd>{exportYears.length.toLocaleString("fa-IR")}</dd></div>
              <div><dt>متغیر</dt><dd>{exportVariables.length.toLocaleString("fa-IR")}</dd></div>
              <div><dt>رکورد تقریبی</dt><dd>{selectedExportCount.toLocaleString("fa-IR")}</dd></div>
              <div><dt>نمودار</dt><dd>{chartSelections.length.toLocaleString("fa-IR")}</dd></div>
            </dl>
            <div className="sheet-list"><strong>شیت‌های فایل</strong>{["داده‌های منتخب", "مقایسه شرکت‌ها", "روند زمانی", "نمودارهای منتخب", "مشخصات خروجی"].map((sheet) => <span key={sheet}><Check size={14} />{sheet}</span>)}</div>
            {!includeValue && !includeScore && !includeChange && <div className="validation-callout danger"><AlertTriangle size={16} />یک نوع داده انتخاب کنید.</div>}
            <button type="button" className="primary-button wide" disabled={!exportCompanies.length || !exportYears.length || !exportVariables.length || (!includeValue && !includeScore && !includeChange)} onClick={() => exportCustomDataWorkbook({ model, companies: exportCompanies, years: exportYears, variables: exportVariables, includeValue, includeScore, includeChange, chartSelections })}><Download size={17} />ساخت و دریافت Excel</button>
          </aside>
        </section>
      )}
    </div>
  );
}

async function downloadIssues(model: FinancialModel) {
  const issueRows = model.issues.map((issue) => ({
    نوع: ISSUE_LABELS[issue.type],
    شدت:
      issue.severity === "error"
        ? "خطا"
        : issue.severity === "warning"
          ? "هشدار"
          : "اطلاعات",
    شرکت: issue.company ?? "",
    سال: issue.year ?? "",
    متغیر: issue.variable ?? "",
    ردیف: issue.row ?? "",
    شرح: issue.message,
  }));
  const summaryRows = [
    { شاخص: "تعداد رکوردها", مقدار: model.summary.totalRecords },
    { شاخص: "تعداد شرکت‌ها", مقدار: model.summary.companies },
    { شاخص: "تعداد سال‌ها", مقدار: model.summary.years },
    { شاخص: "تعداد متغیرها", مقدار: model.summary.variables },
    { شاخص: "سهم کل رکوردهای دارای نمره", مقدار: model.summary.scoreCompleteness },
    { شاخص: "پوشش ۱۳ شاخص رتبه‌بندی", مقدار: model.summary.rankingScoreCompleteness },
    { شاخص: "امتیاز الزامی مفقود", مقدار: model.summary.missingRequiredScores },
    { شاخص: "رکوردهای ناقص", مقدار: model.summary.incompleteRecords },
    { شاخص: "رکوردهای تکراری", مقدار: model.summary.duplicateRecords },
    { شاخص: "نمره‌های نامعتبر", مقدار: model.summary.invalidScores },
    { شاخص: "متغیر با دامنه نمره محدود", مقدار: model.summary.invalidScoreScales },
    { شاخص: "ماهیت تکمیل‌شده", مقدار: model.summary.imputedNatureRows },
  ];
  const groupedRows = Object.entries(
    model.issues.reduce<Record<string, number>>((grouped, issue) => {
      const label = ISSUE_LABELS[issue.type];
      grouped[label] = (grouped[label] ?? 0) + 1;
      return grouped;
    }, {}),
  ).map(([type, count]) => ({ "نوع کنترل": type, تعداد: count }));
  const diagnosticRows = model.scoreDiagnostics.map((diagnostic) => ({
    متغیر: diagnostic.variable,
    "تعداد رکورد": diagnostic.count,
    حداقل: diagnostic.minimum,
    حداکثر: diagnostic.maximum,
    میانگین: diagnostic.mean,
    میانه: diagnostic.median,
    "انحراف معیار": diagnostic.standardDeviation,
    دامنه: diagnostic.range,
    "تعداد صفر": diagnostic.zeroCount,
    "تعداد ۱۰": diagnostic.tenCount,
    "درصد مفقود": diagnostic.missingPercent,
    "وضعیت دامنه": diagnostic.scaleValid ? "مناسب" : "محدود",
    توضیح: diagnostic.reason,
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(issueRows), "جزئیات خطاها");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), "خلاصه کیفیت");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(groupedRows), "تجمیع کنترل‌ها");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(diagnosticRows), "آمار دامنه نمره");
  XLSX.writeFile(workbook, "گزارش-کیفیت-داده.xlsx");
}

function QualityPage({ model }: { model: FinancialModel }) {
  const [issueFilter, setIssueFilter] = useState<DataIssue["type"] | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | DataIssue["severity"]>("all");
  const grouped = new Map<DataIssue["type"], number>();
  for (const issue of model.issues) grouped.set(issue.type, (grouped.get(issue.type) ?? 0) + 1);
  const visible = model.issues.filter(
    (issue) =>
      (issueFilter === "all" || issue.type === issueFilter) &&
      (severityFilter === "all" || issue.severity === severityFilter),
  );
  const invalidScales = useMemo(() => {
    const groups = new Map<string, number[]>();
    model.validRecords.forEach((record) => {
      if (record.score !== null) groups.set(record.normalizedVariable, [...(groups.get(record.normalizedVariable) ?? []), record.score]);
    });
    return [...groups.entries()]
      .filter(([, values]) => Math.max(...values) < 2 || Math.max(...values) - Math.min(...values) < 2)
      .map(([variable, values]) => ({ variable, min: Math.min(...values), max: Math.max(...values), count: values.length }));
  }, [model]);
  return (
    <div className="quality-page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">کنترل کیفیت</p>
          <h2>وضعیت داده ورودی و موارد قابل پیگیری</h2>
          <span>هیچ مقدار خالی در محاسبات به‌صورت صفر فرض نشده است.</span>
        </div>
        <button className="outline-button" type="button" onClick={() => downloadIssues(model)}>
          <Download size={17} />
          دانلود Excel کیفیت داده
        </button>
      </section>
      {invalidScales.length > 0 && (
        <section className="table-card quality-scale-card">
          <header><div><p className="eyebrow">پایش دامنه نمرات</p><h3>هشدار دامنه مشاهده‌شده محدود</h3></div><span className="table-count">{invalidScales.length.toLocaleString("fa-IR")} متغیر</span></header>
          <p className="table-note">این کنترل فقط محدودبودن دامنه نمرات موجود در فایل را نشان می‌دهد. هر نمره معتبر صفر تا ۱۰ همچنان مستقیماً در مدل استفاده می‌شود و از داده خام بازتولید نمی‌شود.</p>
          <div className="table-scroll"><table><thead><tr><th>متغیر</th><th>حداقل</th><th>حداکثر</th><th>تعداد نمره</th></tr></thead><tbody>{invalidScales.map((item) => <tr key={item.variable}><td>{item.variable}</td><td>{formatNumber(item.min, 2)}</td><td>{formatNumber(item.max, 2)}</td><td>{item.count.toLocaleString("fa-IR")}</td></tr>)}</tbody></table></div>
        </section>
      )}
      <section className="quality-overview">
        <QualityStat icon={<Building2 size={18} />} label="تعداد شرکت‌ها" value={model.summary.companies.toLocaleString("fa-IR")} />
        <QualityStat icon={<PanelTop size={18} />} label="تعداد سال‌ها" value={model.summary.years.toLocaleString("fa-IR")} />
        <QualityStat icon={<Database size={18} />} label="تعداد رکوردها" value={model.summary.totalRecords.toLocaleString("fa-IR")} />
        <QualityStat icon={<Layers3 size={18} />} label="تعداد متغیرها" value={model.summary.variables.toLocaleString("fa-IR")} />
        <QualityStat
          icon={<FileCheck2 size={18} />}
          label="سهم کل رکوردهای دارای امتیاز"
          value={percent(model.summary.scoreCompleteness)}
          tone={model.summary.scoreCompleteness > 0.45 ? "good" : "warning"}
        />
        <QualityStat
          icon={<CircleGauge size={18} />}
          label="پوشش ۱۳ شاخص رتبه"
          value={percent(model.summary.rankingScoreCompleteness)}
          tone={model.summary.rankingScoreCompleteness >= 0.75 ? "good" : "warning"}
        />
        <QualityStat
          icon={<AlertTriangle size={18} />}
          label="امتیاز الزامی مفقود"
          value={model.summary.missingRequiredScores.toLocaleString("fa-IR")}
          tone={model.summary.missingRequiredScores ? "warning" : "good"}
        />
        <QualityStat
          icon={<AlertTriangle size={18} />}
          label="رکوردهای ناقص"
          value={model.summary.incompleteRecords.toLocaleString("fa-IR")}
          tone="warning"
        />
        <QualityStat
          icon={<ClipboardCheck size={18} />}
          label="رکوردهای تکراری"
          value={model.summary.duplicateRecords.toLocaleString("fa-IR")}
          tone={model.summary.duplicateRecords ? "danger" : "good"}
        />
        <QualityStat
          icon={<ShieldCheck size={18} />}
          label="ماهیت تکمیل‌شده"
          value={model.summary.imputedNatureRows.toLocaleString("fa-IR")}
          tone="good"
        />
        <QualityStat
          icon={<CircleGauge size={18} />}
          label="متغیر با دامنه محدود"
          value={model.summary.invalidScoreScales.toLocaleString("fa-IR")}
          tone={model.summary.invalidScoreScales ? "warning" : "good"}
        />
      </section>
      <section className="table-card score-diagnostics-card">
        <header>
          <div>
            <p className="eyebrow">پایش توزیع نمره</p>
            <h3>دامنه مشاهده‌شده نمره به تفکیک متغیر</h3>
          </div>
          <span className="table-note-inline">دامنه کمتر از ۲ = هشدار تفکیک‌پذیری؛ نه حذف از مدل</span>
        </header>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>متغیر</th>
                <th>حداقل</th>
                <th>حداکثر</th>
                <th>میانگین</th>
                <th>میانه</th>
                <th>انحراف معیار</th>
                <th>صفر</th>
                <th>۱۰</th>
                <th>مفقود</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {model.scoreDiagnostics
                .filter((diagnostic) => diagnostic.maximum !== null)
                .sort((a, b) => Number(a.scaleValid) - Number(b.scaleValid))
                .map((diagnostic) => (
                  <tr key={diagnostic.normalizedVariable}>
                    <td><strong>{diagnostic.variable}</strong><small className="cell-note">{diagnostic.reason}</small></td>
                    <td>{formatNumber(diagnostic.minimum, 2)}</td>
                    <td>{formatNumber(diagnostic.maximum, 2)}</td>
                    <td>{formatNumber(diagnostic.mean, 2)}</td>
                    <td>{formatNumber(diagnostic.median, 2)}</td>
                    <td>{formatNumber(diagnostic.standardDeviation, 2)}</td>
                    <td>{diagnostic.zeroCount.toLocaleString("fa-IR")}</td>
                    <td>{diagnostic.tenCount.toLocaleString("fa-IR")}</td>
                    <td>{percent(diagnostic.missingPercent)}</td>
                    <td><span className={`severity ${diagnostic.scaleValid ? "info" : "warning"}`}>{diagnostic.scaleValid ? "مناسب" : "محدود"}</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="issue-summary-grid">
        {[...grouped.entries()]
          .filter(([type]) => type !== "missing-score")
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([type, count]) => (
            <button
              key={type}
              type="button"
              className={issueFilter === type ? "active" : ""}
              onClick={() => setIssueFilter(issueFilter === type ? "all" : type)}
            >
              <span>{ISSUE_LABELS[type]}</span>
              <strong>{count.toLocaleString("fa-IR")}</strong>
            </button>
          ))}
      </section>
      <section className="table-card">
        <header>
          <div>
            <p className="eyebrow">فهرست کنترل‌ها</p>
            <h3>{visible.length.toLocaleString("fa-IR")} مورد</h3>
          </div>
          <SelectField label="شدت" value={severityFilter} onChange={(value) => setSeverityFilter(value as typeof severityFilter)}>
            <option value="all">همه</option>
            <option value="error">خطا</option>
            <option value="warning">هشدار</option>
            <option value="info">اطلاع</option>
          </SelectField>
        </header>
        <div className="table-scroll quality-table">
          <table>
            <thead>
              <tr>
                <th>نوع</th>
                <th>شدت</th>
                <th>شرکت</th>
                <th>سال</th>
                <th>متغیر</th>
                <th>شرح</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 500).map((issue, index) => (
                <tr key={`${issue.type}-${issue.row}-${index}`}>
                  <td>{ISSUE_LABELS[issue.type]}</td>
                  <td>
                    <span className={`severity ${issue.severity}`}>{issue.severity}</span>
                  </td>
                  <td>{issue.company ?? "—"}</td>
                  <td>{issue.year ?? "—"}</td>
                  <td>{issue.variable ?? "—"}</td>
                  <td>{issue.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length > 500 && (
            <p className="table-note">برای حفظ سرعت، ۵۰۰ مورد نخست نمایش داده شده است؛ فایل خروجی شامل همه موارد است.</p>
          )}
        </div>
      </section>
    </div>
  );
}

const WEIGHT_GROUPS: {
  key: keyof ModelSettings["weights"];
  title: string;
  items: { key: string; label: string }[];
}[] = [
  {
    key: "profitability",
    title: "سودآوری",
    items: [
      { key: "operatingMargin", label: "حاشیه سود عملیاتی" },
      { key: "npm", label: "حاشیه سود خالص" },
    ],
  },
  {
    key: "cashQuality",
    title: "کیفیت سود و جریان نقد",
    items: [
      { key: "cfoNi", label: "CFO / NI" },
      { key: "fcfMargin", label: "حاشیه FCF" },
      { key: "ocfStability", label: "پایداری OCF" },
    ],
  },
  {
    key: "growth",
    title: "رشد",
    items: [
      { key: "revenueGrowth", label: "رشد درآمد" },
      { key: "operatingProfitGrowth", label: "رشد سود عملیاتی" },
    ],
  },
  {
    key: "capitalReturn",
    title: "بازده سرمایه",
    items: [
      { key: "roic", label: "ROIC / ROCE" },
      { key: "assetTurnover", label: "گردش دارایی‌ها" },
    ],
  },
  {
    key: "resilience",
    title: "تاب‌آوری مالی",
    items: [
      { key: "debtEbitda", label: "بدهی خالص / EBITDA" },
      { key: "interestCoverage", label: "پوشش بهره" },
      { key: "quickRatio", label: "نسبت آنی" },
    ],
  },
  {
    key: "financialPerformance",
    title: "عملکرد مالی",
    items: [
      { key: "profitability", label: "سودآوری" },
      { key: "capitalReturn", label: "بازده سرمایه" },
      { key: "cashQuality", label: "کیفیت سود" },
    ],
  },
];

function SettingsPage({
  settings,
  onSave,
}: {
  settings: ModelSettings;
  onSave: (settings: ModelSettings) => void;
}) {
  const [draft, setDraft] = useState<ModelSettings>(structuredClone(settings));
  const valid = settingsAreValid(draft);

  function changeWeight(groupKey: keyof ModelSettings["weights"], itemKey: string, value: number) {
    setDraft((current) => {
      const next = structuredClone(current);
      const group = next.weights[groupKey] as unknown as Record<string, number>;
      group[itemKey] = value / 100;
      return next;
    });
  }

  return (
    <div className="settings-page">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">تنظیمات مدل</p>
          <h2>محورهای دیدبان، مرزها و حداقل پوشش داده</h2>
          <span>وزن رسمی شش بُعد در رتبه‌نما مدیریت می‌شود؛ تنظیمات این صفحه فقط دیدبان مالی را کنترل می‌کند.</span>
        </div>
        <div className="settings-actions">
          <button type="button" className="outline-button" onClick={() => setDraft(structuredClone(DEFAULT_SETTINGS))}>
            <RotateCcw size={17} />
            بازیابی پیش‌فرض
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={!valid}
            onClick={() => onSave(draft)}
          >
            <Check size={17} />
            ذخیره و محاسبه مجدد
          </button>
        </div>
      </section>
      {!valid && (
        <div className="validation-callout danger">
          <AlertTriangle size={18} />
          <div>
            <strong>تنظیمات نیازمند اصلاح است</strong>
            <span>مجموع وزن هر محور باید دقیقاً ۱۰۰٪ و مرز ضعیف کمتر از مرز مطلوب باشد.</span>
          </div>
        </div>
      )}
      <section className="settings-layout">
        <div className="weight-groups">
          {WEIGHT_GROUPS.map((group) => {
            const values = draft.weights[group.key] as unknown as Record<string, number>;
            const total = Object.values(values).reduce((sum, value) => sum + value, 0);
            return (
              <article className="weight-card" key={group.key}>
                <header>
                  <div>
                    <p className="eyebrow">محور ترکیبی</p>
                    <h3>{group.title}</h3>
                  </div>
                  <span className={Math.abs(total - 1) < 0.001 ? "total valid" : "total invalid"}>
                    مجموع {percent(total)}
                  </span>
                </header>
                <div className="weight-inputs">
                  {group.items.map((item) => (
                    <label key={item.key}>
                      <span>{item.label}</span>
                      <div>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={Math.round((values[item.key] ?? 0) * 100)}
                          onChange={(event) =>
                            changeWeight(group.key, item.key, Number(event.target.value))
                          }
                        />
                        <b>٪</b>
                      </div>
                    </label>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
        <aside className="model-controls">
          <article hidden>
            <header>
              <Target size={18} />
              <h3>ترکیب مطلق و نسبی</h3>
            </header>
            <label>
              <span>وزن امتیاز مطلق</span>
              <input
                type="number"
                min="0"
                max="100"
                step="5"
                value={Math.round((draft.performance ?? DEFAULT_SETTINGS.performance).absoluteWeight * 100)}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    performance: {
                      ...(current.performance ?? DEFAULT_SETTINGS.performance),
                      absoluteWeight: Number(event.target.value) / 100,
                      relativeWeight: 1 - Number(event.target.value) / 100,
                    },
                  }))
                }
              />
            </label>
            <label>
              <span>وزن امتیاز نسبی</span>
              <strong>{percent((draft.performance ?? DEFAULT_SETTINGS.performance).relativeWeight)}</strong>
            </label>
            <p>مقدار پیش‌فرض: ۷۵٪ مطلق و ۲۵٪ نسبی. امتیاز نسبی جایگزین استاندارد مطلق نمی‌شود.</p>
          </article>
          <article hidden>
            <header>
              <TrendingUp size={18} />
              <h3>تورم و نسخه مدل</h3>
            </header>
            <label>
              <span>نرخ تورم سالانه</span>
              <input
                type="number"
                min="0"
                max="500"
                step="0.1"
                placeholder="ثبت نشده"
                value={(draft.performance ?? DEFAULT_SETTINGS.performance).inflationRate === null ? "" : Math.round(((draft.performance ?? DEFAULT_SETTINGS.performance).inflationRate ?? 0) * 1000) / 10}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    performance: {
                      ...(current.performance ?? DEFAULT_SETTINGS.performance),
                      inflationRate: event.target.value === "" ? null : Number(event.target.value) / 100,
                    },
                  }))
                }
              />
            </label>
            <label>
              <span>نسخه فعال مدل</span>
              <input
                type="text"
                value={(draft.performance ?? DEFAULT_SETTINGS.performance).modelVersion}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    performance: {
                      ...(current.performance ?? DEFAULT_SETTINGS.performance),
                      modelVersion: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <p>اگر تورم خالی باشد، رشد درآمد با برچسب «رشد اسمی» گزارش می‌شود.</p>
          </article>
          <article>
            <header>
              <SlidersHorizontal size={18} />
              <h3>مرز طبقه‌بندی</h3>
            </header>
            <label>
              <span>پایان ناحیه ضعیف</span>
              <input
                type="number"
                min="0.1"
                max="9"
                step="0.1"
                value={draft.lowBoundary}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    lowBoundary: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label>
              <span>شروع ناحیه مطلوب</span>
              <input
                type="number"
                min="1"
                max="9.9"
                step="0.1"
                value={draft.highBoundary}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    highBoundary: Number(event.target.value),
                  }))
                }
              />
            </label>
            <div className="boundary-preview">
              <span className="weak">۰ تا {draft.lowBoundary}</span>
              <span className="medium">{draft.lowBoundary} تا {draft.highBoundary}</span>
              <span className="good">{draft.highBoundary} تا ۱۰</span>
            </div>
          </article>
          <article>
            <header>
              <CircleGauge size={18} />
              <h3>حداقل پوشش داده</h3>
            </header>
            <label>
              <span>وزن معتبر لازم</span>
              <div className="range-field">
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={draft.minimumCoverage * 100}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      minimumCoverage: Number(event.target.value) / 100,
                    }))
                  }
                />
                <strong>{percent(draft.minimumCoverage)}</strong>
              </div>
            </label>
            <p>در پوشش کمتر از این حد، محور با برچسب «داده ناکافی» نمایش داده می‌شود.</p>
          </article>
          <article hidden>
            <header>
              <FileCheck2 size={18} />
              <h3>پوشش امتیاز پایه</h3>
            </header>
            <label>
              <span>حداقل وزن شش بُعد</span>
              <div className="range-field">
                <input
                  type="range"
                  min="50"
                  max="100"
                  step="5"
                  value={(draft.performance ?? DEFAULT_SETTINGS.performance).minimumBaseCoverage * 100}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      performance: {
                        ...(current.performance ?? DEFAULT_SETTINGS.performance),
                        minimumBaseCoverage: Number(event.target.value) / 100,
                      },
                    }))
                  }
                />
                <strong>{percent((draft.performance ?? DEFAULT_SETTINGS.performance).minimumBaseCoverage)}</strong>
              </div>
            </label>
            <p>زیر این حد، امتیاز نهایی با برچسب «غیرقابل اتکا» محاسبه نمی‌شود.</p>
          </article>
          <article hidden>
            <header>
              <AlertTriangle size={18} />
              <h3>جریمه‌های استثنایی</h3>
            </header>
            <label>
              <span>پوشش بهره کمتر از یک</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={(draft.performance ?? DEFAULT_SETTINGS.performance).criticalInterestCoveragePenalty}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    performance: {
                      ...(current.performance ?? DEFAULT_SETTINGS.performance),
                      criticalInterestCoveragePenalty: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <label>
              <span>OCF منفی در دو سال از سه سال</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={(draft.performance ?? DEFAULT_SETTINGS.performance).recurringNegativeOcfPenalty}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    performance: {
                      ...(current.performance ?? DEFAULT_SETTINGS.performance),
                      recurringNegativeOcfPenalty: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <label>
              <span>EBITDA منفی و بدهی خالص مثبت</span>
              <input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={(draft.performance ?? DEFAULT_SETTINGS.performance).severeNetDebtPenalty}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    performance: {
                      ...(current.performance ?? DEFAULT_SETTINGS.performance),
                      severeNetDebtPenalty: Number(event.target.value),
                    },
                  }))
                }
              />
            </label>
            <p>مجموع جریمه‌های اضافی حداکثر یک امتیاز است و سقف‌های بحرانی مستقل اعمال می‌شوند.</p>
          </article>
          <article hidden>
            <header>
              <ShieldCheck size={18} />
              <h3>قاعده پایداری OCF</h3>
            </header>
            <p>
              سه سال: ۱۰ منهای دو برابر انحراف معیار. دو سال: ۱۰ منهای اختلاف مطلق.
              یک سال: حذف مؤلفه و بازتوزیع وزن.
            </p>
          </article>
          <article hidden>
            <header>
              <TrendingUp size={18} />
              <h3>قاعده رشد سود عملیاتی</h3>
            </header>
            <p>
              برای سه مقدار مثبت از CAGR استفاده می‌شود. در تغییر علامت، تغییر نمره
              نرمال‌شده مبناست و روش فعال در جزئیات محاسبه درج می‌شود.
            </p>
          </article>
        </aside>
      </section>
    </div>
  );
}

function HomePage({
  model,
  matrix,
  performanceMatrix,
  selectedCompany,
  selectedYear,
  setTab,
}: {
  model: FinancialModel;
  matrix: Map<string, Map<number, AxisBundle>>;
  performanceMatrix: PerformanceMatrix;
  selectedCompany: string;
  selectedYear: number;
  setTab: (tab: AppTab) => void;
}) {
  const result = performanceMatrix.get(selectedCompany)?.get(selectedYear);
  const bundle = matrix.get(selectedCompany)?.get(selectedYear);
  const selectedRecords = model.index.get(selectedCompany)?.get(selectedYear);
  const rawMetric = (variable: string) =>
    selectedRecords?.get(normalizeText(variable))?.value ?? null;
  const dimensions = result
    ? PERFORMANCE_DIMENSION_KEYS
        .map((key) => result.dimensions[key])
        .filter((dimension) => dimension.score !== null)
        .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    : [];
  const modules: {
    key: AppTab;
    number: string;
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    features: string[];
  }[] = [
    {
      key: "analysis",
      number: "۰۱",
      icon: <BarChart3 size={27} />,
      title: "دیدبان مالی",
      subtitle: "تحلیل چندبعدی وضعیت و مسیر مالی شرکت‌ها",
      features: ["چهار ماتریس اسکاتر", "مسیر سه‌ساله و ۹ ناحیه", "مقایسه پرتفوی و هم‌ماهیت"],
    },
    {
      key: "performance",
      number: "۰۲",
      icon: <CircleGauge size={27} />,
      title: "رتبه‌نمای عملکرد",
      subtitle: "امتیازدهی، رتبه‌بندی و ارزیابی عملکرد مالی",
      features: ["مدل شش‌بُعدی و ۱۳ شاخص", "وزن‌دهی گرافیکی و سناریو", "رتبه و تحلیل پویا"],
    },
    {
      key: "data",
      number: "۰۳",
      icon: <Database size={27} />,
      title: "مرکز داده مالی",
      subtitle: "مشاهده، مقایسه و استخراج داده‌ها و شاخص‌ها",
      features: ["پروفایل کامل شرکت", "روند و مقایسه چندشرکتی", "خروجی سفارشی Excel"],
    },
  ];
  return (
    <div className="system-home">
      <section className="system-home-hero">
        <div>
          <span className="product-badge"><Sparkles size={15} />سامانه مدیریتی یکپارچه IPS</span>
          <h1>سامانه تحلیل مالی و راهبری سرمایه آتیه</h1>
          <p>یک مرجع واحد برای مشاهده داده، تحلیل موقعیت مالی، ارزیابی عملکرد و تصمیم‌گیری درباره شرکت‌های زیرمجموعه.</p>
        </div>
        <div className="home-context-card">
          <span>فیلتر فعال</span>
          <strong>{selectedCompany}</strong>
          <p>سال {selectedYear.toLocaleString("fa-IR", { useGrouping: false })} · {model.natureByCompany.get(selectedCompany) ?? "ماهیت نامشخص"}</p>
          <div>
            <span>امتیاز نهایی</span>
            <b>{formatNumber(result?.finalScore ?? null, 2)}</b>
            <small>{result?.classificationLabel ?? "داده ناکافی"}</small>
          </div>
        </div>
      </section>
      <section className="home-summary-strip">
        <QualityStat icon={<Building2 size={18} />} label="شرکت زیرمجموعه" value={model.summary.companies.toLocaleString("fa-IR")} />
        <QualityStat icon={<PanelTop size={18} />} label="دوره مالی" value={`${model.summary.years.toLocaleString("fa-IR")} سال`} />
        <QualityStat icon={<Database size={18} />} label="شاخص و متغیر" value={model.summary.variables.toLocaleString("fa-IR")} />
        <QualityStat icon={<FileCheck2 size={18} />} label="پوشش ۱۳ شاخص رتبه" value={percent(model.summary.rankingScoreCompleteness)} tone={model.summary.rankingScoreCompleteness >= 0.75 ? "good" : "warning"} />
      </section>
      <section className="company-profile-snapshot">
        <header>
          <div>
            <p className="eyebrow">پروفایل مالی شرکت</p>
            <h2>{selectedCompany}</h2>
          </div>
          <span className={`performance-class ${result?.classification ?? "unreliable"}`}>{result?.classificationLabel ?? "داده ناکافی"}</span>
        </header>
        <div className="profile-kpi-grid">
          <div><span>درآمد عملیاتی</span><strong>{formatCompact(rawMetric("درآمدهای عملیاتی"))}</strong></div>
          <div><span>سود عملیاتی</span><strong>{formatCompact(rawMetric("سود (زیان) عملیاتی"))}</strong></div>
          <div><span>سود خالص</span><strong>{formatCompact(rawMetric("سود (زیان) خالص (عملیات در حال تداوم)"))}</strong></div>
          <div><span>جریان نقد عملیاتی</span><strong>{formatCompact(rawMetric("OCF جریان نقد عملیاتی"))}</strong></div>
          <div><span>امتیاز نهایی</span><strong>{formatNumber(result?.finalScore ?? null, 2)}</strong></div>
          <div><span>رتبه پرتفوی</span><strong>{result?.ranking.overallRank?.toLocaleString("fa-IR") ?? "—"}</strong></div>
        </div>
        <div className="profile-insight-grid">
          <article>
            <span>وضعیت چهار اسکاتر</span>
            <div className="scatter-status-list">
              {CHART_DEFINITIONS.map((definition) => {
                const x = bundle?.axes[definition.xKey].score ?? null;
                const y = bundle?.axes[definition.yKey].score ?? null;
                const tone = x === null || y === null ? "empty" : x >= SCATTER_BOUNDARIES.high && y >= SCATTER_BOUNDARIES.high ? "good" : x < SCATTER_BOUNDARIES.low || y < SCATTER_BOUNDARIES.low ? "weak" : "medium";
                return <b className={tone} key={definition.key}>{definition.title}: {x === null || y === null ? "داده ناکافی" : `${formatNumber(x, 1)} / ${formatNumber(y, 1)}`}</b>;
              })}
            </div>
          </article>
          <article><span>مهم‌ترین قوت</span><strong>{dimensions[0]?.label ?? "نامشخص"}</strong><small>{formatNumber(dimensions[0]?.score ?? null, 2)} از ۱۰</small></article>
          <article><span>مهم‌ترین ضعف</span><strong>{dimensions.at(-1)?.label ?? "نامشخص"}</strong><small>{formatNumber(dimensions.at(-1)?.score ?? null, 2)} از ۱۰</small></article>
          <article><span>مهم‌ترین هشدار</span><strong>{result?.penalties[0]?.label ?? (result?.warnings[0] ? "محدودیت مدل" : "هشدار بحرانی ندارد")}</strong><small>{result?.penalties[0]?.evidence ?? result?.warnings[0] ?? "—"}</small></article>
        </div>
      </section>
      <section className="module-card-grid">
        {modules.map((module) => (
          <button type="button" key={module.key} className={`module-card module-${module.key}`} onClick={() => setTab(module.key)}>
            <div className="module-card-top"><span>{module.icon}</span><b>{module.number}</b></div>
            <h2>{module.title}</h2>
            <p>{module.subtitle}</p>
            <ul>{module.features.map((feature) => <li key={feature}><Check size={15} />{feature}</li>)}</ul>
            <span className="module-open">ورود به ماژول <ArrowLeft size={17} /></span>
          </button>
        ))}
      </section>
      <section className="home-guidance">
        <div><ShieldCheck size={21} /><span><strong>پردازش محلی و امن</strong>فایل اصلی تغییر نمی‌کند و داده داخل مرورگر پردازش می‌شود.</span></div>
        <div><Activity size={21} /><span><strong>محاسبات قابل حسابرسی</strong>فرمول، وزن داخلی، پوشش و بازتوزیع برای هر امتیاز قابل مشاهده است.</span></div>
        <div><Layers3 size={21} /><span><strong>State مشترک</strong>شرکت و سال انتخاب‌شده هنگام جابه‌جایی بین ماژول‌ها حفظ می‌شوند.</span></div>
      </section>
    </div>
  );
}

function OutputsPage({
  model,
  matrix,
  performanceMatrix,
  goToBuilder,
}: {
  model: FinancialModel;
  matrix: Map<string, Map<number, AxisBundle>>;
  performanceMatrix: PerformanceMatrix;
  goToBuilder: () => void;
}) {
  return (
    <div className="outputs-page">
      <section className="page-title-row">
        <div><p className="eyebrow">خروجی‌ها</p><h2>مرکز دریافت گزارش‌ها</h2><span>خروجی آماده مدل امتیازدهی یا ساخت فایل سفارشی بر اساس شرکت، سال و متغیر.</span></div>
      </section>
      <section className="output-option-grid">
        <article>
          <span className="output-icon"><CircleGauge size={25} /></span>
          <h3>گزارش امتیاز و رتبه‌بندی</h3>
          <p>امتیاز رسمی سالانه، امتیاز سه‌ساله، شش بُعد، ۱۳ شاخص، پوشش و رتبه‌ها در شیت‌های مستقل.</p>
          <button type="button" className="primary-button" onClick={() => exportAxisWorkbook(model, matrix, performanceMatrix)}><FileSpreadsheet size={17} />دریافت Excel امتیازها</button>
        </article>
        <article>
          <span className="output-icon"><Database size={25} /></span>
          <h3>سازنده خروجی سفارشی</h3>
          <p>شرکت‌ها، سال‌ها، متغیرها و نوع داده را انتخاب کنید و فایل چندشیتی مختص جلسه یا تحلیل خود بسازید.</p>
          <button type="button" className="primary-button" onClick={goToBuilder}><SlidersHorizontal size={17} />ورود به سازنده خروجی</button>
        </article>
        <article>
          <span className="output-icon"><Printer size={25} /></span>
          <h3>نسخه PDF مدیریتی</h3>
          <p>صفحه فعال را با چیدمان چاپی ذخیره کنید؛ برای نمودارها ابتدا حالت تمام‌صفحه را بررسی کنید.</p>
          <button type="button" className="outline-button" onClick={() => window.print()}><Printer size={17} />چاپ / ذخیره PDF</button>
        </article>
      </section>
    </div>
  );
}

async function exportAxisWorkbook(
  model: FinancialModel,
  matrix: Map<string, Map<number, AxisBundle>>,
  performanceMatrix: PerformanceMatrix,
) {
  const axisRows = model.companies.flatMap((company) =>
    model.years.map((year) => {
      const bundle = matrix.get(company)?.get(year);
      return {
        شرکت: company,
        ماهیت: model.natureByCompany.get(company) ?? "",
        سال: year,
        سودآوری: bundle?.axes.profitability.score ?? null,
        "کیفیت سود": bundle?.axes.cashQuality.score ?? null,
        رشد: bundle?.axes.growth.score ?? null,
        "بازده سرمایه": bundle?.axes.capitalReturn.score ?? null,
        "تاب‌آوری مالی": bundle?.axes.resilience.score ?? null,
        "عملکرد مالی": bundle?.axes.financialPerformance.score ?? null,
        "کارایی سرمایه در گردش": bundle?.axes.workingCapital.score ?? null,
        "سودآوری عملیاتی": bundle?.axes.operatingProfitability.score ?? null,
      };
    }),
  );
  const performanceResults = model.companies.flatMap((company) =>
    model.years
      .map((year) => performanceMatrix.get(company)?.get(year))
      .filter((result): result is PerformanceResult => Boolean(result)),
  );
  const scoreRows = performanceResults.map((result) => ({
    شرکت: result.company,
    ماهیت: result.nature,
    سال: result.year,
    "نسخه مدل": result.modelVersion,
    "گروه مقایسه": result.comparisonGroup,
    "امتیاز رسمی سالانه": result.finalScore,
    "پوشش مدل": result.baseCoverage,
    "اعتبار امتیاز": result.confidenceLabel,
    "امتیاز پایدار سه‌ساله": result.weightedHistoryScore,
    "روش سابقه": result.historyLabel,
    طبقه: result.classificationLabel,
    "رتبه گروه سازگار": result.ranking.overallRank,
    "رتبه هم‌ماهیت": result.ranking.peerRank,
    صدک: result.ranking.percentile,
    "فاصله از برتر": result.ranking.gapToLeader,
    "فاصله از میانگین": result.ranking.gapToAverage,
    "فاصله از میانه": result.ranking.gapToMedian,
    "تغییر رتبه": result.ranking.rankChange,
  }));
  const dimensionRows = performanceResults.flatMap((result) =>
    PERFORMANCE_DIMENSION_KEYS.map((key) => {
      const dimension = result.dimensions[key];
      return {
        شرکت: result.company,
        سال: result.year,
        بُعد: dimension.label,
        وزن: dimension.modelWeight,
        پوشش: dimension.coverage,
        "امتیاز بُعد": dimension.score,
        "وزن تعدیل‌شده": dimension.adjustedModelWeight,
        "سهم در امتیاز سالانه": dimension.baseContribution,
        "تغییر سالانه": dimension.yearOverYearChange,
        "رتبه بُعدی": dimension.portfolioRank,
        فرمول: dimension.formula,
        هشدار: dimension.warnings.join(" | "),
      };
    }),
  );
  const componentRows = performanceResults.flatMap((result) =>
    PERFORMANCE_DIMENSION_KEYS.flatMap((key) =>
      result.dimensions[key].components.map((component) => ({
        شرکت: result.company,
        سال: result.year,
        بُعد: result.dimensions[key].label,
        شاخص: component.label,
        متغیر: component.variable,
        مقدار: component.value,
        واحد: component.unit,
        امتیاز: component.score,
        "روش امتیاز": component.scoreMethod,
        "وزن اولیه": component.originalWeight,
        "وزن مؤثر": component.adjustedWeight,
        سهم: component.contribution,
        توضیح: component.method,
      })),
    ),
  );
  const scoreDiagnosticRows = model.scoreDiagnostics.map((diagnostic) => ({
    متغیر: diagnostic.variable,
    حداقل: diagnostic.minimum,
    حداکثر: diagnostic.maximum,
    میانگین: diagnostic.mean,
    میانه: diagnostic.median,
    "انحراف معیار": diagnostic.standardDeviation,
    دامنه: diagnostic.range,
    صفر: diagnostic.zeroCount,
    ده: diagnostic.tenCount,
    "درصد مفقود": diagnostic.missingPercent,
    وضعیت: diagnostic.scaleValid ? "مناسب" : "محدود",
    توضیح: diagnostic.reason,
  }));
  const warningRows = performanceResults.flatMap((result) =>
    result.warnings.map((warning) => ({
      شرکت: result.company,
      سال: result.year,
      پوشش: result.baseCoverage,
      "اعتبار امتیاز": result.confidenceLabel,
      هشدار: warning,
    })),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(scoreRows), "امتیاز نهایی");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dimensionRows), "جزئیات ابعاد");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(componentRows), "جزئیات شاخص‌ها");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(warningRows), "پوشش و هشدارها");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(axisRows), "محورهای دیدبان");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(scoreDiagnosticRows), "آمار دامنه نمره");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ["عنوان", "سامانه تحلیل مالی و راهبری سرمایه آتیه"],
      ["فایل ورودی", model.fileName],
      ["زمان پردازش", formatDate(model.importedAt)],
      ["تعداد شرکت", model.summary.companies],
      ["تعداد سال", model.summary.years],
      ["نسخه نرم‌افزار",'57.0.0'],
      ['نسخه کتابچه دیده‌بان','7.0-v54'],
      ['واحد مبالغ مالی','میلیون ریال؛ واحدهای قابل‌شناسایی هنگام ورود تبدیل شده‌اند'],
      ["نسخه مدل", performanceResults[0]?.modelVersion ?? "—"],
      ["قاعده پوشش داخلی بُعد", "حداقل ۶۰٪ وزن داخلی"],
      ["قاعده پوشش کل", "۷۵٪ معتبر؛ ۶۰٪ تا کمتر از ۷۵٪ موقت؛ کمتر از ۶۰٪ بدون امتیاز و رتبه رسمی"],
      ["یادداشت", "نمره خالی در هیچ محاسبه‌ای صفر فرض نشده است."],
    ]),
    "مشخصات خروجی",
  );
  XLSX.writeFile(workbook, "گزارش-امتیاز-و-رتبه‌بندی-پرتفوی.xlsx");
}

export default function DashboardApp() {
  const [models, setModels] = useState<HoldingModels>({ atieh: null, metil: null });
  const [marketModel, setMarketModel] = useState<MarketModel | null>(null);
  const [benchmarkModel, setBenchmarkModel] = useState<BenchmarkModel | null>(null);
  const [productModel, setProductModel] = useState<ProductionModel | null>(null);
  const [profitModel, setProfitModel] = useState<ProfitModel | null>(null);
  const [assetModel, setAssetModel] = useState<AssetModel | null>(null);
  const [metilActivityModel, setMetilActivityModel] = useState<MetilActivityModel | null>(null);
  const [equipmentModel, setEquipmentModel] = useState<EquipmentModel | null>(null);
  const [marketBusy, setMarketBusy] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [benchmarkBusy, setBenchmarkBusy] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState("");
  const [productBusy, setProductBusy] = useState(false);
  const [productError, setProductError] = useState("");
  const [profitBusy, setProfitBusy] = useState(false);
  const [profitError, setProfitError] = useState("");
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetError, setAssetError] = useState("");
  const [metilActivityBusy, setMetilActivityBusy] = useState(false);
  const [metilActivityError, setMetilActivityError] = useState("");
  const [equipmentBusy, setEquipmentBusy] = useState(false);
  const [equipmentError, setEquipmentError] = useState("");
  const [holding, setHolding] = useState<HoldingSelection>("atieh");
  const [entered, setEntered] = useState(false);
  const [reportPortal,setReportPortal]=useState(false);
  const emptyReportModel=useMemo(()=>buildFinancialModel([],[...REQUIRED_COLUMNS],'بدون داده مالی'),[]);
  useEffect(()=>{const sync=()=>setReportPortal(window.location.hash==='#report');sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync)},[]);
  useEffect(()=>{if(reportPortal)window.scrollTo(0,0)},[reportPortal]);
  function openReport(){window.location.hash='report';setReportPortal(true);setMobileMenu(false);}
  function closeReport(){window.location.hash='';setReportPortal(false);}

  const [busy, setBusy] = useState<HoldingFlags>({ atieh: false, metil: false });
  const [fileErrors, setFileErrors] = useState<HoldingErrors>({ atieh: "", metil: "" });
  const [error, setError] = useState("");
  const [duplicateConfirmed, setDuplicateConfirmed] = useState<HoldingFlags>({ atieh: false, metil: false });
  const [tab, setTab] = useState<AppTab>("analysis");
  const [dataEntryView, setDataEntryView] = useState<DataView>("profile");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [headerCollapsed, setHeaderCollapsed] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedYear, setSelectedYear] = useState(0);
  const [natureFilter, setNatureFilter] = useState("همه");
  const [displayMode, setDisplayMode] = useState<DisplayMode>("trend");
  const [bubbleMetric, setBubbleMetric] = useState<BubbleMetric>("none");
  const [showAverage, setShowAverage] = useState(DEFAULT_SETTINGS.showAverage);
  const [showLabels, setShowLabels] = useState(DEFAULT_SETTINGS.showLabels);
  const [highlightSelected, setHighlightSelected] = useState(true);
  const [settings, setSettings] = useState<ModelSettings>(loadStoredSettings);
  const [exportingImage, setExportingImage] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const restoreRef=useRef<HTMLInputElement>(null);
  const [workspaceMessage,setWorkspaceMessage]=useState('');
  const [reportType, setReportType] = useState<ReportKind>('annual');
  const sourceModel = models[holding];
  const analysisReportType = ['analysis','performance','data','report'].includes(tab) ? reportType : 'annual';
  const model = useMemo(() => sourceModel ? selectReportModel(sourceModel, analysisReportType) : null, [sourceModel, analysisReportType]);
  useEffect(() => {
    if (!model) return;
    if (!model.years.length && reportType === "half-year" && sourceModel && selectReportModel(sourceModel, "annual").years.length) { setReportType("annual"); setWorkspaceMessage("برای این هلدینگ داده شش‌ماهه موجود نیست؛ آخرین دوره سالانه نمایش داده شد."); return; }
    if (!model.years.includes(selectedYear)) setSelectedYear(model.years.at(-1) ?? 0);
    if (!model.companies.includes(selectedCompany)) setSelectedCompany(model.companies[0] ?? '');
  }, [model, selectedYear, selectedCompany, sourceModel, reportType]);

  const occupied:ImportTarget[]=[...(models.atieh?['atieh' as const]:[]),...(models.metil?['metil' as const]:[]),...(marketModel?['market' as const]:[]),...(benchmarkModel?['benchmark' as const]:[]),...(productModel?['product' as const]:[]),...(profitModel?['profit' as const]:[]),...(assetModel?['asset' as const]:[]),...(metilActivityModel?['activity' as const]:[]),...(equipmentModel?['equipment' as const]:[])];
  function applyBatch(next:Partial<Record<ImportTarget,any>>){
    const financial={...models};if(next.atieh)financial.atieh=next.atieh;if(next.metil)financial.metil=next.metil;setModels(financial);
    if(next.market)setMarketModel(next.market);if(next.benchmark)setBenchmarkModel(next.benchmark);if(next.product)setProductModel(next.product);if(next.profit)setProfitModel(next.profit);if(next.asset)setAssetModel(next.asset);if(next.activity)setMetilActivityModel(next.activity);if(next.equipment)setEquipmentModel(next.equipment);
    setDuplicateConfirmed(current=>({...current,...(next.atieh?{atieh:false}:{}),...(next.metil?{metil:false}:{})}));
    const target=financial[holding]?holding:financial.atieh?'atieh':'metil';if(financial[target]){setHolding(target);setDefaultContext(target,financial[target]!);}
  }
  function saveWorkspace(){
    try{const scenarioState=Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('atieh-scenario-v49:')).map(k=>[k,localStorage.getItem(k)]));
      downloadText(serializeWorkspace({models,marketModel,benchmarkModel,productModel,profitModel,assetModel,metilActivityModel,equipmentModel,settings,holding,selectedCompany,selectedYear,tab,reportType,scenarioState}),`atieh-financial-workspace-${new Date().toISOString().slice(0,10)}.json`);setWorkspaceMessage('پرونده کامل ذخیره شد.');
    }catch(e){setWorkspaceMessage(e instanceof Error?e.message:'ذخیره ناموفق بود.');}
  }
  async function restoreWorkspace(file:File){
    try{const p=deserializeWorkspace(await file.text()) as any;if(!settingsAreValid(p.settings))throw Error('تنظیمات پرونده معتبر نیست.');
      setReportType(p.reportType === 'half-year' ? 'half-year' : 'annual');const fm=p.models[p.holding] ? selectReportModel(p.models[p.holding], p.reportType === 'half-year' && ['analysis','performance','data','report'].includes(p.tab) ? 'half-year' : 'annual') : null;if(fm?.years.length&&(!fm.companies.includes(p.selectedCompany)||!fm.years.includes(p.selectedYear)))throw Error('شرکت یا دوره پرونده با داده‌ها سازگار نیست.');
      const scenarioEntries=Object.entries(p.scenarioState??{});for(const [key,value] of scenarioEntries){if(!key.startsWith('atieh-scenario-v49:')||typeof value!=='string')throw Error('سناریوی پرونده معتبر نیست.');JSON.parse(value);}
      // Persist before changing active models, so a storage failure leaves the current workspace intact.
      const rollback=Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('atieh-scenario-v49:')).map(k=>[k,localStorage.getItem(k)]));
      try{for(const key of Object.keys(rollback))localStorage.removeItem(key);for(const [key,value] of scenarioEntries)localStorage.setItem(key,value as string);}catch(e){for(const key of Object.keys(localStorage).filter(k=>k.startsWith('atieh-scenario-v49:')))localStorage.removeItem(key);for(const [key,value] of Object.entries(rollback))if(value!==null)localStorage.setItem(key,value);throw e;}
      setModels(p.models);setMarketModel(p.marketModel??null);setBenchmarkModel(p.benchmarkModel??null);setProductModel(p.productModel??null);setProfitModel(p.profitModel??null);setAssetModel(p.assetModel??null);setMetilActivityModel(p.metilActivityModel??null);setEquipmentModel(p.equipmentModel??null);setSettings(p.settings);setHolding(p.holding);setSelectedCompany(p.selectedCompany);setSelectedYear(p.selectedYear);setShowAverage(p.settings.showAverage);setShowLabels(p.settings.showLabels);setTab(['report','analysis','performance','benchmark','investment','data','quality','settings','outputs'].includes(p.tab)?p.tab:'analysis');setDuplicateConfirmed({atieh:false,metil:false});setEntered(false);setWorkspaceMessage('پرونده بازیابی شد؛ کنترل داده‌ها را بررسی و وارد سامانه شوید.');
    }catch(e){setWorkspaceMessage(e instanceof Error?e.message:'بازیابی ناموفق بود.');}
  }
  const workspaceTools=<section className="workspace-tools no-print"><button className="outline-button" onClick={saveWorkspace} disabled={!models.atieh&&!models.metil}>ذخیره کامل پرونده</button><button className="outline-button" onClick={()=>restoreRef.current?.click()}>بازیابی پرونده</button><input ref={restoreRef} hidden type="file" accept=".json" onChange={e=>{const f=e.target.files?.[0];if(f)void restoreWorkspace(f);e.target.value='';}}/><span role="status">{workspaceMessage}</span></section>;

  const reportFilter = <label className="period-kind-filter"><span>نوع گزارش</span><select aria-label="نوع گزارش" value={reportType} onChange={event => setReportType(event.target.value as ReportKind)}><option value="annual">سالانه</option><option value="half-year">شش‌ماهه</option></select></label>;

  const matrix = useMemo(
    () => (model ? buildAxisMatrix(model, settings) : new Map<string, Map<number, AxisBundle>>()),
    [model, settings],
  );
  const performanceMatrix = useMemo(
    () => (model ? buildPerformanceMatrix(model, matrix, settings) : new Map()),
    [model, matrix, settings],
  );

  function setDefaultContext(target: HoldingSelection, parsed: FinancialModel) {
    const preferredName = target === "metil" ? "فولاد متیل" : "آتیه فولاد نقش جهان";
    const preferred = parsed.companies.includes(preferredName)
      ? preferredName
      : parsed.companies[0] ?? "";
    setSelectedCompany(preferred);
    setSelectedYear(selectReportModel(parsed, 'annual').years.at(-1) ?? 0);
    setNatureFilter("همه");
  }

  function switchHolding(nextHolding: HoldingSelection) {
    const nextModel = models[nextHolding];
    if (!nextModel || nextHolding === holding) return;
    setHolding(nextHolding);
    setDefaultContext(nextHolding, nextModel);
    setMobileMenu(false);
    setError("");
  }

  async function handleFile(target: HoldingSelection, file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setFileErrors((current) => ({
        ...current,
        [target]: "فرمت فایل پشتیبانی نمی‌شود. فایل XLSX، XLS یا CSV انتخاب کنید.",
      }));
      return;
    }
    setBusy((current) => ({ ...current, [target]: true }));
    setFileErrors((current) => ({ ...current, [target]: "" }));
    setDuplicateConfirmed((current) => ({ ...current, [target]: false }));
    try {
      const parsed = await parseExcelFile(file);
      if(parsed.missingColumns.length||!parsed.validRecords.length)throw Error('ساختار یا داده مالی معتبر نیست؛ فایل قبلی حفظ شد.');
      setModels((current) => ({ ...current, [target]: parsed }));
      if (target === holding) setDefaultContext(target, parsed);
    } catch (reason) {
      setFileErrors((current) => ({
        ...current,
        [target]: reason instanceof Error ? reason.message : "فایل قابل پردازش نبود.",
      }));
    } finally {
      setBusy((current) => ({ ...current, [target]: false }));
    }
  }

  async function handleMarketFile(file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setMarketError("فرمت فایل پشتیبانی نمی‌شود. فایل XLSX، XLS یا CSV انتخاب کنید.");
      return;
    }
    setMarketBusy(true);
    setMarketError("");
    try {
      setMarketModel(await parseMarketFile(file));
    } catch (reason) {
      setMarketError(reason instanceof Error ? reason.message : "فایل ارزیابی بازار قابل پردازش نبود.");
    } finally {
      setMarketBusy(false);
    }
  }

  async function handleBenchmarkFile(file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setBenchmarkError("فرمت فایل پشتیبانی نمی‌شود. فایل XLSX، XLS یا CSV انتخاب کنید.");
      return;
    }
    setBenchmarkBusy(true);
    setBenchmarkError("");
    try {
      setBenchmarkModel(await parseBenchmarkWorkbook(file));
    } catch (reason) {
      setBenchmarkError(reason instanceof Error ? reason.message : "فایل پایش تطبیقی قابل پردازش نبود.");
    } finally {
      setBenchmarkBusy(false);
    }
  }

  async function handleProductFile(file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setProductError("فرمت فایل پشتیبانی نمی‌شود. فایل XLSX، XLS یا CSV انتخاب کنید.");
      return;
    }
    setProductBusy(true);
    setProductError("");
    try {
      setProductModel(await parseProductFile(file));
    } catch (reason) {
      setProductError(reason instanceof Error ? reason.message : "فایل تولید و بهره‌برداری قابل پردازش نبود.");
    } finally {
      setProductBusy(false);
    }
  }

  async function handleProfitFile(file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setProfitError("فرمت فایل پشتیبانی نمی‌شود. فایل XLSX، XLS یا CSV انتخاب کنید.");
      return;
    }
    setProfitBusy(true);
    setProfitError("");
    try {
      const data = await file.arrayBuffer();
      setProfitModel(parseProfitWorkbook(data, file.name));
    } catch (reason) {
      setProfitError(reason instanceof Error ? reason.message : "فایل سود و بودجه قابل پردازش نبود.");
    } finally {
      setProfitBusy(false);
    }
  }

  async function handleAssetFile(file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setAssetError("فرمت فایل پشتیبانی نمی‌شود. فایل XLSX، XLS یا CSV انتخاب کنید.");
      return;
    }
    setAssetBusy(true);
    setAssetError("");
    try {
      const data = await file.arrayBuffer();
      setAssetModel(parseAssetWorkbook(data, file.name));
    } catch (reason) {
      setAssetError(reason instanceof Error ? reason.message : "فایل دارایی‌های تجمیع‌شده قابل پردازش نبود.");
    } finally {
      setAssetBusy(false);
    }
  }

  async function handleMetilActivityFile(file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setMetilActivityError("فرمت فایل پشتیبانی نمی‌شود. فایل XLSX، XLS یا CSV انتخاب کنید.");
      return;
    }
    setMetilActivityBusy(true);
    setMetilActivityError("");
    try {
      const data = await file.arrayBuffer();
      setMetilActivityModel(parseMetilActivityWorkbook(data, file.name));
    } catch (reason) {
      setMetilActivityError(reason instanceof Error ? reason.message : "فایل فعالیت گروه متیل قابل پردازش نبود.");
    } finally {
      setMetilActivityBusy(false);
    }
  }

  async function handleEquipmentFile(file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setEquipmentError("فرمت فایل پشتیبانی نمی‌شود. فایل XLSX، XLS یا CSV انتخاب کنید.");
      return;
    }
    setEquipmentBusy(true);
    setEquipmentError("");
    try {
      const data = await file.arrayBuffer();
      setEquipmentModel(parseEquipmentWorkbook(data, file.name));
    } catch (reason) {
      setEquipmentError(reason instanceof Error ? reason.message : "فایل تجهیزات گروه متیل قابل پردازش نبود.");
    } finally {
      setEquipmentBusy(false);
    }
  }

  function saveSettings(next: ModelSettings) {
    const normalized = { ...next, showAverage, showLabels };
    setSettings(normalized);
    localStorage.setItem("ips-financial-model-settings-v4", JSON.stringify(normalized));
    setTab("performance");
  }

  async function exportReportImage() {
    if (!reportRef.current || !selectedCompany) return;
    setExportingImage(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        pixelRatio: 1.5,
        backgroundColor: "#f4f7fb",
        filter: (node) =>
          !(node instanceof HTMLElement && node.classList.contains("no-print")),
      });
      const anchor = document.createElement("a");
      anchor.download = `${safeFileName(selectedCompany)}-${selectedYear}.png`;
      anchor.href = dataUrl;
      anchor.click();
    } catch {
      setError("تهیه تصویر کامل صفحه ممکن نشد؛ می‌توانید از خروجی چاپ/PDF استفاده کنید.");
    } finally {
      setExportingImage(false);
    }
  }

  if(reportPortal){
    const raw=models[holding];
    const valid=Boolean(raw&&!raw.missingColumns.length&&(raw.duplicateCount===0||duplicateConfirmed[holding]));
    const benchmarkReady=holding==='atieh'&&Boolean(benchmarkModel?.atiehCompanies.length);
    const financial=valid?raw!:emptyReportModel;
    const company=financial.companies.includes(selectedCompany)?selectedCompany:financial.companies[0]??benchmarkModel?.atiehCompanies[0]?.name??'';
    return <ReportWorkspace onBack={closeReport} holding={holding} onHolding={setHolding} available={{atieh:Boolean(models.atieh||benchmarkModel),metil:Boolean(models.metil)}} upload={<BatchImport onApply={applyBatch} occupied={occupied}/>} tools={workspaceTools}>
      {raw&&raw.duplicateCount>0&&!duplicateConfirmed[holding]&&<label className="report-data-confirm"><input type="checkbox" checked={false} onChange={e=>setDuplicateConfirmed(x=>({...x,[holding]:e.target.checked}))}/>فایل مالی ردیف تکراری دارد؛ استفاده از داده‌های پردازش‌شده را پس از بازبینی تأیید می‌کنم.</label>}
      {valid||benchmarkReady?<IntelligentReport key={holding+'-'+(valid?'financial':'benchmark')} initialCompany={company} inputs={{financial,settings,holding,benchmark:benchmarkModel,market:marketModel,production:productModel,profit:profitModel,assets:assetModel,activity:metilActivityModel,equipment:equipmentModel}}/>:<ReportEmpty message={raw?.missingColumns.length?'فایل مالی انتخاب‌شده ستون‌های لازم را ندارد. فایل اصلاح‌شده را بارگذاری کنید یا از فایل معتبر پایش تطبیقی استفاده کنید.':undefined}/>}
    </ReportWorkspace>;
  }

  if (!entered || !model) {
    return (
      <><ReportEntry onOpen={openReport}/><div className="import-workspace"><BatchImport onApply={applyBatch} occupied={occupied}/>{workspaceTools}</div>
      <UploadScreen
        models={models}
        marketModel={marketModel}
        benchmarkModel={benchmarkModel}
        productModel={productModel}
        profitModel={profitModel}
        assetModel={assetModel}
        metilActivityModel={metilActivityModel}
        equipmentModel={equipmentModel}
        marketBusy={marketBusy}
        marketError={marketError}
        benchmarkBusy={benchmarkBusy}
        benchmarkError={benchmarkError}
        productBusy={productBusy}
        productError={productError}
        profitBusy={profitBusy}
        profitError={profitError}
        assetBusy={assetBusy}
        assetError={assetError}
        metilActivityBusy={metilActivityBusy}
        metilActivityError={metilActivityError}
        equipmentBusy={equipmentBusy}
        equipmentError={equipmentError}
        busy={busy}
        errors={fileErrors}
        duplicateConfirmed={duplicateConfirmed}
        onDuplicateConfirmed={(target, value) =>
          setDuplicateConfirmed((current) => ({ ...current, [target]: value }))
        }
        onFile={handleFile}
        onMarketFile={handleMarketFile}
        onBenchmarkFile={handleBenchmarkFile}
        onProductFile={handleProductFile}
        onProfitFile={handleProfitFile}
        onAssetFile={handleAssetFile}
        onMetilActivityFile={handleMetilActivityFile}
        onEquipmentFile={handleEquipmentFile}
        onOpenModule={(module) => {
          const initialModel = models.atieh;
          if (!initialModel) return;
          setHolding("atieh");
          setDefaultContext("atieh", initialModel);
          if (module === "data") setDataEntryView("profile");
          setTab(module);
          setEntered(true);
          setError("");
        }}
        onClear={(target) => {
          setModels((current) => ({ ...current, [target]: null }));
          setFileErrors((current) => ({ ...current, [target]: "" }));
          setDuplicateConfirmed((current) => ({ ...current, [target]: false }));
        }}
        onClearMarket={() => {
          setMarketModel(null);
          setMarketError("");
        }}
        onClearBenchmark={() => {
          setBenchmarkModel(null);
          setBenchmarkError("");
        }}
        onClearProduct={() => {
          setProductModel(null);
          setProductError("");
        }}
        onClearProfit={() => {
          setProfitModel(null);
          setProfitError("");
        }}
        onClearAsset={() => {
          setAssetModel(null);
          setAssetError("");
        }}
        onClearMetilActivity={() => {
          setMetilActivityModel(null);
          setMetilActivityError("");
        }}
        onClearEquipment={() => {
          setEquipmentModel(null);
          setEquipmentError("");
        }}
      /></>
    );
  }

  const navItems: { key: AppTab; label: string; icon: React.ReactNode }[] = [
    { key: "report", label: "گزارش هوشمند", icon: <Sparkles size={18} /> },
    { key: "analysis", label: "دیدبان مالی", icon: <BarChart3 size={18} /> },
    { key: "performance", label: "رتبه‌نمای عملکرد", icon: <CircleGauge size={18} /> },
    ...(benchmarkModel ? [{ key: "benchmark" as const, label: "پایش تطبیقی", icon: <TrendingUp size={18} /> }] : []),
    { key: "investment" as const, label: "تحلیل سرمایه‌گذاری", icon: <Target size={18} /> },
    { key: "data", label: "مرکز داده مالی", icon: <Database size={18} /> },
    { key: "quality", label: "کیفیت داده", icon: <ClipboardCheck size={18} /> },
    { key: "settings", label: "تنظیمات مدل", icon: <Settings2 size={18} /> },
    { key: "outputs", label: "خروجی‌ها", icon: <Download size={18} /> },
  ];
  const primaryNav = navItems.filter((item) => ["report", "analysis", "performance", "benchmark", "investment", "data"].includes(item.key));
  const utilityNav = navItems.filter((item) => !["report", "analysis", "performance", "benchmark", "investment", "data"].includes(item.key));
  const activeNav = navItems.find((item) => item.key === tab) ?? navItems[0];

  return (
    <main className={`app-shell ${headerCollapsed ? "header-is-collapsed" : ""}`} dir="rtl">
      <header className={`app-header no-print ${headerCollapsed ? "collapsed" : ""}`}>
        <div className="header-brand">
          <button
            type="button"
            className="icon-button mobile-menu-button"
            onClick={() => setMobileMenu((current) => !current)}
            aria-label="منوی اصلی"
          >
            <Menu size={20} />
          </button>
          <span className="brand-mark">
            <BarChart3 size={21} />
          </span>
          <div className="header-brand-copy">
            <strong>سامانه تحلیل مالی و راهبری سرمایه آتیه</strong>
            <span>نسخه ۵۷ · تحلیل مالی و راهبری سرمایه</span>
          </div>
        </div>
          <button type="button" className="collapsed-module-label" onClick={() => setHeaderCollapsed(false)} aria-label="باز کردن نوار پیمایش">{activeNav.icon}<span><small>بخش فعال</small><strong>{activeNav.label}</strong></span></button>
          <nav className={mobileMenu ? "open" : ""}>
          <div className="primary-module-tabs">{primaryNav.map((item) => (
            <button
              key={item.key}
              type="button"
              className={tab === item.key ? "active" : ""}
              onClick={() => {
                if(item.key==='report')openReport();else setTab(item.key);
                setMobileMenu(false);
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}</div>
          <div className="utility-nav">{utilityNav.map((item) => (
            <button key={item.key} type="button" className={tab === item.key ? "active" : ""} onClick={() => { if (item.key === "data" && tab !== "data") setDataEntryView("profile"); setTab(item.key); setMobileMenu(false); }}>{item.icon}{item.label}</button>
          ))}</div>
          </nav>
        <div className="header-actions">
          <div className="file-status">
            <FileSpreadsheet size={17} />
            <div>
              <strong>{model.fileName}</strong>
              <span>بارگذاری: {formatDate(model.importedAt)}</span>
            </div>
          </div>
          <div className="utility-actions">
            <button type="button" className="icon-button" onClick={() => { setEntered(false); setMobileMenu(false); }} aria-label="بازگشت به صفحه بارگذاری" title="بازگشت به صفحه بارگذاری"><Home size={17} /></button>
          </div>
          <FileDrop onFile={(file) => handleFile(holding, file)} busy={busy[holding]} compact />
          <div className="export-menu">
            <button type="button" className="primary-button">
              <Download size={17} />
              خروجی گزارش
              <ChevronDown size={14} />
            </button>
            <div className="export-popover">
              <button type="button" onClick={() => window.print()}>
                <Printer size={16} /> چاپ / ذخیره PDF
              </button>
              <button type="button" onClick={() => exportAxisWorkbook(model, matrix, performanceMatrix)}>
                <FileSpreadsheet size={16} /> Excel امتیاز و رتبه‌بندی
              </button>
              {tab === "analysis" && <button type="button" onClick={exportReportImage} disabled={exportingImage}>{exportingImage ? <LoaderCircle className="spin" size={16} /> : <ImageDown size={16} />}تصویر دیدبان مالی</button>}
            </div>
          </div>
          <button type="button" className="report-header-shortcut" onClick={openReport}><Sparkles size={17}/>گزارش هوشمند</button>
          <button type="button" className="header-collapse-button" onClick={() => { setHeaderCollapsed((current) => !current); setMobileMenu(false); }} aria-label={headerCollapsed ? "نمایش کامل نوار بالا" : "جمع کردن نوار بالا"} title={headerCollapsed ? "نمایش نوار کامل" : "جمع کردن نوار بالا"}><PanelTop size={17} /><span>{headerCollapsed ? "بازکردن" : "جمع‌کردن"}</span><ChevronDown size={14} /></button>
        </div>
      </header>
      <div className="shared-context-bar no-print">
        <div className="holding-dashboard-tabs" role="tablist" aria-label="انتخاب هلدینگ برای نمایش">
          {HOLDING_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={holding === key}
              className={holding === key ? "active" : ""}
              onClick={() => switchHolding(key)}
            >
              <Building2 size={15} />
              {HOLDING_SHORT_LABELS[key]}
              <small>{models[key]?.summary.companies.toLocaleString("fa-IR") ?? "—"} شرکت</small>
            </button>
          ))}
        </div>
        <span className="active-holding-context"><Layers3 size={15} />{HOLDING_LABELS[holding]}</span>
        {tab !== 'report' && <><span><Building2 size={15} />{selectedCompany}</span>
        <span><PanelTop size={15} />سال {selectedYear.toLocaleString("fa-IR", { useGrouping: false })}</span>
        <span><Layers3 size={15} />{model.natureByCompany.get(selectedCompany) ?? "ماهیت نامشخص"}</span></>}
        <span><ShieldCheck size={15} />داده محلی</span>
        <button type="button" onClick={() => { setEntered(false); setMobileMenu(false); }}><Home size={15} />صفحه بارگذاری</button>
      </div>

      <div className="app-content">
        {workspaceTools}
        {error && (
          <div className="floating-error">
            <AlertTriangle size={17} />
            {error}
            <button type="button" onClick={() => setError("")}>
              <X size={15} />
            </button>
          </div>
        )}
        {tab === "analysis" && (
          <CompanyDashboard
            reportFilter={reportFilter}
            model={model}
            matrix={matrix}
            settings={settings}
            selectedCompany={selectedCompany}
            setSelectedCompany={setSelectedCompany}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
            natureFilter={natureFilter}
            setNatureFilter={setNatureFilter}
            displayMode={displayMode}
            setDisplayMode={setDisplayMode}
            bubbleMetric={bubbleMetric}
            setBubbleMetric={setBubbleMetric}
            showAverage={showAverage}
            setShowAverage={setShowAverage}
            showLabels={showLabels}
            setShowLabels={setShowLabels}
            highlightSelected={highlightSelected}
            setHighlightSelected={setHighlightSelected}
            reportRef={reportRef}
          />
        )}
        {tab === "performance" && (
          <DynamicRankingPage
            reportFilter={reportFilter}
            key={`${holding}-${model.fileName}`}
            model={model}
            marketModel={marketModel}
            enableStrategicMatrix={holding === "atieh" && reportType === "annual"}
            selectedCompany={selectedCompany}
            setSelectedCompany={setSelectedCompany}
            selectedYear={selectedYear}
            setSelectedYear={setSelectedYear}
          />
        )}
        {tab === "report" && <IntelligentReport key={holding} initialCompany={selectedCompany} inputs={{financial:sourceModel ?? model,settings,holding,benchmark:benchmarkModel,market:marketModel,production:productModel,profit:profitModel,assets:assetModel,activity:metilActivityModel,equipment:equipmentModel}}/>}
        {tab === "benchmark" && benchmarkModel && <PerformanceBenchmark model={benchmarkModel} />}
        {tab === "investment" && model && <InvestmentAnalysis
          key={`investment-${holding}-${model.importedAt}`}
          financialModel={model}
          allFinancialModel={sourceModel ?? model}
          contextCompany={selectedCompany} contextYear={selectedYear} onContextChange={(company,year)=>{if(model.companies.includes(company))setSelectedCompany(company);if(year!==undefined&&model.years.includes(year))setSelectedYear(year);}}
          productionModel={productModel}
          profitModel={profitModel}
          holding={holding}
          onHoldingChange={switchHolding}
          availableHoldings={{ atieh: Boolean(models.atieh), metil: Boolean(models.metil) }}
          assetModel={assetModel}
          activityModel={metilActivityModel}
          equipmentModel={equipmentModel}
        />}
        {tab === "data" && <DataCenterPage key={`${holding}-${model.fileName}-${reportType}`} model={model} view={dataEntryView} setView={setDataEntryView} reportFilter={reportFilter} selectedCompany={model.companies.includes(selectedCompany) ? selectedCompany : model.companies[0] ?? ""} setSelectedCompany={setSelectedCompany} selectedYear={model.years.includes(selectedYear) ? selectedYear : model.years.at(-1) ?? 0} setSelectedYear={setSelectedYear} />}
        {tab === "quality" && <QualityPage model={model} />}
        {tab === "settings" && <SettingsPage settings={settings} onSave={saveSettings} />}
        {tab === "outputs" && (
          <OutputsPage
            model={model}
            matrix={matrix}
            performanceMatrix={performanceMatrix}
            goToBuilder={() => {
              setDataEntryView("export");
              setTab("data");
            }}
          />
        )}
      </div>
      <footer className="app-footer no-print">
        <span>
          <ShieldCheck size={15} /> داده فایل در مرورگر پردازش می‌شود و فایل اصلی تغییر نمی‌کند.
        </span>
        <span>
          {model.summary.companies.toLocaleString("fa-IR")} شرکت ·{" "}
          {model.summary.years.toLocaleString("fa-IR")} سال ·{" "}
          {model.summary.totalRecords.toLocaleString("fa-IR")} رکورد
        </span>
      </footer>
    </main>
  );
}
