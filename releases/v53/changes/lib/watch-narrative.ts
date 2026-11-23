import runtime from '../data/policy/watch-v4.runtime.json';
import { CHART_DEFINITIONS, type AxisBundle } from './financial-engine';
export function watchBand(score: number | null | undefined) {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 10) return null;
  return score < 3.33 ? 'W' : score < 6.66 ? 'M' : 'G';
}
export const WATCH_BAND_NAMES = {W:'ضعیف', M:'متوسط', G:'مطلوب'} as const;
export function resolveWatchNarrative(bundle: AxisBundle) {
  const codes: string[] = [];
  for (const [i, chart] of CHART_DEFINITIONS.entries()) {
    const x = watchBand(bundle.axes[chart.xKey].score), y = watchBand(bundle.axes[chart.yKey].score);
    if (!x || !y) return null;
    codes.push(`M${i + 1}-${x}${y}`);
  }
  const row = (runtime.rows as Record<string, (string | number)[]>)[codes.join('|')];
  if (!row) return null;
  return {id: String(row[0]), title: runtime.titles[Number(row[1])], text: runtime.texts[Number(row[2])]};
}
export function watchPathDescription(points: {year:number;x:number;y:number}[]) {
  const sorted = [...points].sort((a,b)=>a.year-b.year);
  if (sorted.length < 2) return 'تاریخچه کافی برای مقایسه نیست';
  const first = sorted[0], last = sorted.at(-1)!;
  for (let i=1;i<sorted.length-1;i++) {
    const a=sorted[i-1], b=sorted[i], c=sorted[i+1];
    if ((b.x-a.x)*(c.x-b.x)<-0.2 || (b.y-a.y)*(c.y-b.y)<-0.2) return 'مسیر رفت‌وبرگشتی';
  }
  const dx=last.x-first.x,dy=last.y-first.y;
  if (Math.hypot(dx,dy)<0.7) return 'تغییر محدود در امتیازها';
  if(dx>0.25&&dy>0.25)return 'بهبود هر دو محور';
  if(dx<-.25&&dy<-.25)return 'افت هر دو محور';
  if(dx>.25&&dy<-.25)return 'رشد محور افقی، افت محور عمودی';
  if(dx<-.25&&dy>.25)return 'افت محور افقی، رشد محور عمودی';
  return Math.abs(dx)>=Math.abs(dy)?`محور افقی ${dx>0?'بهتر':'ضعیف‌تر'} شده`:`محور عمودی ${dy>0?'بهتر':'ضعیف‌تر'} شده`;
}
