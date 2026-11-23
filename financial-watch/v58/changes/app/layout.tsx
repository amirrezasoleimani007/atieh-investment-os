import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/600.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/vazirmatn/800.css";
import "./globals.css";
import "./investment-polish.css";
import "./watch-v53.css";
import "./watch-v7.css";
import "./report-pilot.css";

export const metadata: Metadata = {
  title: "سامانه تحلیل مالی و راهبری سرمایه آتیه",
  description:
    "نسخه ۵۵؛ دیده‌بان مالی با روایت فارسی و مسیر دوره‌های مالی",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

import "./intelligent-report.css";

import "./report-entry.css";

import "./watch-six.css";
