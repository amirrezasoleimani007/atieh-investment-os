import type {CapitalOutput} from './capital-allocation.mjs';
export type DebtTerms=Record<string,{years:number;grace:number}>;
export function debtBridge(outputs:CapitalOutput[],terms?:DebtTerms):{rows:{year:number;drawn:number;principal:number;interest:number;unknown:number}[];missing:{year:number;source:string;amount:number}[];tailPrincipal:number};
