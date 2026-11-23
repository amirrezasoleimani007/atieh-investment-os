import runtime from '../data/policy/watch-v10.runtime.json';
import {WATCH_SIX_CHARTS,watchSixBand,type WatchSixBundle,type WatchSixAxisKey} from './watch-six';
export function resolveWatchV10Narrative(bundle:WatchSixBundle){
 const codes:string[]=[];
 for(const d of WATCH_SIX_CHARTS){const x=watchSixBand(bundle.axes[d.xKey as WatchSixAxisKey].score),y=watchSixBand(bundle.axes[d.yKey as WatchSixAxisKey].score);if(!x||!y)return null;codes.push(`${d.key}-${x}${y}`);}
 return watchV10Record(codes.join('|'));
}
export function watchV10Record(key:string){const r=(runtime.rows as Record<string,number[]>)[key];if(!r)return null;return {id:key,text:runtime.texts[r[0]],topic:runtime.topics[r[1]],priority:runtime.priorities[r[2]],priorityRule:runtime.rules[r[3]],title:runtime.patterns[r[4]],diagnosticCode:runtime.codes[r[5]],version:runtime.version,sourceSha256:runtime.sourceSha256};}
