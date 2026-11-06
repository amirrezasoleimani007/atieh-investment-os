import {FIT_MODEL_V22} from "./strategic-fit.mjs";
export const MATRIX_THRESHOLDS = FIT_MODEL_V22.matrix;
export function zoneFor(x, y) {
  const xb =
      x >= MATRIX_THRESHOLDS.high ? 2 : x >= MATRIX_THRESHOLDS.medium ? 1 : 0,
    yb =
      y >= MATRIX_THRESHOLDS.high ? 2 : y >= MATRIX_THRESHOLDS.medium ? 1 : 0;
  const zones = [
    [
      {
        title: "کم‌اولویت",
        decision: "عدم تخصیص منابع و صرفاً رصد تغییرات بنیادین.",
      },
      {
        title: "حفظ در رادار",
        decision: "پایش محدود؛ ورود تنها با محرک راهبردی روشن.",
      },
      {
        title: "توانمندسازی داخلی",
        decision: "تناسب مناسب است، اما جذابیت رشد هنوز ورود را توجیه نمی‌کند.",
      },
    ],
    [
      {
        title: "پایش انتخابی",
        decision: "اطلاعات تکمیلی گردآوری و ورود در مقیاس آزمایشی بررسی شود.",
      },
      {
        title: "بررسی تکمیلی",
        decision:
          "فرصت متعادل است؛ تصمیم به مزیت اجرایی و شریک مناسب وابسته است.",
      },
      {
        title: "هم‌افزایی مشروط",
        decision:
          "از قابلیت موجود استفاده شود، اما سرمایه‌گذاری مرحله‌ای باقی بماند.",
      },
    ],
    [
      {
        title: "پایش فرصت",
        decision:
          "بازار جذاب است؛ پیش از ورود باید شکاف قابلیت پرتفوی رفع شود.",
      },
      {
        title: "توسعه انتخابی",
        decision: "ورود هدفمند با شریک یا مدل کم‌سرمایه در اولویت بررسی است.",
      },
      {
        title: "اولویت ورود",
        decision:
          "فرصت هم‌زمان جذاب و متناسب است؛ مطالعه ورود و تخصیص منابع آغاز شود.",
      },
    ],
  ][xb][yb];
  return zones;
}
