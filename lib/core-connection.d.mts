export type CoreRow={id:number;name:string;coreFit:number;verticalTrade?:number;verticalSteel?:number};
export const CORE_CONNECTION_METHOD: Readonly<{version:string;anchorId:number;anchorFit:number;label:string}>;
export function coreConnection(row:CoreRow):{id:number;raw:number|null;score:number|null;chain:string;capability:string;routeStatus:string;method:string;tradeVertical:number|null;steelVertical:number|null};
