import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const data = name => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url)));
test('approved company narratives and management statements are complete',()=>{
 const market=data('company-market-narratives'), management=data('management-narratives');
 assert.equal(market.companies.length,10);
 assert.equal(management.companies.length,10);
 assert.equal(Object.keys(market.marketCompanies).length,6);
 const ids=new Set(market.companies.map(x=>x.id));
 for(const links of Object.values(market.marketCompanies)) for(const id of links) assert.ok(ids.has(id));
 for(const c of market.companies) assert.equal(c.sections.filter(s=>s.heading).length,4);
 for(const c of management.companies){assert.ok(c.title);assert.ok(c.paragraphs.length>=2);}
 assert.ok(management.companies.at(-1).name.includes('صندوق پژوهش'));
 assert.ok(market.companies.at(-1).name.includes('پارتاک'));
});
test('all Trade rows retain their exact values, periods and related companies',()=>{
 const trade=data('steel-trade');
 assert.equal(trade.series.length,8);assert.equal(trade.records.length,56);
 assert.equal(trade.years.length,7);assert.ok(trade.years.at(-1).includes('10ماهه'));
 for(const s of trade.series){
  assert.deepEqual(s.values,trade.records.filter(r=>r.product===s.product).map(r=>r.value));
  assert.ok(s.values.every(Number.isFinite));assert.equal(s.companies.length,2);
 }
 assert.equal(trade.series.find(s=>s.product==='لوله درزجوش').values.at(-1),228.890455);
});
