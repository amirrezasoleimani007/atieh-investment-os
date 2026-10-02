import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "سامانه هوشمند خط‌مشی سرمایه‌گذاری | آتیه فولاد",
  description: "مرکز فرماندهی سرمایه‌گذاری آتیه فولاد برای پایش عملکرد، رتبه‌بندی فرصت‌ها و طراحی نقشه حرکت.",
  icons: {
    icon: "/atieh-logo.png",
    shortcut: "/atieh-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
