export type EntryMode='direct'|'trade';
export type SelectionTrace={version:1;chosenAt:string;year:number;dataSnapshot:string;parentId:number;child:boolean;gates:{mission:string;condition?:unknown;focus:unknown;focusOverride?:unknown;thresholds?:unknown};scores:Record<string,number|null>;weights:Record<string,number>;vision?:Record<string,number>;isicPreset?:string;isicWeights?:Record<string,number>;managementReason:string};
export const ENTRY_MODES:Record<EntryMode,{label:string;target:string;description:string}>;
export function validEntryMetadata(item:{entryMode?:unknown;selectionTrace?:unknown}):boolean;
export function captureSelectionTrace(opportunity:unknown,base:unknown,parent:unknown,year:number,dataSnapshot:string):SelectionTrace;
