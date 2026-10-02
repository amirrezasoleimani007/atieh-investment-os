import test from "node:test";
import assert from "node:assert/strict";
import master from "../public/data/movement-master-data.json" with {type:"json"};
import names from "../public/data/isic-persian-names.json" with {type:"json"};
import opportunities from "../public/data/opportunities.json" with {type:"json"};
import {calculateStrategicFit} from "../lib/strategic-fit.mjs";
import {priorityScore} from "../lib/priority-score.mjs";
import {MOVEMENT_BASELINE,ISIC_PRESETS,YEARS,restoreMovementState,updateVisionShare,weightedHorizon,scoreIsicActivities,rankSingleIndicator,selectionScore,canAddBasket,validateBasket,parentBasketKey,activityBasketKey} from "../lib/movement-model.mjs";

test("vision changes Y, matrix priority and horizon but never growth coordinate",()=>{
 const baseline=calculateStrategicFit(opportunities,MOVEMENT_BASELINE.fitWeights);
 const modified=calculateStrategicFit(opportunities,{core:10,adjacent:10,transform:80});
 assert.equal(opportunities.length,77);
 assert.ok(opportunities.every((r,i)=>r.xPlotBaseline===opportunities[i].xPlotBaseline));
 assert.ok(modified.some((r,i)=>Math.abs(r.dynamicY-baseline[i].dynamicY)>.1));
 assert.ok(modified.some((r,i)=>Math.abs(priorityScore(opportunities[i].xPlotBaseline,r.dynamicY)-priorityScore(opportunities[i].xPlotBaseline,baseline[i].dynamicY))>.1));
 assert.ok(opportunities.some(r=>weightedHorizon(r.coreFit,r.adjacentFit,r.transformFit,{core:10,adjacent:10,transform:80})!==weightedHorizon(r.coreFit,r.adjacentFit,r.transformFit)));
 let vision={core:60,adjacent:30,transform:10};for(const key of ["core","adjacent","transform"]){vision=updateVisionShare(vision,key,41.3);assert.ok(Math.abs(Object.values(vision).reduce((a,b)=>a+b,0)-100)<1e-9)}
 const restored=restoreMovementState(null,opportunities);assert.ok(Object.values(restored.mission).every(v=>v==="مجاز"));assert.equal(restored.visionLocked,false);
});
test("all 145 activities have Persian primary names and single-indicator ordering is parent-filterable",()=>{
 assert.equal(Object.keys(names).length,master.length);
 assert.ok(master.every(row=>/[\u0600-\u06ff]/u.test(names[row.code])));
 const result=scoreIsicActivities(master,ISIC_PRESETS.balanced.weights);
 const ranked=rankSingleIndicator(result.activities.filter(row=>row.isicLevel==="ISIC 4-digit"),"investment");
 assert.ok(ranked.length>50);
 assert.ok(ranked.every((row,index)=>index===0||ranked[index-1].percentiles.investment>=row.percentiles.investment));
 const parent=rankSingleIndicator(result.activities,"investment",7);assert.ok(parent.every(row=>row.parentId===7));
 const alternative=scoreIsicActivities(master,ISIC_PRESETS.investment.weights);
 assert.ok(result.activities.some((row,i)=>row.score!=null&&alternative.activities[i].score!=null&&Math.abs(row.score-alternative.activities[i].score)>.01));
 assert.ok(result.activities.some((row,i)=>row.rank!=null&&alternative.activities[i].rank!=null&&row.rank!==alternative.activities[i].rank));
});
test("selection policy rescales missing components and preserves parent and child board independence",()=>{
 const weights={macro:50,detail:30,board:20};
 assert.equal(selectionScore(70,80,4,weights).score,74);
 assert.equal(selectionScore(70,80,null,weights).score,73.75);
 assert.equal(selectionScore(70,null,4,weights).score,5000/70);
 assert.equal(selectionScore(70,null,null,weights).score,70);
 const restored=restoreMovementState({mission:{7:"مجاز"},board:{7:{score:4,reason:""}},activityBoard:{"2410":{score:2,reason:""}}},[{id:7,priority:70}]);
 assert.equal(restored.board[7].score,4);assert.equal(restored.activityBoard["2410"].score,2);
 assert.equal(restored.activityBoard["2420"],undefined);
});
test("annual targets and basket parent-child exclusivity validate independently across 1406–1414",()=>{
 const p=parentBasketKey(7),c=activityBasketKey("2410");const lookup={[p]:{parentId:7,horizon:"core",mission:"مجاز",condition:{}},[c]:{parentId:7,horizon:"core",mission:"مجاز",condition:{}}};
 assert.equal(canAddBasket({[p]:{share:30}},c,7,lookup),false);
 assert.equal(canAddBasket({[c]:{share:30}},p,7,lookup),false);
 assert.equal(validateBasket({core:100,adjacent:0,transform:0},{[p]:{share:100}},lookup).valid,true);
 assert.equal(validateBasket({core:100,adjacent:0,transform:0},{[p]:{share:50},[c]:{share:50}},lookup).valid,false);
 assert.equal(validateBasket({core:60,adjacent:30,transform:10},{[p]:{share:60}},lookup).totals.core,60);
 const saved={vision:{core:20,adjacent:20,transform:60},annualShares:{1406:{core:60,adjacent:30,transform:10},1407:{core:50,adjacent:35,transform:15},1414:{core:60,adjacent:30,transform:10}},baskets:{1406:{[p]:{share:30}},1407:{[c]:{share:20}}}};
 const restored=restoreMovementState(saved,[{id:7,priority:70}],master);
 assert.deepEqual(restored.annualShares[1414],saved.vision);
 assert.notDeepEqual(restored.annualShares[1406],restored.annualShares[1407]);
 assert.deepEqual(YEARS,[1406,1407,1408,1409,1410,1411,1412,1413,1414]);
});
