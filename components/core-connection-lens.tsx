"use client";
import {useState} from "react";
import {Compass, Info, Link2} from "lucide-react";
import {coreConnection,CORE_CONNECTION_METHOD,type CoreRow} from "@/lib/core-connection.mjs";
type Selected={key:string;name:string;parentId:number;child?:boolean;parentName?:string};
const fa=(n:number|null,d=0)=>n==null?"نامشخص":n.toLocaleString("fa-IR",{maximumFractionDigits:d});
export default function CoreConnectionLens({rows,selected,year,context="فرصت‌های منتخب"}:{rows:CoreRow[];selected:Selected[];year:number;context?:string}){
 const [detail,setDetail]=useState<string|null>(null);
 const [all,setAll]=useState(false);
 const display:Selected[]=all?rows.map(r=>({key:`parent:${r.id}`,name:r.name,parentId:r.id,child:false})):selected;
 const items=display.map(item=>({item,row:rows.find(r=>r.id===item.parentId)})).map(({item,row})=>({item,row,connection:row?coreConnection(row):null}));
 const known=items.filter(i=>i.connection?.score!=null).length;
 return <section className="core-lens" aria-label="ارتباط با هسته بازرگانی فولاد">
  <header><div className="core-lens-icon"><Compass/></div><div><span>لنز راهبردی · {year.toLocaleString("fa-IR",{useGrouping:false})}</span><h3>این انتخاب‌ها چقدر به هسته ما نزدیک‌اند؟</h3><p>{context} از نگاه بازرگانی در زنجیره فولاد</p></div><div className="core-coverage"><b>{fa(known)} / {fa(items.length)}</b><span>حوزه با امتیاز موجود</span></div></header>
  <div className="core-lens-note"><Info/><p>امتیاز نسبی مدل · بازرگانی مرجع = ۱۰۰. این امتیاز برای شناخت پیوند با هسته است و امتیاز انتخاب و ترتیب تخصیص سرمایه را تغییر نمی‌دهد. نزدیکی بیشتر به‌تنهایی دلیل سرمایه‌گذاری نیست.</p></div>
  <div className="core-lens-tabs"><button aria-pressed={!all} onClick={()=>setAll(false)}>فرصت‌های منتخب</button><button aria-pressed={all} onClick={()=>setAll(true)}>همه حوزه‌های مدل</button><small>مسیر اتصال پیشنهادی است؛ قابلیت اجرایی نیازمند تأیید است.</small></div>
  {items.length?<div className="table-scroll"><table><thead><tr><th>حوزه منتخب</th><th>ارتباط با هسته · از ۱۰۰</th><th>محل اتصال به زنجیره</th><th>قابلیت قابل بررسی</th><th>مبنای ارزیابی</th></tr></thead><tbody>{items.map(({item,row,connection:c})=><tr key={item.key}><td><b>{item.name}</b>{item.child&&<small>برآورد از حوزه مادر: {row?.name??item.parentName}</small>}</td><td><div className="core-score"><strong>{fa(c?.score??null)}</strong><div className="core-meter"><i style={{width:`${c?.score??0}%`}}/></div></div></td><td><span className="core-route"><Link2/>{c?.chain??"نگاشت حوزه موجود نیست"}</span></td><td>{c?.capability??"نیازمند ارزیابی"}</td><td><button aria-expanded={detail===item.key} onClick={()=>setDetail(detail===item.key?null:item.key)}>مشاهده مبنا</button>{detail===item.key&&<div className="core-evidence"><p>Fit هسته در مدل ۲٫۲: <b>{fa(c?.raw??null,3)}</b></p><p>امتیاز = ۱۰۰ × Fit حوزه ÷ ۹؛ سقف نمایش ۱۰۰.</p><p>۹، مقدار ثابت حوزه بازرگانی در داده مرجع این نسخه است؛ امتیاز نسبی است و درصد ارتباط واقعی نیست.</p><p>Vertical تجارت: {fa(c?.tradeVertical??null,6)} · Vertical فولاد: {fa(c?.steelVertical??null,6)}؛ ضرایب خام برای توضیح‌اند و به امتیاز اضافه نمی‌شوند.</p><small>{c?.routeStatus}؛ این دو ضریب، دو امتیاز مستقل فولاد و قابلیت تجاری نیستند.</small></div>}</td></tr>)}</tbody></table></div>:<div className="core-empty">با افزودن فرصت به برنامه ورود، ارتباط آن با هسته در اینجا نمایش داده می‌شود.</div>}
  <details className="core-method"><summary>روش و محدودیت امتیاز ارتباط</summary><p>مبنای امتیاز، شاخص موجود «Fit هسته بازرگانی فولاد» است که در تناسب راهبردی نیز اثر دارد. تبدیل به صفر تا صد با مرجع ثابت بازرگانی انجام می‌شود و به ترکیب سبد، رتبه فرصت یا وزن چشم‌انداز وابسته نیست. فرمول کامل ساخت Fit در فایل مرجع است؛ تفکیک دو بعد فولاد و قابلیت بازرگانی با این داده‌ها ممکن نیست. مسیرهای اتصال پیشنهادی‌اند و برای تأیید، اطلاعات محصول، مشتری و توان اجرایی لازم است. برای سبد رتبه‌محور، امتیاز کل پرتفوی محاسبه نمی‌شود. نسخه روش: {CORE_CONNECTION_METHOD.version}.</p></details>
 </section>;
}
