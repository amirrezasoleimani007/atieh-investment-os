import test from "node:test";
import assert from "node:assert/strict";
import {
  SOURCE_WATERFALL,
  V13_SAMPLE_FINANCIAL_INPUT,
  allocateCapital,
  computeFinancialCapacity,
  reliableDisposalCapacity,
} from "../lib/capital-allocation.mjs";

const sampleProjects = [
  { id: "P001", year: 1406, name: "سرمایه در گردش بازرگانی", needType: "سرمایه در گردش", annualNeed: 700, stageable: true, minimumExecution: 0.5, maximumRate: 0.35, entryPriority: 90 },
  { id: "P002", year: 1406, name: "توسعه ظرفیت پایین‌دستی", needType: "توسعه / CAPEX رشد", annualNeed: 400, stageable: true, minimumExecution: 0.5, maximumRate: 0.37, entryPriority: 80 },
  { id: "P003", year: 1406, name: "سرمایه‌گذاری خدمات مالی", needType: "تملک / سرمایه‌گذاری راهبردی", annualNeed: 300, stageable: false, minimumExecution: 1, dedicatedSource: "partner", dedicatedAmount: 100, entryPriority: 70 },
  { id: "P004", year: 1406, name: "طرح پشتیبانی جدید", needType: "تملک / سرمایه‌گذاری راهبردی", annualNeed: 300, stageable: false, minimumExecution: 1, entryPriority: 60 },
];

test("ظرفیت مالی نمونه اکسل v13 دقیقاً بازتولید می‌شود", () => {
  const result = computeFinancialCapacity(V13_SAMPLE_FINANCIAL_INPUT);
  assert.equal(result.cashAfterPayments, 900);
  assert.equal(result.internal, 600);
  assert.equal(result.reserveShortfall, 0);
  assert.equal(result.effectiveDebt, 900);
});

test("آبشار شش نوع نیاز با مستند رسمی v13 یکسان است", () => {
  assert.deepEqual(SOURCE_WATERFALL["سرمایه در گردش"], ["shortDebt", "internal", "longDebt", "partner"]);
  assert.deepEqual(SOURCE_WATERFALL["سرمایه‌گذاری مالی / پرتفویی"], ["internal", "partner", "disposal", "longDebt"]);
});

test("نمونه 1406 اکسل: 1700 اجرا و ترکیب منابع 400/600/300/400", () => {
  const result = allocateCapital({ year: 1406, financialInput: V13_SAMPLE_FINANCIAL_INPUT, projects: sampleProjects });
  assert.equal(result.valid, true);
  assert.equal(result.totalNeed, 1700);
  assert.equal(result.totalExecuted, 1700);
  assert.equal(result.totalDeferred, 0);
  assert.deepEqual(result.used, { internal: 400, shortDebt: 600, longDebt: 300, partner: 400, disposal: 0 });
  assert.deepEqual(result.results.map((row) => row.decision), ["تأمین کامل", "تأمین کامل", "تأمین کامل", "تأمین کامل"]);
});

test("منبع بدهی گران‌تر از سقف نرخ پروژه کنار گذاشته می‌شود", () => {
  const result = allocateCapital({
    year: 1406,
    financialInput: { ...V13_SAMPLE_FINANCIAL_INPUT, cashStart: 300, reliableInflows: 0, requiredPayments: 0, debtRepayment: 0, dividends: 0, priorCommitments: 0, minimumCashReserve: 300, partnerCapacity: 0, shortDebtRate: 0.4, longDebtRate: 0.45 },
    projects: [{ id: "R", year: 1406, name: "نیاز سرمایه در گردش", needType: "سرمایه در گردش", annualNeed: 700, stageable: false, maximumRate: 0.35, entryPriority: 1 }],
  });
  assert.equal(result.results[0].decision, "تعویق");
  assert.equal(result.results[0].trace.find((row) => row.source === "shortDebt").rateAllowed, false);
  assert.equal(result.totalUsed, 0);
});

test("تخصیص موقت پروژه‌ای که به حداقل اجرا نمی‌رسد آزاد می‌شود", () => {
  const result = allocateCapital({
    year: 1406,
    financialInput: { ...V13_SAMPLE_FINANCIAL_INPUT, cashStart: 200, reliableInflows: 200, minimumCashReserve: 300, shortDebtCapacity: 100, longDebtCapacity: 0, totalNewDebtCeiling: 100, partnerCapacity: 0 },
    projects: [
      { id: "A", year: 1406, name: "پروژه نخست", needType: "سرمایه در گردش", annualNeed: 500, stageable: true, minimumExecution: 0.5, maximumRate: 0.35, entryPriority: 100 },
      { id: "B", year: 1406, name: "پروژه دوم", needType: "سرمایه در گردش", annualNeed: 100, stageable: false, maximumRate: 0.35, entryPriority: 90 },
    ],
  });
  assert.equal(result.results[0].decision, "تعویق");
  assert.equal(result.results[0].temporaryFunding, 100);
  assert.equal(result.results[1].decision, "تأمین کامل");
  assert.equal(result.used.shortDebt, 100);
});

test("فقط واگذاری قابل اتکا یا محقق‌شده وارد ظرفیت می‌شود", () => {
  const actions = [
    { year: 1406, action: "واگذاری / خروج", status: "برنامه‌ریزی‌شده", reliableProceeds: 500 },
    { year: 1406, action: "کاهش سهم", status: "قابل اتکا", reliableProceeds: 200 },
    { year: 1406, action: "واگذاری / خروج", status: "محقق‌شده", reliableProceeds: 300 },
  ];
  assert.equal(reliableDisposalCapacity(actions, 1406), 500);
});

test("کنترل‌های تطبیق نیاز، ظرفیت منبع و سقف بدهی برقرارند", () => {
  const result = allocateCapital({ year: 1406, financialInput: V13_SAMPLE_FINANCIAL_INPUT, projects: sampleProjects });
  assert.deepEqual(result.checks, { needBalanced: true, sourceCapacity: true, debtCeiling: true, disposalReliableOnly: true });
  assert.ok(result.used.shortDebt + result.used.longDebt <= result.capacity.debtCeiling);
});
