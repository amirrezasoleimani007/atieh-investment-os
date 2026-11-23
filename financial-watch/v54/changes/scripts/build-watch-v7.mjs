import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const bytes=await readFile(new URL('data/policy/financial_watch_narratives_fa_v7_SITE.json',root));
const source=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
const baseline=JSON.parse(await readFile(new URL('data/policy/financial_watch_6561_v4_SITE.json',root),'utf8'));
assert.equal(source.combinations.length,6561);
assert.deepEqual(source.axis_definitions,baseline.axis_definitions);
const ids=new Set(), states=new Set(), titles=[],texts=[],rows={};
function intern(list,value){let i=list.indexOf(value);if(i<0){i=list.length;list.push(value)}return i}
for(const [i,row] of source.combinations.entries()){
  assert.equal(row.id,baseline.combinations[i].id,'Source order or ID changed');
  const preserve=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!['narrative','narrative_title'].includes(k)));
  assert.deepEqual(preserve(row),preserve(baseline.combinations[i]),`State changed: ${row.id}`);
  assert.equal(typeof row.narrative,'string');assert(row.narrative.trim());
  assert.equal(typeof row.narrative_title,'string');assert(row.narrative_title.trim());
  const key=row.matrix_state_codes.join('|');assert(!states.has(key));assert(!ids.has(row.id));
  states.add(key);ids.add(row.id);
  // Preserve every Unicode character in the supplied title and paragraph exactly.
  rows[key]=[row.id,intern(titles,row.narrative_title),intern(texts,row.narrative)];
}
const runtime={version:'7.0-v54',sourceSha256:createHash('sha256').update(bytes).digest('hex'),titles,texts,rows};
await writeFile(new URL('data/policy/watch-v7.runtime.json',root),JSON.stringify(runtime));
console.log(`Validated ${ids.size} states; ${texts.length} unique paragraphs; source SHA256 ${runtime.sourceSha256}`);
