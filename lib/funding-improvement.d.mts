import type {allocateCapital,CapitalOutput,SourcePolicy,FundingSource} from './capital-allocation.mjs';
export type FundingSearch={status:string;tested:number;baseline:CapitalOutput;best:CapitalOutput|null;policy?:SourcePolicy;gain:number;changes:{needType:string;before:FundingSource[];after:FundingSource[]}[]};
export function findFundingImprovement(input:Parameters<typeof allocateCapital>[0],baseline?:CapitalOutput,otherInputs?:Parameters<typeof allocateCapital>[0][]):FundingSearch;
