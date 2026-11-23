"use client";
import { CHART_DEFINITIONS, type AxisBundle } from '@/lib/financial-engine';
import { resolveWatchNarrative } from '@/lib/watch-narrative';
export default function FinancialWatchPolicy({bundle, reportKind}: {
  bundle: AxisBundle; reportKind?: 'annual'|'half-year';
  previousBundle?: AxisBundle|null; trendThreshold?: number;
}) {
  const narrative=resolveWatchNarrative(bundle);
  const missing=CHART_DEFINITIONS.flatMap(d=>[bundle.axes[d.xKey],bundle.axes[d.yKey]]).filter(a=>a.score===null).map(a=>a.label);
  const period=`${reportKind==='half-year'?'شش‌ماهه':'سالانه'} ${bundle.year.toLocaleString('fa-IR',{useGrouping:false})}`;
  return <section className="watch-v53-narrative" aria-label="تحلیل وضعیت شرکت" data-rulebook="4.0" data-combination={narrative?.id}>
    <header><div><span>روایت شرکت منتخب</span><h3>{bundle.company} <small>· {period}</small></h3></div><span className="watch-narrative-title">{narrative?.title??'اطلاعات ناکافی'}</span></header>
    <p>{narrative?.text??`برای روایت کامل وضعیت شرکت، اطلاعات کافی در ${missing.length?missing.join('، '):'چهار ماتریس'} موجود نیست. وضعیت محورهای دارای داده در جدول آمده است؛ از داده ناقص نتیجه‌گیری کلی نمی‌شود.`}</p>
    <small className="watch-model-note">ضعیف، متوسط و مطلوب، سطح امتیاز در مدل‌اند؛ علت و شدت واقعی مسائل از ارقام مالی مشخص می‌شود.</small>
  </section>;
}
