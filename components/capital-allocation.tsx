"use client";

import {
  Activity,
  ArrowLeft,
  BriefcaseBusiness,
  ChevronDown,
  CircleHelp,
  FileText,
  Landmark,
  Plus,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  WalletCards,
} from "lucide-react";
import {summarizeCapital} from "@/lib/capital-presentation.mjs";
import CapitalExecutiveSummary from "@/components/capital-executive-summary";
import CapitalDecisionDesk from "@/components/capital-decision-desk";
import { useMemo, useState } from "react";
import {
  CAPITAL_YEARS,
  ENTRY_METHODS,
  FUNDING_SOURCES,
  NEED_TYPES,
  allocateCapital,
  V13_SAMPLE_FINANCIAL_INPUT,
  DEFAULT_FINANCIAL_INPUT,
  SOURCE_WATERFALL,
  type FundingSource,
} from "@/lib/capital-allocation.mjs";
import {evaluationSignature,freezeAllocationEvaluation} from "@/lib/allocation-evaluations.mjs";
import {workspaceId} from "@/lib/scenario-workspace.mjs";
import type { EntryOpportunity } from "@/components/entry-planning";

type FinancialInput = Record<string, number>;
type PortfolioAction = {
  action: string;
  year: number;
  potentialProceeds: number;
  reliableProceeds: number;
  status: string;
  note: string;
};
type InvestmentCase = {
  id: string;
  opportunityKey: string;
  name: string;
  parentName: string;
  year: number;
  entryPriority: number; entryRank?:number;
  macro: number | null;
  sourceKind?: "scenario" | "independent";
  runKey?: string;
  detail: number | null;
  management: number | null;
  method: string;
  totalNeed: number;
  annualNeed: number;
  needType: string;
  stageable: boolean;
  minimumExecution: number;
  maximumRate: number | null;
  dedicatedMode?: "reserved"|"preferred";
  continuationOf?: string;
  entryYear?: number;
  financialReviewRequired?: boolean;
  dedicatedSource: string;
  dedicatedAmount: number;
  economicNote: string;
  order?: number;
  overrideRank?: number | null;
  overrideReason?: string;
  overrideBy?: string;
  overrideAt?: string;
};
type PortfolioItem = {
  name: string;
  portfolioShare: number | null;
  horizon: string;
  attributableValue?: number | null;
};
type PlanOpportunity = EntryOpportunity & { share: number };
type AllocationState = {
  evaluations?: import("@/lib/allocation-evaluations.mjs").AllocationEvaluation[];
  sourcePolicies?:Record<string,import("@/lib/capital-allocation.mjs").SourcePolicy>;
  financialByYear: Record<number, FinancialInput>;
  portfolioActions: Record<string, PortfolioAction>;
  cases: Record<string, InvestmentCase>;
  financialStatusByYear?: Record<number,"sample"|"draft"|"confirmed">;
};

const fa = (value: number | null | undefined, digits = 1) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("fa-IR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
const percent = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : `${fa(value * 100, 1)}٪`;
const financialFields = [
  ["cashStart", "نقد ابتدای سال"],
  ["reliableInflows", "ورود نقد قابل اتکا"],
  ["requiredPayments", "هزینه‌ها و پرداخت‌های قطعی"],
  ["debtRepayment", "بازپرداخت بدهی"],
  ["dividends", "سود تقسیمی"],
  ["priorCommitments", "تعهدات سرمایه‌گذاری قبلی"],
  ["minimumCashReserve", "حداقل ذخیره نقد"],
] as const;
const fundingFields = [
  ["shortDebtCapacity", "اعتبار کوتاه‌مدت", false],
  ["shortDebtRate", "نرخ مؤثر کوتاه‌مدت", true],
  ["longDebtCapacity", "بدهی میان/بلندمدت", false],
  ["longDebtRate", "نرخ مؤثر میان/بلندمدت", true],
  ["totalNewDebtCeiling", "سقف کل بدهی جدید", false],
  ["partnerCapacity", "ظرفیت آورده سهامداران و شرکا", false],
] as const;

export default function CapitalAllocation({
  activeYear,
  onYear,
  plans,
  portfolio,
  state,
  onState,
  standalone = false,
  runKey = "legacy",
  blocked = false,
  blockedYears = [],
  contextName = "برنامه جاری",
}: {
  activeYear: number;
  onYear: (year: number) => void;
  plans: PlanOpportunity[];
  portfolio: PortfolioItem[];
  state: AllocationState;
  onState: (state: AllocationState) => void;
  standalone?: boolean;
  runKey?: string;
  blocked?: boolean;
  blockedYears?: number[];
  contextName?: string;
}) {
  const [view, setView] = useState<
    "dashboard" | "capacity" | "portfolio" | "cases" | "trace" | "executive" | "policy"
  >("dashboard");
  const [advanced,setAdvanced]=useState(false);
  const [manualName,setManualName]=useState("");
  const [manualReason,setManualReason]=useState("");
  const [manualRank,setManualRank]=useState(1);
  const [copyYear,setCopyYear]=useState(1407);
  const [actionNotice,setActionNotice]=useState("");
  const [approvalActor,setApprovalActor]=useState("");
  const [approvalReason,setApprovalReason]=useState("");
  const [pendingFinance,setPendingFinance]=useState<"sample"|"draft"|null>(null);
  const [selectedCase, setSelectedCase] = useState("");
  const financial = useMemo(
    () => state.financialByYear[activeYear] ?? {},
    [state.financialByYear, activeYear],
  );
  const actions = useMemo(
    () =>
      portfolio
        .map((_, index) => state.portfolioActions[String(index)])
        .filter(Boolean),
    [portfolio, state.portfolioActions],
  );
  const cases = useMemo(
    () => Object.values(state.cases).filter((item) => item.year === activeYear),
    [state.cases, activeYear],
  );
  const sourcePolicy=useMemo(()=>({liquidityMode:"block" as const,...state.sourcePolicies?.[runKey]}),[state.sourcePolicies,runKey]);
  const setSourcePolicy=(policy:import("@/lib/capital-allocation.mjs").SourcePolicy)=>onState({...state,sourcePolicies:{...state.sourcePolicies,[runKey]:{...policy,updatedAt:new Date().toISOString()}}});
  const output = useMemo(
    () =>
      allocateCapital({
        year: activeYear,
        financialInput: financial,
        portfolioActions: actions,
        projects: blocked ? [] : cases,
        sourcePolicy,
      }),
    [activeYear, financial, actions, cases, blocked,sourcePolicy],
  );

  const baselineOutput=useMemo(()=>allocateCapital({year:activeYear,financialInput:financial,portfolioActions:actions,projects:blocked?[]:cases,sourcePolicy:{liquidityMode:sourcePolicy.liquidityMode,liquidityReason:sourcePolicy.liquidityReason,liquiditySources:sourcePolicy.liquiditySources}}),[activeYear,financial,actions,cases,blocked,sourcePolicy]);
  const annualOutputs = useMemo(
    () =>
      CAPITAL_YEARS.map((year) =>
        allocateCapital({
          year,
          financialInput: state.financialByYear[year] ?? {},
          portfolioActions: actions,
          projects: blockedYears.includes(year) ? [] : Object.values(state.cases),
          sourcePolicy,
        }),
      ),
    [actions, state.cases, state.financialByYear, blockedYears,sourcePolicy],
  );
  const fundingRate = output.totalNeed
    ? output.totalExecuted / output.totalNeed
    : 0;
  const decisionCounts = output.results.reduce(
    (counts, item) => {
      if (item.decision === "تأمین کامل") counts.full += 1;
      else if (item.decision === "تأمین جزئی") counts.partial += 1;
      else if (item.decision === "تعویق") counts.deferred += 1;
      else counts.incomplete += 1;
      return counts;
    },
    { full: 0, partial: 0, deferred: 0, incomplete: 0 },
  );
  const financeStatus=state.financialStatusByYear?.[activeYear]??"draft";
  const executiveSignal = blocked ? "ابتدا تعارض بین خروجی‌های سناریوها را تعیین تکلیف کنید." : financeStatus !== "confirmed" ? "این خروجی پیش‌نمایش است؛ داده‌های مالی این سال هنوز به‌عنوان ورودی واقعی تأیید نشده‌اند." : cases.some(c=>c.financialReviewRequired) ? "ورودی مالی پرونده‌های منتقل‌شده از نسخه جدید یا مرحله بعد نیازمند بازبینی است؛ نتیجه فعلاً پیش‌نمایش است." : output.financial.reserveShortfall>0
    ? `کسری نقد و ذخیره نقد ${fa(output.financial.reserveShortfall,0)} میلیارد تومان است؛ ${output.liquidityRestricted?"تخصیص فقط با استثنای مصوبِ منابع محدود به طرح انجام می‌شود و به معنی سلامت نقدینگی گروه نیست.":"پیش از تصویب طرح‌های جدید، پوشش این کسری ضروری است."}` : output.reservationConflict ? "تعهدات رزروشده با ظرفیت منابع سازگار نیست؛ تخصیص متوقف است." : !output.results.length
    ? "هنوز پرونده‌ای برای تصمیم سرمایه‌گذاری این سال ثبت نشده است. ابتدا فرصت‌های منتخب مسیر حرکت را به پرونده اجرایی تبدیل کنید."
    : decisionCounts.incomplete > 0
      ? `${decisionCounts.incomplete.toLocaleString("fa-IR")} پرونده هنوز ورودی معتبر ندارد؛ پیش از نتیجه‌گیری درباره کفایت منابع، نیاز و شروط اجرای این پرونده‌ها را تکمیل کنید.`
    : output.totalDeferred <= 0
      ? `تمام نیاز سرمایه سال ${activeYear.toLocaleString("fa-IR", { useGrouping: false })} با منابع قابل اتکا پوشش داده شده و سبد منتخب از نظر تأمین منابع تأمین شده است.`
      : fundingRate >= 0.5
        ? `بخش عمده نیاز سرمایه سال ${activeYear.toLocaleString("fa-IR", { useGrouping: false })} تأمین شده است؛ تصمیم مدیریتی باید بر تأمین شکاف ${fa(output.totalDeferred, 0)} میلیارد تومانی یا زمان‌بندی مجدد پرونده‌ها متمرکز شود.`
        : `ظرفیت قابل اتکا پاسخ‌گوی بخش محدودی از نیاز سال است؛ اولویت‌بندی پرونده‌ها و بازطراحی ترکیب منابع پیش از تصویب ضروری است.`;
  const selectedResult =
    output.results.find((item) => item.id === selectedCase) ??
    output.results[0] ??
    null;
  const selectedCaseRecord = state.cases[selectedCase] ?? cases[0] ?? null;
  const caseIds = new Set(cases.map((item) => item.opportunityKey));

  const patchFinancial = (key: string, value: number) =>
    onState({
      ...state,
      financialStatusByYear:{...state.financialStatusByYear,[activeYear]:"draft"},
      financialByYear: {
        ...state.financialByYear,
        [activeYear]: { ...financial, [key]: Math.max(0, value || 0) },
      },
    });
  const patchAction = (index: number, patch: Partial<PortfolioAction>) => {
    const key = String(index);
    const current = state.portfolioActions[key] ?? {
      action: "حفظ",
      year: activeYear,
      potentialProceeds: 0,
      reliableProceeds: 0,
      status: "برنامه‌ریزی‌شده",
      note: "",
    };
    onState({
      ...state,
      portfolioActions: {
        ...state.portfolioActions,
        [key]: { ...current, ...patch },
      },
    });
  };
  const createCase = (opportunity: PlanOpportunity) => {
    const id = `${runKey}:${activeYear}:${opportunity.key}`;
    const item: InvestmentCase = {
      id,
      opportunityKey: opportunity.key,
      sourceKind:"scenario",
      runKey,
      name: opportunity.name,
      parentName: opportunity.parentName,
      year: activeYear,
      entryPriority: opportunity.entryPriority,
      macro: opportunity.macro,
      detail: opportunity.detail,
      management: opportunity.management,
      method: "مشارکت",
      totalNeed: 0,
      annualNeed: 0,
      needType: "تملک / سرمایه‌گذاری راهبردی",
      stageable: true,
      minimumExecution: 0.5,
      maximumRate: 0.35,
      dedicatedSource: "",
      dedicatedAmount: 0,
      economicNote: "",
    };
    onState({ ...state, cases: { ...state.cases, [id]: item } });
    setSelectedCase(id);
    setView("cases");
  };
  const patchCase = (id: string, patch: Partial<InvestmentCase>) => {
    const current = state.cases[id];
    if (!current) return;
    onState({
      ...state,
      cases: { ...state.cases, [id]: { ...current, ...patch } },
    });
  };
  const removeCase = (id: string) => {
    if(state.cases[id]?.sourceKind === "scenario" && !state.cases[id]?.continuationOf) {
      patchCase(id,{annualNeed:0,totalNeed:0,dedicatedAmount:0,economicNote:"",financialReviewRequired:true});
      setActionNotice("ورودی مالی پرونده پاک شد؛ انتخاب مصوب سناریو حفظ می‌شود. برای حذف طرح، برنامه ورود را اصلاح و نسخه جدید منتقل کنید.");
      return;
    }
    const next = { ...state.cases };
    delete next[id];
    onState({ ...state, cases: next });
    setSelectedCase("");
  };

  const createIndependent = () => {
    if(!manualName.trim() || !manualReason.trim() || !Number.isInteger(manualRank) || manualRank<1){setActionNotice("نام، دلیل ورود پروژه مستقل و رتبه مصوب مثبت را تکمیل کنید.");return;}
    const duplicate=cases.find(c=>c.sourceKind==="independent"&&c.name===manualName.trim());
    if(duplicate){setSelectedCase(duplicate.id);setActionNotice("این پروژه مستقل در سال جاری قبلاً ثبت شده است؛ پرونده موجود باز شد.");return;}
    const key=`independent:${workspaceId()}`;
    const id=`${activeYear}:${key}`;
    const item:InvestmentCase={id,opportunityKey:key,sourceKind:"independent",name:manualName.trim(),parentName:"پروژه مستقل از مدل فرصت‌ها",year:activeYear,entryPriority:0,macro:null,detail:null,management:null,method:"سایر",totalNeed:0,annualNeed:0,needType:"توسعه / CAPEX رشد",stageable:true,minimumExecution:0.5,maximumRate:null,dedicatedSource:"",dedicatedAmount:0,economicNote:manualReason.trim(),overrideRank:manualRank,overrideReason:manualReason.trim(),overrideBy:"کاربر جاری",overrideAt:new Date().toISOString()};
    onState({...state,cases:{...state.cases,[id]:item}});setSelectedCase(id);setManualName("");setManualReason("");setView("cases");setActionNotice("پروژه مستقل ثبت شد؛ نیاز و شروط اجرای آن را تکمیل کنید. امتیاز علمی برای این پروژه ساخته نشده است.");
  };
  const effectiveCopyYear=copyYear===activeYear ? CAPITAL_YEARS.find(y=>y!==activeYear)! : copyYear;
  const copyCase = () => {
    if(!selectedCaseRecord || effectiveCopyYear===activeYear)return;
    const current=selectedCaseRecord;const id=`${current.runKey??"independent"}:${effectiveCopyYear}:${current.opportunityKey}`;
    if(Object.values(state.cases).some(c=>c.year===effectiveCopyYear&&c.opportunityKey===current.opportunityKey)){setActionNotice("این پروژه در سال مقصد پرونده دارد؛ آن را از انتخاب سال باز کنید.");return;}
    const copied={...current,id,year:effectiveCopyYear,entryYear:current.entryYear??current.year,continuationOf:current.continuationOf??current.id,financialReviewRequired:true,annualNeed:0,dedicatedAmount:0};
    onState({...state,cases:{...state.cases,[id]:copied}});onYear(effectiveCopyYear);setSelectedCase(id);setActionNotice("پرونده سال بعد ایجاد شد؛ نیاز سالانه را جدا وارد کنید تا منابع دوباره شماری نشوند.");
  };
  const setFinanceMode=(kind:"sample"|"draft"|"confirmed")=>onState({...state,financialStatusByYear:{...state.financialStatusByYear,[activeYear]:kind},...(kind === "sample" ? {financialByYear:{...state.financialByYear,[activeYear]:{...V13_SAMPLE_FINANCIAL_INPUT}}} : kind === "draft" ? {financialByYear:{...state.financialByYear,[activeYear]:{...DEFAULT_FINANCIAL_INPUT}}}: {})});

  const evaluationInput={runKey,year:activeYear,contextName,financial,financeStatus,actions,projects:cases,sourcePolicy};
  const currentSignature=evaluationSignature(evaluationInput);
  const evaluations=(state.evaluations??[]).filter(e=>e.input.runKey===runKey&&e.input.year===activeYear);
  const saveEvaluation=(status:"draft"|"approved")=>{
    try {
      const evaluation=freezeAllocationEvaluation(evaluationInput,output,{status,actor:approvalActor,reason:approvalReason,financeStatus,blocked,id:workspaceId(),createdAt:new Date().toISOString()});
      onState({...state,evaluations:[...(state.evaluations??[]),evaluation]});setActionNotice(status==="approved"?"ارزیابی تأییدشده با ورودی‌ها و نتیجه ثابت ثبت شد؛ تغییر بعدی نسخه تازه می‌خواهد.":"پیش‌نویس ارزیابی با ورودی‌ها و نتیجه ثابت ثبت شد.");
    }catch(error){setActionNotice(error instanceof Error?error.message:"ثبت ارزیابی ممکن نشد.");}
  };
  return (
    <div className="capital-workspace">
      <div className="capital-unit-banner">واحد تمام مبالغ: میلیارد تومان · نرخ‌ها: درصد سالانه</div>
      <div className="decision-context capital-context"><div><b>{contextName}</b><span>سال {activeYear.toLocaleString("fa-IR",{useGrouping:false})} · {{capacity:"ظرفیت مالی",cases:"پرونده‌های طرح",policy:"سیاست منابع",executive:"خروجی مدیریتی",trace:"ردیابی",dashboard:"نمای تصمیم",portfolio:"آزادسازی سرمایه"}[view]}</span></div><span className={financeStatus==="confirmed"?"confirmed":"pending"}>{financeStatus==="confirmed"?"ارقام واقعی تأیید شده":financeStatus==="sample"?"داده آموزشی":"ورودی در حال تکمیل"}</span></div>
      <header className="capital-head">
        <div>
          <span>
            {standalone
              ? "مسیر مستقل ۰۴ · تبدیل سیاست به اجرا"
              : "گام چهارم · تصمیم اجرایی"}
          </span>
          <h2>تخصیص راهبردی سرمایه و منابع</h2>
          <p>
            فرصت‌های منتخب را به ظرفیت واقعی سال، تصمیم‌های پرتفوی موجود و آبشار
            منابع مصوب متصل کنید.
          </p>
        </div>
        <label>
          <span>سال تخصیص</span>
          <select
            value={activeYear}
            onChange={(event) => {
              onYear(Number(event.target.value));
              setSelectedCase("");
            }}
          >
            {CAPITAL_YEARS.map((year) => (
              <option key={year} value={year}>
                {year.toLocaleString("fa-IR", { useGrouping: false })}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className="desk-home-actions"><button className={view==="dashboard"?"active":""} onClick={()=>setView("dashboard")}>میز تصمیم و وضعیت طرح‌ها</button><button onClick={()=>setView("executive")}>ثبت و مرور تصمیم مدیریتی</button></div>
      <section className="capital-guided">
        <header><div><span>مراحل تخصیص سال جاری</span></div><button onClick={()=>setAdvanced(!advanced)}>{advanced?"نمای ساده":"ابزارهای کامل"}<SlidersHorizontal/></button></header>
        <div className="capital-guided-steps">{([['capacity','منابع قابل اتکای سال'],['cases','طرح‌ها و سرمایه موردنیاز'],['policy','اولویت طرح‌ها و سیاست تأمین'],['executive','جمع‌بندی تخصیص سرمایه']] as const).map(([key,label],i)=><button key={key} className={view===key?'active':''} onClick={()=>setView(key)}><span>{(i+1).toLocaleString("fa-IR")}</span><b>{label}</b></button>)}</div>
        <p>امتیاز ورود حفظ می‌شود؛ اولویت طرح‌ها، ترتیب منابع و شروط اجرای هر طرح را مدیریت تعیین می‌کند. بازده اقتصادی از تخصیص منابع استنتاج نمی‌شود.</p>
      </section>
      <div className={`finance-status ${financeStatus}`}><ShieldCheck/><span>{financeStatus==="confirmed"?"ورودی مالی واقعی تأیید شده":financeStatus==="sample"?"داده نمونه آموزشی؛ قابل استناد برای تصمیم نهایی نیست":"ورودی مالی در انتظار بررسی و تأیید"}</span>{financeStatus!=="confirmed"&&<button onClick={()=>setView("capacity")}>بررسی منابع قابل اتکای سال</button>}</div>
      {blocked&&<div className="capital-blocked" role="alert">تخصیص تا حل تعارض سناریوها متوقف است؛ پرونده‌ها و منابع قابل ویرایش‌اند.</div>}
      {Object.values(output.reserved).some(v=>v>0)&&<div className="finance-status"><ShieldCheck/><span>{fa(Object.values(output.reserved).reduce((n,v)=>n+v,0),0)} میلیارد تومان تعهد رزروشده هنوز مصرف نشده است؛ در ظرفیت آزاد برای طرح‌های دیگر منظور نمی‌شود.</span></div>}
      {actionNotice&&<div className="movement-notice"><span>{actionNotice}</span><button onClick={()=>setActionNotice("")}>×</button></div>}
      {advanced && <nav className="capital-tabs" aria-label="بخش‌های تخصیص سرمایه">
        {(
          [
            ["dashboard", "نمای تصمیم", Activity],
            ["capacity", "ظرفیت مالی", Landmark],
            ["portfolio", "آزادسازی سرمایه", BriefcaseBusiness],
            ["cases", "پرونده‌های سرمایه‌گذاری", WalletCards],
            ["trace", "ردیابی تخصیص", Route],
            ["executive", "خروجی مدیریتی", FileText],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            className={view === key ? "active" : ""}
            onClick={() => setView(key)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>}

      {view === "capacity" && <section className="finance-verification"><h3>نوع ورودی مالی</h3><p>ارقام نمونه فقط برای آموزش هستند. تعهدات قبلی که از منابع کسر شده‌اند را دوباره به‌عنوان نیاز پرونده همین سال ثبت نکنید.</p><div><button onClick={()=>setPendingFinance("sample")}>بارگذاری داده نمونه</button><button onClick={()=>setPendingFinance("draft")}>شروع با ورودی واقعی خالی</button><button onClick={()=>setFinanceMode("confirmed")}>تأیید ارقام به‌عنوان ورودی واقعی</button></div></section>}
      {pendingFinance&&<div className="capital-blocked" role="alert"><p>{pendingFinance==="sample"?"ارقام سال جاری با داده آموزشی جایگزین می‌شوند.":"ارقام مالی سال جاری پاک می‌شوند."} نسخه‌های ثبت‌شده ارزیابی حفظ می‌شوند.</p><button onClick={()=>{setFinanceMode(pendingFinance);setPendingFinance(null);}}>تأیید جایگزینی ارقام</button><button onClick={()=>setPendingFinance(null)}>انصراف</button></div>}
      {view === "policy" && <section className="capital-policy"><header><h3>اولویت طرح‌ها و سیاست تأمین</h3><p>رتبه کمتر اولویت تخصیص بالاتر دارد. رتبه مصوب نسبت به اولویت ورود مقدم است؛ دلیل تصمیم ثبت می‌شود. تغییر این رتبه هیچ امتیاز علمی را تغییر نمی‌دهد.</p></header><div className="table-scroll"><table><thead><tr><th>پرونده</th><th>اولویت مدل ورود</th><th>رتبه مصوب</th><th>دلیل ترجیح</th><th>حداقل اجرای مرحله‌ای</th><th>سقف نرخ</th></tr></thead><tbody>{cases.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.sourceKind==="independent"?"فاقد امتیاز مدل":fa(c.entryPriority)}</td><td><input aria-label={`رتبه تخصیص ${c.name}`} type="number" min="1" step="1" value={c.overrideRank??""} onChange={e=>patchCase(c.id,{overrideRank:e.target.value?Math.max(1,Math.round(Number(e.target.value))):null,overrideAt:new Date().toISOString(),overrideBy:"کاربر جاری"})} placeholder="طبق مدل ورود"/></td><td><input aria-label={`دلیل رتبه ${c.name}`} value={c.overrideReason??""} onChange={e=>patchCase(c.id,{overrideReason:e.target.value,overrideAt:new Date().toISOString(),overrideBy:"کاربر جاری"})}/></td><td>{percent(c.minimumExecution)}</td><td>{c.maximumRate==null?"بدون سقف":percent(c.maximumRate)}</td></tr>)}</tbody></table></div>{!cases.length&&<p>ابتدا پرونده‌های این سال را ثبت کنید.</p>}<section className="source-order-policy"><header><h3>ترتیب استفاده از منابع</h3><p>برای هر نوع نیاز، ترتیب منابع مجاز را تغییر دهید. محاسبه تخصیص بلافاصله با همین ترتیب انجام می‌شود؛ ظرفیت منابع، سقف بدهی و شروط اجرای طرح حفظ می‌شوند. این سیاست برای همه سال‌های سبد منتخب اعمال می‌شود.</p></header><div className="source-order-toolbar"><button onClick={()=>setSourcePolicy({liquidityMode:sourcePolicy.liquidityMode,liquidityReason:sourcePolicy.liquidityReason,liquiditySources:sourcePolicy.liquiditySources})}>بازگشت به ترتیب مصوب</button><label><input type="checkbox" checked={sourcePolicy?.dedicatedFirst!==false} onChange={e=>setSourcePolicy({...sourcePolicy,dedicatedFirst:e.target.checked})}/> استفاده از منبع اختصاصی پیش از منابع عمومی</label></div><label className="source-policy-reason">دلیل تغییر سیاست<input value={sourcePolicy?.reason??""} onChange={e=>setSourcePolicy({...sourcePolicy,reason:e.target.value})} placeholder="دلیل تصمیم مدیریت را ثبت کنید"/></label><div className="source-order-grid">{Object.entries(SOURCE_WATERFALL).map(([need,baseline])=>{const order=sourcePolicy?.orders?.[need]??baseline;return <article key={need}><h4>{need.replace("CAPEX", "سرمایه‌گذاری")}</h4><ol>{order.map((source,index)=><li key={source}><span>{FUNDING_SOURCES[source].label}</span><div>{[-1,1].map(delta=><button key={delta} disabled={index+delta<0||index+delta>=order.length} aria-label={`${delta<0?"افزایش":"کاهش"} تقدم ${FUNDING_SOURCES[source].label} برای ${need.replace("CAPEX","سرمایه‌گذاری")}`} onClick={()=>{const next=[...order];[next[index],next[index+delta]]=[next[index+delta],next[index]];setSourcePolicy({...sourcePolicy,orders:{...sourcePolicy?.orders,[need]:next}});}}>{delta<0?"↑":"↓"}</button>)}</div></li>)}</ol></article>;})}</div><div className="source-policy-impact"><h4>اثر زنده سیاست بر تأمین طرح‌ها</h4>{output.results.map(item=>{const baseline=baselineOutput.results.find(r=>r.id===item.id);const delta=item.executed-(baseline?.executed??0);return <p key={item.id}><b>{item.name}</b><span>{fa(item.executed,0)} میلیارد تومان · {Math.abs(delta)<0.01?"میزان تأمین بدون تغییر":`${delta>0?"افزایش":"کاهش"} ${fa(Math.abs(delta),0)}`}</span></p>;})}</div><details className="source-policy-comparison"><summary>مقایسه تخصیص با ترتیب مصوب</summary><p>هر دو محاسبه با طرح‌ها، رتبه مدیریتی، نیاز و منابع یکسان اجرا می‌شوند؛ تفاوت فقط ترتیب استفاده از منابع است.</p><div className="table-scroll"><table><thead><tr><th>منبع</th><th>تخصیص با ترتیب مصوب</th><th>تخصیص با سیاست جاری</th></tr></thead><tbody>{Object.entries(FUNDING_SOURCES).map(([key,value])=><tr key={key}><td>{value.label}</td><td>{fa(baselineOutput.used[key as keyof typeof baselineOutput.used],0)}</td><td>{fa(output.used[key as keyof typeof output.used],0)}</td></tr>)}</tbody></table></div><p>تأمین با ترتیب مصوب: {fa(baselineOutput.totalExecuted,0)} · تأمین با ترتیب جاری: {fa(output.totalExecuted,0)} میلیارد تومان</p></details></section><button onClick={()=>setView("cases")}>ویرایش نیاز و شروط پرونده‌ها <ArrowLeft/></button><button onClick={()=>setView("trace")}>مشاهده ردیابی محاسبات <Route/></button></section>}
      {view === "dashboard" && <CapitalDecisionDesk output={output} contextName={contextName} financeConfirmed={financeStatus==="confirmed"} sourcePolicy={sourcePolicy} onOpen={id=>{setSelectedCase(id);setView("cases");}} onSources={()=>setView("capacity")} onPolicy={()=>setView("policy")}/>}

      {output.financial.reserveShortfall>0&&<section className="liquidity-policy" role="alert"><h3>ابتدا وضعیت نقدینگی را روشن کنید</h3><p>کسری پرداخت‌ها: {fa(Math.max(0,-output.financial.cashAfterPayments),0)} · کسری نسبت به حداقل ذخیره: {fa(output.financial.reserveShortfall,0)} میلیارد تومان. ثبت آورده یا بدهی به‌عنوان ظرفیت طرح، خودبه‌خود این کسری را پوشش نمی‌دهد. مبلغ وصول‌شده برای پوشش پرداخت‌های گروه در ورود نقد قابل اتکا ثبت شود و همزمان در ظرفیت طرح دوباره شماری نشود.</p><label>سیاست اجرای طرح در شرایط کسری<select aria-label="سیاست کسری نقد" value={sourcePolicy.liquidityMode} onChange={e=>setSourcePolicy({...sourcePolicy,liquidityMode:e.target.value as "block"|"restricted"})}><option value="block">توقف تخصیص جدید تا پوشش کسری</option><option value="restricted">استثنای مصوب: تأمین محدود به طرح</option></select></label>{sourcePolicy.liquidityMode==="restricted"&&<div className="restricted-source-choice"><p>فقط منابع دارای مجوز اختصاص به طرح را انتخاب کنید؛ سایر منابع در تخصیص استفاده نمی‌شوند.</p>{Object.entries(FUNDING_SOURCES).map(([key,info])=><label key={key}><input type="checkbox" checked={sourcePolicy.liquiditySources?.includes(key as FundingSource)??false} onChange={e=>setSourcePolicy({...sourcePolicy,liquiditySources:e.target.checked?[...(sourcePolicy.liquiditySources??[]),key as FundingSource]:(sourcePolicy.liquiditySources??[]).filter(s=>s!==key)})}/>{info.label}</label>)}<label>دلیل و حدود مجوز<input aria-label="دلیل استثنای کسری نقد" value={sourcePolicy.liquidityReason??""} onChange={e=>setSourcePolicy({...sourcePolicy,liquidityReason:e.target.value})} placeholder="منبعی که فقط برای اجرای طرح مجاز است و مرجع تصویب"/></label></div>}</section>}
      {view === "capacity" && (
        <section className="financial-capacity-form">
          <header>
            <div>
              <span>ورودی سالانه</span>
              <h3>ظرفیت مالی {activeYear.toLocaleString("fa-IR", { useGrouping: false })}</h3>
              <p>
                همه مبالغ میلیارد تومان است؛ نرخ‌ها به صورت درصد وارد می‌شوند.
              </p>
            </div>
            <div className="cash-equation">
              <span>نقد پس از پرداخت‌ها</span>
              <b>{fa(output.financial.cashAfterPayments, 0)}</b>
              <small>
                منابع داخلی قابل سرمایه‌گذاری:{" "}
                {fa(output.financial.internal, 0)}
              </small>
            </div>
          </header>
          <div className="financial-form-grid">
            <article>
              <h4>نقد و منابع داخلی</h4>
              {financialFields.map(([key, label]) => (
                <label key={key}>
                  <span>{label}<small className="field-unit">میلیارد تومان</small></span>
                  <input
                    type="number"
                    min="0"
                    value={financial[key] ?? 0}
                    onChange={(event) =>
                      patchFinancial(key, Number(event.target.value))
                    }
                  />
                </label>
              ))}
            </article>
            <article>
              <h4>تأمین مالی و منابع تکمیلی</h4>
              <details className="capital-contribution-help"><summary>راهنمای ثبت آورده سرمایه‌ای</summary><p>آورده نقدی سهامداران فعلی، افزایش سرمایه نقدی، ورود سهامدار جدید و سرمایه‌گذاری شریک صنعتی یا راهبردی در این منبع ثبت می‌شود. فقط مبلغ قابل اتکا برای سال منتخب را وارد کنید.</p><small>این منبع آورده سرمایه‌ای است؛ وام سهامداران در منابع بدهی ثبت می‌شود. اگر همین نقد در «ورود نقد قابل اتکا» منظور شده است، آن را دوباره اینجا وارد نکنید.</small></details>
              {fundingFields.map(([key, label, isRate]) => (
                <label key={key}>
                  <span>{label}<small className="field-unit">{isRate?"درصد سالانه":"میلیارد تومان"}</small></span>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max={isRate?100:undefined}
                      step={isRate ? "0.1" : "0.1"}
                      value={
                        isRate
                          ? (financial[key] ?? 0) * 100
                          : (financial[key] ?? 0)
                      }
                      onChange={(event) =>
                        patchFinancial(
                          key,
                          Number(event.target.value) / (isRate ? 100 : 1),
                        )
                      }
                    />
                    {isRate && <em>٪</em>}
                  </div>
                </label>
              ))}
            </article>
          </div>
          <footer>
            <div>
              <span>منابع داخلی قابل سرمایه‌گذاری</span>
              <b>{fa(output.capacity.internal, 0)}</b>
            </div>
            <div>
              <span>ظرفیت مؤثر بدهی</span>
              <b>{fa(output.capacity.effectiveDebt, 0)}</b>
            </div>
            <div>
              <span>کسری ذخیره نقد</span>
              <b>{fa(output.financial.reserveShortfall, 0)}</b>
            </div>
          </footer>
        </section>
      )}

      {view === "portfolio" && (
        <section className="portfolio-release">
          <header>
            <div>
              <span>پرتفوی فعلی</span>
              <h3>تصمیم آزادسازی سرمایه</h3>
              <p>
                برنامه فروش به‌تنهایی منبع نیست؛ فقط مبلغ «قابل اتکا» یا
                «محقق‌شده» وارد موتور تخصیص می‌شود.
              </p>
            </div>
            <div>
              <small>ظرفیت قابل تخصیص سال</small>
              <b>{fa(output.capacity.disposal, 0)}</b>
              <span>میلیارد تومان</span>
            </div>
          </header>
          <div className="movement-table-wrap">
            <table className="movement-table">
              <thead>
                <tr>
                  <th>دارایی / شرکت</th>
                  <th>سهم فعلی</th>
                  <th>افق</th>
                  <th>اقدام</th>
                  <th>سال</th>
                  <th>منابع بالقوه</th>
                  <th>منابع قابل اتکا</th>
                  <th>وضعیت تحقق</th>
                  <th>توضیح</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.map((asset, index) => {
                  const action = state.portfolioActions[String(index)] ?? {
                    action: "حفظ",
                    year: activeYear,
                    potentialProceeds: 0,
                    reliableProceeds: 0,
                    status: "برنامه‌ریزی‌شده",
                    note: "",
                  };
                  return (
                    <tr key={`${asset.name}-${index}`}>
                      <td>
                        <b>{asset.name}</b>
                      </td>
                      <td>
                        {asset.portfolioShare == null
                          ? "—"
                          : `${fa(asset.portfolioShare * 100, 2)}٪`}
                      </td>
                      <td>
                        <span className="parent-badge">{asset.horizon}</span>
                      </td>
                      <td>
                        <select
                          value={action.action}
                          onChange={(event) =>
                            patchAction(index, { action: event.target.value })
                          }
                        >
                          <option>حفظ</option>
                          <option>کاهش سهم</option>
                          <option>واگذاری / خروج</option>
                        </select>
                      </td>
                      <td>
                        <select
                          value={action.year}
                          onChange={(event) =>
                            patchAction(index, {
                              year: Number(event.target.value),
                            })
                          }
                        >
                          {CAPITAL_YEARS.map((year) => (
                            <option key={year} value={year}>
                              {year.toLocaleString("fa-IR", { useGrouping: false })}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={action.potentialProceeds}
                          onChange={(event) =>
                            patchAction(index, {
                              potentialProceeds:
                                Number(event.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={action.reliableProceeds}
                          onChange={(event) =>
                            patchAction(index, {
                              reliableProceeds: Number(event.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={action.status}
                          onChange={(event) =>
                            patchAction(index, { status: event.target.value })
                          }
                        >
                          <option>برنامه‌ریزی‌شده</option>
                          <option>قابل اتکا</option>
                          <option>محقق‌شده</option>
                        </select>
                      </td>
                      <td>
                        <input
                          value={action.note}
                          onChange={(event) =>
                            patchAction(index, { note: event.target.value })
                          }
                          placeholder="یادداشت کوتاه"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <footer>
            <CircleHelp />
            <span>
              مبلغ بالقوه برای سناریوسازی نمایش داده می‌شود، اما تا تغییر وضعیت
              به «قابل اتکا» یا «محقق‌شده» در ظرفیت تخصیص صفر است.
            </span>
          </footer>
        </section>
      )}

      {(view==="policy")&&<section className="capital-project-register"><header><h3>طرح‌ها و تصمیم قابل اقدام</h3><span>مبالغ: میلیارد تومان</span></header><div className="table-scroll"><table><thead><tr><th>طرح</th><th>اولویت تخصیص</th><th>نیاز سال</th><th>تأمین</th><th>وضعیت</th><th>قدم بعدی</th></tr></thead><tbody>{output.results.map(item=><tr key={item.id} className={selectedCaseRecord?.id===item.id?"selected":""}><td><button onClick={()=>{setSelectedCase(item.id);setView("cases");}}>{item.name}</button>{cases.find(c=>c.id===item.id)?.continuationOf&&<small>ادامه طرح سال {cases.find(c=>c.id===item.id)?.entryYear?.toLocaleString("fa-IR",{useGrouping:false})??"—"}</small>}</td><td>{item.overrideRank?`رتبه مصوب ${fa(item.overrideRank,0)}`:fa(item.entryPriority)}</td><td>{fa(item.annualNeed,0)}</td><td>{fa(item.executed,0)}</td><td><span className={item.validation.valid&&item.deferred===0?"confirmed":"pending"}>{item.decision}</span></td><td><button onClick={()=>{setSelectedCase(item.id);setView("cases");}}>{!item.validation.valid?"تکمیل ورودی":cases.find(c=>c.id===item.id)?.financialReviewRequired?"بازبینی مالی":item.deferred>0?"بررسی علت و شروط": "مشاهده پرونده"}</button><small>{item.reason}</small></td></tr>)}</tbody></table></div>{!cases.length&&<p>پرونده این سال ثبت نشده است؛ از برنامه ورود یا «ثبت پروژه مستقل» استفاده کنید.</p>}</section>}
      {view === "cases" && (
        <div className="investment-cases-layout">
          <section className="case-directory">
            <header>
              <div>
                <span>فرصت‌های منتخب {activeYear.toLocaleString("fa-IR", { useGrouping: false })}</span>
                <h3>طرح‌های منتقل‌شده از برنامه ورود</h3>
              </div>
              <b>{plans.length.toLocaleString("fa-IR")} فرصت</b>
            </header>
            {plans.map((opportunity) => {
              const id = `${runKey}:${activeYear}:${opportunity.key}`;
              const exists = caseIds.has(opportunity.key);
              return (
                <button
                  key={opportunity.key}
                  className={selectedCaseRecord?.id === id ? "selected" : ""}
                  onClick={() =>
                    exists ? setSelectedCase(id) : createCase(opportunity)
                  }
                >
                  <div>
                    <b>{opportunity.name}</b>
                    <small>{opportunity.parentName}</small>
                  </div>
                  <span>{fa(opportunity.entryPriority)}</span>
                  {exists ? <ChevronDown /> : <Plus />}
                </button>
              );
            })}
            <details className="independent-project-form"><summary><Plus/> ثبت پروژه مستقل</summary><p>پروژه نگهداشت، توسعه شرکت موجود یا طرح خارج از فهرست فرصت‌ها؛ بدون ساخت امتیاز علمی.</p><label>نام پروژه<input aria-label="نام پروژه مستقل" value={manualName} onChange={e=>setManualName(e.target.value)}/></label><label>رتبه تخصیص مصوب<input aria-label="رتبه پروژه مستقل" type="number" min="1" step="1" value={manualRank} onChange={e=>setManualRank(Number(e.target.value))}/></label><label>دلیل ورود و ترجیح<input aria-label="دلیل پروژه مستقل" value={manualReason} onChange={e=>setManualReason(e.target.value)}/></label><button onClick={createIndependent}>ثبت پرونده مستقل</button></details>
            {cases.filter(c=>c.sourceKind==="independent" || !plans.some(p=>p.key===c.opportunityKey)).map(c=><button key={c.id} onClick={()=>setSelectedCase(c.id)} className={selectedCaseRecord?.id===c.id?"selected":""}><div><b>{c.name}</b><small>{c.sourceKind==="independent"?"پروژه مستقل · رتبه مصوب":"پرونده ثبت‌شده این سبد"} {fa(c.overrideRank,0)}</small></div><ChevronDown/></button>)}
            {!plans.length && !cases.some(c=>c.continuationOf) && (
              <div className="case-empty">
                <b>برنامه ورود این سال خالی است.</b>
                <p>
                  در گام چهارم، فرصت‌ها را برای{" "}
                  {activeYear.toLocaleString("fa-IR", { useGrouping: false })} انتخاب کنید.
                </p>
              </div>
            )}
          </section>
          <section className="case-editor">
            {selectedCaseRecord ? (
              <>
                <header>
                  <div>
                    <span>پرونده سرمایه‌گذاری</span>
                    <h3>{selectedCaseRecord.name}</h3>
                    <p>
                      {selectedCaseRecord.parentName} · {selectedCaseRecord.sourceKind==="independent" ? `رتبه مصوب ${fa(selectedCaseRecord.overrideRank,0)}؛ فاقد امتیاز مدل کلان` : `اولویت ورود ${fa(selectedCaseRecord.entryPriority)}`}
                    </p>
                  </div>
                  <button onClick={() => removeCase(selectedCaseRecord.id)}>
                    <Trash2 /> {selectedCaseRecord.sourceKind==="scenario"&&!selectedCaseRecord.continuationOf?"پاک‌کردن ورودی مالی":"حذف پرونده"}
                  </button>
                </header>
                <div className="case-form-grid">
                  <label>
                    <span>روش ورود</span>
                    <select
                      value={selectedCaseRecord.method}
                      onChange={(event) =>
                        patchCase(selectedCaseRecord.id, {
                          method: event.target.value,
                        })
                      }
                    >
                      {ENTRY_METHODS.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>نوع نیاز</span>
                    <select
                      value={selectedCaseRecord.needType}
                      onChange={(event) =>
                        patchCase(selectedCaseRecord.id, {
                          needType: event.target.value,
                        })
                      }
                    >
                      {NEED_TYPES.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>نیاز مالی کل<small className="field-unit">میلیارد تومان</small></span>
                    <input
                      type="number"
                      min="0"
                      value={selectedCaseRecord.totalNeed}
                      onChange={(event) =>
                        patchCase(selectedCaseRecord.id, {
                          totalNeed: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>
                      نیاز مالی سال {activeYear.toLocaleString("fa-IR", { useGrouping: false })}<small className="field-unit">میلیارد تومان</small>
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={selectedCaseRecord.annualNeed}
                      onChange={(event) =>
                        patchCase(selectedCaseRecord.id, {
                          annualNeed: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>قابلیت اجرای مرحله‌ای</span>
                    <select
                      value={selectedCaseRecord.stageable ? "بله" : "خیر"}
                      onChange={(event) =>
                        patchCase(selectedCaseRecord.id, {
                          stageable: event.target.value === "بله",
                          minimumExecution:
                            event.target.value === "بله"
                              ? selectedCaseRecord.minimumExecution || 0.5
                              : 1,
                        })
                      }
                    >
                      <option>بله</option>
                      <option>خیر</option>
                    </select>
                  </label>
                  <label>
                    <span>حداقل درصد اجرا</span>
                    <div>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        disabled={!selectedCaseRecord.stageable}
                        value={selectedCaseRecord.minimumExecution * 100}
                        onChange={(event) =>
                          patchCase(selectedCaseRecord.id, {
                            minimumExecution: Number(event.target.value) / 100,
                          })
                        }
                      />
                      <em>٪</em>
                    </div>
                  </label>
                  <label>
                    <span>حداکثر نرخ قابل تحمل</span>
                    <div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={selectedCaseRecord.maximumRate==null ? "" : selectedCaseRecord.maximumRate*100}
                        placeholder="بدون سقف نرخ"
                        onChange={(event) =>
                          patchCase(selectedCaseRecord.id, {
                            maximumRate: event.target.value === "" ? null : Number(event.target.value) / 100,
                          })
                        }
                      />
                      <em>٪</em>
                    </div>
                  </label>
                  <label>
                    <span>منبع اختصاصی</span>
                    <select
                      value={selectedCaseRecord.dedicatedSource}
                      onChange={(event) =>
                        patchCase(selectedCaseRecord.id, {
                          dedicatedSource: event.target.value,
                          dedicatedAmount: event.target.value
                            ? selectedCaseRecord.dedicatedAmount
                            : 0,
                        })
                      }
                    >
                      <option value="">بدون منبع اختصاصی</option>
                      {Object.entries(FUNDING_SOURCES).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label><span>نحوه استفاده از منبع اختصاصی</span><select aria-label="نحوه تعهد منبع اختصاصی" disabled={!selectedCaseRecord.dedicatedSource} value={selectedCaseRecord.dedicatedMode??"preferred"} onChange={e=>patchCase(selectedCaseRecord.id,{dedicatedMode:e.target.value as "reserved"|"preferred"})}><option value="preferred">منبع ترجیحی؛ وابسته به ظرفیت باقی‌مانده</option><option value="reserved">رزروشده برای این طرح؛ حفاظت از تعهد</option></select><small>رزرو از همان ظرفیت سال کسر می‌شود. بخش استفاده‌نشده تا اصلاح تعهد برای سایر طرح‌ها آزاد نمی‌شود.</small></label>
                  <label>
                    <span>مبلغ اختصاصی<small className="field-unit">میلیارد تومان</small></span>
                    <input
                      type="number"
                      min="0"
                      disabled={!selectedCaseRecord.dedicatedSource}
                      value={selectedCaseRecord.dedicatedAmount}
                      onChange={(event) =>
                        patchCase(selectedCaseRecord.id, {
                          dedicatedAmount: Number(event.target.value) || 0,
                        })
                      }
                    />
                  </label>
                  <label className="case-wide">
                    <span>معیار یا توضیح اقتصادی</span>
                    <textarea
                      value={selectedCaseRecord.economicNote}
                      onChange={(event) =>
                        patchCase(selectedCaseRecord.id, {
                          economicNote: event.target.value,
                        })
                      }
                      placeholder="در صورت وجود: بازده، دوره بازگشت یا شرط اقتصادی مصوب"
                    />
                  </label>
                </div>
                {selectedCaseRecord.dedicatedSource === "partner" && <details className="capital-contribution-help case-contribution-help"><summary>راهنمای ثبت منبع اختصاصی</summary><p>آورده نقدی سهامداران فعلی یا جدید و شرکای سرمایه‌گذاری را در «مبلغ اختصاصی» ثبت کنید. این مبلغ باید در ظرفیت آورده همان سال نیز منظور شده باشد؛ ثبت منبع اختصاصی ظرفیت تازه‌ای ایجاد نمی‌کند.</p><small>مبلغ اختصاصی در اولویت تأمین همین پرونده و در حد ظرفیت باقی‌مانده همان منبع استفاده می‌شود. یک آورده را همزمان در منابع داخلی و این منبع ثبت نکنید.</small></details>}
                {selectedCaseRecord.financialReviewRequired&&<div className="case-review-required" role="status"><p>این پرونده از نسخه جدید سناریو یا مرحله بعد طرح آمده است؛ ورودی مالی حفظ شده اما نیازمند بازبینی است.</p><button onClick={()=>patchCase(selectedCaseRecord.id,{financialReviewRequired:false})}>تأیید بازبینی مالی این پرونده</button></div>}
                <div className="case-phase-copy"><label>ثبت مرحله سال دیگر<select aria-label="سال مرحله بعد" value={effectiveCopyYear} onChange={e=>setCopyYear(Number(e.target.value))}>{CAPITAL_YEARS.filter(y=>y!==activeYear).map(y=><option value={y} key={y}>{y.toLocaleString("fa-IR",{useGrouping:false})}</option>)}</select></label><button onClick={copyCase}>کپی ساختار پرونده به سال منتخب</button><small>نیاز سالانه و مبلغ اختصاصی کپی نمی‌شوند؛ هر مرحله تأمین مستقل دارد.</small></div>
                <details className="allocation-override">
                  <summary>
                    <SlidersHorizontal /> تعیین اولویت تخصیص توسط مدیریت{" "}
                    <ChevronDown />
                  </summary>
                  <div>
                    <label>
                      <span>رتبه دستی</span>
                      <input
                        type="number"
                        min="1"
                        value={selectedCaseRecord.overrideRank ?? ""}
                        onChange={(event) =>
                          patchCase(selectedCaseRecord.id, {
                            overrideRank: event.target.value
                              ? Number(event.target.value)
                              : null,
                            overrideAt: new Date().toISOString(),
                            overrideBy: "کاربر جاری",
                          })
                        }
                      />
                    </label>
                    <label>
                      <span>دلیل تعیین اولویت</span>
                      <input
                        value={selectedCaseRecord.overrideReason ?? ""}
                        onChange={(event) =>
                          patchCase(selectedCaseRecord.id, {
                            overrideReason: event.target.value,
                            overrideAt: new Date().toISOString(),
                            overrideBy: "کاربر جاری",
                          })
                        }
                        placeholder="علت تصمیم مدیریتی"
                      />
                    </label>
                    {selectedCaseRecord.overrideAt && (
                      <small>
                        ثبت در{" "}
                        {new Date(selectedCaseRecord.overrideAt).toLocaleString(
                          "fa-IR",
                        )}{" "}
                        توسط {selectedCaseRecord.overrideBy}
                      </small>
                    )}
                  </div>
                </details>
              </>
            ) : (
              <div className="case-editor-empty">
                <WalletCards />
                <b>یک فرصت را انتخاب کنید</b>
                <p>
                  فرصت منتخب به پرونده‌ای با نیاز مالی، روش ورود و محدودیت‌های
                  قابل ردیابی تبدیل می‌شود.
                </p>
              </div>
            )}
          </section>
        </div>
      )}


      {view === "executive" && <CapitalExecutiveSummary output={output} annualOutputs={annualOutputs} contextName={contextName} signal={executiveSignal} financeStatuses={state.financialStatusByYear??{}} blockedYears={blockedYears} onYear={onYear} onOpen={id=>{setSelectedCase(id);setView("cases");}}/>}

      {view==="executive"&&<section className="allocation-evaluation-record"><header><h3>ثبت نسخه تصمیم</h3><p>این ثبت، ارقام سال، پرونده‌ها، ترتیب منابع و نتیجه را ثابت نگه می‌دارد؛ اصلاح بعدی ارزیابی جدید می‌خواهد.</p></header><div className="evaluation-record-form"><label>ثبت‌کننده<input aria-label="ثبت‌کننده ارزیابی" value={approvalActor} onChange={e=>setApprovalActor(e.target.value)}/></label><label>دلیل یا مصوبه<input aria-label="دلیل ثبت ارزیابی" value={approvalReason} onChange={e=>setApprovalReason(e.target.value)}/></label><button onClick={()=>saveEvaluation("draft")}>ثبت پیش‌نویس</button><button onClick={()=>saveEvaluation("approved")}>ثبت ارزیابی تأییدشده</button></div><details><summary>نسخه‌های ثبت‌شده این سال ({fa(evaluations.length,0)})</summary>{evaluations.map(e=><article key={e.id}><b>{e.status==="approved"?"تأییدشده":"پیش‌نویس"}</b><span> · {new Date(e.createdAt).toLocaleString("fa-IR")} · {e.signature===currentSignature?"مطابق ورودی جاری":"ورودی جاری تغییر کرده؛ نسخه ثبت‌شده مستقل است"}</span><p>{e.actor||"ثبت‌کننده تعیین نشده"} · {e.reason||"دلیل تعیین نشده"}</p><p>نیاز: {summarizeCapital(e.output).need==null?"نامشخص":fa(summarizeCapital(e.output).need!,0)} · تأمین: {fa(e.output.totalExecuted,0)} · تعویق: {summarizeCapital(e.output).gap==null?"نامشخص":fa(summarizeCapital(e.output).gap!,0)} میلیارد تومان</p><details><summary>ورودی‌ها و تصمیم‌های همین نسخه</summary><p>نقد پس از پرداخت‌ها: {fa(e.output.financial.cashAfterPayments,0)} · کسری ذخیره: {fa(e.output.financial.reserveShortfall,0)}</p>{e.output.results.map(c=><p key={c.id}>{c.name} · نیاز {c.validation.valid?fa(c.annualNeed,0):"نامشخص"} · تأمین {fa(c.executed,0)} · {c.decision}</p>)}</details></article>)}</details></section>}
      {view === "trace" && (
        <section className="allocation-trace">
          <header>
            <div>
              <span>ردیابی ساده الگوریتم</span>
              <h3>دفاع مرحله‌به‌مرحله از تصمیم تخصیص</h3>
              <p>
                هر مرحله فقط نیاز باقی‌مانده، ظرفیت واقعی، سقف بدهی و مجازبودن
                نرخ را بررسی می‌کند.
              </p>
            </div>
            <label>
              <span>پرونده</span>
              <select
                value={selectedResult?.id ?? ""}
                onChange={(event) => setSelectedCase(event.target.value)}
              >
                {output.results.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
          </header>
          {selectedResult ? (
            <>
              <div className="trace-summary">
                <div>
                  <span>نیاز سال</span>
                  <b>{fa(selectedResult.annualNeed, 0)}</b>
                </div>
                <div>
                  <span>حداقل لازم برای اجرا</span>
                  <b>{fa(selectedResult.minimumRequired, 0)}</b>
                </div>
                <div>
                  <span>تأمین موقت</span>
                  <b>{fa(selectedResult.temporaryFunding, 0)}</b>
                </div>
                <strong
                  className={`allocation-decision ${selectedResult.decision === "تأمین کامل" ? "full" : selectedResult.decision === "تأمین جزئی" ? "partial" : "deferred"}`}
                >
                  {selectedResult.decision}
                </strong>
              </div>
              <div className="trace-flow">
                {selectedResult.trace.map((stage, index) => (
                  <article
                    key={`${stage.stage}-${index}`}
                    className={
                      !stage.rateAllowed || stage.allocation === 0
                        ? "muted"
                        : "allocated"
                    }
                  >
                    <div className="trace-index">
                      {(index + 1).toLocaleString("fa-IR")}
                    </div>
                    <header>
                      <span>{stage.stage}</span>
                      <b>
                        {stage.source
                          ? FUNDING_SOURCES[stage.source].label
                          : "بدون منبع"}
                      </b>
                    </header>
                    <div className="trace-math">
                      <span>
                        <small>نیاز قبل</small>
                        <b>{fa(stage.needBefore, 0)}</b>
                      </span>
                      <i>−</i>
                      <span>
                        <small>تخصیص</small>
                        <b>{fa(stage.allocation, 0)}</b>
                      </span>
                      <i>=</i>
                      <span>
                        <small>نیاز بعد</small>
                        <b>{fa(stage.needAfter, 0)}</b>
                      </span>
                    </div>
                    <dl>
                      <div>
                        <dt>ظرفیت اسمی</dt>
                        <dd>{fa(stage.nominalCapacity, 0)}</dd>
                      </div>
                      <div>
                        <dt>مصرف قبلی</dt>
                        <dd>{fa(stage.previousUse, 0)}</dd>
                      </div>
                      <div>
                        <dt>ظرفیت قابل استفاده</dt>
                        <dd>{fa(stage.usableCapacity, 0)}</dd>
                      </div>
                      <div>
                        <dt>سقف بدهی باقی</dt>
                        <dd>{fa(stage.remainingDebtCeiling, 0)}</dd>
                      </div>
                      <div>
                        <dt>نرخ</dt>
                        <dd>{percent(stage.rate)}</dd>
                      </div>
                      <div>
                        <dt>نرخ مجاز؟</dt>
                        <dd>{stage.rateAllowed ? "بله" : "خیر"}</dd>
                      </div>
                    </dl>
                    <p>{stage.note}</p>
                  </article>
                ))}
              </div>
              <footer className="trace-decision">
                <ShieldCheck />
                <div>
                  <b>{selectedResult.reason}</b>
                  <p>
                    تأمین‌شده {fa(selectedResult.executed, 0)} و تعویق{" "}
                    {fa(selectedResult.deferred, 0)} میلیارد تومان؛ جمع دقیقاً
                    با نیاز سال برابر است.
                  </p>
                </div>
              </footer>
            </>
          ) : (
            <div className="capital-empty">
              <Route />
              <b>ردیابی هنوز در دسترس نیست</b>
              <p>
                پس از تکمیل حداقل یک پرونده سرمایه‌گذاری، مسیر پنج‌مرحله‌ای
                تخصیص اینجا نمایش داده می‌شود.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
