import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHART_DEFINITIONS,type AxisBundle} from '../lib/financial-engine';
import {resolveWatchNarrative,watchBand,watchPathDescription} from '../lib/watch-narrative';
const book=JSON.parse(readFileSync(new URL('../data/policy/financial_watch_narratives_fa_v7_SITE.json',import.meta.url),'utf8'));
function bundle(scores:(number|null)[]) {return {company:'آزمون',year:1404,nature:'تولیدی',axes:Object.fromEntries(CHART_DEFINITIONS.flatMap(d=>[d.xKey,d.yKey]).map((key,i)=>[key,{score:scores[i]}]))} as AxisBundle}
test('all 6,561 source combinations map independently to the exact original ID and title',()=>{
 for(const row of book.combinations){const result=resolveWatchNarrative(bundle(row.axis_bands.map((b:string)=>({W:1,M:5,G:9})[b])));assert.equal(result?.id,row.id);assert.equal(result?.title,row.narrative_title);assert.equal(result?.text,row.narrative)}
});
test('boundaries, missing, nonfinite and out-of-range inputs never invent a state',()=>{
 assert.equal(watchBand(3.329),'W');assert.equal(watchBand(3.33),'M');assert.equal(watchBand(6.66),'G');
 for(const n of [null,NaN,Infinity,-1,11]){assert.equal(watchBand(n),null);assert.equal(resolveWatchNarrative(bundle([n,5,5,5,5,5,5,5])),null)}
 assert.equal(resolveWatchNarrative(bundle([8.36,7.97,7.27,7.11,9.69,6.59,3.30,3.03]))?.id,'C6526');
 assert.equal(resolveWatchNarrative(bundle([6.43,1.02,4.23,3.76,9.59,5.10,1.11,4.12]))?.id,'C1102');
});
test('returning to the starting point does not conceal a large middle-period reversal',()=>{
 assert.match(watchPathDescription([{year:1402,x:8,y:8},{year:1403,x:2,y:2},{year:1404,x:8,y:8}]),/رفت‌وبرگشتی/);
 assert.match(watchPathDescription([{year:1404,x:8,y:8}]),/کافی/);
});
