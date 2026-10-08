import type {CapitalOutput,FundingSource} from './capital-allocation.mjs';
type Project=CapitalOutput['results'][number];
export type StoryEvent={id:string;kind:'entry'|'turn'|'source'|'unneeded'|'gate'|'stop'|'result';phase:number;title:string;traceIndex?:number;temporary:number|null;remaining:number|null;unneeded?:{index:number;source:FundingSource;stage:string}[]};
export const STORY_PHASES:string[];
export function capitalStory(project:Project):StoryEvent[];
export function sourceDecision(project:Project,traceIndex:number):null|{why:string;dedicated:boolean;limit:number|null;explanations:string[];permissions:{label:string;pass:boolean|null}[];blocked:boolean;candidates:{label:string;amount:number}[];selection:string};
