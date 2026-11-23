import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),bytes=await readFile(new URL('data/policy/financial_watch_6charts_diagnostic_synthesis_fa_v10.json',root));
const source=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')),records=source.integrated_lookup.records;
assert.equal(records.length,45927);
const pools={texts:[],topics:[],priorities:[],rules:[],patterns:[],codes:[]},indices=Object.fromEntries(Object.keys(pools).map(k=>[k,new Map()]));
const intern=(k,v)=>{if(!indices[k].has(v)){indices[k].set(v,pools[k].length);pools[k].push(v);}return indices[k].get(v)};
const rows={};
for(const r of records){assert(!rows[r.key]);assert.equal(typeof r.narrative,'string');assert(r.narrative.trim());rows[r.key]=['narrative','main_review_topic','priority_level','priority_rule','diagnostic_pattern','diagnostic_code'].map((k,i)=>intern(Object.keys(pools)[i],r[k]));}
const runtime={version:source.meta.version,sourceSha256:createHash('sha256').update(bytes).digest('hex'),...pools,rows};
await writeFile(new URL('data/policy/watch-v10.runtime.json',root),JSON.stringify(runtime));
console.log(JSON.stringify({states:records.length,uniqueTexts:pools.texts.length,sourceSha256:runtime.sourceSha256}));
