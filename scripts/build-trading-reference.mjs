import fs from 'node:fs';
const rows=JSON.parse(fs.readFileSync('public/data/opportunities.json','utf8'));
const matrix=JSON.parse(fs.readFileSync('public/data/opportunity-relatedness.json','utf8'));
if(rows.length!==77||new Set(rows.map(r=>r.id)).size!==77)throw Error('Expected 77 unique sectors');
const byId=new Map(rows.map(r=>[r.id,r])),ix=new Map(matrix.ids.map((id,i)=>[id,i]));
const relation=(a,b)=>byId.get(a).ioCode===byId.get(b).ioCode?10:matrix.matrix[ix.get(a)][ix.get(b)];
const raw=rows.map(r=>r.verticalSteel).sort((a,b)=>a-b),position=(raw.length-1)*.95;
const ceiling=raw[Math.floor(position)]+(raw[Math.ceil(position)]-raw[Math.floor(position)])*(position%1);
const reference=rows.map(r=>{
 const service=(relation(r.id,41)+relation(r.id,52))/2,steel=Math.max(relation(r.id,24),relation(r.id,25));
 const reconstructed=[41,52].includes(r.id)?9:.9*Math.min(service,Math.sqrt(service*steel));
 if(Math.abs(reconstructed-r.coreFit)>1e-8)throw Error(`Core reconstruction mismatch ${r.id}`);
 return {id:r.id,service:10*service,steelTransaction:r.verticalSteel,legacyCore:r.coreFit};
});
fs.writeFileSync('lib/trading-reference.json',JSON.stringify({method:'trade-expansion-v2',baseYear:1400,ceiling,reference},null,2)+'\n');
