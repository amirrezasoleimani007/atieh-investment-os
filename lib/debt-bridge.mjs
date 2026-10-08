/** Equal annual principal; first interest/payment year follows drawing year. No cash rollover assumed. */
export function debtBridge(outputs,terms={}){
 const years=outputs.map(o=>o.year).sort((a,b)=>a-b),end=Math.max(...years),schedule=new Map(years.map(year=>[year,{year,drawn:0,principal:0,interest:0,unknown:0}]));
 const missing=[];let tailPrincipal=0;
 for(const out of outputs){
  for(const source of ['shortDebt','longDebt']){
   const amount=out.used[source]??0;if(!(amount>0))continue;
   const current=schedule.get(out.year);current.drawn+=amount;
   const term=terms[`${out.year}:${source}`],rate=out.capacity[`${source}Rate`];
   if(!term||!Number.isInteger(term.years)||term.years<1||term.years>30||!Number.isInteger(term.grace)||term.grace<0||term.grace>=term.years||!Number.isFinite(rate)||rate<0){missing.push({year:out.year,source,amount});for(const y of years)if(y>out.year)schedule.get(y).unknown+=amount;continue;}
   let balance=amount;const installment=amount/(term.years-term.grace);
   for(let age=1;age<=term.years;age++){
    const year=out.year+age,interest=balance*rate,principal=age>term.grace?Math.min(balance,installment):0;
    const row=schedule.get(year);if(row){row.principal+=principal;row.interest+=interest;}if(year>end)tailPrincipal+=principal;
    balance=Math.max(0,balance-principal);
   }
  }
 }
 return {rows:[...schedule.values()],missing,tailPrincipal};
}
