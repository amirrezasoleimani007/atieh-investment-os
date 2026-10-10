"use client";

import Image from "next/image";
import { Eye, EyeOff, LockKeyhole, ShieldCheck, ArrowLeft, ChartNoAxesCombined, Compass, Layers3, Pause, Play } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useState } from "react";

const SESSION_KEY = "ips-access-v29";

export default function AccessGate({ children }: { children: ReactNode }) {
  const [motion, setMotion] = useState(true);
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      setAuthorized(new URLSearchParams(window.location.search).get("login") !== "1" && sessionStorage.getItem(SESSION_KEY) === "ok");
    } finally {
      setReady(true);
    }
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password.replace(/[۰-۹٠-٩]/g, c => String(c.charCodeAt(0) - (c <= "۹" && c >= "۰" ? 1776 : 1632))) !== "4321") {
      setError("رمز ورود صحیح نیست؛ دوباره تلاش کنید.");
      return;
    }
    sessionStorage.setItem(SESSION_KEY, "ok");
    setError("");
    setAuthorized(true);
  };

  if (!ready) return <div className="access-loading" aria-label="در حال آماده‌سازی سامانه" />;
  if (authorized) return children;

  return (
    <main className="access-gate access-premium" data-motion={motion ? "on" : "off"} dir="rtl">
      <button className="access-motion-toggle" type="button" aria-pressed={!motion} onClick={() => setMotion(!motion)}>{motion ? <Pause size={15}/> : <Play size={15}/>} {motion ? "توقف حرکت‌ها" : "پخش حرکت‌ها"}</button>
      <div className="access-aurora" aria-hidden="true"/>
      <div className="access-orbits" aria-hidden="true"><i/><i/><i/><span/></div>
      <div className="access-grid" aria-hidden="true" />
      <div className="access-glow glow-blue" />
      <div className="access-glow glow-gold" />
      <div className="capital-lines" aria-hidden="true">
        <svg viewBox="0 0 920 560" preserveAspectRatio="none">
          <path d="M0 440 C170 420 210 255 385 310 S620 180 920 92" />
          <path d="M0 510 C185 470 270 392 430 410 S700 270 920 230" />
          <circle cx="385" cy="310" r="7" />
          <circle cx="705" cy="154" r="7" />
        </svg>
      </div>
      <section className="access-branding">
        <div className="access-logo"><Image src="/atieh-logo.png" width={92} height={92} alt="آتیه فولاد" priority unoptimized /></div>
        <span>گروه سرمایه‌گذاری آتیه فولاد نقش جهان</span>
        <small className="brand-unit">واحد مدیریت سرمایه‌گذاری آتیه فولاد نقش جهان</small>
        <h1><span className="hero-line">از شناخت واقعیت امروز</span><span className="hero-line hero-gold">تا انتخاب مسیر رشد فردا</span></h1>
        <p>محیط یکپارچه تحلیل پرتفوی، انتخاب فرصت‌های رشد و تخصیص راهبردی منابع گروه آتیه فولاد.</p>
        <div className="access-capabilities"><span><ChartNoAxesCombined/><b>شناخت امروز</b><small>پایش عملکرد پرتفوی</small></span><span><Compass/><b>انتخاب فردا</b><small>ارزیابی فرصت‌های رشد</small></span><span><Layers3/><b>طراحی مسیر</b><small>برنامه ورود و تخصیص</small></span></div>
        <div className="access-proof"><ShieldCheck /><span><b>محیط تصمیم‌یار مدیریتی</b><small>داده‌ها، سیاست‌ها و مسیر تخصیص در یک روایت پیوسته</small></span></div>
      </section>
      <form className="access-form" onSubmit={submit}>
        <header>
          <span><LockKeyhole /> دسترسی سازمانی</span><small className="access-release">نسخه ۵۰ · استراتژی سرپرستی شرکت‌ها</small>
          <h2>ورود به سامانه</h2>
          <p>برای ادامه، رمز دسترسی را وارد کنید.</p>
        </header>
        <label>
          <span>رمز ورود</span>
          <div className={error ? "has-error" : ""}>
            <LockKeyhole />
            <input aria-label="رمز ورود" autoFocus inputMode="numeric" autoComplete="current-password" type={visible ? "text" : "password"} value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} aria-invalid={Boolean(error)} aria-describedby="access-error" placeholder="رمز چهاررقمی" />
            <button type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "پنهان کردن رمز" : "نمایش رمز"}>{visible ? <EyeOff /> : <Eye />}</button>
          </div>
        </label>
        <p id="access-error" className="access-error" aria-live="polite">{error || "\u00a0"}</p>
        <button className="access-submit" type="submit"><span>ورود به سامانه</span><ArrowLeft size={20}/></button>
        <footer>نشست ورود تا زمانی که این برگه مرورگر باز است حفظ می‌شود.</footer>
      </form>
    </main>
  );
}
