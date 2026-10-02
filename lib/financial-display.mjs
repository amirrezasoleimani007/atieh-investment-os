/** Exact database unit. Monetary amounts are never silently rescaled. */
export function formatFinancialValue(value, unit, digits=1) {
 if(value==null||!Number.isFinite(value)) return '—';
 const normalized=String(unit??'').trim();
 const number=(n)=>n.toLocaleString('fa-IR',{maximumFractionDigits:digits});
 if(normalized==='درصد') return `${number(value*100)}٪`;
 return `${number(value)}${normalized?` ${normalized}`:' (بدون واحد ثبت‌شده)'}`;
}
