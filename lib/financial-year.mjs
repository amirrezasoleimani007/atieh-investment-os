export const SCATTER_COMPONENTS={scatterOperationalGrowth:[['144',.55],['186',.45]],scatterOperatingProfitability:[['146',.6],['178',.4]],scatterResourceProductivity:[['152',.6],['154',.4]],scatterCapitalValueCreation:[['176',.6],['151',.4]],scatterLiquidityStrength:[['164',.6],['163',.4]],scatterFinancialStructure:[['173',.4],['174',.35],['155',.25]],scatterEarningsQuality:[['162',.6],['169',.4]],scatterFcfGeneration:[['175',.6],['170',.4]]};
export function financialAtYear(company,year){
 const scoreFor=code=>company.kpiHistory?.[code]?.find(p=>p.year===year)?.score;
 const scatterAxes=Object.fromEntries(Object.entries(SCATTER_COMPONENTS).map(([key,parts])=>{const valid=parts.every(([code])=>Number.isFinite(scoreFor(code)));return [key,valid?Math.round(parts.reduce((s,[code,w])=>s+scoreFor(code)*w,0)*1e4)/1e4:null];}));
 // Exact current reference retained for legacy files without historical KPI scores.
 if(year===company.year)for(const key of Object.keys(scatterAxes))if(scatterAxes[key]==null&&Number.isFinite(company.scatterAxes?.[key]))scatterAxes[key]=company.scatterAxes[key];
 const dimensions=company.yearlyDimensions?.[year]??(year===company.year?company.dimensions:{});
 const kpis=Object.fromEntries(Object.entries(company.kpiHistory??{}).flatMap(([code,history])=>{const p=history.find(p=>p.year===year);if(!p)return [];return [[code,{...p,previous:history.find(p=>p.year===year-1)?.value??null}]];}));
 const score=company.annualScores?.[year]??(year===company.year?company.score:null);
 return {...company,year,dimensions,scatterAxes,kpis,score,coverage:Object.values(dimensions??{}).filter(d=>d.score!=null).length/6,classification:score==null?'فاقد داده':score>=6.66?'مطلوب':score>=3.33?'متوسط':'ضعیف'};
}
export function financialYears(companies){const years=new Set();for(const c of companies){for(const y of [c.year,...Object.keys(c.yearlyDimensions??{}).map(Number)]){const r=financialAtYear(c,y);if(Object.values(r.scatterAxes).some(Number.isFinite)||Object.values(r.dimensions??{}).some(d=>Number.isFinite(d.score)))years.add(y);}}return [...years].sort((a,b)=>b-a);}
