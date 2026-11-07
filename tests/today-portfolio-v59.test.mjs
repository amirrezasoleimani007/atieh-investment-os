import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {aggregateComposition,consecutivePairs,extendPortfolioFinancials,performanceHistory,portfolioPeriod,rankPerformance,scatterCell,scatterHistory} from '../lib/today-portfolio.mjs';
import {financialAtYear,financialYears} from '../lib/financial-year.mjs';

const json = (name) => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`,import.meta.url),'utf8'));
const register=json('portfolio-register'), prior=json('financial-companies');
const financials=extendPortfolioFinancials(prior,register);
const group=financials.filter(c=>c.scope==='گروه آتیه');
const metricWeights={growth:20,profitability:15,capitalReturn:20,cashQuality:15,resilience:20,workingCapital:10};
const partak='صنایع آتیه لوله پارتاک', best='آینده برتر (Best Future)', nia='نیا استیل';

test('new register reconciles direct and group rates, classifications and 13 entities',()=>{
  assert.equal(register.rows.length,13);
  assert.equal(group.length,13);
  assert.equal(new Set(group.map(c=>c.name)).size,13);
  assert.equal(register.rows.find(r=>r.name==='آتیه تجارت نقش جهان قشم').direct,.55);
  assert.equal(register.rows.find(r=>r.name==='آتیه تجارت نقش جهان قشم').group,.8934882993696178);
  assert.equal(register.rows.find(r=>r.name==='کارگزاری مبین سرمایه').control,'غیرکنترلی');
  assert.equal(register.rows.find(r=>r.name===partak).stewardship,'عملیاتی');
});

test('portfolio charts reconcile annual totals and preserve negative and missing values',()=>{
  const total=(rows)=>rows.reduce((sum,r)=>sum+(r.amount??0),0);
  const all=portfolioPeriod(register.rows,financials,1404,'equity','all');
  assert.equal(all.filter(r=>r.amount!==null).length,12);
  assert.equal(all.find(r=>r.name===nia).amount,null);
  assert.equal(all.find(r=>r.name===best).amount,18006615.850737333);
  assert.ok(Math.abs(total(all)-201087628.94127917)<0.001);
  for(const lens of ['nature','control','segment','stewardship']){
    const aggregate=aggregateComposition(all,lens);
    assert.ok(Math.abs(aggregate.reduce((s,r)=>s+r.value,0)-total(all))<0.001);
    assert.equal(aggregate.reduce((s,r)=>s+r.available,0),12);
  }
  const profit=portfolioPeriod(register.rows,financials,1403,'profit','direct');
  assert.equal(profit.find(r=>r.name===partak).amount,-7892*.8752546);
  assert.equal(profit.find(r=>r.name===best).amount,1178185.26672);
  const grouped=portfolioPeriod(register.rows,financials,1403,'profit','group');
  assert.equal(grouped.find(r=>r.name===partak).amount,-7892*.9666562124794504);
  assert.equal(group.find(c=>c.name===best).kpiHistory['136'].length,4);
});

test('annual rank follows active weights in current and historical years and omits unscored entities',()=>{
  for(const weights of [metricWeights,{...metricWeights,growth:5,profitability:30}]){
    for(const year of financialYears(group)){
      const ranks=rankPerformance(group.map(c=>financialAtYear(c,year)),weights);
      const rank=ranks.find(c=>c.name==='فولاد متیل');
      const point=performanceHistory(group,rank.name,[year],weights)[0];
      assert.equal(point.score,rank.dynamicScore);
      assert.equal(point.rank,rank.dynamicRank);
      assert.equal(ranks.find(c=>c.name===partak).dynamicRank,null);
      assert.equal(ranks.find(c=>c.name===best).dynamicScore,null);
    }
  }
  const annual=performanceHistory(group,'فولاد متیل',[1403,1404],metricWeights);
  assert.deepEqual(annual.map(p=>p.rank),[5,3]);
});

test('scatter uses score bands, historical observations and no invented segments',()=>{
  assert.deepEqual([scatterCell(0,0),scatterCell(3.33,3.33),scatterCell(6.66,6.66),scatterCell(10,10)],[1,5,9,9]);
  const years=[1401,1402,1403,1404];
  const observed=scatterHistory(group.find(c=>c.name==='فولاد متیل'),years,'scatterOperationalGrowth','scatterOperatingProfitability');
  assert.ok(observed.at(-1).cell!==null);
  assert.ok(consecutivePairs(observed,p=>p.cell!==null).length>0);
  assert.equal(consecutivePairs([observed[0],observed[2]],p=>p.cell!==null).length,0);
  assert.ok(scatterHistory(group.find(c=>c.name===partak),years,'scatterOperationalGrowth','scatterOperatingProfitability').every(p=>p.cell===null));
});

test('management table has the requested 11 rows and exact links to the 10 legacy stories',()=>{
  const rows=json('management-summary'), legacy=json('management-narratives').companies;
  const normalize = (s)=>s.replace(/^(شرکت|هلدینگ)\s+/, '').trim();
  assert.equal(rows.length,11);
  assert.equal(rows.filter(row=>legacy.some(c=>normalize(c.name)===row.name)).length,10);
  assert.ok(rows.find(r=>r.name.startsWith('نورد لوله کوثر')).actions[0].includes('آماده‌سازی واگذاری'));
  assert.equal(rows.find(r=>r.name===partak).stewardship,'سرپرستی عملکردی');
});
