import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import ScatterChart from '../components/scatter-chart';
import {CompanyDashboard} from '../app/dashboard-app';
import {parseFinancialWorkbook} from '../lib/workbook-parser';
import {selectReportModel} from '../lib/report-period';
import {buildFinancialModel,buildAxisMatrix,CHART_DEFINITIONS,DEFAULT_SETTINGS,type ChartPoint} from '../lib/financial-engine';
const input=process.env.IPS_ANNUAL_WORKBOOK??'../../review-data/2.Metil.xlsx';
const rows: Record<string,unknown>[]=[];
for(const year of [1402,1403,1404]) for(const company of ['شرکت نمونه یک','شرکت نمونه دو']) for(const code of ['144','186','146','178','152','154','176','151','164','163','173','174','155','162','169','175','170']) {
 rows.push({'شرکت':company,'سال':year,'ماهیت':'بازرگانی/خدماتی','کد متغیر':code,'متغیر':`شاخص ${code}`,'واحد':'درصد','مقدار':.1,'امتیاز':year===1404?8:5,'نشان':100});
}
const sourceBytes=existsSync(input)?readFileSync(input):null;
const source=sourceBytes?parseFinancialWorkbook(sourceBytes.buffer.slice(sourceBytes.byteOffset,sourceBytes.byteOffset+sourceBytes.byteLength),'2.Metil.xlsx'):buildFinancialModel(rows,Object.keys(rows[0]),'synthetic-ui-fixture');
const model=selectReportModel(source,'annual'),matrix=buildAxisMatrix(model,DEFAULT_SETTINGS);
const company=model.companies.find(c=>c.includes('کاسپین'))??model.companies[0],year=model.years.at(-1)!;
const noop=()=>{};
function dashboard(mode:'trend'|'portfolio'|'peers',overrides:Record<string,unknown>={}) {
 return renderToStaticMarkup(<CompanyDashboard model={model} matrix={matrix} settings={DEFAULT_SETTINGS} selectedCompany={company} selectedYear={year} displayMode={mode} natureFilter="همه" bubbleMetric="none" showAverage showLabels={false} highlightSelected setSelectedCompany={noop} setSelectedYear={noop} setDisplayMode={noop} setNatureFilter={noop} setBubbleMetric={noop} setShowAverage={noop} setShowLabels={noop} setHighlightSelected={noop} reportRef={{current:null}} reportFilter={<label>نوع گزارش<select><option>سالانه</option><option>شش‌ماهه</option></select></label>} {...overrides}/>);
}
test('annual data renders four charts before one exact v7 paragraph and final status table in all three modes',()=>{
 for(const mode of ['trend','portfolio','peers'] as const){
  const html=dashboard(mode);
  assert.equal((html.match(/class="chart-card watch-chart/g)??[]).length,4);
  assert.equal((html.match(/class="watch-v53-narrative watch-v7-story"/g)??[]).length,1);
  assert(html.indexOf('watch-charts-grid')<html.indexOf('watch-v53-narrative'));
  assert(html.indexOf('watch-v53-narrative')<html.indexOf('watch-status-table'));
  assert.equal((html.match(/مشاهده فرمول محور/g)??[]).length,8);
  assert.doesNotMatch(html,/اقدام‌های پیشنهادی|مقیاس‌پذیر است|اتکای سود به اقلام غیرنقدی بالاست/);
  assert.match(html,/data-rulebook="7.0"/);
 }
});
test('peer mode ignores a stale portfolio nature filter',()=>{
 const html=dashboard('peers',{natureFilter:'ماهیت دیگری که در پرتفوی انتخاب شده بود'});
 assert.match(html,/scatter-point/);assert.doesNotMatch(html,/برای این انتخاب داده کافی وجود ندارد/);
});
test('synthetic half-year data remains isolated and labels and table use the selected interim period',()=>{
 const mixed=buildFinancialModel([...rows,...rows.map(r=>({...r,'سال':`${Number(r['سال'])+1}-06`,'امتیاز':2}))],Object.keys(rows[0]),'synthetic-mixed-period-fixture');
 const interim=selectReportModel(mixed,'half-year'),im=buildAxisMatrix(interim,DEFAULT_SETTINGS);
 assert.deepEqual(interim.years,[1403,1404,1405]);
 assert.equal(im.get('شرکت نمونه یک')?.get(1405)?.axes.scatterOperationalGrowth.score,2);
 const html=dashboard('trend',{model:interim,matrix:im,selectedCompany:'شرکت نمونه یک',selectedYear:1405});
 assert.match(html,/شش‌ماهه ۱۴۰۵/);assert.match(html,/شش‌ماهه 1405/);
 assert.match(html,/data-rulebook="7.0"/);assert.doesNotMatch(html,/سالانه ۱۴۰۵/);
});
test('missing company or report retains selectors and shows a recoverable empty state',()=>{
 const html=dashboard('trend',{selectedCompany:'فاقد داده'});
 assert.match(html,/فیلترهای دیده‌بان مالی/);assert.match(html,/نوع گزارش/);assert.match(html,/داده‌ای موجود نیست/);
 assert.doesNotMatch(html,/watch-v53-narrative/);
});
function point(year:number,x:number,y:number):ChartPoint {
 const b=matrix.get(company)!.get(model.years.at(-1)!)!,d=CHART_DEFINITIONS[0];
 return {company,nature:b.nature,year,x,y,selected:true,xAxis:b.axes[d.xKey],yAxis:b.axes[d.yKey],bubbleValue:null,bubbleLabel:'',spreadValue:null,spreadScore:null,regionTitle:'',interpretation:''};
}
test('SVG trajectory orders old-to-new despite shuffled input; every year labeled; one-point path is absent',()=>{
 const chart=(points:ChartPoint[],trend=true)=>renderToStaticMarkup(<ScatterChart definition={CHART_DEFINITIONS[0]} points={points} showTrend={trend} showLabels={false} showAverage highlightSelected reportKind="half-year"/>);
 const html=chart([point(1404,8,8),point(1402,2,2),point(1403,5,4)]);
 assert.match(html,/path="M 200 329.6 L 395 257.2 L 590 112.39999999999998"/);
 for(const year of ['۱۴۰۲','۱۴۰۳','۱۴۰۴'])assert(html.includes(year));
 assert.match(html,/watch-dash-flow/);assert.match(html,/animateMotion/);assert.match(html,/شش‌ماهه 1404/);
 assert.doesNotMatch(chart([point(1404,8,8)]),/animateMotion/);
 const singleton=chart([point(1404,8,8)],false);assert.doesNotMatch(singleton,/class="average-lines"/);assert.match(singleton,/تنها یک شرکت/);
});
