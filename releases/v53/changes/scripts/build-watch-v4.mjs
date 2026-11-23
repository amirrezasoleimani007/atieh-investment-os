import { readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const source = JSON.parse(await readFile(new URL('data/policy/financial_watch_6561_v4_SITE.json', root), 'utf8'));
assert.equal(source.combinations.length, 6561);
const states = new Set(), ids = new Set(), titles = [], texts = [], rows = {};
function intern(list, value) { let i = list.indexOf(value); if (i < 0) { i = list.length; list.push(value); } return i; }
function edit(text) {
  return text
    .replaceAll('بهره‌وری دارایی‌ها و بازده سرمایه هر دو مطلوب ارزیابی شده‌اند.', 'امتیاز بهره‌وری منابع و ارزش‌آفرینی سرمایه نیز در مدل مطلوب است.')
    .replaceAll('بی‌آنکه این نتیجه به‌تنهایی نشانه دستکاری یا ناپایداری قطعی سود باشد.', 'با این حال، پایداری واقعی سود به بررسی ارقام و اجزای آن وابسته است.')
    .replaceAll('با این حال، از آن نمی‌توان درباره صحت یا نادرستی سود گزارش‌شده حکم قطعی داد.', 'این امتیاز به‌تنهایی برای قضاوت درباره سود گزارش‌شده کافی نیست.')
    .replaceAll('تصویر نقدی عملکرد شرکت را کم‌فروغ‌تر می‌کند', 'از نقاط ضعف این ارزیابی است')
    .replaceAll('در این ارزیابی تصویری نامساعد دارد', 'در چارچوب مدل نامساعد ارزیابی می‌شود')
    .replace(/\s+/g, ' ').trim();
}
for (const row of source.combinations) {
  const key = row.matrix_state_codes.join('|');
  assert(!states.has(key)); assert(!ids.has(row.id)); assert(row.narrative?.trim());
  states.add(key); ids.add(row.id);
  rows[key] = [row.id, intern(titles, row.narrative_title), intern(texts, edit(row.narrative))];
}
await writeFile(new URL('data/policy/watch-v4.runtime.json', root), JSON.stringify({version:'4.0-v53', titles, texts, rows}));
console.log(`Validated ${ids.size} unique states; ${texts.length} narratives. Original source retained.`);
