import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const markets=JSON.parse(readFileSync(new URL('../public/data/industry-markets.json',import.meta.url),'utf8'));
test('five markets contain finite sourced values and complete narratives',()=>{
 assert.deepEqual(markets.map(m=>m.id),['welded','seamless','cored','bentonite','paint']);
 for(const m of markets){assert.ok(m.paragraphs.length>=3);assert.equal(m.source.slide,1);assert.match(m.source.sha256,/^[a-f0-9]{64}$/);for(const c of m.charts){assert.ok(c.note);for(const d of c.items){assert.ok(Number.isFinite(d.value));if(d.high)assert.ok(d.high>=d.value);if(c.kind==='gauge')assert.ok(d.value<=100);}}}
});
test('capacity, ranges and conditional horizons retain source distinctions',()=>{
 const [w,s,c,b,p]=markets;
 assert.deepEqual(w.charts[0].items.map(x=>x.value),[2705,1755,280]);assert.equal(w.charts[0].items[2].high,310);
 assert.deepEqual(s.charts[0].items.map(x=>x.value),[625,345,64,600]);assert.equal(s.charts[1].items[3].value,500);assert.equal(s.charts[1].items[3].forecast,true);
 assert.equal(c.charts[0].items[1].qualifier,'بیش از');
 assert.deepEqual(b.charts[0].items.map(x=>x.value),[440,550]);assert.match(b.charts[1].note,/کسری بازار محاسبه نمی‌شود/);
 assert.deepEqual(p.charts[0].items.map(x=>x.value),[900,750]);assert.equal(p.charts[1].items[0].value,49);assert.equal(p.charts[2].items[0].value,70);
});
