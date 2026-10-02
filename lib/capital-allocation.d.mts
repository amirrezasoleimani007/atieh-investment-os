export type FundingSource = "internal" | "shortDebt" | "longDebt" | "partner" | "disposal";
type SourceAmounts = Record<FundingSource, number>;
export type CapitalProject = {
  id: string;
  name: string;
  parentName: string;
  year: number;
  entryPriority: number; entryRank?:number; financialReviewRequired?:boolean;
  annualNeed: number;
  needType: string;
  stageable: boolean;
  minimumExecution: number;
  maximumRate: number | null;
  dedicatedMode?: "reserved" | "preferred";
  dedicatedSource: string;
  dedicatedAmount: number;
  order?: number;
  overrideRank?: number | null;
};
export type CapitalTraceStage = {
  stage: string;
  source: FundingSource | null;
  needBefore: number;
  nominalCapacity: number;
  previousUse: number;
  remainingDebtCeiling: number;
  usableCapacity: number;
  rate: number | null;
  rateAllowed: boolean;
  allocation: number;
  needAfter: number;
  note: string;
};
export type FinancialCapacity = {
  cashAfterPayments: number; internal: number; reserveShortfall: number;
  shortDebt: number; shortDebtRate: number; longDebt: number; longDebtRate: number;
  debtCeiling: number; effectiveDebt: number; partner: number;
};
export type CapitalOutput = {
  year: number;
  financial: FinancialCapacity;
  capacity: FinancialCapacity & { disposal: number };
  used: SourceAmounts;
  remaining: SourceAmounts;
  reserved: SourceAmounts; freeCapacity:number;
  totalNeed: number; totalExecuted: number; totalDeferred: number;
  totalCapacity: number; totalUsed: number; unusedCapacity: number;
  results: (CapitalProject & {
    decision: string; executed: number; deferred: number; allocations: SourceAmounts;
    reason: string; trace: CapitalTraceStage[]; validation: { valid: boolean; errors: string[] };
    minimumRequired?: number; temporaryFunding?: number; passedMinimum?: boolean;
  })[];
  checks: Record<string, boolean>;
  valid: boolean;
  policyValid: boolean; reservationInvalid: boolean; restrictedAuthorized: boolean; reservationConflict: boolean; liquidityBlocked: boolean; liquidityRestricted: boolean; investmentReady: boolean;
};
export const CAPITAL_YEARS: readonly number[];
export const FUNDING_SOURCES: Readonly<Record<FundingSource, { label: string; debt: boolean }>>;
export const NEED_TYPES: readonly string[];
export const ENTRY_METHODS: readonly string[];
export const SOURCE_WATERFALL: Readonly<Record<string, FundingSource[]>>;
export const DEFAULT_FINANCIAL_INPUT: Readonly<Record<string, number>>;
export const V13_SAMPLE_FINANCIAL_INPUT: Readonly<Record<string, number>>;
export function computeFinancialCapacity(input?: Record<string, number>): FinancialCapacity;
export function reliableDisposalCapacity(actions: { year: number; action: string; status: string; reliableProceeds: number }[], year: number): number;
export function validateInvestmentCase(project: CapitalProject): { valid: boolean; errors: string[] };
export function allocateCapital(input: {
  year: number;
  financialInput: Record<string, number>;
  portfolioActions?: { year: number; action: string; status: string; reliableProceeds: number }[];
  projects?: CapitalProject[];
  sourcePolicy?: SourcePolicy;
  tolerance?: number;
}): CapitalOutput;
export function allocationSourceRows(output: CapitalOutput): {
  key: FundingSource; label: string; capacity: number; used: number;
  reserved: number; remaining: number; utilization: number | null;
}[];

export type SourcePolicy = {liquidityMode?: "block"|"restricted"; liquidityReason?:string; liquiditySources?:FundingSource[];orders?: Record<string, FundingSource[]>; dedicatedFirst?: boolean; reason?: string; updatedAt?: string};
export function validateSourcePolicy(policy?: SourcePolicy): boolean;
