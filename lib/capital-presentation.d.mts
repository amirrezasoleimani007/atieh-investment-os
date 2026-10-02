import type {CapitalOutput} from './capital-allocation.mjs';
export function summarizeCapital(output:CapitalOutput):{incomplete:number;review:number;knownNeed:number;knownGap:number;need:number|null;gap:number|null;coverage:number|null};
