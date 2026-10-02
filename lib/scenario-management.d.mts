export function validateScenarioBackup<T>(value:T):T;
export function archiveScenario<T>(workspace:T,id:string,archived?:boolean):T;
export function renameScenario<T>(workspace:T,id:string,name:string):T;
export function mergeScenarioBackup<T>(current:T,backup:T,makeId?:()=>string):T;
export function scenarioBackup<T>(workspace:T,id:string):T;
