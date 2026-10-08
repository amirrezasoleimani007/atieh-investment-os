import type {CoreRow} from './core-connection.mjs';
export const TRADING_PROXIMITY_METHOD:Readonly<{version:string;source:string;anchor:number;baseYear:number}>;
export const TRADING_ROUTES:Record<number,string[]>;
export type TradingProximityRow={id:number;name:string;score:number|null;raw:number|null;tradeVertical:number|null;steelVertical:number|null;connection:string;expansion:string;reason:string;method:string;rank:number|null};
export function tradingProximity(rows:CoreRow[]):TradingProximityRow[];
export function proximityCsv(items:TradingProximityRow[],selectedIds?:number[]):string;
