export type ProximityMetric = 'score' | 'service' | 'steel';
export function sortProximity<T extends {id:number; score:number|null; service:number|null; steel:number|null}>(rows:T[],metric?:ProximityMetric,direction?:'asc'|'desc'):T[];
