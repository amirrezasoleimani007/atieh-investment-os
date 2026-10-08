import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sortProximity} from '../lib/proximity-sort.mjs';
const rows=[{id:1,score:60,service:90,steel:40},{id:2,score:70,service:50,steel:98},{id:3,score:null,service:null,steel:null},{id:4,score:0,service:0,steel:0}];
test('each metric sorts independently; missing values remain last and zero is valid',()=>{
 for(const metric of ['score','service','steel']){
  assert.equal(sortProximity(rows,metric,'desc')[0].id,metric==='service'?1:2);
  assert.deepEqual(sortProximity(rows,metric,'asc').map(r=>r.id),metric==='service'?[4,2,1,3]:[4,1,2,3]);
  assert.equal(sortProximity(rows,metric,'desc').at(-1).id,3);
 }
 assert.deepEqual(rows.map(r=>r.id),[1,2,3,4]);
});
