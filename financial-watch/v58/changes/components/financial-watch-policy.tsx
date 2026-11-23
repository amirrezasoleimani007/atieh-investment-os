"use client";
import {WATCH_SIX_AXES,type WatchSixBundle} from '@/lib/watch-six';
import {resolveWatchV10Narrative} from '@/lib/watch-v10-narrative';
import { ScanText } from 'lucide-react';
export default function FinancialWatchPolicy({bundle, reportKind}: {
  bundle: WatchSixBundle; reportKind?: 'annual'|'half-year';
  previousBundle?: WatchSixBundle|null; trendThreshold?: number;
}) {
  const narrative=resolveWatchV10Narrative(bundle);
  const missing=WATCH_SIX_AXES.map(d=>bundle.axes[d.key]).filter(a=>a.score===null).map(a=>a.label);
  const period=`${reportKind==='half-year'?'شش‌ماهه':'سالانه'} ${bundle.year.toLocaleString('fa-IR',{useGrouping:false})}`;
  return <section key={`${bundle.company}-${period}-${narrative?.id??'missing'}`} className="watch-v53-narrative watch-v7-story" aria-label="تحلیل وضعیت شرکت" aria-live="polite" aria-atomic="true" data-rulebook="10.0" data-source-sha256={narrative?.sourceSha256} data-combination={narrative?.id}>
    <header><div className="watch-story-identity"><span className="watch-story-icon" aria-hidden="true"><ScanText size={21}/></span><div><span className="watch-story-eyebrow">روایت شرکت منتخب</span><h3>{bundle.company} <small>· {period}</small></h3></div></div><span className="watch-narrative-title">{narrative?.title??'اطلاعات ناکافی'}</span></header>
    <div className="watch-story-copy"><p>{narrative?.text??(missing.length?`برای روایت یکپارچه شش نمودار، نمره ${missing.join('، ')} موجود نیست. محورهای دارای داده در نمودار و جدول نمایش داده شده‌اند.`:'برای این ترکیب، روایتی در کتابچه نسخه دهم ثبت نشده است.')}</p></div>
    {narrative&&<div className="watch-v10-review"><span>موضوع بررسی: <b>{narrative.topic}</b></span><span>اولویت: <b>{narrative.priority}</b></span></div>}
    <small className="watch-model-note">روایت تشخیصی نسخه دهم بر پایه نمرات نرمال‌شده است؛ فرضیه مدیریتی، اثبات علت یا علامت واقعی جریان نقد و اسپرد نیست.</small>
  </section>;
}
