import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { priorityScore } from '../lib/priority-score.mjs';
import { calculateStrategicFit } from '../lib/strategic-fit.mjs';

test('supplementary priority index: endpoints, symmetry, monotonicity and invalid inputs', () => {
  assert.equal(priorityScore(.5,9.5),0);
  assert.equal(priorityScore(9.5,9.5),100);
  assert.equal(priorityScore(5,5),50);
  assert.equal(priorityScore(2,8),priorityScore(8,2));
  assert.ok(priorityScore(7,6)>priorityScore(7,5));
  for(const value of [NaN,Infinity,undefined,-1,10]) assert.throws(()=>priorityScore(value,5));
});
test('all 77 opportunities and policy scenarios have finite scores without mutating governed data', () => {
  const rows=JSON.parse(readFileSync(new URL('../public/data/opportunities.json',import.meta.url),'utf8'));
  const before=JSON.stringify(rows);
  assert.equal(rows.length,77);
  for(const weights of [{core:60,adjacent:30,transform:10},{core:80,adjacent:10,transform:10},{core:30,adjacent:60,transform:10},{core:20,adjacent:20,transform:60},{core:10,adjacent:10,transform:80}]) {
    const fits=calculateStrategicFit(rows,weights);
    fits.forEach((fit,i)=>{const score=priorityScore(rows[i].xPlotBaseline,fit.dynamicY);assert.ok(Number.isFinite(score)&&score>=0&&score<=100)});
  }
  assert.equal(JSON.stringify(rows),before);
});
