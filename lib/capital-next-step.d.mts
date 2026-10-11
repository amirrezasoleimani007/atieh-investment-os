import type {allocateCapital} from './capital-allocation.mjs';
export function assessPhasedExecution(input:Parameters<typeof allocateCapital>[0],id:string,minimumPercent:number):{status:string;before?:number;after?:number;gap?:number;affected?:{name:string;before:number;after:number}[]};
