import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {annualPortfolioOutput,validateAnnualPortfolio,movementLabel,parentBasketKey,activityBasketKey} from "../lib/movement-model.mjs";

test("five-step workflow removes Focus and standalone selection screens from navigation",()=>{
 const source=fs.readFileSync(new URL("../components/movement-path.tsx",import.meta.url),"utf8");
 assert.match(source,/جهت‌گیری راهبردی پرتفوی/);
 assert.match(source,/ارزیابی تفصیلی فرصت‌ها/);
 assert.match(source,/اولویت‌های راهبردی مدیریت/);
 assert.match(source,/طراحی و تخصیص پرتفوی سالانه/);
 assert.match(source,/نقشه تحول پرتفوی تا ۱۴۱۴/);
 const stageBlock=source.match(/const STAGES:[\s\S]*?;\n/)?.[0]??"";
 assert.equal((stageBlock.match(/id:"/g)??[]).length,5);
 assert.doesNotMatch(stageBlock,/focus|selection/);
 assert.doesNotMatch(source,/تمرکز فرصت‌ها|پیشنهاد سیستم|تصمیم مدیر/);
});

test("current holdings and new opportunities form annual output without automatic transfer",()=>{
 const current=[{name:"لوله کوثر",horizon:"adjacent",share:20,index:0},{name:"فولاد متیل",horizon:"core",share:50,index:1}];
 const transformKey=parentBasketKey(44),lookup={[transformKey]:{parentId:44,horizon:"transform",mission:"مجاز",condition:{},name:"فرصت تحولی"}};
 const exitOnly=annualPortfolioOutput({0:0,1:50},current,{},lookup);
 assert.deepEqual(exitOnly.totals,{core:50,adjacent:0,transform:0});
 assert.equal(exitOnly.total,50);
 const replaced=annualPortfolioOutput({0:0,1:50},current,{[transformKey]:{share:20}},lookup);
 assert.deepEqual(replaced.totals,{core:50,adjacent:0,transform:20});
 assert.equal(replaced.total,70);
 assert.equal(movementLabel(20,0),"خروج");
 assert.equal(movementLabel(0,20),"ورود");
 assert.equal(movementLabel(20,20),"حفظ");
});

test("annual portfolio validates target versus actual and blocks parent-child double allocation",()=>{
 const parent=parentBasketKey(7),child=activityBasketKey("2410");
 const lookup={
  [parent]:{parentId:7,horizon:"core",mission:"مجاز",condition:{},name:"حوزه"},
  [child]:{parentId:7,horizon:"core",mission:"مجاز",condition:{},name:"زیر‌بخش"},
 };
 const current=[{name:"دارایی مجاور",horizon:"adjacent",share:30,index:0}];
 const valid=validateAnnualPortfolio({core:60,adjacent:30,transform:10},{0:30},current,{[parent]:{share:60},[parentBasketKey(8)]:{share:10}}, {...lookup,[parentBasketKey(8)]:{parentId:8,horizon:"transform",mission:"مجاز",condition:{},name:"تحولی"}});
 assert.equal(valid.valid,true);
 assert.equal(valid.total,100);
 const duplicate=validateAnnualPortfolio({core:60,adjacent:30,transform:10},{0:30},current,{[parent]:{share:30},[child]:{share:30},[parentBasketKey(8)]:{share:10}}, {...lookup,[parentBasketKey(8)]:{parentId:8,horizon:"transform",mission:"مجاز",condition:{},name:"تحولی"}});
 assert.equal(duplicate.valid,false);
 assert.match(duplicate.reason,/هم‌زمان/);
});
