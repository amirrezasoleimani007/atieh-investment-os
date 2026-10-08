import type {SelectionTrace,EntryMode} from './entry-route.mjs';
import type {RoadmapInput} from './movement-roadmap.mjs';
export type Journey={key:string;name:string;parentId:number;parentName:string;child:boolean;rank?:number;mode:EntryMode|null;modeLabel:string;target:string;trace:SelectionTrace;recorded:boolean;calculation:ReturnType<typeof import('./movement-model.mjs').selectionScore>;currentPriority:number};
export function selectionJourney(input:RoadmapInput,year:number):Journey[];
