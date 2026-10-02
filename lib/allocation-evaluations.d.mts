import type {CapitalOutput} from './capital-allocation.mjs';
export type AllocationEvaluation = {id:string;createdAt:string;status:'draft'|'approved';actor:string;reason:string;signature:string;input:{runKey:string;year:number;[key:string]:unknown};output:CapitalOutput};
export function evaluationSignature(input:unknown):string;
export function freezeAllocationEvaluation(input:AllocationEvaluation['input'],output:CapitalOutput,options:{status:'draft'|'approved';actor:string;reason:string;financeStatus:string;blocked:boolean;id:string;createdAt:string}):AllocationEvaluation;
