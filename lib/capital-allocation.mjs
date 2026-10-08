/**
 * موتور تخصیص سرمایه IPS — نگاشت مستقیم مدل شفاف v13.
 * واحد همه مبالغ: میلیارد تومان. نرخ‌ها به‌صورت اعشاری (مثلاً 0.32) نگهداری می‌شوند.
 */
export const CAPITAL_YEARS = Object.freeze(Array.from({ length: 9 }, (_, index) => 1406 + index));

export const FUNDING_SOURCES = Object.freeze({
  internal: { label: "منابع داخلی", debt: false },
  shortDebt: { label: "اعتبار کوتاه‌مدت", debt: true },
  longDebt: { label: "بدهی میان/بلندمدت", debt: true },
  partner: { label: "آورده سرمایه‌ای سهامداران و شرکا", debt: false },
  disposal: { label: "مولدسازی / واگذاری", debt: false },
});

export const NEED_TYPES = Object.freeze([
  "سرمایه در گردش",
  "نگهداشت / نوسازی / الزامات",
  "توسعه / CAPEX رشد",
  "تملک / سرمایه‌گذاری راهبردی",
  "تقویت ساختار مالی",
  "سرمایه‌گذاری مالی / پرتفویی",
]);

export const ENTRY_METHODS = Object.freeze([
  "احداث",
  "توسعه شرکت موجود",
  "تملک",
  "مشارکت",
  "سرمایه‌گذاری مالی",
  "سایر",
]);

export const SOURCE_WATERFALL = Object.freeze({
  // همه خانواده‌های تأمین مالی برای هر نیاز در دسترس‌اند؛ ترتیب فقط تقدم مصرف را تعیین می‌کند.
  "سرمایه در گردش": ["shortDebt", "internal", "partner", "longDebt", "disposal"],
  "نگهداشت / نوسازی / الزامات": ["internal", "disposal", "longDebt", "partner", "shortDebt"],
  "توسعه / CAPEX رشد": ["longDebt", "internal", "partner", "disposal", "shortDebt"],
  "تملک / سرمایه‌گذاری راهبردی": ["partner", "internal", "longDebt", "disposal", "shortDebt"],
  "تقویت ساختار مالی": ["disposal", "partner", "internal", "longDebt", "shortDebt"],
  "سرمایه‌گذاری مالی / پرتفویی": ["internal", "disposal", "partner", "longDebt", "shortDebt"],
});

/** Legacy saved policies are completed with any newly approved source, without changing their existing order. */
export function normalizedSourceOrder(needType, order) {
  const baseline = SOURCE_WATERFALL[needType];
  if (!baseline) return [];
  const valid = Array.isArray(order)
    ? order.filter((source, index) => baseline.includes(source) && order.indexOf(source) === index)
    : [];
  return [...valid, ...baseline.filter((source) => !valid.includes(source))];
}

export const DEFAULT_FINANCIAL_INPUT = Object.freeze({
  cashStart: 0,
  reliableInflows: 0,
  requiredPayments: 0,
  debtRepayment: 0,
  dividends: 0,
  priorCommitments: 0,
  minimumCashReserve: 0,
  shortDebtCapacity: 0,
  shortDebtRate: 0,
  longDebtCapacity: 0,
  longDebtRate: 0,
  totalNewDebtCeiling: 0,
  partnerCapacity: 0,
  shortDebtIncludedInInflows: 0,
  longDebtIncludedInInflows: 0,
  partnerIncludedInInflows: 0,
  disposalIncludedInInflows: 0,
});

/** Core fields must be explicitly present before finance can be confirmed. Zero is valid; absence is not. */
export const REQUIRED_FINANCIAL_FIELDS = Object.freeze([
  "cashStart",
  "reliableInflows",
  "requiredPayments",
  "debtRepayment",
  "dividends",
  "priorCommitments",
  "minimumCashReserve",
  "shortDebtCapacity",
  "shortDebtRate",
  "longDebtCapacity",
  "longDebtRate",
  "totalNewDebtCeiling",
  "partnerCapacity",
]);

export const V13_SAMPLE_FINANCIAL_INPUT = Object.freeze({
  cashStart: 700,
  reliableInflows: 1000,
  requiredPayments: 300,
  debtRepayment: 150,
  dividends: 250,
  priorCommitments: 100,
  minimumCashReserve: 300,
  shortDebtCapacity: 600,
  shortDebtRate: 0.32,
  longDebtCapacity: 500,
  longDebtRate: 0.34,
  totalNewDebtCeiling: 900,
  partnerCapacity: 400,
});

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const nonnegative = (value) => Math.max(0, number(value));
const round = (value) => Math.round((number(value) + Number.EPSILON) * 1e8) / 1e8;

export const TRACE_REASONS = Object.freeze({
  not_needed: "نیاز قبلاً تأمین شده؛ استفاده از این منبع لازم نبود.",
  source_ineligible: "این منبع طبق سیاست ثبت‌شده برای این نوع نیاز مجاز نیست.",
  liquidity_restricted: "این منبع در مجوز تأمین محدود به طرح انتخاب نشده است.",
  rate_exceeded: "نرخ منبع از سقف نرخ قابل تحمل طرح بیشتر است.",
  no_capacity: "ظرفیت قابل اتکا برای این منبع ثبت نشده یا صفر است.",
  source_reserved: "مانده این منبع برای تعهد طرح‌های دیگر رزرو است.",
  source_consumed: "ظرفیت این منبع در طرح‌های مقدم یا مراحل قبلی مصرف شده است.",
  debt_ceiling: "سقف مشترک بدهی با مصرف یا رزرو قبلی پر شده است.",
  dedicated_limit: "سقف مبلغ منبع اختصاصی اجازه تخصیص بیشتر نمی‌دهد.",
  partial_reserved: "بخشی از ظرفیت منبع برای طرح‌های دیگر رزرو است؛ فقط مانده آزاد تخصیص یافت.",
  partial_capacity: "مانده منبع از نیاز طرح کمتر بود؛ تخصیص به همان مانده محدود شد.",
  partial_debt_ceiling: "سقف باقی‌مانده بدهی اجازه تأمین کل نیاز از این منبع را نداد.",
  partial_dedicated_limit: "این مرحله به مبلغ منبع اختصاصی ثبت‌شده محدود شد؛ باقی نیاز از منابع بعدی بررسی می‌شود.",
});
function blockedTrace(need, reasonCode, note) {
  return {stage:"کنترل پیش از تخصیص",source:null,needBefore:need,nominalCapacity:0,previousUse:0,remainingDebtCeiling:0,usableCapacity:0,rate:null,rateAllowed:true,allocation:0,finalAllocation:0,releasedAllocation:0,needAfter:need,status:"blocked",reasonCode,constraints:[reasonCode],note};
}

export function validateFinancialInput(input = {}) {
  const errors = [];
  for (const key of REQUIRED_FINANCIAL_FIELDS) {
    if (!Object.hasOwn(input, key) || input[key] === "" || input[key] == null) {
      errors.push(`ورودی مالی «${key}» تعیین نشده است.`);
      continue;
    }
    if (!Number.isFinite(Number(input[key])) || Number(input[key]) < 0) errors.push(`ورودی مالی «${key}» نامعتبر است.`);
  }
  for (const key of ["shortDebtRate", "longDebtRate"]) {
    if (Object.hasOwn(input, key) && Number.isFinite(Number(input[key])) && Number(input[key]) > 1) errors.push(`نرخ «${key}» باید حداکثر صددرصد باشد.`);
  }
  for (const key of ["shortDebtIncludedInInflows", "longDebtIncludedInInflows", "partnerIncludedInInflows", "disposalIncludedInInflows"]) {
    if (input[key] != null && input[key] !== "" && (!Number.isFinite(Number(input[key])) || Number(input[key]) < 0)) errors.push(`هم‌پوشانی منبع «${key}» نامعتبر است.`);
  }
  const overlapRules = [
    ["shortDebtIncludedInInflows", "shortDebtCapacity"],
    ["longDebtIncludedInInflows", "longDebtCapacity"],
    ["partnerIncludedInInflows", "partnerCapacity"],
  ];
  for (const [overlap, capacity] of overlapRules) if (nonnegative(input[overlap]) > nonnegative(input[capacity]) + 1e-8) errors.push(`مبلغ منظورشده در ورود نقد از ظرفیت منبع «${capacity}» بیشتر است.`);
  const totalOverlap = ["shortDebtIncludedInInflows", "longDebtIncludedInInflows", "partnerIncludedInInflows", "disposalIncludedInInflows"].reduce((sum, key) => sum + nonnegative(input[key]), 0);
  if (totalOverlap > nonnegative(input.reliableInflows) + 1e-8) errors.push("جمع منابعی که قبلاً در ورود نقد منظور شده‌اند از ورود نقد قابل اتکا بیشتر است.");
  if (nonnegative(input.shortDebtIncludedInInflows)+nonnegative(input.longDebtIncludedInInflows)>nonnegative(input.totalNewDebtCeiling)+1e-8) errors.push("بدهی جدید منظورشده در ورود نقد از سقف کل بدهی جدید سال بیشتر است.");
  return { valid: errors.length === 0, complete: REQUIRED_FINANCIAL_FIELDS.every((key) => Object.hasOwn(input, key) && input[key] !== "" && input[key] != null), errors };
}

export function computeFinancialCapacity(input = {}) {
  const data = { ...DEFAULT_FINANCIAL_INPUT, ...input };
  const cashAfterPayments =
    nonnegative(data.cashStart) +
    nonnegative(data.reliableInflows) -
    nonnegative(data.requiredPayments) -
    nonnegative(data.debtRepayment) -
    nonnegative(data.dividends) -
    nonnegative(data.priorCommitments);
  const internal = Math.max(0, cashAfterPayments - nonnegative(data.minimumCashReserve));
  const reserveShortfall = Math.max(0, nonnegative(data.minimumCashReserve) - cashAfterPayments);
  // Amounts already included in reliable inflows cannot be allocated a second time.
  const shortDebt = Math.max(0, nonnegative(data.shortDebtCapacity) - nonnegative(data.shortDebtIncludedInInflows));
  const longDebt = Math.max(0, nonnegative(data.longDebtCapacity) - nonnegative(data.longDebtIncludedInInflows));
  const debtCeilingGross = nonnegative(data.totalNewDebtCeiling);
  const debtAlreadyDrawn = nonnegative(data.shortDebtIncludedInInflows)+nonnegative(data.longDebtIncludedInInflows);
  const debtCeiling = Math.max(0,debtCeilingGross-debtAlreadyDrawn);
  const effectiveDebt = Math.min(shortDebt + longDebt, debtCeiling);
  return {
    cashAfterPayments: round(cashAfterPayments),
    internal: round(internal),
    reserveShortfall: round(reserveShortfall),
    shortDebt: round(shortDebt),
    shortDebtRate: nonnegative(data.shortDebtRate),
    longDebt: round(longDebt),
    longDebtRate: nonnegative(data.longDebtRate),
    debtCeiling: round(debtCeiling),
    debtCeilingGross: round(debtCeilingGross),
    debtAlreadyDrawn: round(debtAlreadyDrawn),
    effectiveDebt: round(effectiveDebt),
    partner: round(Math.max(0, nonnegative(data.partnerCapacity) - nonnegative(data.partnerIncludedInInflows))),
    overlaps: {
      shortDebt: round(nonnegative(data.shortDebtIncludedInInflows)),
      longDebt: round(nonnegative(data.longDebtIncludedInInflows)),
      partner: round(nonnegative(data.partnerIncludedInInflows)),
      disposal: round(nonnegative(data.disposalIncludedInInflows)),
    },
  };
}

/** Planned proceeds remain visible but are not allocatable. */
export function reliableDisposalCapacity(actions = [], year) {
  return round(
    actions
      .filter((item) => Number(item.year) === Number(year) && ["کاهش سهم", "واگذاری / خروج"].includes(item.action))
      .filter((item) => ["قابل اتکا", "محقق‌شده"].includes(item.status))
      .reduce((sum, item) => sum + nonnegative(item.reliableProceeds), 0),
  );
}

const projectFamilyKey = (project) => `${project?.sourceKind ?? "legacy"}|${project?.runKey ?? ""}|${project?.opportunityKey ?? project?.id ?? ""}`;

export function validateInvestmentCase(project, allProjects = [project], tolerance = 0.01) {
  const errors = [];
  if (!CAPITAL_YEARS.includes(Number(project?.year))) errors.push("سال نامعتبر است.");
  if (!String(project?.name ?? "").trim()) errors.push("نام فرصت الزامی است.");
  if (!NEED_TYPES.includes(project?.needType)) errors.push("نوع نیاز معتبر نیست.");
  if (!(number(project?.annualNeed) > 0)) errors.push("نیاز مالی سال باید بزرگ‌تر از صفر باشد.");
  const hasExplicitTotal = Object.hasOwn(project ?? {}, "totalNeed");
  if (hasExplicitTotal && !(number(project?.totalNeed) > 0)) errors.push("نیاز مالی کل باید بزرگ‌تر از صفر باشد.");
  if (hasExplicitTotal && number(project?.annualNeed) > number(project?.totalNeed) + tolerance) errors.push("نیاز مالی سال از نیاز مالی کل بیشتر است.");
  if (hasExplicitTotal && number(project?.totalNeed) > 0) {
    const family = allProjects.filter((item) => projectFamilyKey(item) === projectFamilyKey(project));
    const totals = [...new Set(family.map((item) => number(item.totalNeed)).filter((value) => value > 0).map((value) => round(value)))];
    if (totals.length > 1) errors.push("نیاز مالی کل این طرح بین سال‌ها یکسان نیست.");
    const scheduled = family.reduce((sum, item) => sum + nonnegative(item.annualNeed), 0);
    if (scheduled > number(project.totalNeed) + tolerance) errors.push("مجموع نیازهای سالانه این طرح از نیاز مالی کل بیشتر است.");
  }
  if (project?.stageable && !(number(project?.minimumExecution) > 0 && number(project?.minimumExecution) <= 1)) errors.push("حداقل اجرای پروژه مرحله‌ای باید بین صفر و صددرصد باشد.");
  if (project?.maximumRate != null && project.maximumRate !== "" && !(number(project.maximumRate) > 0 && number(project.maximumRate) <= 1)) errors.push("حداکثر نرخ قابل تحمل معتبر نیست.");
  if (project?.dedicatedSource && !Object.hasOwn(FUNDING_SOURCES, project.dedicatedSource)) errors.push("منبع اختصاصی معتبر نیست.");
  if (project?.dedicatedSource && !(number(project?.dedicatedAmount) > 0)) errors.push("مبلغ منبع اختصاصی باید وارد شود.");
  if (!project?.dedicatedSource && number(project?.dedicatedAmount) > 0) errors.push("برای مبلغ اختصاصی، منبع را انتخاب کنید.");
  if (number(project?.dedicatedAmount) > number(project?.annualNeed)) errors.push("مبلغ اختصاصی از نیاز سال بیشتر است.");
  return { valid: errors.length === 0, errors };
}

function sourceCapacity(source, capacity) {
  return {
    internal: capacity.internal,
    shortDebt: capacity.shortDebt,
    longDebt: capacity.longDebt,
    partner: capacity.partner,
    disposal: capacity.disposal,
  }[source] ?? 0;
}

function sourceRate(source, capacity) {
  if (source === "shortDebt") return capacity.shortDebtRate;
  if (source === "longDebt") return capacity.longDebtRate;
  return null;
}

function prioritySort(a, b) {
  const aOverride = a.overrideRank != null && a.overrideRank !== "" && Number.isInteger(Number(a.overrideRank)) && Number(a.overrideRank) > 0 ? Number(a.overrideRank) : null;
  const bOverride = b.overrideRank != null && b.overrideRank !== "" && Number.isInteger(Number(b.overrideRank)) && Number(b.overrideRank) > 0 ? Number(b.overrideRank) : null;
  if (aOverride != null || bOverride != null) return (aOverride ?? Number.MAX_SAFE_INTEGER) - (bOverride ?? Number.MAX_SAFE_INTEGER) || number(b.entryPriority) - number(a.entryPriority) || String(a.id).localeCompare(String(b.id));
  const aRank=Number.isInteger(a.entryRank)&&a.entryRank>0?a.entryRank:Number.MAX_SAFE_INTEGER;
  const bRank=Number.isInteger(b.entryRank)&&b.entryRank>0?b.entryRank:Number.MAX_SAFE_INTEGER;
  return aRank-bRank || number(b.entryPriority) - number(a.entryPriority) || number(a.order, Number.MAX_SAFE_INTEGER) - number(b.order, Number.MAX_SAFE_INTEGER) || String(a.id).localeCompare(String(b.id));
}

/**
 * Allocate one year using the five-stage v13 engine.
 * Temporary allocations are committed only after the minimum execution gate passes.
 */
export function allocateCapital({ year, financialInput, portfolioActions = [], projects = [], sourcePolicy, tolerance = 0.01 }) {
  validateSourcePolicy(sourcePolicy);
  const financialValidation = validateFinancialInput(financialInput);
  const financial = computeFinancialCapacity(financialInput);
  const disposalGross = reliableDisposalCapacity(portfolioActions, year);
  if (nonnegative(financialInput?.disposalIncludedInInflows) > disposalGross + tolerance) {
    financialValidation.valid = false;
    financialValidation.errors.push("واگذاری منظورشده در ورود نقد از واگذاری قابل اتکای همین سال بیشتر است.");
  }
  const disposal = round(Math.max(0, disposalGross - nonnegative(financialInput?.disposalIncludedInInflows)));
  const capacity = { ...financial, disposal };
  const used = { internal: 0, shortDebt: 0, longDebt: 0, partner: 0, disposal: 0 };
  const relevant = projects
    .filter((project) => Number(project.year) === Number(year))
    .map((project) => ({ ...project, validation: validateInvestmentCase(project, projects, tolerance) }))
    .sort(prioritySort);
  const results = [];
  // Reservations protect approved commitments without creating source capacity.
  const reservationInvalid = relevant.some(p => p.dedicatedMode === "reserved" && (!FUNDING_SOURCES[p.dedicatedSource] || !Number.isFinite(Number(p.dedicatedAmount)) || Number(p.dedicatedAmount) <= 0));
  const reservations = new Map(relevant.filter(p => p.dedicatedMode === "reserved" && FUNDING_SOURCES[p.dedicatedSource] && Number(p.dedicatedAmount) > 0 && Number.isFinite(Number(p.dedicatedAmount))).map(p => [p.id, {source:p.dedicatedSource, amount:nonnegative(p.dedicatedAmount)}]));
  const reservedBySource = source => [...reservations.values()].filter(r=>r.source===source).reduce((n,r)=>n+r.amount,0);
  const reservationConflict = Object.keys(used).some(source=>reservedBySource(source)>sourceCapacity(source,capacity)+tolerance) || reservedBySource("shortDebt")+reservedBySource("longDebt")>capacity.debtCeiling+tolerance;
  const liquidityBlocked = financial.reserveShortfall > tolerance && (sourcePolicy?.liquidityMode ?? "block") === "block";
  const liquidityRestricted = financial.reserveShortfall > tolerance && sourcePolicy?.liquidityMode === "restricted";
  const restrictedAuthorized = !liquidityRestricted || Boolean(sourcePolicy?.liquidityReason?.trim() && sourcePolicy?.liquiditySources?.length);

  for (const project of relevant) {
    const need = nonnegative(project.annualNeed);
    // Immutable turn boundaries: never infer earlier spending from stage.previousUse,
    // which also includes this project's own temporary funding.
    const capture = () => {
      const otherReserved = Object.fromEntries(Object.keys(used).map(source => [source, round([...reservations.entries()].filter(([id,r]) => id !== project.id && r.source === source).reduce((n,[,r]) => n+r.amount,0))]));
      const debtReserved = otherReserved.shortDebt + otherReserved.longDebt;
      const remainingDebtCeiling = round(Math.max(0,capacity.debtCeiling-used.shortDebt-used.longDebt-debtReserved));
      const remaining = Object.fromEntries(Object.keys(used).map(source => [source,round(Math.max(0,sourceCapacity(source,capacity)-used[source]-otherReserved[source]))]));
      return { used:{...used}, otherReserved, remaining, remainingDebtCeiling, ownReservation:round(reservations.get(project.id)?.amount ?? 0) };
    };
    const start = capture();
    const position = results.length+1;
    const priorProjects = results.map(r => ({id:r.id,name:r.name,executed:r.executed}));
    const recordResult = result => results.push({...result,audit:{version:1,position,priorityBasis:project.overrideRank!=null&&project.overrideRank!==""&&Number.isInteger(Number(project.overrideRank))&&Number(project.overrideRank)>0?"managerial":Number.isInteger(project.entryRank)&&project.entryRank>0?"entry":"score",priorProjects,start,end:capture(),assessed:result.trace.some(t=>t.source)}});
    if (!project.validation.valid) {
      const reason = project.validation.errors.join(" ");
      recordResult({ ...project, decision: "ورودی ناقص", executed: 0, deferred: need, allocations: { internal: 0, shortDebt: 0, longDebt: 0, partner: 0, disposal: 0 }, reason, trace: [blockedTrace(need, "invalid_project", reason)] });
      continue;
    }

    if (!financialValidation.valid) {
      const reason = "ورودی مالی سال کامل و معتبر نیست؛ تخصیص تا تکمیل ارقام محاسبه نمی‌شود.";
      recordResult({...project,decision:"ورودی ناقص",executed:0,deferred:need,allocations:{internal:0,shortDebt:0,longDebt:0,partner:0,disposal:0},reason,trace:[blockedTrace(need,"invalid_finance",reason)],passedMinimum:false});
      continue;
    }

    if (reservationInvalid || reservationConflict || liquidityBlocked || !restrictedAuthorized) {
      const reason = reservationInvalid ? "اطلاعات تعهد رزروشده ناقص است؛ ابتدا منبع و مبلغ تعهد را تعیین کنید." : reservationConflict ? "تعهدات رزروشده از ظرفیت منبع یا سقف بدهی بیشتر است؛ تعهد یا ظرفیت را اصلاح کنید." : liquidityBlocked ? "کسری نقد یا ذخیره نقد پوشش داده نشده است؛ ابتدا ورودی مالی را اصلاح یا تأمین محدود به طرح را با دلیل مصوب ثبت کنید." : "دلیل مصوب استفاده از منابع محدود به طرح ثبت نشده است.";
      const code = reservationInvalid ? "invalid_reservation" : reservationConflict ? "reservation_conflict" : liquidityBlocked ? "liquidity_blocked" : "liquidity_permission_missing";
      recordResult({...project,decision:"تعویق",executed:0,deferred:need,allocations:{internal:0,shortDebt:0,longDebt:0,partner:0,disposal:0},reason,trace:[blockedTrace(need,code,reason)],passedMinimum:false});
      continue;
    }
    const waterfall = normalizedSourceOrder(project.needType, sourcePolicy?.orders?.[project.needType]);
    const dedicated = { stage: "منبع اختصاصی", source: project.dedicatedSource || null, limit: nonnegative(project.dedicatedAmount) };
    const general = waterfall.map((source, index) => ({ stage: `منبع ${index + 1}`, source, limit: Number.POSITIVE_INFINITY }));
    const stages = project.dedicatedMode !== "reserved" && sourcePolicy?.dedicatedFirst === false ? [...general, dedicated] : [dedicated, ...general];
    const temporary = { internal: 0, shortDebt: 0, longDebt: 0, partner: 0, disposal: 0 };
    const trace = [];
    let remaining = need;

    for (const stage of stages) {
      const source = stage.source;
      const before = remaining;
      if (!source) {
        trace.push({ ...blockedTrace(before,"no_dedicated_source","منبع اختصاصی ثبت نشده است؛ بررسی منابع عمومی ادامه دارد."), stage: stage.stage, status:"skipped" });
        continue;
      }
      const nominal = sourceCapacity(source, capacity);
      const previousUse = used[source] + temporary[source];
      const otherReserved = [...reservations.entries()].filter(([id,r])=>id!==project.id && r.source===source).reduce((n,[,r])=>n+r.amount,0);
      const sourceRemaining = Math.max(0, nominal - previousUse - otherReserved);
      const otherDebtReserved = [...reservations.entries()].filter(([id,r])=>id!==project.id && FUNDING_SOURCES[r.source]?.debt).reduce((n,[,r])=>n+r.amount,0);
      const remainingDebtCeiling = Math.max(0, capacity.debtCeiling - used.shortDebt - used.longDebt - temporary.shortDebt - temporary.longDebt - otherDebtReserved);
      const usable = FUNDING_SOURCES[source].debt ? Math.min(sourceRemaining, remainingDebtCeiling) : sourceRemaining;
      const rate = sourceRate(source, capacity);
      const maximumRate = project.maximumRate == null || project.maximumRate === "" ? Number.POSITIVE_INFINITY : nonnegative(project.maximumRate);
      const rateAllowed = rate == null || rate <= maximumRate + 1e-12;
      const permittedByLiquidity = !liquidityRestricted || sourcePolicy.liquiditySources.includes(source);
      const eligible = !sourcePolicy?.allowedSources?.[project.needType] || sourcePolicy.allowedSources[project.needType].includes(source);
      const allocation = rateAllowed && permittedByLiquidity && eligible ? Math.min(before, usable, stage.limit) : 0;
      const consumers = results.filter(r=>r.allocations[source]>tolerance).map(r=>({id:r.id,name:r.name,amount:r.allocations[source]}));
      const debtConsumers = FUNDING_SOURCES[source].debt ? results.filter(r=>r.allocations.shortDebt+r.allocations.longDebt>tolerance).map(r=>({id:r.id,name:r.name,amount:round(r.allocations.shortDebt+r.allocations.longDebt)})) : [];
      const debtReservationHolders = FUNDING_SOURCES[source].debt ? [...reservations.entries()].filter(([id,r])=>id!==project.id&&FUNDING_SOURCES[r.source]?.debt&&r.amount>tolerance).map(([id,r])=>({id,name:relevant.find(p=>p.id===id)?.name??id,amount:round(r.amount)})) : [];
      const reservationHolders = [...reservations.entries()].filter(([id,r])=>id!==project.id && r.source===source && r.amount>tolerance).map(([id,r])=>({id,name:relevant.find(p=>p.id===id)?.name??id,amount:round(r.amount)}));
      const constraints = [];
      if (before <= tolerance) constraints.push("not_needed");
      else {
        if (!eligible) constraints.push("source_ineligible");
        if (!permittedByLiquidity) constraints.push("liquidity_restricted");
        if (!rateAllowed) constraints.push("rate_exceeded");
        if (nominal <= tolerance) constraints.push("no_capacity");
        else if (sourceRemaining <= tolerance) constraints.push(otherReserved > tolerance ? "source_reserved" : "source_consumed");
        if (FUNDING_SOURCES[source].debt && remainingDebtCeiling <= tolerance) constraints.push("debt_ceiling");
        if (stage.limit <= tolerance) constraints.push("dedicated_limit");
        if (allocation>tolerance&&allocation+tolerance<before){
          if (sourceRemaining+tolerance<before) constraints.push(otherReserved>tolerance?"partial_reserved":"partial_capacity");
          if (FUNDING_SOURCES[source].debt&&remainingDebtCeiling+tolerance<before) constraints.push("partial_debt_ceiling");
          if (stage.limit+tolerance<before) constraints.push("partial_dedicated_limit");
        }
      }
      const reasonCode = allocation > tolerance ? "allocated" : constraints[0] ?? "no_capacity";
      const note = reasonCode === "allocated" ? (before-allocation <= tolerance ? "نیاز این طرح در این مرحله تکمیل شد." : "بخشی از نیاز تأمین شد؛ بررسی منبع بعدی ادامه دارد.") : TRACE_REASONS[reasonCode];
      temporary[source] = round(temporary[source] + allocation);
      remaining = round(Math.max(0, remaining - allocation));
      trace.push({
        stage: stage.stage,
        source,
        stageKind: stage.stage === "منبع اختصاصی" ? "dedicated" : "general",
        dedicatedLimit: Number.isFinite(stage.limit) ? round(stage.limit) : null,
        selectionReason: stage.stage === "منبع اختصاصی" ? (project.dedicatedMode === "reserved" ? "dedicated_reserved" : "dedicated_preferred") : sourcePolicy?.orders?.[project.needType]?.length ? "custom_order" : "default_order",
        selectionNote: sourcePolicy?.reason?.trim() || null,
        needBefore: round(before),
        nominalCapacity: round(nominal),
        previousUse: round(previousUse),
        usedByEarlier: round(used[source]),
        temporaryBefore: round(previousUse-used[source]),
        remainingDebtCeiling: round(remainingDebtCeiling),
        usableCapacity: round(usable),
        rate,
        rateAllowed,
        eligible,
        permittedByLiquidity,
        reservedForOthers: round(otherReserved),
        sourceRemaining: round(sourceRemaining),
        consumers,
        debtConsumers,
        debtReservationHolders,
        reservationHolders,
        constraints,
        reasonCode,
        status: allocation > tolerance ? "temporary" : before <= tolerance ? "not_needed" : "blocked",
        allocation: round(allocation),
        needAfter: remaining,
        note,
      });
    }

    const temporaryTotal = Object.values(temporary).reduce((sum, value) => sum + value, 0);
    const minimumRequired = project.stageable ? need * nonnegative(project.minimumExecution) : need;
    const passedMinimum = temporaryTotal + tolerance >= minimumRequired;
    const allocations = passedMinimum ? temporary : { internal: 0, shortDebt: 0, longDebt: 0, partner: 0, disposal: 0 };
    for (const stage of trace) {
      stage.finalAllocation = passedMinimum ? stage.allocation : 0;
      stage.releasedAllocation = passedMinimum ? 0 : stage.allocation;
      if (stage.allocation > tolerance) stage.status = passedMinimum ? "committed" : "released";
    }
    if (passedMinimum) for (const source of Object.keys(used)) used[source] = round(used[source] + allocations[source]);
    if (passedMinimum) {
      const reservation = reservations.get(project.id);
      if (reservation) reservation.amount = Math.max(0,reservation.amount-allocations[reservation.source]);
    }
    const executed = round(Object.values(allocations).reduce((sum, value) => sum + value, 0));
    const deferred = round(Math.max(0, need - executed));
    const decision = !passedMinimum ? "تعویق" : deferred <= tolerance ? "تأمین کامل" : "تأمین جزئی";
    const reason = !passedMinimum
      ? project.stageable
        ? "حداقل مقیاس اجرای فرصت تأمین نشد؛ تخصیص‌های موقت آزاد شد."
        : "تأمین کامل نیاز سال ممکن نشد؛ تخصیص‌های موقت آزاد شد."
      : deferred <= tolerance
        ? "نیاز مالی سال به‌طور کامل بر اساس آبشار منابع تأمین شد."
        : "حداقل مقیاس اجرا تأمین شد؛ بخش قابل اجرا تخصیص یافت و باقیمانده به تعویق رفت.";
    recordResult({ ...project, minimumRequired: round(minimumRequired), temporaryFunding: round(temporaryTotal), passedMinimum, decision, executed, deferred, allocations, reason, trace });
  }

  const totalNeed = round(results.reduce((sum, result) => sum + nonnegative(result.annualNeed), 0));
  const totalExecuted = round(results.reduce((sum, result) => sum + nonnegative(result.executed), 0));
  const totalDeferred = round(results.reduce((sum, result) => sum + nonnegative(result.deferred), 0));
  const totalCapacity = round(capacity.internal + capacity.effectiveDebt + capacity.partner + capacity.disposal);
  const totalUsed = round(Object.values(used).reduce((sum, value) => sum + value, 0));
  const reserved = Object.fromEntries(Object.keys(used).map(source=>[source,round(reservedBySource(source))]));
  const remaining = Object.fromEntries(Object.keys(used).map((source) => [source, round(Math.max(0, sourceCapacity(source, capacity) - used[source] - reserved[source]))]));
  const available = source => !liquidityRestricted || sourcePolicy.liquiditySources?.includes(source) ? remaining[source] : 0;
  const freeCapacity = !financialValidation.valid || liquidityBlocked || !restrictedAuthorized || reservationConflict || reservationInvalid ? 0 : round(available("internal")+available("partner")+available("disposal")+Math.min(available("shortDebt")+available("longDebt"),Math.max(0,capacity.debtCeiling-used.shortDebt-used.longDebt-reserved.shortDebt-reserved.longDebt)));
  const checks = {
    needBalanced: Math.abs(totalNeed - totalExecuted - totalDeferred) <= tolerance,
    sourceCapacity: Object.keys(used).every((source) => used[source] <= sourceCapacity(source, capacity) + tolerance),
    debtCeiling: used.shortDebt + used.longDebt <= capacity.debtCeiling + tolerance,
    disposalReliableOnly: used.disposal <= disposal + tolerance,
  };
  return { year: Number(year), financial, financialValidation, disposalGross, capacity, used, remaining, reserved, freeCapacity, reservationConflict, reservationInvalid, restrictedAuthorized, policyValid: !reservationInvalid && restrictedAuthorized, liquidityBlocked, liquidityRestricted, investmentReady: financialValidation.valid && relevant.length > 0 && relevant.every(p=>p.validation.valid) && !reservationInvalid && !reservationConflict && !liquidityBlocked && restrictedAuthorized && financial.reserveShortfall <= tolerance, totalNeed, totalExecuted, totalDeferred, totalCapacity, totalUsed, unusedCapacity: round(Math.max(0, totalCapacity - totalUsed)), results, checks, valid: financialValidation.valid && Object.values(checks).every(Boolean) };
}

export function allocationSourceRows(output) {
  return Object.entries(FUNDING_SOURCES).map(([key, source]) => {
    const capacity = sourceCapacity(key, output.capacity);
    const used = output.used[key] ?? 0;
    return { key, label: source.label, capacity, used, reserved: output.reserved[key] ?? 0, remaining: output.remaining[key] ?? Math.max(0, capacity - used), utilization: capacity > 0 ? used / capacity : null };
  });
}

/** A policy may reorder approved eligible sources, never add capacity or bypass guards. */
export function validateSourcePolicy(policy) {
  if (policy == null) return true;
  if (typeof policy !== "object" || (policy.dedicatedFirst != null && typeof policy.dedicatedFirst !== "boolean")) throw new Error("سیاست ترتیب منابع معتبر نیست.");
  if (policy.liquidityMode != null && !["block","restricted"].includes(policy.liquidityMode)) throw new Error("سیاست کسری نقد معتبر نیست.");
  if(policy.liquiditySources != null && (!Array.isArray(policy.liquiditySources)||policy.liquiditySources.some(s=>!FUNDING_SOURCES[s])||new Set(policy.liquiditySources).size!==policy.liquiditySources.length)) throw new Error("منابع مجوز کسری نقد معتبر نیستند.");
  for (const [need, order] of Object.entries(policy.orders ?? {})) {
    const baseline = SOURCE_WATERFALL[need];
    if (!baseline || !Array.isArray(order) || order.length < 1 || order.length > baseline.length || new Set(order).size !== order.length || order.some(s => !baseline.includes(s))) throw new Error("ترتیب منابع باید فقط جابه‌جایی منابع مجاز مدل باشد.");
  }
  for (const [need, sources] of Object.entries(policy.allowedSources ?? {})) {
    if (!SOURCE_WATERFALL[need] || !Array.isArray(sources) || new Set(sources).size !== sources.length || sources.some(s=>!FUNDING_SOURCES[s])) throw new Error("فهرست منابع مجاز معتبر نیست.");
  }
  return true;
}

export function sourcePolicyRequiresReason(policy) {
  if (!policy) return false;
  if (policy.dedicatedFirst === false) return true;
  if (Object.values(policy.allowedSources ?? {}).some(sources=>sources.length < Object.keys(FUNDING_SOURCES).length)) return true;
  return Object.entries(policy.orders ?? {}).some(([need, order]) => {
    const baseline = SOURCE_WATERFALL[need];
    if (!baseline) return true;
    const normalized = normalizedSourceOrder(need, order);
    return normalized.some((source, index) => source !== baseline[index]);
  });
}
