"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  Compass,
  Download,
  Landmark,
  LockKeyhole,
  Play,
  Route,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import IsicAnalysis, {
  activityName,
  type IsicActivity,
  type IsicResult,
} from "@/components/isic-analysis";
import EntryPlanning, {
  type EntryOpportunity,
} from "@/components/entry-planning";
import { reconcileScenarioCases, workspaceId, inspectEntryPlan, reviewSignature, mergeScenarioPlans, eligibleScenarioCases, type SnapshotPlan } from "@/lib/scenario-workspace.mjs";
import ScenarioCapitalComparison from "@/components/scenario-capital-comparison";
import MovementMeetingPrint from "@/components/movement-meeting-print";
import { archiveScenario, renameScenario, scenarioBackup, validateScenarioBackup, mergeScenarioBackup } from "@/lib/scenario-management.mjs";
import ScenarioControls from "@/components/scenario-controls";
import CapitalAllocation from "@/components/capital-allocation";
import { calculateStrategicFit } from "@/lib/strategic-fit.mjs";
import { priorityScore } from "@/lib/priority-score.mjs";
import {
  CONDITIONS,
  HORIZONS,
  ISIC_PRESETS,
  MISSION_OPTIONS,
  YEARS,
  activityBasketKey,
  normalizeWeights,
  parentBasketKey,
  passesMissionGate,
  restoreMovementState,
  scoreIsicActivities,
  selectionScore,
  updateVisionShare,
  weightedHorizon,
} from "@/lib/movement-model.mjs";

type Horizon = "core" | "adjacent" | "transform";
type Stage = "mission" | "isic" | "management" | "entry";
type Row = {
  id: number;
  name: string;
  x: number;
  dynamicY: number;
  priority: number;
  coreFit: number;
  adjacentFit: number;
  transformFit: number;
  yPlotBaseline: number;
  horizon: string;
};
type ActivityRow = {
  code: string;
  name: string;
  parentId: number | null;
  parentName?: string | null;
  mappingEligible?: boolean;
  mappingConfidence?: string | null;
  include?: boolean;
  isicLevel: string;
  score?: number | null;
  rank?: number | null;
  indicators: Record<string, number | null>;
};
type CurrentAsset = {
  name: string;
  portfolioShare: number | null;
  horizon: string;
  attributableValue?: number | null;
};
type Board = { score: number | null; reason: string };
type BaseState = {
  mission: Record<number, string>;
  conditions: Record<number, { key: string; note: string }>;
  board: Record<number, Board>;
  activityBoard: Record<string, Board>;
  vision: Record<Horizon, number>;
  selectionWeights: { macro: number; detail: number; board: number };
  baskets: Record<number, Record<string, { share: number; priorityRank?:number; parentId?: number }>>;
  isicPreset: string;
  customWeights: Record<string, number>;
  [key: string]: unknown;
};
type CapitalState = {
  evaluations?: import("@/lib/allocation-evaluations.mjs").AllocationEvaluation[];
  sourcePolicies?: Record<string,import("@/lib/capital-allocation.mjs").SourcePolicy>;
  liquidityPoliciesByYear?: Record<string,Pick<import("@/lib/capital-allocation.mjs").SourcePolicy,"liquidityMode"|"liquidityReason"|"liquiditySources">>;
  financialByYear: Record<number, Record<string, number>>;
  financialStatusByYear?: Record<number,"sample"|"draft"|"confirmed">;
  portfolioActions: Record<
    string,
    {
      action: string;
      year: number;
      potentialProceeds: number;
      reliableProceeds: number;
      status: string;
      note: string;
    }
  >;
  cases: Record<string, CapitalCase>;
};
type CapitalCase = {
  id: string;
  opportunityKey: string;
  name: string;
  parentName: string;
  year: number;
  entryPriority: number;
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
type Scenario = { id: string; name: string; base: BaseState; completed: Stage[]; reviewed?: Partial<Record<Stage,string>>; revision: number; updatedAt: string };
type Snapshot = { id: string; scenarioId: string; name: string; revision: number; createdAt: string; dataSnapshot: string; policy?: BaseState; plans: SnapshotPlan[] };
type State = { exportedAt?:string;backupScope?:string; archivedScenarioIds?:string[]; compositionMode?:"single"|"combined"; recoveryRequired?:boolean; lastCapitalYear?:number; version: 31; base: BaseState; capital: CapitalState; activeScenarioId: string; scenarios: Scenario[]; snapshots: Snapshot[]; selectedSnapshots: string[]; conflictChoices: Record<string,string> };
function prepareCapital(state:State):State {
  const archived=new Set(state.archivedScenarioIds??[]);
  const removed=new Set(state.snapshots.filter(s=>archived.has(s.scenarioId)).map(s=>s.id));
  state={...state,selectedSnapshots:state.selectedSnapshots.filter(id=>!removed.has(id)),conflictChoices:Object.fromEntries(Object.entries(state.conflictChoices).filter(([,v])=>!removed.has(v)))};
  const policies={...state.capital.sourcePolicies};
  const runKey=state.selectedSnapshots.slice().sort().join("|");
  const lineage=(key:string)=>key.split("|").map(id=>state.snapshots.find(s=>s.id===id)?.scenarioId??id).sort().join("|");
  if(runKey && !policies[runKey]) {
    const previous=Object.entries(policies).filter(([key])=>lineage(key)===lineage(runKey)).at(-1)?.[1];
    if(previous)policies[runKey]=structuredClone(previous);
  }
  return {...state,capital:{...state.capital,sourcePolicies:policies,cases:reconcileScenarioCases(state.capital.cases,state.snapshots,state.selectedSnapshots,state.conflictChoices)}};
}
function serialized(state: State) { return {...state, scenarios: state.scenarios.map(s => s.id === state.activeScenarioId ? {...s, base: state.base, completed: STAGES.filter(step=>s.reviewed?.[step.id]===reviewSignature(state.base,step.id)).map(step=>step.id)} : s)}; }
const emptyWorkspace = {activeScenarioId:"", scenarios:[] as Scenario[], snapshots:[] as Snapshot[], selectedSnapshots:[] as string[], conflictChoices:{} as Record<string,string>};
type StoredV29 = { base?: unknown; capital?: Partial<CapitalState> } | null;

const STAGES = [
  {
    id: "mission" as const,
    number: "۰۱",
    title: "جهت‌گیری راهبردی پرتفوی",
    short: "جهت‌گیری",
    description: "مقصد و حدود مأموریت سرمایه‌گذاری",
    icon: Compass,
  },
  {
    id: "isic" as const,
    number: "۰۲",
    title: "ارزیابی تفصیلی فرصت‌ها",
    short: "ارزیابی تفصیلی",
    description: "مقایسه و رتبه‌بندی زیر‌بخش‌های اقتصادی",
    icon: BarChart3,
  },
  {
    id: "management" as const,
    number: "۰۳",
    title: "اولویت‌های راهبردی مدیریت",
    short: "اولویت ورود",
    description: "ترجیحات مستقل مدیریت و سیاست انتخاب",
    icon: BriefcaseBusiness,
  },
  {id:"entry" as const, number:"۰۴", title:"برنامه ورود سرمایه‌گذاری", short:"برنامه ورود", description:"انتخاب فرصت‌ها و نقشه ورود چندساله", icon: Route},
];
const fa = (value: number | null | undefined, digits = 1) =>
  value == null || !Number.isFinite(value)
    ? "—"
    : value.toLocaleString("fa-IR", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
const horizonLabel = (key: string) =>
  HORIZONS.find((item) => item.key === key)?.label ?? "—";

function initialCapital(portfolio: CurrentAsset[]): CapitalState {
  return {
    sourcePolicies:{},
    liquidityPoliciesByYear:{},
    financialByYear: Object.fromEntries(
      YEARS.map((year) => [
        year,
        {},
      ]),
    ),
    portfolioActions: Object.fromEntries(
      portfolio.map((_, index) => [
        String(index),
        {
          action: "حفظ",
          year: 1406,
          potentialProceeds: 0,
          reliableProceeds: 0,
          status: "برنامه‌ریزی‌شده",
          note: "",
        },
      ]),
    ),
    cases: {},
  };
}

function migrateEntryRanks(base:BaseState):BaseState {
  return {...base,baskets:Object.fromEntries(Object.entries(base.baskets).map(([year,basket])=>{
    const ordered=Object.entries(basket).sort((a,b)=>Number(b[1].share)-Number(a[1].share));
    return [year,Object.fromEntries(ordered.map(([key,value],i)=>[key,{...value,priorityRank:value.priorityRank??i+1}]))];
  }))};
}
function hydrate(
  rows: Row[],
  activities: ActivityRow[],
  portfolio: CurrentAsset[],
): State {
  let savedV29: StoredV29 = null;
  let savedLegacy: unknown = null;
  try {
    savedV29 = JSON.parse(
      localStorage.getItem("ips-movement-path-v29") || "null",
    );
    savedLegacy = JSON.parse(
      localStorage.getItem("ips-movement-path-v1") || "null",
    );
  } catch {
    /* defensive reset */
  }
  const base = migrateEntryRanks(restoreMovementState(
    savedV29?.base ?? savedLegacy,
    rows,
    activities,
  ) as BaseState);
  const defaults = initialCapital(portfolio);
  const capital =
    savedV29?.capital && typeof savedV29.capital === "object"
      ? {
          financialByYear: {
            ...defaults.financialByYear,
            ...(savedV29.capital.financialByYear ?? {}),
          },
          portfolioActions: {
            ...defaults.portfolioActions,
            ...(savedV29.capital.portfolioActions ?? {}),
          },
          cases: savedV29.capital.cases ?? {},
        }
      : defaults;
  try {
    const workspace = JSON.parse(localStorage.getItem("ips-scenario-workspace-v31") || "null");
    if (workspace?.version === 31 && Array.isArray(workspace.scenarios) && Array.isArray(workspace.snapshots)) {
      validateScenarioBackup(workspace);
      return {...workspace, base: migrateEntryRanks(restoreMovementState(workspace.base, rows, activities) as BaseState),
        scenarios:workspace.scenarios.map((s:Scenario)=>({...s,base:migrateEntryRanks(restoreMovementState(s.base,rows,activities) as BaseState)})),
        capital: {...defaults, ...workspace.capital,liquidityPoliciesByYear:workspace.capital.liquidityPoliciesByYear??{}}, conflictChoices: workspace.conflictChoices ?? {}};
    }
    if(localStorage.getItem("ips-scenario-workspace-v31")) throw new Error("invalid workspace");
  } catch {
    const raw = localStorage.getItem("ips-scenario-workspace-v31");
    if(raw) {
      localStorage.setItem("ips-workspace-recovery-v34",raw);
      return {version:31,base,capital,...emptyWorkspace,recoveryRequired:true};
    }
  }
  const migrated = savedV29 ? [{id:"legacy", name:"سناریوی پیشین", base, completed:[] as Stage[],revision:1,updatedAt:new Date().toISOString()}] : [];
  return { version:31, base, capital, ...emptyWorkspace, scenarios:migrated, activeScenarioId:migrated[0]?.id ?? "" };
}

function JourneyIntro({
  onStart,
  onExport,
  onImport,
  fileRef,
  snapshot,
}: {
  onStart: (stage?:Stage) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  snapshot: string;
}) {
  return (
    <main className="movement-v29-intro" dir="rtl">
      <div className="journey-grid" />
      <div className="journey-aura one" />
      <div className="journey-aura two" />
      <header>
        <span>سامانه خط‌مشی سرمایه‌گذاری آتیه فولاد</span>
        <h1>مسیر حرکت سرمایه‌گذاری</h1>
        <p>از تعیین جهت راهبردی تا انتخاب فرصت و برنامه‌ریزی زمان ورود</p>
      </header>
      <section className="strategic-journey">
        {STAGES.map((step, index) => {
          const Icon = step.icon;
          return (
            <article
              key={step.id}
              role="button" tabIndex={0} onClick={()=>onStart(step.id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onStart(step.id);}}}
              style={
                { "--journey-delay": `${index * 90}ms` } as React.CSSProperties
              }
            >
              <div className="journey-node">
                <Icon />
                <span>{step.number}</span>
              </div>
              <div>
                <small>گام {step.number}</small>
                <h2>{step.title}</h2>
                <p>{step.description}</p>
              </div>
              {index < STAGES.length - 1 && (
                <i className="journey-connector">
                  <em />
                </i>
              )}
            </article>
          );
        })}
      </section>
      <div className="journey-actions">
        <button onClick={()=>onStart()}>
          <Play /> شروع مسیر حرکت
        </button>
        <div>
          <button onClick={onExport}>
            <Download /> خروجی سیاست
          </button>
          <button onClick={() => fileRef.current?.click()}>
            <Upload /> ورود سیاست
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.target.value = "";
            }}
          />
        </div>
        <small>نسخه داده {snapshot}</small>
      </div>
    </main>
  );
}

function BoardSelect({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(event) =>
        onChange(event.target.value === "" ? null : Number(event.target.value))
      }
    >
      <option value="">بدون نظر</option>
      {[1, 2, 3, 4, 5].map((score) => (
        <option key={score} value={score}>
          {score.toLocaleString("fa-IR")} —{" "}
          {score === 1
            ? "بسیار پایین"
            : score === 2
              ? "پایین"
              : score === 3
                ? "عادی"
                : score === 4
                  ? "بالا"
                  : "راهبردی بالا"}
        </option>
      ))}
    </select>
  );
}

export default function MovementPathV29({
  mode = "movement",
  rows,
  masterData,
  currentPortfolio,
  dataSnapshot,
  onOpenCapital,
}: {
  onOpenCapital?:()=>void;
  mode?: "movement" | "capital";
  rows: Row[];
  masterData: ActivityRow[];
  currentPortfolio: CurrentAsset[];
  currentAudit?: unknown[];
  dataSnapshot: string;
}) {
  const [entered, setEntered] = useState(false);
  const [stage, rawSetStage] = useState<Stage>("mission");
  const [state, setState] = useState<State>({
    version: 31,
    ...emptyWorkspace,
    base: restoreMovementState(null, rows, masterData) as BaseState,
    capital: initialCapital(currentPortfolio),
  });
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [missionFilter,setMissionFilter]=useState("همه");
  const [boardFilter,setBoardFilter]=useState("همه");
  const [selectedRows,setSelectedRows]=useState<number[]>([]);
  const [bulkValue,setBulkValue]=useState("مجاز");
  const [bulkPending,setBulkPending]=useState(false);
  const setStage=(next:Stage)=>{rawSetStage(next);setSelectedRows([]);setBulkPending(false);setBulkValue(next==="management"?"3":"مجاز");};
  const [compositionMode,setCompositionMode]=useState<"single"|"combined">("single");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [activeYear, setActiveYear] = useState(1406);
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingImport,setPendingImport]=useState<{workspace:State;filename:string}|null>(null);
  const restoreDialogRef=useRef<HTMLElement>(null);
  const [importMode,setImportMode]=useState<"merge"|"replace">("merge");
  const [canUndoRestore,setCanUndoRestore]=useState(false);
  const [exportFile,setExportFile]=useState<{url:string;name:string;content:string}|null>(null);
  const [saveStatus,setSaveStatus]=useState("در حال بازیابی اطلاعات…");
  const [lastSavedAt,setLastSavedAt]=useState<string|null>(null);
  const [lastBackupAt,setLastBackupAt]=useState<string|null>(null);

  useEffect(()=>{
    if(!pendingImport)return;
    const previous=document.activeElement as HTMLElement|null;
    const dialog=restoreDialogRef.current;
    dialog?.focus();
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){setPendingImport(null);return;}
      if(event.key!=="Tab"||!dialog)return;
      const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button,input,a[href]')).filter(e=>!e.hasAttribute("disabled"));
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener("keydown",keydown);
    return ()=>{document.removeEventListener("keydown",keydown);previous?.focus();};
  },[pendingImport]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const loaded=prepareCapital(hydrate(rows, masterData, currentPortfolio));
      setState(loaded);
      setCompositionMode(loaded.compositionMode??(loaded.selectedSnapshots.length>1?"combined":"single"));
      setActiveYear(loaded.lastCapitalYear ?? 1406);
      setCanUndoRestore(Boolean(localStorage.getItem("ips-workspace-before-restore-v37")));
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [rows, masterData, currentPortfolio]);
  useEffect(() => {
    if (ready && !state.recoveryRequired) {
      try {localStorage.setItem("ips-scenario-workspace-v31", JSON.stringify(serialized(state)));queueMicrotask(()=>{setSaveStatus("تغییرات در این مرورگر ذخیره شد");setLastSavedAt(new Date().toISOString());});}
      catch {queueMicrotask(()=>{setSaveStatus("ذخیره ناموفق؛ پشتیبان دانلود کنید");setNotice("ذخیره خودکار انجام نشد؛ فضای مرورگر کافی نیست. پیش از خروج، فایل پشتیبان کامل را دانلود کنید.");});}
    }
  }, [state, ready]);

  const base = state.base;
  const isicWeights = useMemo(
    () =>
      base.isicPreset === "custom"
        ? normalizeWeights(base.customWeights)
        : (ISIC_PRESETS[base.isicPreset as keyof typeof ISIC_PRESETS]
            ?.weights ?? ISIC_PRESETS.balanced.weights),
    [base.isicPreset, base.customWeights],
  );
  const isic = useMemo(
    () => scoreIsicActivities(masterData, isicWeights),
    [masterData, isicWeights],
  );
  const baseline = useMemo(
    () => scoreIsicActivities(masterData, ISIC_PRESETS.balanced.weights),
    [masterData],
  );
  const fit = useMemo(
    () =>
      new Map(
        (
          calculateStrategicFit(rows, base.vision) as {
            id: number;
            dynamicY: number;
          }[]
        ).map((item) => [item.id, item.dynamicY]),
      ),
    [rows, base.vision],
  );
  const records = useMemo(
    () =>
      rows.map((row) => {
        const dynamicY = fit.get(row.id) ?? row.dynamicY;
        return {
          ...row,
          dynamicY,
          priority: priorityScore(row.x, dynamicY),
          horizon: weightedHorizon(
            row.coreFit,
            row.adjacentFit,
            row.transformFit,
            base.vision,
          ) as Horizon,
          mission: base.mission[row.id] ?? "مجاز",
          condition: base.conditions[row.id] ?? { key: "", note: "" },
        };
      }),
    [rows, fit, base.vision, base.mission, base.conditions],
  );
  const children = useMemo(() => {
    const map = new Map<number, IsicActivity[]>();
    for (const row of isic.activities as IsicActivity[])
      if (row.mappingEligible && row.parentId != null)
        map.set(row.parentId, [...(map.get(row.parentId) ?? []), row]);
    return map;
  }, [isic]);
  const entryOpportunities = useMemo<EntryOpportunity[]>(() => {
    const result: EntryOpportunity[] = [];
    for (const row of records) {
      if (!passesMissionGate(row.mission, row.condition)) continue;
      const detail =
        (isic.sectors as IsicResult["sectors"] | undefined)?.[row.id]?.score ??
        null;
      const management = base.board[row.id]?.score ?? null;
      result.push({
        key: parentBasketKey(row.id),
        name: row.name,
        parentName: "حوزه اصلی",
        parentId: row.id,
        child: false,
        macro: row.priority,
        detail,
        management,
        entryPriority:
          selectionScore(
            row.priority,
            detail,
            management,
            base.selectionWeights,
          ).score ?? row.priority,
        horizon: row.horizon,
      });
      for (const child of children.get(row.id) ?? []) {
        const childManagement = base.activityBoard[child.code]?.score ?? null;
        result.push({
          key: activityBasketKey(child.code),
          name: activityName(child),
          parentName: row.name,
          parentId: row.id,
          child: true,
          macro: row.priority,
          detail: child.score ?? null,
          management: childManagement,
          entryPriority:
            selectionScore(
              row.priority,
              child.score ?? null,
              childManagement,
              base.selectionWeights,
            ).score ?? row.priority,
          horizon: row.horizon,
        });
      }
    }
    return result;
  }, [
    records,
    isic.sectors,
    base.board,
    base.activityBoard,
    base.selectionWeights,
    children,
  ]);
  const plan = base.baskets[activeYear] ?? {};
  const liveCapitalPlans = Object.entries(plan)
    .map(([key, value]) => {
      const opportunity = entryOpportunities.find((item) => item.key === key);
      return opportunity
        ? { ...opportunity, share: Number(value.share || 0), priorityRank: value.priorityRank }
        : null;
    })
    .filter(Boolean) as (EntryOpportunity & { share: number })[];

  const missingConditions = records.filter(row=>row.mission==="مشروط"&&!passesMissionGate(row.mission,row.condition)).length;
  const missingOpinions = records.filter(row=>passesMissionGate(row.mission,row.condition)&&base.board[row.id]?.score==null).length;
  const entryIssues = inspectEntryPlan(base.baskets,entryOpportunities,"priority").errors;
  const stageInputsReady = stage==="mission" ? !records.some(row=>row.mission==="مشروط"&&!passesMissionGate(row.mission,row.condition)) : stage==="entry" ? inspectEntryPlan(base.baskets,entryOpportunities,"priority").errors.length===0 : true;
  const activeScenario = serialized(state).scenarios.find(s => s.id === state.activeScenarioId);
  const selectedSnapshots = state.snapshots.filter(s => state.selectedSnapshots.includes(s.id));
  const merged = mergeScenarioPlans(selectedSnapshots, activeYear, state.conflictChoices,state.capital.cases);
  const runKey = state.selectedSnapshots.slice().sort().join("|") || (state.activeScenarioId === "legacy" ? "legacy" : "none");
  const capitalPlans = selectedSnapshots.length ? merged.plans : state.activeScenarioId === "legacy" ? liveCapitalPlans : [];
  const yearMerges=YEARS.map(year=>({year,...mergeScenarioPlans(selectedSnapshots,year,state.conflictChoices,state.capital.cases)}));
  const eligiblePlans = yearMerges.flatMap(result=>result.plans);
  const runCases = eligibleScenarioCases(state.capital.cases,runKey,eligiblePlans);
  const selectSnapshots=(inputIds:string[])=>{
    const uniqueVersions=[...new Map(inputIds.map(id=>[state.snapshots.find(s=>s.id===id)?.scenarioId??id,id])).values()];
    const ids=compositionMode==="single"?uniqueVersions.slice(-1):uniqueVersions;
    const years=state.snapshots.filter(s=>ids.includes(s.id)).flatMap(s=>s.plans.map(p=>p.year));
    const year=years.length&&!years.includes(activeYear)?Math.min(...years):activeYear;
    setActiveYear(year);
    setState(old=>prepareCapital({...old,selectedSnapshots:ids,compositionMode,conflictChoices:{},lastCapitalYear:year}));
  };
  const changeScenario = (id:string) => setState(old => {
    const all = serialized(old).scenarios;
    const next = all.find(s => s.id === id && !(old.archivedScenarioIds??[]).includes(s.id));
    return next ? {...old, scenarios:all, activeScenarioId:id, base:next.base} : old;
  });
  const createScenario = (name:string, duplicate:boolean) => {
    const clean = name.trim(); if (!clean) return;
    const scenario:Scenario = {id:workspaceId(),name:clean,base:duplicate ? structuredClone(state.base) : restoreMovementState(null,rows,masterData) as BaseState,completed:[],revision:1,updatedAt:new Date().toISOString()};
    setState(old => ({...old, scenarios:[...serialized(old).scenarios,scenario],activeScenarioId:scenario.id,base:scenario.base}));
    setStage("mission"); setEntered(true);
  };
  const freezeScenario = (confirmFinal=false) => {
    if(state.recoveryRequired){setNotice("ابتدا داده معتبر را بازیابی کنید؛ نسخه اصلی بازنویسی نمی‌شود.");return;}
    const checked=inspectEntryPlan(base.baskets,entryOpportunities,"priority");
    if (!activeScenario || (confirmFinal ? STAGES.slice(0,3).some(step=>!activeScenario.completed.includes(step.id)) : activeScenario.completed.length < 4)) {setNotice("ابتدا مراحل قبلی سناریو را بررسی و تأیید کنید.");return;}
    if (checked.errors.length) {setNotice(checked.errors.join(" "));return;}
    const previous=state.snapshots.filter(s=>s.scenarioId===activeScenario.id&&s.revision===activeScenario.revision&&s.dataSnapshot===dataSnapshot&&JSON.stringify(s.plans)===JSON.stringify(checked.plans)&&JSON.stringify(s.policy)===JSON.stringify(base)).at(-1);
    const snapshot:Snapshot=previous??{id:workspaceId(),scenarioId:activeScenario.id,name:activeScenario.name,revision:activeScenario.revision,createdAt:new Date().toISOString(),dataSnapshot,policy:structuredClone(base),plans:checked.plans};
    const year=checked.plans.some(p=>p.year===activeYear)?activeYear:Math.min(...checked.plans.map(p=>p.year));
    const next=prepareCapital({...serialized(state),lastCapitalYear:year,scenarios:serialized(state).scenarios.map(s=>s.id===activeScenario.id?{...s,reviewed:{...s.reviewed,entry:reviewSignature(base,"entry")}}:s),snapshots:previous?state.snapshots:[...state.snapshots,snapshot],selectedSnapshots:[snapshot.id],conflictChoices:{}});
    try { localStorage.setItem("ips-scenario-workspace-v31",JSON.stringify(serialized(next))); } catch {setNotice("انتقال ذخیره نشد؛ فضای مرورگر کافی نیست. ابتدا فایل پشتیبان را دانلود کنید.");return;}
    setState(next);setActiveYear(year);
    setNotice("سناریو منتقل شد؛ طرح‌های منتخب آماده تکمیل نیاز سرمایه‌اند. اطلاعات مالی نسخه پیشین، در صورت وجود، حفظ شده است.");
    onOpenCapital?.();
  };
  const updateBase = (patch: Partial<BaseState>) =>
    setState((old) => ({ ...old, base: { ...old.base, ...patch }, scenarios:old.scenarios.map(s=>s.id===old.activeScenarioId?{...s,completed:s.completed.filter(x=>x!==stage),revision:s.revision+1,updatedAt:new Date().toISOString()}:s) }));
  const setVision = (key: Horizon, value: number) =>
    setState((old) => ({
      ...old,
      scenarios:old.scenarios.map(s=>s.id===old.activeScenarioId?{...s,revision:s.revision+1,updatedAt:new Date().toISOString()}:s),
      base: {
        ...old.base,
        vision: updateVisionShare(old.base.vision, key, value),
      },
    }));
  const setMission = (id: number, status: string) =>
    setState((old) => {
      const baskets = { ...old.base.baskets };
      const cases = { ...old.capital.cases };
      if (status === "خارج از مأموریت")
        for (const year of YEARS) {
          const next = { ...(baskets[year] ?? {}) };
          for (const key of Object.keys(next)) {
            const item = entryOpportunities.find((row) => row.key === key);
            if (item?.parentId === id) {
              delete next[key];
              delete cases[`${year}:${key}`];
            }
          }
          baskets[year] = next;
        }
      return {
        ...old,
        base: {
          ...old.base,
          mission: { ...old.base.mission, [id]: status },
          baskets,
        },
        capital: { ...old.capital, cases },
        scenarios:old.scenarios.map(s=>s.id===old.activeScenarioId?{...s,revision:s.revision+1,updatedAt:new Date().toISOString()}:s),
      };
    });
  const downloadBackup = (content:string,name:string) => {
    const url=URL.createObjectURL(new Blob([content],{type:"application/json"}));
    if(exportFile)URL.revokeObjectURL(exportFile.url);
    setExportFile({url,name,content});
    const link=document.createElement("a");link.href=url;link.download=name;
    document.body.appendChild(link);link.click();link.remove();
    setLastBackupAt(new Date().toISOString());
    setNotice("درخواست دانلود ارسال شد؛ فایل را در فهرست دانلودهای مرورگر بررسی کنید. در صورت مسدودشدن، از دانلود مجدد استفاده کنید.");
  };
  const backupStamp = () => new Date().toISOString().replace(/[:.]/g,"-");
  const exportPolicy = () => {
    const content=state.recoveryRequired ? localStorage.getItem("ips-workspace-recovery-v34")??"null" : JSON.stringify({...serialized(state),exportedAt:new Date().toISOString(),dataSnapshot},null,2);
    downloadBackup(content,`IPS-پشتیبان-کامل-${backupStamp()}.json`);
  };
  const exportScenario = (id:string) => {
    const backup=scenarioBackup(serialized(state),id);
    const name=backup.scenarios[0].name.replace(/[^\p{L}\p{N} _-]/gu,"_");
    downloadBackup(JSON.stringify({...backup,dataSnapshot},null,2),`IPS-سناریو-${name}-نسخه-${backup.scenarios[0].revision}-${backupStamp()}.json`);
  };
  const manageArchive = (id:string,removed:boolean) => {
    setState(old=>prepareCapital(archiveScenario(serialized(old),id,removed)));
    setStage("mission");setNotice(removed?"سناریو از فهرست فعال و سبد تخصیص کنار گذاشته شد؛ از مدیریت سناریوها قابل بازگردانی است.":"سناریو بازگردانی شد. برای تخصیص، خروجی آن را انتخاب کنید.");
  };
  const openScenarioCapital = () => {
    const snapshot=state.snapshots.filter(s=>s.scenarioId===state.activeScenarioId).at(-1);
    if(!snapshot)return;
    const year=snapshot.plans.some(p=>p.year===activeYear)?activeYear:Math.min(...snapshot.plans.map(p=>p.year));
    const next=prepareCapital({...serialized(state),selectedSnapshots:[snapshot.id],compositionMode:"single",conflictChoices:{},lastCapitalYear:year});
    try{localStorage.setItem("ips-scenario-workspace-v31",JSON.stringify(next));}catch{setNotice("انتقال ذخیره نشد؛ فایل پشتیبان را دانلود کنید.");return;}
    setState(next);setCompositionMode("single");setActiveYear(year);onOpenCapital?.();
  };
  const importPolicy = async (file:File) => {
    try {
      if(file.size>20*1024*1024)throw new Error("حجم فایل بیش از حد مجاز است.");
      const parsed=validateScenarioBackup(JSON.parse(await file.text())) as State;
      setPendingImport({workspace:parsed,filename:file.name});
      setImportMode("merge");
      setEntered(true);setNotice("");
    }catch(error){setNotice(error instanceof Error?error.message:"فایل انتخاب‌شده معتبر نیست.");setEntered(true);}
  };
  const normalizeImported=(raw:State):State=>prepareCapital({...raw,recoveryRequired:false,base:migrateEntryRanks(restoreMovementState(raw.base,rows,masterData) as BaseState),scenarios:raw.scenarios.map(s=>({...s,base:migrateEntryRanks(restoreMovementState(s.base,rows,masterData) as BaseState)})),capital:{...initialCapital(currentPortfolio),...raw.capital}});
  const restoreBackup = () => {
    if(!pendingImport)return;
    try {
      const previous=serialized(state);
      const next=normalizeImported(importMode==="merge"?mergeScenarioBackup(previous,pendingImport.workspace):pendingImport.workspace);
      // Keep a complete recovery point, including frozen decisions, before replacement.
      localStorage.setItem("ips-workspace-before-restore-v37",JSON.stringify(previous));
      localStorage.setItem("ips-scenario-workspace-v31",JSON.stringify(next));
      setState(next);setCompositionMode(next.compositionMode??"single");setActiveYear(next.lastCapitalYear??1406);setCanUndoRestore(true);setPendingImport(null);setStage("mission");
      setNotice(importMode==="merge"?"سناریوها به‌صورت نسخه مستقل اضافه شدند؛ ارقام مالی و تصمیم‌های جاری تغییر نکردند. برای تخصیص، خروجی بازیابی‌شده را انتخاب کنید.":"فایل کامل بازیابی شد؛ سناریوها، خروجی‌ها و پرونده‌های مالی در دسترس‌اند. بازیابی قبلی نیز قابل بازگردانی است.");
    }catch(error){setNotice(error instanceof Error?error.message:"بازیابی انجام نشد؛ اطلاعات جاری محفوظ است.");}
  };
  const undoRestore = () => {
    try {
      const previous=validateScenarioBackup(JSON.parse(localStorage.getItem("ips-workspace-before-restore-v37")??"null")) as State;
      const next=normalizeImported(previous);
      localStorage.setItem("ips-scenario-workspace-v31",JSON.stringify(next));
      setState(next);setCompositionMode(next.compositionMode??"single");setActiveYear(next.lastCapitalYear??1406);setCanUndoRestore(false);localStorage.removeItem("ips-workspace-before-restore-v37");setNotice("اطلاعات پیش از آخرین بازیابی بازگردانده شد.");
    }catch{setNotice("بازگردانی انجام نشد؛ اطلاعات جاری حفظ شده است.");}
  };
  const downloadReady = exportFile && <div className="scenario-download-ready" role="status"><div><b>درخواست دانلود فایل پشتیبان ارسال شد</b><span>{exportFile.name}</span></div><a href={exportFile.url} download={exportFile.name}>دانلود مجدد فایل</a><button onClick={()=>{URL.revokeObjectURL(exportFile.url);setExportFile(null);}}>بستن</button><details><summary>مشاهده محتوای فایل برای کپی دستی</summary><textarea aria-label="محتوای فایل پشتیبان" readOnly value={exportFile.content}/></details></div>;
  const importDialog = pendingImport && <div className="scenario-restore-overlay"><section ref={restoreDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="scenario-restore-title" className="scenario-restore-panel"><header><Upload/><h2 id="scenario-restore-title">بازیابی سناریوها</h2></header><p>{pendingImport.filename}</p><div className="scenario-import-overview"><b>{pendingImport.workspace.backupScope==="scenario"?"فایل یک سناریو":"پشتیبان کامل"}</b><span>قالب داده سازگار با نسخه ۳۱ · تاریخ خروجی: {pendingImport.workspace.exportedAt?new Date(pendingImport.workspace.exportedAt).toLocaleString("fa-IR",{timeZone:"Asia/Tehran"}):"در فایل ثبت نشده"}</span><span>سناریوها: {pendingImport.workspace.scenarios.map(s=>s.name).join("، ")}</span><span>سال‌های مالی: {Object.keys(pendingImport.workspace.capital.financialByYear).map(y=>Number(y).toLocaleString("fa-IR",{useGrouping:false})).join("، ")||"ثبت نشده"}</span><small>در حالت افزودن، اطلاعات مالی عمومی و تصمیم‌های فعلی جایگزین نمی‌شوند. جایگزینی کامل، همه اطلاعات جاری را تغییر می‌دهد و نقطه بازگشت ایجاد می‌کند.</small></div><div className="scenario-backup-stats"><span><b>{pendingImport.workspace.scenarios.length.toLocaleString("fa-IR")}</b> سناریو</span><span><b>{pendingImport.workspace.snapshots.length.toLocaleString("fa-IR")}</b> خروجی ثبت‌شده</span><span><b>{Object.keys(pendingImport.workspace.capital.cases).length.toLocaleString("fa-IR")}</b> پرونده مالی</span></div><label><input type="radio" name="restoreMode" checked={importMode==="merge"} onChange={()=>setImportMode("merge")}/><span><b>افزودن سناریوها به اطلاعات جاری</b><small>سناریوها و پرونده‌های وابسته با شناسه مستقل اضافه می‌شوند. منابع سالانه، طرح‌های مستقل و تصمیم‌های جاری تغییر نمی‌کنند.</small></span></label><label><input type="radio" name="restoreMode" checked={importMode==="replace"} onChange={()=>setImportMode("replace")}/><span><b>بازیابی کامل و جایگزینی اطلاعات جاری</b><small>همه سناریوها، منابع، پرونده‌ها و تصمیم‌های ثبت‌شده فایل بازیابی می‌شوند. اطلاعات قبل از بازیابی برای بازگردانی نگهداری می‌شود.</small></span></label><footer><button onClick={restoreBackup}>تأیید بازیابی</button><button onClick={()=>setPendingImport(null)}>انصراف</button><button onClick={exportPolicy}>دانلود پشتیبان اطلاعات جاری</button></footer>{notice&&<p role="alert">{notice}</p>}</section></div>;

  if(!ready)return <main className="capital-route" dir="rtl"><p role="status">در حال بازیابی سناریوها و پرونده‌های ذخیره‌شده…</p></main>;

  if (mode === "capital")
    return (
      <main className="capital-route" dir="rtl">
        {importDialog}
        {downloadReady}
        {notice&&<p className="movement-notice" role="status">{notice}</p>}
        {canUndoRestore&&<button className="scenario-undo" onClick={undoRestore}>بازگردانی اطلاعات پیش از آخرین بازیابی</button>}
        {state.recoveryRequired&&<div className="capital-blocked" role="alert">داده ذخیره‌شده نیازمند بازیابی است. نسخه اصلی حفظ شده و ذخیره خودکار متوقف است؛ از ورود فایل استفاده کنید.</div>}
        <section className="capital-route-hero">
          <div className="capital-route-mark">
            <Landmark />
            <span>۰۴</span>
          </div>
          <div>
            <span>مسیر اجرایی سرمایه‌گذاری</span>
            <h1>تخصیص راهبردی سرمایه و منابع</h1>
            <p>
              تبدیل برنامه ورود فرصت‌ها به تصمیم قابل اجرا، با کنترل ظرفیت مالی،
              ترتیب منابع و شروط اجرای هر طرح.
            </p>
          </div>
          <aside>
            <b>{capitalPlans.length.toLocaleString("fa-IR")}</b>
            <span>فرصت منتخب در سال {activeYear.toLocaleString("fa-IR", { useGrouping: false })}</span>
          </aside>
        </section>
        <section className="scenario-handoff">
          <details open className="scenario-source-picker"><summary>انتخاب و مدیریت خروجی سناریوها · {selectedSnapshots.map(s=>s.name).join("، ")||"پروژه‌های مستقل"}</summary>
          <div className="evaluation-mode"><span>نوع ارزیابی</span><button className={compositionMode==="single"?"active":""} onClick={()=>{setCompositionMode("single");setState(old=>prepareCapital({...old,compositionMode:"single",selectedSnapshots:old.selectedSnapshots.slice(-1),conflictChoices:{}}));}}>سناریوی مستقل</button><button className={compositionMode==="combined"?"active":""} onClick={()=>{setCompositionMode("combined");setState(old=>({...old,compositionMode:"combined"}));}}>اجرای همزمان سبد مشترک</button><small>برای مقایسه گزینه‌های جایگزین، از جدول مقایسه استفاده کنید؛ سبد مشترک یعنی اجرای همزمان طرح‌ها. از هر سناریو فقط یک نسخه وارد سبد می‌شود.</small></div>
          <header><h2>سبد سناریوهای منتخب</h2><p>یک سناریو برای ارزیابی مستقل، یا چند خروجی برای ارزیابی سبد مشترک انتخاب کنید. ظرفیت مالی سال فقط یک‌بار منظور می‌شود.</p></header>
          <details className="scenario-draft-status"><summary>وضعیت انتقال سناریوها</summary>{serialized(state).scenarios.filter(s=>!(state.archivedScenarioIds??[]).includes(s.id)).map(s=><p key={s.id}><b>{s.name}</b> — {state.snapshots.some(x=>x.scenarioId===s.id&&x.revision===s.revision)?"خروجی نسخه جاری منتقل شده است":s.completed.length<4?`در انتظار تأیید مراحل؛ ${s.completed.length.toLocaleString("fa-IR")} از ۴ مرحله تأیید شده`:"مراحل تأیید شده‌اند؛ انتقال نهایی هنوز انجام نشده است"}</p>)}</details><div className="snapshot-options">{state.snapshots.filter(snapshot=>!(state.archivedScenarioIds??[]).includes(snapshot.scenarioId)).map(snapshot=><label key={snapshot.id}><input type="checkbox" checked={state.selectedSnapshots.includes(snapshot.id)} onChange={e=>selectSnapshots(e.target.checked?[...state.selectedSnapshots,snapshot.id]:state.selectedSnapshots.filter(id=>id!==snapshot.id))}/><span><b>{snapshot.name}</b><small>نسخه {snapshot.revision.toLocaleString("fa-IR")} · {new Date(snapshot.createdAt).toLocaleDateString("fa-IR")} · {snapshot.plans.length.toLocaleString("fa-IR")} انتخاب سالانه</small></span></label>)}</div>
          {!state.snapshots.some(s=>!(state.archivedScenarioIds??[]).includes(s.scenarioId)) && <p>خروجی سناریو پس از تأیید چهار مرحله مسیر حرکت در اینجا قرار می‌گیرد. ثبت پروژه مستقل نیز در دسترس است.</p>}
          </details>
          {merged.conflicts.map(conflict=><label className="scenario-conflict" key={conflict.key}><span>تعارض برنامه «{conflict.name}»؛ مرجع این ارزیابی را مشخص کنید</span><select aria-label={`مرجع ${conflict.name}`} value={state.conflictChoices[conflict.key]??""} onChange={e=>setState(old=>prepareCapital({...old,conflictChoices:{...old.conflictChoices,[conflict.key]:e.target.value}}))}><option value="">انتخاب مرجع</option>{conflict.options.map(option=><option key={option.snapshotId} value={option.snapshotId}>{option.scenarioName} · نسخه {state.snapshots.find(s=>s.id===option.snapshotId)?.revision.toLocaleString("fa-IR")} · {option.priorityRank?`رتبه ورود ${fa(option.priorityRank,0)}`:`سهم تاریخی ${fa(option.share)} درصد`} · امتیاز ورود {fa(option.entryPriority)}</option>)}</select></label>)}
          {merged.conflicts.length>0 && <strong>تا تعیین مرجع تعارض‌ها، اجرای تخصیص این سبد متوقف است.</strong>}
          <small>پروژه‌های مستقل در همه ارزیابی‌ها مشترک‌اند؛ پرونده‌های سناریویی برای هر سبد جدا نگهداری می‌شوند. در سبد مشترک، درصدهای برنامه ورود سهم مالی جدید تولید نمی‌کنند؛ تخصیص بر نیاز ریالی پرونده‌ها انجام می‌شود.</small>
        </section>
        {state.snapshots.length>0&&<ScenarioCapitalComparison sourcePolicies={state.capital.sourcePolicies} liquidityPoliciesByYear={state.capital.liquidityPoliciesByYear} snapshots={state.snapshots.filter(s=>!(state.archivedScenarioIds??[]).includes(s.scenarioId))} year={activeYear} cases={state.capital.cases} financial={state.capital.financialByYear[activeYear]??{}} actions={Object.values(state.capital.portfolioActions)}/>}
        <section className="capital-route-surface">
          <CapitalAllocation
            activeYear={activeYear}
            onYear={year=>{setActiveYear(year);setState(old=>({...old,lastCapitalYear:year}));}}
            plans={capitalPlans}
            portfolio={currentPortfolio}
            state={{...state.capital,cases:runCases}}
            runKey={runKey}
            blocked={merged.conflicts.length>0}
            blockedYears={yearMerges.filter(m=>m.conflicts.length>0).map(m=>m.year)}
            contextName={selectedSnapshots.map(s=>s.name).join(" + ") || "پروژه‌های مستقل"}
            onState={(capital) => setState((old) => {
              const retained=Object.fromEntries(Object.entries(old.capital.cases).filter(([id])=>!Object.hasOwn(runCases,id)));
              return {...old,capital:{...capital,cases:{...retained,...capital.cases}}};
            })}
            standalone
          />
        </section>
        <footer className="movement-v29-footer capital-route-footer">
          <span>
            <LockKeyhole /> داده‌های تخصیص با برنامه ورود مشترک و در همین مرورگر
            نگهداری می‌شوند.
          </span>
          <div>
            <button onClick={exportPolicy}>
              <Download /> خروجی کامل
            </button>
            <button onClick={() => fileRef.current?.click()}>
              <Upload /> ورود فایل
            </button>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importPolicy(file);
                event.target.value = "";
              }}
            />
          </div>
        </footer>
      </main>
    );

  if (!entered)
    return (
      <> {downloadReady} <JourneyIntro
        onStart={(selected) => {if(selected)setStage(selected);setEntered(true);}}
        onExport={exportPolicy}
        onImport={importPolicy}
        fileRef={fileRef}
        snapshot={dataSnapshot}
      /> </>
    );

  return (
    <main className="movement-v29" dir="rtl">
      {downloadReady}
      {importDialog}
      {canUndoRestore&&<button className="scenario-undo" onClick={undoRestore}>بازگردانی اطلاعات پیش از آخرین بازیابی</button>}
      {state.recoveryRequired&&<div className="capital-blocked" role="alert">داده ذخیره‌شده نیازمند بازیابی است؛ نسخه اصلی حفظ شده و ذخیره خودکار متوقف است. از «ورود فایل» برای بازیابی نسخه معتبر استفاده کنید.</div>}
      <ScenarioControls saveStatus={state.recoveryRequired?"ذخیره متوقف؛ نیازمند بازیابی":saveStatus} lastSavedAt={lastSavedAt} lastBackupAt={lastBackupAt} archivedIds={state.archivedScenarioIds??[]} onArchive={manageArchive} onRename={(id,name)=>{const next=renameScenario(serialized(state),id,name);setState(next);}} onExport={exportScenario} onBackup={exportPolicy} onImport={()=>fileRef.current?.click()} onOpenCapital={openScenarioCapital} scenarios={serialized(state).scenarios} activeId={state.activeScenarioId} onSelect={changeScenario} onCreate={createScenario} onFreeze={()=>setStage("entry")} snapshots={state.snapshots} />
      {!activeScenario ? <div className="scenario-required"><h2>ابتدا نام سناریو را ثبت کنید</h2><p>هر تصمیم و برنامه ورود به همین سناریو تعلق خواهد داشت.</p></div> : <>
      <div className="decision-context"><div><b>{activeScenario.name}</b><span>نسخه {fa(activeScenario.revision,0)} · {STAGES.find(s=>s.id===stage)?.title}</span></div><span className={activeScenario.completed.includes(stage)?"confirmed":"pending"}>{activeScenario.completed.includes(stage)?"تأیید شده":stageInputsReady?"ورودی آماده؛ نیازمند تأیید":"ورودی نیازمند تکمیل"}</span><span>{fa(activeScenario.completed.length,0)} از ۴ مرحله تأیید شده</span></div>
      <MovementMeetingPrint scenario={activeScenario.name} revision={activeScenario.revision} sectors={records} activities={isic.activities as IsicActivity[]} board={base.board} activityBoard={base.activityBoard} weights={isicWeights}/>
      <header className="movement-v29-top">
        <div>
          <span>مسیر حرکت سرمایه‌گذاری</span>
          <h1>{STAGES.find((item) => item.id === stage)?.title}</h1>
        </div>
        <button onClick={() => setEntered(false)}>
          نمای کلی مسیر <ChevronLeft />
        </button>
      </header>
      <nav className="movement-v29-nav">
        {STAGES.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={stage === item.id ? "active" : ""}
              onClick={() => setStage(item.id)}
            >
              <span>{item.number}</span>
              <Icon />
              <div>
                <b>{item.short}</b>
                <small>{activeScenario.completed.includes(item.id)?"تأیید شده":stage===item.id?"در حال بررسی": "نیازمند بررسی"}</small>
              </div>
            </button>
          );
        })}
      </nav>
      {notice && (
        <div className="movement-notice">
          <Check />
          {notice}
          <button onClick={() => setNotice("")}>×</button>
        </div>
      )}

      <section className="movement-decision-queue" aria-label="راهنمای تصمیم مرحله جاری"><div><h3>{stage==="mission"?"ابتدا حدود مأموریت را روشن کنید":stage==="isic"?"آیا جزئیات، نگاه کلان را تأیید می‌کنند؟":stage==="management"?"نظر مدیریت را مستقل از مدل ثبت کنید":"برنامه ورود را برای انتقال آماده کنید"}</h3><p>{stage==="mission"?(missingConditions?`${fa(missingConditions,0)} حوزه مشروط هنوز شرط ورود کامل ندارد.`:"شرط ناقصی ثبت نشده است؛ وضعیت حوزه‌ها را پیش از تأیید مرحله مرور کنید."):stage==="isic"?"امتیاز کلان و تحلیل تفصیلی را جدا بخوانید؛ نبود داده تفصیلی به معنی نامناسب بودن فرصت نیست.":stage==="management"?`${fa(missingOpinions,0)} حوزه مجاز یا مشروط هنوز نظر مدیریتی ثبت‌شده ندارد.`:entryIssues.length?`${fa(entryIssues.length,0)} مورد در برنامه ورود نیازمند اصلاح است؛ رتبه‌های ورود و انتخاب‌های هر سال را بررسی کنید.`:"برنامه ورود از کنترل‌های ساختاری عبور کرده است؛ نسخه سناریو را پس از مرور نهایی ثبت کنید."}</p><small>{stage==="isic"?"سال داده، پوشش شاخص‌ها و کیفیت داده را پیش از مقایسه رتبه‌ها بررسی کنید.":"کامل بودن ورودی با تأیید مدیریتی یکسان نیست؛ ثبت تأیید هر مرحله همچنان ضروری است."}</small></div><div>{stage==="mission"&&<><button onClick={()=>{setMissionFilter("شرط ناقص");setQuery("");}}>مشاهده شرط‌های ناقص</button><button onClick={()=>{setMissionFilter("همه");setQuery("");}}>همه حوزه‌ها</button></>}{stage==="management"&&<><button onClick={()=>{setBoardFilter("بدون نظر");setQuery("");}}>حوزه‌های بدون نظر</button><button onClick={()=>{setBoardFilter("همه");setQuery("");}}>همه حوزه‌ها</button></>}</div></section>
      {(stage==="mission"||stage==="management")&&<section className="decision-filter-bar">
        <label>نمای جدول<select value={stage==="mission"?missionFilter:boardFilter} onChange={e=>{if(stage==="mission")setMissionFilter(e.target.value);else setBoardFilter(e.target.value);setSelectedRows([]);setBulkPending(false);}}>{(stage==="mission"?["همه","مجاز","مشروط","خارج از مأموریت","شرط ناقص"]:["همه","بدون نظر","دارای نظر","اولویت بالا"]).map(v=><option key={v}>{v}</option>)}</select></label>
        <span>{fa(selectedRows.length,0)} حوزه منتخب</span><button onClick={()=>setSelectedRows([])}>پاک‌کردن انتخاب</button>
        <label>تصمیم گروهی<select value={bulkValue} onChange={e=>{setBulkValue(e.target.value);setBulkPending(false);}}>{(stage==="mission"?["مجاز","خارج از مأموریت"]:["1","2","3","4","5"]).map(v=><option value={v} key={v}>{stage==="mission"?v:`اولویت ${fa(Number(v),0)}`}</option>)}</select></label>
        <button disabled={!selectedRows.length} onClick={()=>{if(!bulkPending){setBulkPending(true);return;}if(stage==="mission"){const mission={...base.mission};selectedRows.forEach(id=>mission[id]=bulkValue==="خارج از مأموریت"?bulkValue:"مجاز");const baskets=Object.fromEntries(Object.entries(base.baskets).map(([y,b])=>[y,Object.fromEntries(Object.entries(b).filter(([k,v])=>mission[v.parentId??entryOpportunities.find(o=>o.key===k)?.parentId??-1]!=="خارج از مأموریت"))]));updateBase({mission,baskets});}else{const board={...base.board};selectedRows.forEach(id=>board[id]={score:[1,2,3,4,5].includes(Number(bulkValue))?Number(bulkValue):3,reason:board[id]?.reason??""});updateBase({board});}setBulkPending(false);setSelectedRows([]);setNotice("تصمیم گروهی برای حوزه‌های منتخب ثبت شد؛ امتیازهای علمی تغییر نکردند.");}}>{bulkPending?`تأیید تغییر ${fa(selectedRows.length,0)} حوزه` :"اعمال تصمیم گروهی"}</button>{bulkPending&&<button onClick={()=>setBulkPending(false)}>انصراف</button>}
      </section>}
      <section className="movement-v29-surface">
        {stage === "mission" && (
          <div className="mission-v29">
            <header className="stage-heading">
              <div>
                <span>گام ۰۱ · مقصد و حدود مأموریت</span>
                <h2>جهت‌گیری راهبردی پرتفوی</h2>
                <p>
                  ترکیب هدف، تناسب راهبردی و افق غالب را تغییر می‌دهد؛ امتیاز
                  فرصت مستقل و ثابت باقی می‌ماند.
                </p>
              </div>
              <button onClick={() => setStage("isic")}>
                ارزیابی تفصیلی <ArrowLeft />
              </button>
            </header>
            <section className="vision-command">
              <div className="vision-intro">
                <span>سیاست هدف افق ۱۴۱۴</span>
                <h3>تمرکز سرمایه‌گذاری را تنظیم کنید</h3>
                <p>جمع سه افق همیشه ۱۰۰٪ نگه داشته می‌شود.</p>
                <div className="vision-total">
                  <b>۱۰۰٪</b>
                  <small>ترکیب هدف</small>
                </div>
              </div>
              <div className="vision-controls">
                {HORIZONS.map((horizon) => (
                  <label key={horizon.key} className={horizon.key}>
                    <span>
                      <i />
                      <b>{horizon.label}</b>
                      <strong>
                        {fa(base.vision[horizon.key as Horizon], 0)}٪
                      </strong>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={base.vision[horizon.key as Horizon]}
                      onChange={(event) =>
                        setVision(
                          horizon.key as Horizon,
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
              <div
                className="vision-orbit"
                style={{
                  background: `conic-gradient(#176cb5 0 ${base.vision.core}%,#c89435 ${base.vision.core}% ${base.vision.core + base.vision.adjacent}%,#7558a6 ${base.vision.core + base.vision.adjacent}% 100%)`,
                }}
              >
                <span>
                  <b>{records.length.toLocaleString("fa-IR")}</b>
                  <small>حوزه بازمحاسبه‌شده</small>
                </span>
              </div>
            </section>
            <section className="mission-register">
              <header>
                <div>
                  <span>غربال مأموریتی</span>
                  <h3>وضعیت ۷۷ حوزه سرمایه‌گذاری</h3>
                  <p>
                    این تصمیم امتیاز علمی حوزه را تغییر نمی‌دهد؛ فقط ورود آن به
                    مراحل بعدی را کنترل می‌کند.
                  </p>
                </div>
                <label>
                  <Search />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="جست‌وجوی حوزه…"
                  />
                </label>
              </header>
              <div className="mission-summary">
                {MISSION_OPTIONS.map((option) => (
                  <span key={option}>
                    <b>
                      {records
                        .filter((row) => row.mission === option)
                        .length.toLocaleString("fa-IR")}
                    </b>
                    {option}
                  </span>
                ))}
              </div>
              <div className="movement-table-wrap">
                <table className="movement-table mission-v29-table">
                  <thead>
                    <tr>
                      <th>حوزه</th>
                      <th>امتیاز فرصت</th>
                      <th>تناسب راهبردی</th>
                      <th>افق غالب در سیاست منتخب</th>
                      <th>وضعیت مأموریت</th>
                      <th>شرط ورود</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records
                      .filter(
                        (row) => (!query || row.name.includes(query.trim())) && (missionFilter==="همه" || (missionFilter==="شرط ناقص" ? row.mission==="مشروط"&&!passesMissionGate(row.mission,row.condition) : row.mission===missionFilter)),
                      )
                      .sort((a, b) => b.priority - a.priority)
                      .map((row) => (
                        <tr key={row.id}>
                          <td>
                            <label className="row-selection"><input type="checkbox" aria-label={`انتخاب ${row.name}`} checked={selectedRows.includes(row.id)} onChange={e=>{setSelectedRows(old=>e.target.checked?[...old,row.id]:old.filter(id=>id!==row.id));setBulkPending(false);}}/><b>{row.name}</b></label>
                            <small>رتبه ترکیبی {fa(row.priority, 1)}</small>
                          </td>
                          <td>{fa(row.x, 2)}</td>
                          <td>{fa(row.dynamicY, 2)}</td>
                          <td>
                            <span className={`horizon-tag ${row.horizon}`}>
                              {horizonLabel(row.horizon)}
                            </span>
                          </td>
                          <td>
                            <select
                              value={row.mission}
                              onChange={(event) =>
                                setMission(row.id, event.target.value)
                              }
                            >
                              {MISSION_OPTIONS.map((option) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {row.mission === "مشروط" ? (
                              <div className="mission-condition">
                                <select
                                  value={row.condition.key}
                                  onChange={(event) =>
                                    updateBase({
                                      conditions: {
                                        ...base.conditions,
                                        [row.id]: {
                                          key: event.target.value,
                                          note: row.condition.note,
                                        },
                                      },
                                    })
                                  }
                                >
                                  <option value="">انتخاب شرط…</option>
                                  {CONDITIONS.map((condition) => (
                                    <option key={condition}>{condition}</option>
                                  ))}
                                </select>
                                {row.condition.key === "سایر" && (
                                  <input
                                    value={row.condition.note}
                                    onChange={(event) =>
                                      updateBase({
                                        conditions: {
                                          ...base.conditions,
                                          [row.id]: {
                                            ...row.condition,
                                            note: event.target.value,
                                          },
                                        },
                                      })
                                    }
                                    placeholder="توضیح شرط"
                                  />
                                )}
                              </div>
                            ) : (
                              <span className="mission-no-condition">
                                بدون شرط
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {stage === "isic" && (
          <IsicAnalysis
            rows={rows}
            result={isic as IsicResult}
            baseline={baseline as IsicResult}
            preset={base.isicPreset}
            weights={isicWeights}
            customWeights={base.customWeights}
            onPreset={(isicPreset) => updateBase({ isicPreset })}
            onCustom={(key, value) =>
              updateBase({
                customWeights: normalizeWeights({
                  ...base.customWeights,
                  [key]: value,
                }),
                isicPreset: "custom",
              })
            }
            onNext={() => {
              setStage("management");
              setStage("management");
            }}
          />
        )}

        {(stage === "management" || stage === "entry") && (
          <div className="management-v29">
            <header className="stage-heading">
              <div>
                <span>{stage === "entry" ? "گام ۰۴ · نقشه ورود چندساله" : "گام ۰۳ · قضاوت مدیریتی"}</span>
                <h2>{stage === "entry" ? "برنامه ورود سرمایه‌گذاری" : "اولویت‌های راهبردی مدیریت"}</h2>
                <p>
                  نظر هیئت‌مدیره مستقل از مدل علمی ثبت می‌شود و سپس همراه دو
                  شاهد تحلیلی، اولویت ورود را می‌سازد.
                </p>
              </div>
            </header>
            {stage === "management" && (
              <section className="management-priority">
                <div className="management-toolbar">
                  <div>
                    <h3>نظر مستقل مدیریت درباره ۷۷ حوزه</h3>
                    <p>
                      «بدون نظر» معادل صفر نیست و از محاسبه اولویت ورود کنار
                      گذاشته می‌شود.
                    </p>
                  </div>
                  <label>
                    <Search />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="جست‌وجوی حوزه…"
                    />
                  </label>
                </div>
                <div className="management-definition">
                  <CircleHelp />
                  <span>
                    <b>امتیاز حوزه در مدل ۷۷ بخشی</b> امتیاز ترکیبی حوزه از نظر
                    جذابیت فرصت و تناسب راهبردی با پرتفوی؛ این امتیاز شامل
                    ارزیابی تفصیلی زیر‌بخش‌ها نیست.
                  </span>
                </div>
                <div className="movement-table-wrap">
                  <table className="movement-table management-v29-table">
                    <thead>
                      <tr>
                        <th>حوزه</th>
                        <th title="امتیاز ترکیبی حوزه از نظر جذابیت فرصت و تناسب راهبردی با پرتفوی؛ این امتیاز شامل ارزیابی تفصیلی زیر‌بخش‌ها نیست.">
                          امتیاز حوزه در مدل ۷۷ بخشی (?)
                        </th>
                        <th>افق غالب</th>
                        <th>تحلیل تفصیلی</th>
                        <th>اولویت مدیریت</th>
                        <th>دلیل ترجیح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records
                        .filter(
                          (row) => (!query || row.name.includes(query.trim())) && (boardFilter==="همه" || (boardFilter==="بدون نظر" ? base.board[row.id]?.score==null : boardFilter==="اولویت بالا" ? (base.board[row.id]?.score??0)>=4 : base.board[row.id]?.score!=null)),
                        )
                        .sort((a, b) => b.priority - a.priority)
                        .map((row) => {
                          const childRows = children.get(row.id) ?? [];
                          return (
                            <Fragment key={row.id}>
                              <tr
                                className={
                                  childRows.length ? "has-children" : ""
                                }
                              >
                                <td>
                                  <div className="management-name">
                                    {childRows.length ? (
                                      <button
                                        onClick={() =>
                                          setExpanded(
                                            expanded === row.id ? null : row.id,
                                          )
                                        }
                                      >
                                        {expanded === row.id ? (
                                          <ChevronDown />
                                        ) : (
                                          <ChevronLeft />
                                        )}
                                      </button>
                                    ) : (
                                      <span />
                                    )}
                                    <div>
                                      <label className="row-selection"><input type="checkbox" aria-label={`انتخاب ${row.name}`} checked={selectedRows.includes(row.id)} onChange={e=>{setSelectedRows(old=>e.target.checked?[...old,row.id]:old.filter(id=>id!==row.id));setBulkPending(false);}}/><b>{row.name}</b></label>
                                      <small>{row.mission}</small>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <strong className="movement-score">
                                    {fa(row.priority)}
                                  </strong>
                                </td>
                                <td>
                                  <span
                                    className={`horizon-tag ${row.horizon}`}
                                  >
                                    {horizonLabel(row.horizon)}
                                  </span>
                                </td>
                                <td>
                                  {childRows.length ? (
                                    <span className="data-status ready">
                                      {childRows.length.toLocaleString("fa-IR")}{" "}
                                      زیر‌بخش
                                    </span>
                                  ) : (
                                    <span className="data-status muted">
                                      فاقد داده تفصیلی
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <BoardSelect
                                    value={base.board[row.id]?.score ?? null}
                                    onChange={(score) =>
                                      updateBase({
                                        board: {
                                          ...base.board,
                                          [row.id]: {
                                            score,
                                            reason:
                                              base.board[row.id]?.reason ?? "",
                                          },
                                        },
                                      })
                                    }
                                    label={`اولویت ${row.name}`}
                                  />
                                </td>
                                <td>
                                  <input
                                    value={base.board[row.id]?.reason ?? ""}
                                    onChange={(event) =>
                                      updateBase({
                                        board: {
                                          ...base.board,
                                          [row.id]: {
                                            score:
                                              base.board[row.id]?.score ?? null,
                                            reason: event.target.value,
                                          },
                                        },
                                      })
                                    }
                                    placeholder="دلیل کوتاه، اختیاری"
                                  />
                                </td>
                              </tr>
                              {expanded === row.id &&
                                childRows
                                  .sort(
                                    (a, b) => (b.score ?? -1) - (a.score ?? -1),
                                  )
                                  .map((child) => (
                                    <tr
                                      key={child.code}
                                      className="management-child"
                                    >
                                      <td>
                                        <span className="entry-branch" />
                                        <b>{activityName(child)}</b>
                                      </td>
                                      <td>
                                        <span>امتیاز تفصیلی</span>
                                        <strong>{fa(child.score)}</strong>
                                      </td>
                                      <td colSpan={2}>
                                        <span className="parent-badge">
                                          {row.name}
                                        </span>
                                      </td>
                                      <td>
                                        <BoardSelect
                                          value={
                                            base.activityBoard[child.code]
                                              ?.score ?? null
                                          }
                                          onChange={(score) =>
                                            updateBase({
                                              activityBoard: {
                                                ...base.activityBoard,
                                                [child.code]: {
                                                  score,
                                                  reason:
                                                    base.activityBoard[
                                                      child.code
                                                    ]?.reason ?? "",
                                                },
                                              },
                                            })
                                          }
                                          label={`اولویت ${activityName(child)}`}
                                        />
                                      </td>
                                      <td>
                                        <input
                                          value={
                                            base.activityBoard[child.code]
                                              ?.reason ?? ""
                                          }
                                          onChange={(event) =>
                                            updateBase({
                                              activityBoard: {
                                                ...base.activityBoard,
                                                [child.code]: {
                                                  score:
                                                    base.activityBoard[
                                                      child.code
                                                    ]?.score ?? null,
                                                  reason: event.target.value,
                                                },
                                              },
                                            })
                                          }
                                          placeholder="دلیل مستقل زیر‌بخش"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                            </Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <footer className="management-next">
                  <div>
                    <ShieldCheck />
                    <span>
                      نظر حوزه مادر و زیر‌بخش مستقل است و هیچ‌کدام جای امتیاز
                      علمی را نمی‌گیرد.
                    </span>
                  </div>
                  <button onClick={() => setStage("entry")}>
                    برنامه‌ریزی ورود <ArrowLeft />
                  </button>
                </footer>
              </section>
            )}
            {stage === "entry" && (
              <EntryPlanning
                baskets={base.baskets}
                opportunities={entryOpportunities}
                activeYear={activeYear}
                onYear={setActiveYear}
                weights={base.selectionWeights}
                onWeights={(selectionWeights) =>
                  updateBase({ selectionWeights })
                }
                plan={plan}
                onAdd={(item) =>
                  updateBase({
                    baskets: {
                      ...base.baskets,
                      [activeYear]: {
                        ...plan,
                        [item.key]: { share: 0, priorityRank:Math.max(0,...Object.values(plan).map(v=>v.priorityRank??0))+1, parentId: item.parentId },
                      },
                    },
                  })
                }
                onRemove={(key) =>
                  setState((old) => {
                    const nextPlan = {
                      ...(old.base.baskets[activeYear] ?? {}),
                    };
                    delete nextPlan[key];
                    const cases = { ...old.capital.cases };
                    delete cases[`${activeYear}:${key}`];
                    return {
                      ...old,
                      base: {
                        ...old.base,
                        baskets: {
                          ...old.base.baskets,
                          [activeYear]: nextPlan,
                        },
                      },
                      capital: { ...old.capital, cases },
                    };
                  })
                }
                onRank={(key, priorityRank) =>
                  updateBase({
                    baskets: {
                      ...base.baskets,
                      [activeYear]: { ...plan, [key]: { ...plan[key], priorityRank } },
                    },
                  })
                }
              />
            )}
          </div>
        )}

      </section>
      <div className="scenario-stage-confirm"><span>{activeScenario.completed.includes(stage) ? "این مرحله تأیید شده است؛ پس از هر اصلاح بازبینی کنید." : "پس از بررسی ورودی‌ها، این مرحله را تأیید کنید."}</span><button onClick={()=>{if(state.recoveryRequired){setNotice("ابتدا داده معتبر را بازیابی کنید.");return;}if(stage==="mission"&&!stageInputsReady){setNotice("شرط ورود حوزه‌های مشروط را تکمیل کنید.");setMissionFilter("شرط ناقص");return;}if(stage==="entry"){freezeScenario(true);return;}setState(old=>({...old,scenarios:old.scenarios.map(s=>s.id===old.activeScenarioId?{...s,completed:[...new Set([...s.completed,stage])],reviewed:{...s.reviewed,[stage]:reviewSignature(old.base,stage)},updatedAt:new Date().toISOString()}:s)})); const next=STAGES[STAGES.findIndex(s=>s.id===stage)+1];if(next)setStage(next.id);}}>{stage === "entry" ? "تأیید و انتقال به تخصیص سرمایه" : "تأیید مرحله و ادامه"} <ArrowLeft/></button></div>
      </>}
      <footer className="movement-v29-footer">
        <span>
          <LockKeyhole /> تصمیم‌ها در مرورگر شما ذخیره می‌شوند.
        </span>
        <div>
          <button onClick={exportPolicy}>
            <Download /> خروجی کامل
          </button>
          <button onClick={() => fileRef.current?.click()}>
            <Upload /> ورود فایل
          </button>
          <input
            ref={fileRef}
            hidden
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importPolicy(file);
              event.target.value = "";
            }}
          />
        </div>
      </footer>
    </main>
  );
}
