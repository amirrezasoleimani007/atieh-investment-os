import type {CapitalOutput} from './capital-allocation.mjs';
export function allocationChanges(before:CapitalOutput,after:CapitalOutput):{id:string;name:string;delta:number;sources:{source:string;delta:number}[];reason:string;decision:string;decisionChanged:boolean}[];
