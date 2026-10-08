export type Criterion={level:number|null;evidence:string};
export type TradeRoute={id:string;parentId:number;title:string;product:string;customer:string;channel:string;gap:string;reviewer:string;reviewedAt:string;trade:Record<string,Criterion>;steel:Record<string,Criterion>};
export const TRADE_METHOD:string;
export const TRADE_CRITERIA:string[][];export const STEEL_CRITERIA:string[][];export const LEVELS:string[];
export function dimensionScore(route:TradeRoute,dimension:string):{score:number|null;covered:number;total:number};
export function routeAssessment(route:TradeRoute):{trade:ReturnType<typeof dimensionScore>;steel:ReturnType<typeof dimensionScore>;complete:boolean;label:string};
export function validateTradeRoutes(routes:unknown):boolean;
export function newTradeRoute(id:string,parentId:number):TradeRoute;
