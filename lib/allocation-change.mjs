export function allocationChanges(before,after){
 const old=new Map(before.results.map(r=>[r.id,r]));const now=new Map(after.results.map(r=>[r.id,r]));
 return [...new Set([...old.keys(),...now.keys()])].map(id=>{
  const a=old.get(id),b=now.get(id);const sources=[...new Set([...Object.keys(a?.allocations??{}),...Object.keys(b?.allocations??{})])].map(source=>({source,delta:(b?.allocations?.[source]??0)-(a?.allocations?.[source]??0)})).filter(s=>Math.abs(s.delta)>.01);
  return {id,name:b?.name??a.name,delta:(b?.executed??0)-(a?.executed??0),sources,reason:b?.reason??'طرح از سبد این سال خارج شد.',decision:b?.decision??'حذف از سبد',decisionChanged:a?.decision!==b?.decision};
 }).filter(r=>Math.abs(r.delta)>.01||r.sources.length||r.decisionChanged);
}
