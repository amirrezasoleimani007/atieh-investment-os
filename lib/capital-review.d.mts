import type {CapitalOutput,FundingSource} from './capital-allocation.mjs';
type Holder={id:string;name:string;amount:number};
export function reviewCapitalProject(project:CapitalOutput['results'][number]):{
 assessed:boolean;temporary:number|null;released:number|null;narrative:string;action:'case'|'resources'|'policy'|'decision';
 rows:{key:FundingSource;label:string;amount:number;temporary:number;released:number;state:string;explanation:string;constraints:{code:string;text:string}[];consumers:Holder[];reservations:Holder[];debtConsumers:Holder[];debtReservations:Holder[];start:number|null;usedByEarlier:number|null;reserved:number|null;end:number|null}[];
};
