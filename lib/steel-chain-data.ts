import trade from "../public/data/steel-trade.json" with { type: "json" };
export type SteelNode = { product: string; capacity?: number; supply?: number; demand?: number | null; balance?: number | null; utilization?: number; companies?: string[]; breakdown?: { label: string; value: number }[] };

export const STEEL_CHAIN_DATA = {
  unit: "میلیون تن",
  sources: { market: "شیت Market فایل داشبورد", trade: "شیت Trade فایل داشبورد", narrative: "پاورپوینت زنجیره صنعت فولاد" },
  groupCapacity: {
    upstream: [
      { product: "سنگ‌آهن", current: 13.63, future: 30.47 }, { product: "کنسانتره", current: 10.37, future: 22.24 },
      { product: "گندله", current: 17.95, future: 22.17 }, { product: "آهن اسفنجی", current: 12.45, future: 19.75 }, { product: "فولاد میانی", current: 11.3, future: 17.5 },
    ],
    downstream: [
      { product: "کلاف گرم", current: 6.8, future: 15.1 }, { product: "کلاف خام", current: 1.9, future: 4.65 },
      { product: "کلاف سرد", current: 1.03, future: 1.78 }, { product: "قلع‌اندود", current: 0.26, future: 0.41 }, { product: "گالوانیزه", current: 0.87, future: 1.92 }, { product: "رنگی", current: 0.12, future: 0.24 },
    ],
  },
  mainCompany: [
    { product: "گندله", production1404: 7.18, production1405: 6, consumption1404: 10.4835, consumption1405: 2.1025, balance1404: -3.3035, balance1405: 3.8975, companies: ["آتیه تجارت نقش جهان", "پولای بهیز"] },
    { product: "آهن اسفنجی", production1404: 7.23, production1405: 1.45, consumption1404: 9.048, consumption1405: 1.8, balance1404: -1.818, balance1405: -0.35, companies: ["آتیه تجارت"] },
    { product: "اسلب", production1404: 7.54, production1405: 1.5, consumption1404: 5.3793814433, consumption1405: 4.3298969072, balance1404: 2.1606185567, balance1405: -2.8298969072, companies: ["آتیه تجارت", "پولای بهیز"] },
    { product: "ورق نورد گرم", production1404: 5.218, production1405: 4.2, consumption1404: 0.905, consumption1405: 0.821, balance1404: 4.313, balance1405: 3.379, companies: ["فولاد متیل", "صنایع برش", "پولای بهیز"] },
    { product: "ورق نورد سرد", production1404: 0.905, production1405: 0.821, consumption1404: 0.293, consumption1405: 0.264, balance1404: 0.612, balance1405: 0.557 },
    { product: "ورق گالوانیزه", production1404: 0.188, production1405: 0.165, consumption1404: 0.105, consumption1405: 0.09, balance1404: 0.083, balance1405: 0.075 },
    { product: "ورق رنگی", production1404: 0.105, production1405: 0.09, consumption1404: 0, consumption1405: 0, balance1404: 0.105, balance1405: 0.09 },
    { product: "ورق قلع‌اندود", production1404: 0.105, production1405: 0.099, consumption1404: 0, consumption1405: 0, balance1404: 0.105, balance1405: 0.099 },
  ],
  futureGroup: {
    "18": { title: "تولید ۱۸ میلیون تن فولاد میانی", nodes: [
      { product: "سنگ‌آهن", supply: 30.4675, demand: 65.772, balance: -35.3045, utilization: 100 }, { product: "کنسانتره", supply: 22.24, demand: 32.886, balance: -10.646, utilization: 100 },
      { product: "گندله", supply: 22.17, demand: 31.32, balance: -9.15, utilization: 100 }, { product: "آهن اسفنجی", supply: 19.75, demand: 21.6, balance: -1.85, utilization: 100 }, { product: "فولاد میانی", supply: 17.5, demand: 18, balance: -0.5, utilization: 100 },
    ] },
    utilization: { title: "تولید بر اساس نرخ بهره‌وری فعلی", nodes: [
      { product: "سنگ‌آهن", supply: 30.4675, demand: 39.5872, balance: -9.1197, utilization: 100 }, { product: "کنسانتره", supply: 19.7936, demand: 21.183435, balance: -1.389835, utilization: 89 },
      { product: "گندله", supply: 20.1747, demand: 22.623625, balance: -2.448925, utilization: 91 }, { product: "آهن اسفنجی", supply: 15.6025, demand: 20.37, balance: -4.7675, utilization: 79 }, { product: "فولاد میانی", supply: 16.975, demand: null, balance: null, utilization: 97 },
    ] },
    downstream: { title: "ظرفیت عرضه به بازار در ۱۴۱۰", nodes: [
      { product: "اسلب", supply: 17.5, demand: 15.1, balance: 2.4 }, { product: "کلاف گرم", supply: 14.1, demand: 5.1, balance: 9 },
    ] },
  },
  national: {
    nominal: { title: "ظرفیت اسمی", nodes: [
      { product: "سنگ‌آهن", supply: 150, demand: 180.69, balance: -30.69, utilization: 100 }, { product: "کنسانتره", supply: 100.91107, demand: 84.0642894, balance: 16.8467806, utilization: 100 }, { product: "گندله", supply: 92.75, demand: 80.061228, balance: 12.688772, utilization: 100 }, { product: "آهن اسفنجی", supply: 74.67, demand: 55.47624, balance: 19.19376, utilization: 100 }, { product: "فولاد میانی", supply: 64.7763, demand: null, balance: null, utilization: 100 },
    ] },
    energy: { title: "محدودیت انرژی", nodes: [
      { product: "کنسانتره", supply: 83.7561881, demand: 80.831625, balance: 2.9245631, utilization: 83 }, { product: "گندله", supply: 76.9825, demand: 66.7058, balance: 10.2767, utilization: 83 }, { product: "آهن اسفنجی", supply: 46.2954, demand: 30.511932, balance: 15.783468, utilization: 62 }, { product: "فولاد میانی", supply: 35.6268, demand: 22, balance: 13.6268, utilization: 55 },
    ] },
    ore: { title: "محدودیت عرضه سنگ‌آهن", nodes: [
      { product: "سنگ‌آهن", supply: 125 }, { product: "کنسانتره", supply: 63.89, utilization: 63 }, { product: "گندله", supply: 60.85, utilization: 66 }, { product: "آهن اسفنجی", supply: 41.96, utilization: 56 }, { product: "فولاد میانی", supply: 40, utilization: 62 },
    ] },
    likely: { title: "سناریوی محتمل", nodes: [
      { product: "سنگ‌آهن", supply: 125, demand: 155.82, balance: -30.82 }, { product: "کنسانتره", supply: 79.7197453, demand: 77.91, balance: 1.8097453, utilization: 79 }, { product: "گندله", supply: 74.2, demand: 72.0853, balance: 2.1147, utilization: 80 }, { product: "آهن اسفنجی", supply: 50.0289, demand: 33.8405064, balance: 16.1883936, utilization: 67 }, { product: "فولاد میانی", supply: 39.51336, demand: 22, balance: 17.51336, utilization: 61 },
    ] },
    nominalSteelMix: [{ label: "بیلت و بلوم", value: 46.25, share: 71 }, { label: "اسلب", value: 18.52, share: 29 }],
    nominalSteelCapacity: [{ label: "کوره قوس الکتریکی", value: 47.737 }, { label: "کوره اکسیژنی", value: 5.3 }, { label: "قراضه", value: 11.7393 }],
    historicalUtilization: [{ product: "کنسانتره", value: 83 }, { product: "گندله", value: 83 }, { product: "آهن اسفنجی", value: 82 }, { product: "فولاد میانی", value: 71 }],
    weights: [{ label: "محدودیت سنگ‌آهن", value: 20 }, { label: "تداوم روند گذشته", value: 30 }, { label: "محدودیت انرژی", value: 50 }],
    scenarioUtilization: [
      { label: "تداوم روند گذشته", weight: 30, values: [83, 83, 82, 71] },
      { label: "محدودیت انرژی", weight: 50, values: [83, 83, 62, 55] },
      { label: "محدودیت سنگ‌آهن", weight: 20, values: [63, 66, 56, 62] },
      { label: "سناریوی محتمل", weight: 100, values: [79, 80, 67, 61] },
    ],
  },
  products: {
    slab: { title: "بازار اسلب؛ افق ۱۴۱۰", scenarios: { nominal: { label: "ظرفیت اسمی تولید", supply: 26.18, demand: 26.97, balance: -0.79, breakdown: [{ label: "خودمصرفی نوردهای گرم", value: 18.18 }, { label: "نیاز سایر نوردهای گرم", value: 5 }, { label: "نیاز پلیت و ورق عریض", value: 3.79 }] }, demand: { label: "پیش‌بینی تقاضای بازار", supply: 22.67, demand: 20.04, balance: 2.63, breakdown: [{ label: "تقاضای محصولات تخت", value: 14.67 }, { label: "تقاضای بازار داخل", value: 4.57 }, { label: "صادرات", value: 0.8 }] } } },
    hot: { title: "بازار کلاف گرم؛ افق ۱۴۱۰", scenarios: { market: { label: "پیش‌بینی تقاضای بازار", supply: 22.1, demand: 15.22, balance: 6.88, breakdown: [{ label: "خودمصرفی نوردهای سرد", value: 7.6 }, { label: "نیاز سایر خطوط اسیدشویی و نوردهای سرد", value: 0.82 }, { label: "تقاضای بازار داخل", value: 6.8 }], companies: ["فولاد متیل"] } } },
  },
  trade,
} as const;
