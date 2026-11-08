import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculateStrategicFit, redistributePortfolioWeights, transformFitEvidence } from "../lib/strategic-fit.mjs";
import { zoneFor } from "../lib/movement-zones.mjs";

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const rows = await json("../public/data/opportunities.json");
const relatedness = await json("../public/data/opportunity-relatedness.json");
const keys = ["core","adjacent","transform"];
const base = { core:60, adjacent:30, transform:10 };
const approx = (a,b) => assert.ok(Math.abs(a-b)<1e-10,`${a} ≠ ${b}`);

test("zeroing two sliders cannot create an out-of-range weight or a total below 100",()=>{
  const a=redistributePortfolioWeights(base,"adjacent",0);
  const b=redistributePortfolioWeights(a,"transform",0);
  const c=redistributePortfolioWeights(b,"core",50);
  assert.deepEqual(b,{core:90,adjacent:10,transform:0});
  assert.deepEqual(c,{core:50,adjacent:50,transform:0});
  assert.deepEqual(redistributePortfolioWeights({core:100,adjacent:0,transform:0},"core",50),{core:50,adjacent:25,transform:25});
});

test("redistribution preserves the changed weight and all bounds for every integer slider value",()=>{
  for (const input of [base,{core:90,adjacent:10,transform:0},{core:10,adjacent:0,transform:90},{core:1,adjacent:88,transform:11}]) {
    for (const key of keys) for(let next=0;next<=90;next++){
      const result=redistributePortfolioWeights(input,key,next);
      assert.equal(result[key],next);
      assert.equal(Object.values(result).reduce((a,b)=>a+b,0),100);
      assert.ok(Object.values(result).every(x=>Number.isInteger(x)&&x>=0&&x<=90));
    }
  }
});

test("live horizon contributions reconcile to the actual matrix coordinate and zone movement",()=>{
  const trade=rows.find(row=>row.id===41);
  const [before]=calculateStrategicFit([trade],base);
  const [after]=calculateStrategicFit([trade],{core:10,adjacent:80,transform:10});
  approx(before.strategicRaw,6.463644639120565);
  approx(before.dynamicY,8.314476309665652);
  approx(after.dynamicY,5.951787096067987);
  approx(after.strategicRaw,Object.values(after.contributions).reduce((a,b)=>a+b,0));
  approx(after.strategicRaw-before.strategicRaw,keys.reduce((d,k)=>d+after.contributions[k]-before.contributions[k],0));
  assert.equal(zoneFor(trade.xPlotBaseline,before.dynamicY).title,"اولویت ورود");
  assert.equal(zoneFor(trade.xPlotBaseline,after.dynamicY).title,"توسعه انتخابی");
});

test("reported transformation contributions reconcile with all 77 governed scores",()=>{
  for(const row of rows){
    const evidence=transformFitEvidence(rows,relatedness,row.id);
    assert.equal(evidence.top.length,3);
    approx(evidence.total,row.transformFit);
    approx(evidence.top.reduce((sum,item)=>sum+item.contribution,0)+evidence.remainder,row.transformFit);
  }
});
