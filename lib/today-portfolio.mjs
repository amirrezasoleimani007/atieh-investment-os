import { financialAtYear } from './financial-year.mjs';

export function extendPortfolioFinancials(companies, register) {
  return [...companies, ...register.rows.filter(row => !companies.some(c => c.scope === 'گروه آتیه' && c.name === row.financialName)).map(row => {
    const kpiHistory = register.financialAdditions[row.financialName] ?? {};
    const year = Math.max(0, ...Object.values(kpiHistory).flat().map(p => p.year));
    return {name: row.financialName, scope: 'گروه آتیه', nature: row.nature, year, rank: null,
      score: null, classification: 'فاقد داده', coverage: 0, dimensions: {}, yearlyDimensions: {},
      annualScores: {}, scatterAxes: {}, kpis: {}, kpiHistory};
  })];
}

export function portfolioPeriod(rows, financials, year, metric, scope) {
  const financialByName = new Map(financials.filter(c => c.scope === 'گروه آتیه').map(c => [c.name, c]));
  const code = metric === 'equity' ? '136' : '124';
  return rows.map(row => {
    const point = financialByName.get(row.financialName)?.kpiHistory?.[code]?.find(p => p.year === year);
    const factor = scope === 'all' ? 1 : row[scope];
    const amount = point?.unit === 'میلیون ریال' && Number.isFinite(point.value) && Number.isFinite(factor)
      ? point.value * factor : null;
    return {...row, amount};
  });
}

export function aggregateComposition(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row[key]) ?? {label: row[key], value: 0, count: 0, available: 0};
    group.count++;
    if (Number.isFinite(row.amount)) {
      group.value += row.amount;
      group.available++;
    }
    groups.set(row[key], group);
  }
  return [...groups.values()];
}

export function scatterCell(x, y) {
  const band = n => n >= 6.66 ? 2 : n >= 3.33 ? 1 : 0;
  return band(y) * 3 + band(x) + 1;
}

export function scatterHistory(company, years, xKey, yKey) {
  if (!company) return [];
  return [...new Set(years)].sort((a,b) => a-b).map(year => {
    const {scatterAxes} = financialAtYear(company, year);
    const x = scatterAxes[xKey], y = scatterAxes[yKey];
    return {year, x, y, cell: Number.isFinite(x) && Number.isFinite(y) ? scatterCell(x,y) : null};
  });
}

export function rankPerformance(companies, weights) {
  return companies.map(c => {
    const dimensions = Object.entries(weights).filter(([key, weight]) => weight > 0 && Number.isFinite(c.dimensions?.[key]?.score));
    const sum = dimensions.reduce((s, [,weight]) => s + weight, 0);
    const dynamicScore = sum ? dimensions.reduce((s, [key, weight]) => s + c.dimensions[key].score * weight, 0) / sum : null;
    return {...c, dynamicScore, dynamicRank: null};
  }).sort((a,b) => (b.dynamicScore ?? -Infinity) - (a.dynamicScore ?? -Infinity))
    .map((row, index, ordered) => ({...row, dynamicRank: row.dynamicScore == null ? null :
      ordered.findIndex(r => r.dynamicScore === row.dynamicScore) + 1}));
}

export function performanceHistory(companies, name, years, weights) {
  return [...new Set(years)].sort((a,b) => a-b).map(year => {
    const ranks = rankPerformance(companies.map(c => financialAtYear(c, year)), weights);
    const row = ranks.find(c => c.name === name);
    return {year, score: row?.dynamicScore ?? null, rank: row?.dynamicRank ?? null,
      peers: ranks.filter(c => c.dynamicRank != null).length};
  });
}

export function consecutivePairs(points, usable) {
  return points.slice(1).flatMap((p,i) => p.year === points[i].year + 1 && usable(p) && usable(points[i])
    ? [[points[i], p]] : []);
}


export function averageDimensionScores(companies, keys) {
  return Object.fromEntries(keys.map(key => {
    let total = 0, count = 0;
    for (const company of companies) {
      const score = company.dimensions?.[key]?.score;
      if (Number.isFinite(score)) { total += score; count++; }
    }
    return [key, {score: count ? total / count : null, count}];
  }));
}
