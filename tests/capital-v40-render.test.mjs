import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {buildSync} from 'esbuild';
import {allocateCapital,DEFAULT_FINANCIAL_INPUT} from '../lib/capital-allocation.mjs';
const require=createRequire(import.meta.url);
const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const dir=fs.mkdtempSync(path.join(root,'.sites-runtime','render-'));
const file=path.join(dir,'components.cjs');
buildSync({stdin:{contents:'export {default as Entry} from "./components/entry-planning.tsx"; export {default as Trade} from "./components/trading-proximity-ranking.tsx"; export {default as SelectionMap} from "./components/movement-roadmap.tsx"; export {default as Desk} from "./components/capital-decision-desk.tsx"; export {default as Executive} from "./components/capital-executive-summary.tsx"; export {default as Flow} from "./components/capital-flow.tsx"; export {default as Review} from "./components/capital-project-review.tsx"; export {default as Lens} from "./components/core-connection-lens.tsx";',resolveDir:root,sourcefile:'render-entry.tsx',loader:'tsx'},outfile:file,bundle:true,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime'],logLevel:'silent'});
const {Flow,Lens,Review,Desk,Executive,Entry,Trade,SelectionMap}=require(file);
const finalReview=output=>renderToStaticMarkup(React.createElement(Review,{project:output.results[0],initialEvent:100}));
test.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
const project={id:'p',year:1406,name:'طرح نمونه',needType:'توسعه / CAPEX رشد',annualNeed:200,totalNeed:200,stageable:false};
test('v43 graphical portfolio excludes rolled-back paths and final review explains released funds',()=>{
 const output=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,cashStart:100},projects:[project]});
 const html=renderToStaticMarkup(React.createElement(Flow,{output,onSelect:()=>{}}));
 const result=finalReview(output);
 assert.match(result,/مبلغ ۱۰۰ بررسی و موقتاً/);assert.match(result,/آزادشده/);assert.match(result,/تأمین نهایی صفر/);
 assert.doesNotMatch(html,/class="has-allocation"/);
 assert.match(html,/class="allocation-number-map"/);
});
test('v40 core lens renders parent inheritance and transparent fixed reference',()=>{
 const html=renderToStaticMarkup(React.createElement(Lens,{rows:[{id:24,name:'فلزات پایه',coreFit:4.5}],selected:[{key:'activity:241',name:'فعالیت فولادی',parentId:24,child:true}],year:1406}));
 assert.match(html,/فعالیت فولادی/);assert.match(html,/برآورد از حوزه مادر/);assert.match(html,/۵۰/);assert.match(html,/بازرگانی مرجع = ۱۰۰/);assert.match(html,/همه حوزه‌های مدل/);
});
test('v43 opens with exactly one entry event and one previous/next navigation',()=>{
 const output=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,cashStart:250},projects:[project]});
 const html=renderToStaticMarkup(React.createElement(Flow,{output,onSelect:()=>{}}));
 assert.equal((html.match(/class="story-active"/g)||[]).length,1);
 assert.match(html,/data-event="entry"/);
 assert.doesNotMatch(html,/story-source-graphic/);
 assert.ok(html.indexOf('class="story-active"')<html.indexOf('class="flow-portfolio-map"'));
 assert.equal((html.match(/aria-label="حرکت در مسیر همین طرح"/g)||[]).length,1);
 assert.match(html,/<button disabled="">/);
 assert.match(html,/<details class="flow-portfolio-map">/);
});
test('v43 incomplete project final result uses unknown needs and no misleading funding bar',()=>{
 const output=allocateCapital({year:1406,financialInput:DEFAULT_FINANCIAL_INPUT,projects:[{...project,annualNeed:null}]});
 const html=finalReview(output);
 assert.match(html,/نیاز سال<\/span><strong>نامشخص/);
 assert.doesNotMatch(html,/class="story-final-bar"/);
 assert.doesNotMatch(html,/پوشش نیاز:/);
 assert.match(html,/نیاز و کسری تا تکمیل پرونده قابل اتکا نیست/);
});
test('v43 stop event distinguishes unassessed sources from capacity shortages',()=>{
 const output=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,requiredPayments:100,partnerCapacity:500},projects:[project]});
 const html=renderToStaticMarkup(React.createElement(Review,{project:output.results[0],initialEvent:1,onResources:()=>{}}));
 assert.match(html,/صفر تخصیص، به معنای صفر بودن ظرفیت منابع نیست/);
 assert.match(html,/توقف پیش از بررسی منابع/);assert.match(html,/بررسی و ویرایش منابع/);
 assert.doesNotMatch(html,/story-source-graphic/);
});
test('v43 source event exposes capacity numbers, permission failures and exact recorded allocation',()=>{
 const output=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,longDebtCapacity:300,totalNewDebtCeiling:150,longDebtRate:.4},projects:[{...project,maximumRate:.3}]});
 const html=renderToStaticMarkup(React.createElement(Review,{project:output.results[0],initialEvent:2}));
 assert.match(html,/data-event="source:1"/);
 assert.match(html,/چرا این منبع/);assert.match(html,/چرا دقیقاً ۰/);
 assert.match(html,/ظرفیت قابل اتکای سال/);assert.match(html,/۳۰۰/);
 assert.match(html,/۱۵۰/);assert.match(html,/۴۰٪/);assert.match(html,/۳۰٪/);
 assert.match(html,/حداقل یکی از مجوزها/);
 assert.equal((html.match(/class="story-active"/g)||[]).length,1);
});
test('v43 numeric portfolio map shows exact source shares and all three balance figures',()=>{
 const output=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,cashStart:120.25,longDebtCapacity:80.5,totalNewDebtCeiling:80.5,longDebtRate:.3},projects:[project]});
 const html=renderToStaticMarkup(React.createElement(Flow,{output,onSelect:()=>{}}));
 assert.match(html,/class="has-allocation"/);assert.match(html,/۸۰٫۵/);assert.match(html,/۱۱۹٫۵/);
 assert.match(html,/رزرو مصرف‌نشده/);assert.match(html,/مانده منبع/);
 assert.match(html,/جمع نهایی/);assert.match(html,/کسری/);
});

test('v43 stopped final result does not mark unperformed funding phases complete',()=>{
 const output=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,requiredPayments:100,partnerCapacity:500},projects:[project]});
 const html=finalReview(output);
 const phases=html.match(/<ol class="story-phases"[^>]*>(.*?)<\/ol>/s)[1];
 assert.equal((phases.match(/class="not-assessed"/g)||[]).length,2);
 assert.match(phases,/تأمین از منابع<small>بررسی نشد/);
 assert.match(phases,/کنترل اجرا<small>بررسی نشد/);
});

const renderDesk=(output,sourcePolicy)=>renderToStaticMarkup(React.createElement(Desk,{output,sourcePolicy,contextName:'تست حسابرسی',financeConfirmed:true,onOpen:()=>{},onSources:()=>{},onPolicy:()=>{}}));
test('v47 decision desk reports remaining debt after draw and protected reservation',()=>{
 const output=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,longDebtCapacity:100,totalNewDebtCeiling:100,longDebtRate:.2},projects:[{...project,id:'funded',annualNeed:80,totalNeed:80,entryRank:1},{...project,id:'reserved',annualNeed:30,totalNeed:30,entryRank:2,dedicatedMode:'reserved',dedicatedSource:'longDebt',dedicatedAmount:10}]});
 assert.equal(output.used.longDebt,80);assert.equal(output.reserved.longDebt,10);
 const html=renderDesk(output);assert.match(html,/سقف باقی‌مانده بدهی پس از مصرف و رزرو: <b>۱۰<\/b>/);
 const flow=renderToStaticMarkup(React.createElement(Flow,{output,onSelect:()=>{}}));assert.match(flow,/سقف مشترک بدهی پس از مصرف و رزرو: <b>۱۰<\/b>/);
});
test('v47 desk displays the same completed legacy source order as the engine',()=>{
 const policy={orders:{[project.needType]:['partner']},reason:'مصوبه'};
 const output=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,cashStart:200},projects:[project],sourcePolicy:policy});
 const html=renderDesk(output,policy),order=html.match(/ترتیب منابع قابل بررسی<\/summary><small>(.*?)<\/small>/s)[1];
 assert.match(order,/آورده سرمایه‌ای سهامداران و شرکا ← بدهی میان\/بلندمدت ← منابع داخلی ← مولدسازی \/ واگذاری ← اعتبار کوتاه‌مدت/);
 assert.deepEqual(output.results[0].trace.filter(t=>t.source).map(t=>t.source),['partner','longDebt','internal','disposal','shortDebt']);
});
test('v47 conflicting reservations are explicitly reported in desk and executive controls',()=>{
 const output=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,cashStart:100},projects:[{...project,dedicatedMode:'reserved',dedicatedSource:'internal',dedicatedAmount:150}]});
 assert.equal(output.reservationConflict,true);assert.equal(output.totalExecuted,0);
 assert.match(renderDesk(output),/رزروها از ظرفیت منبع یا سقف بدهی بیشترند/);
 const executive=renderToStaticMarkup(React.createElement(Executive,{output,annualOutputs:[output],contextName:'تست',signal:'تست',financeStatuses:{1406:'confirmed'},blockedYears:[],onYear:()=>{},onOpen:()=>{}}));
 assert.match(executive,/توقف به علت تعارض رزروها/);
});
test('v47 fractional amounts remain visible in desk and executive instead of being rounded to zero',()=>{
 const output=allocateCapital({year:1406,financialInput:{...DEFAULT_FINANCIAL_INPUT,cashStart:.04},projects:[{...project,annualNeed:.04,totalNeed:.04}]});assert.equal(output.totalExecuted,.04);
 assert.match(renderDesk(output),/۰٫۰۴/);
 const executive=renderToStaticMarkup(React.createElement(Executive,{output,annualOutputs:[output],contextName:'تست',signal:'تست',financeStatuses:{1406:'confirmed'},blockedYears:[],onYear:()=>{},onOpen:()=>{}}));assert.match(executive,/۰٫۰۴/);
});

test('v48 selected entry exposes the trade route and strengthened core',()=>{
 const opportunity={key:'parent:24',name:'فلزات',parentId:24,parentName:'حوزه اصلی',child:false,macro:70,detail:60,management:4,entryPriority:70,horizon:'core'};
 const plan={'parent:24':{share:0,priorityRank:1,parentId:24,entryMode:'trade'}};
 const html=renderToStaticMarkup(React.createElement(Entry,{opportunities:[opportunity],baskets:{1406:plan},activeYear:1406,plan,weights:{macro:50,detail:30,board:20},onAdd:()=>{},onMode:()=>{},onYear:()=>{},onWeights:()=>{},onRemove:()=>{},onRank:()=>{}}));
 assert.match(html,/مسیر ورود و هسته هدف/);assert.match(html,/تقویت هسته بازرگانی فولاد/);assert.match(html,/option value="trade" selected=""/);
});
test('v49 trading lens exposes three sorting criteria while removed explanatory sections stay absent',()=>{
 const html=renderToStaticMarkup(React.createElement(Trade,{rows:[{id:24,name:'فلزات',coreFit:2}],selected:[],year:1406}));
 assert.match(html,/aria-sort="descending"/);assert.match(html,/مرتب‌سازی بر اساس/);for(const key of ['service','steel','score'])assert.match(html,new RegExp(`option value="${key}"`));assert.equal((html.match(/class="proximity-cell/g)||[]).length,3);assert.doesNotMatch(html,/فرمول، مبنای داده و محدودیت کاربرد/);
});
test('v48 selection roadmap renders the decision stages and marks legacy evidence honestly',()=>{
 const opportunity={key:'parent:24',name:'فلزات',parentId:24,parentName:'حوزه اصلی',child:false,macro:70,detail:60,management:4,entryPriority:70,horizon:'core'};
 const input={baskets:{1406:{'parent:24':{priorityRank:1,entryMode:'direct'}}},opportunities:[opportunity],scenario:{id:'s',revision:1,base:{mission:{24:'مجاز'},focus:{24:'بررسی عمیق'},selectionWeights:{macro:50,detail:30,board:20},vision:{core:60,adjacent:30,transform:10}}}};
 const html=renderToStaticMarkup(React.createElement(SelectionMap,{input,onYear:()=>{}}));assert.match(html,/حدود مأموریت/);assert.match(html,/وضعیت غربال/);assert.match(html,/نظر مدیریت/);assert.match(html,/سرمایه‌گذاری مستقیم/);assert.match(html,/سابقه زمان انتخاب موجود نیست/);assert.doesNotMatch(html,/اصل سررسیدشده/);
});
