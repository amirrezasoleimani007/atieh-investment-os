import type { EntryOpportunity } from '../components/entry-planning';
export type SnapshotPlan = EntryOpportunity & {share:number;priorityRank?:number;year:number};
export type PlanSnapshot = {id:string;name:string;plans:SnapshotPlan[]};
export function mergeScenarioPlans(snapshots:PlanSnapshot[],year:number,choices?:Record<string,string>,cases?:Record<string,{runKey?:string;year:number;opportunityKey:string}>):{plans:(SnapshotPlan & {snapshotId:string;scenarioName:string;sourceNames:string[]})[];conflicts:{key:string;name:string;options:(SnapshotPlan & {snapshotId:string;scenarioName:string})[]}[]};
export function inspectEntryPlan(baskets:Record<number,Record<string,{share:number;priorityRank?:number;parentId?:number;entryMode?:import("./entry-route.mjs").EntryMode;selectionTrace?:import("./entry-route.mjs").SelectionTrace}>>,opportunities:EntryOpportunity[],mode?:"shares"|"priority"):{plans:SnapshotPlan[];errors:string[]};
export function scopedCases<T extends {sourceKind?:string;runKey?:string}>(cases:Record<string,T>,runKey:string):Record<string,T>;
export function reviewSignature(base:Record<string,unknown>,stage:string):string;

export function workspaceId():string;
export function carryFundingPolicies(capital:{sourcePolicies?:Record<string,import('./capital-allocation.mjs').SourcePolicy>;liquidityPoliciesByYear?:Record<string,import('./capital-allocation.mjs').SourcePolicy>},snapshots:{id:string;scenarioId?:string}[],selectedIds:string[]):{sourcePolicies:Record<string,import('./capital-allocation.mjs').SourcePolicy>;liquidityPoliciesByYear:Record<string,import('./capital-allocation.mjs').SourcePolicy>};

export function reconcileScenarioCases<T>(cases: Record<string,T>, snapshots:(PlanSnapshot & {scenarioId?:string})[], selectedIds:string[], choices?:Record<string,string>):Record<string,T>;

export function eligibleScenarioCases<T extends {sourceKind?:string;runKey?:string;opportunityKey:string;continuationOf?:string}>(cases:Record<string,T>,runKey:string,plansByYear:SnapshotPlan[]):Record<string,T>;
