import type {CoreRow} from './core-connection.mjs';
export const TRADE_EXPANSION_METHOD:{version:string;ceiling:number;baseYear:number};
export type TradeExpansionRow={id:number;name:string;service:number|null;steel:number|null;score:number|null;raw:number|null;steelVertical:number|null;group:string;connection:string;expansion:string;reason:string;limiter:string;method:string;rank:number|null};
export function tradeExpansion(rows:CoreRow[]):TradeExpansionRow[];
export function tradeExpansionCsv(rows:TradeExpansionRow[],selected?:number[]):string;
