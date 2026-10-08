"use client";
import {useEffect,useRef,useState} from "react";
import {Activity} from "lucide-react";
import {allocationChanges} from "@/lib/allocation-change.mjs";
import {FUNDING_SOURCES,type FundingSource} from "@/lib/capital-allocation.mjs";
import type {CapitalOutput} from "@/lib/capital-allocation.mjs";
const fa=(n:number)=>n.toLocaleString("fa-IR",{maximumFractionDigits:2});
export default function AllocationLiveChange({output,contextKey}:{output:CapitalOutput;contextKey:string}){
 const previous=useRef<{contextKey:string;signature:string;output:CapitalOutput}|null>(null);
 const [change,setChange]=useState<{contextKey:string;delta:number;items:ReturnType<typeof allocationChanges>}|null>(null);
 const signature=JSON.stringify([output.financial,output.capacity,output.results.map(r=>[r.id,r.annualNeed,r.entryRank,r.overrideRank,r.executed,r.allocations,r.decision]),output.reserved,output.liquidityBlocked]);
 useEffect(()=>{
  const old=previous.current;
  if(old&&old.contextKey===contextKey&&old.signature!==signature){
   const items=allocationChanges(old.output,output);
   setChange({contextKey,delta:output.totalExecuted-old.output.totalExecuted,items});
  }
  previous.current={contextKey,signature,output};
 },[signature,contextKey,output]);
 const current=change?.contextKey===contextKey?change:null;
 return <div className="allocation-live-change" role="status" aria-live="polite"><Activity/><div><b>پیش‌نمایش زنده · با هر تغییر، تخصیص دوباره محاسبه می‌شود</b>{current?<p>{Math.abs(current.delta)<.01?"جمع تأمین بدون تغییر است؛ ترکیب منابع و موانع بر اساس ورودی جاری بررسی شده‌اند.":`جمع تأمین ${current.delta>0?"افزایش":"کاهش"} یافت: ${fa(Math.abs(current.delta))} میلیارد تومان.`}</p>:<p>ورودی مالی، نیاز، رتبه و سیاست منابع را تغییر دهید؛ نتیجه در همه نماها به‌روز می‌شود. نسخه‌های ثبت‌شده ثابت می‌مانند.</p>}</div>{current&&current.items.length>0&&<details className="allocation-change-detail"><summary>اثر تغییر بر {fa(current.items.length)} طرح</summary>{current.items.map(i=><article key={i.id}><b>{i.name} · {i.decision}</b><p>تغییر تأمین: {i.delta>0?"+":""}{fa(i.delta)} میلیارد تومان</p>{i.sources.length>0&&<p>{i.sources.map(s=>`${FUNDING_SOURCES[s.source as FundingSource]?.label??s.source}: ${s.delta>0?"+":""}${fa(s.delta)}`).join(" · ")}</p>}<small>علت نتیجه جاری: {i.reason}</small></article>)}</details>}</div>;
}
