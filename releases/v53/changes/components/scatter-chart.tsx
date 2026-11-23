"use client";

import { useMemo, useRef, useState } from "react";
import { CircleHelp, Download } from "lucide-react";
import {
  SCATTER_BOUNDARIES,
  type AxisResult,
  type ChartDefinition,
  type ChartPoint,
  formatNumber,
} from "@/lib/financial-engine";

interface ScatterChartProps {
  definition: ChartDefinition;
  points: ChartPoint[];
  showAverage: boolean;
  showLabels: boolean;
  showTrend: boolean;
  highlightSelected: boolean;
  narrative?: string;
  reportKind?: "annual" | "half-year";
  expectedCount?: number;
}

const WIDTH = 760;
const HEIGHT = 470;
const PLOT = { left: 70, right: 720, top: 40, bottom: 402 };
const ZONE_COLORS = [
  ["#fff1f2", "#fff8e8", "#f4f8ed"],
  ["#fff7ed", "#fffbeb", "#f1f8eb"],
  ["#fdf6ea", "#f4f8eb", "#eaf7ee"],
];

interface FormulaSpec {
  formula: string;
  components: Array<{ label: string; weight: number }>;
}

const AXIS_FORMULAS: Record<ChartDefinition["key"], { x: FormulaSpec; y: FormulaSpec }> = {
  phase1: {
    x: {
      formula: "۰٫۵۵ × رشد درآمد + ۰٫۴۵ × رشد سود عملیاتی",
      components: [
        { label: "رشد درآمد (کد ۱۴۴)", weight: 0.55 },
        { label: "رشد سود عملیاتی (کد ۱۸۶)", weight: 0.45 },
      ],
    },
    y: {
      formula: "۰٫۶۰ × حاشیه سود عملیاتی + ۰٫۴۰ × حاشیه EBITDA",
      components: [
        { label: "حاشیه سود عملیاتی (کد ۱۴۶)", weight: 0.6 },
        { label: "حاشیه EBITDA (کد ۱۷۸)", weight: 0.4 },
      ],
    },
  },
  phase2: {
    x: {
      formula: "۰٫۶۰ × گردش دارایی‌ها + ۰٫۴۰ × ROA",
      components: [
        { label: "گردش دارایی‌ها (کد ۱۵۲)", weight: 0.6 },
        { label: "بازده دارایی‌ها ROA (کد ۱۵۴)", weight: 0.4 },
      ],
    },
    y: {
      formula: "۰٫۶۰ × اسپرد ROIC−WACC + ۰٫۴۰ × ROCE",
      components: [
        { label: "اسپرد ارزش‌آفرینی (کد ۱۷۶)", weight: 0.6 },
        { label: "بازده سرمایه بکارگرفته‌شده ROCE (کد ۱۵۱)", weight: 0.4 },
      ],
    },
  },
  phase3: {
    x: {
      formula: "۰٫۶۰ × نسبت آنی + ۰٫۴۰ × نسبت جاری",
      components: [
        { label: "نسبت آنی (کد ۱۶۴)", weight: 0.6 },
        { label: "نسبت جاری (کد ۱۶۳)", weight: 0.4 },
      ],
    },
    y: {
      formula: "۰٫۴۰ × پوشش بهره + ۰٫۳۵ × بدهی خالص/EBITDA + ۰٫۲۵ × بدهی/حقوق صاحبان سهام",
      components: [
        { label: "نسبت پوشش بهره (کد ۱۷۳)", weight: 0.4 },
        { label: "بدهی خالص به EBITDA (کد ۱۷۴)", weight: 0.35 },
        { label: "بدهی به حقوق صاحبان سهام (کد ۱۵۵)", weight: 0.25 },
      ],
    },
  },
  phase4: {
    x: {
      formula: "۰٫۶۰ × CFO/NI + ۰٫۴۰ × نسبت تعهدی",
      components: [
        { label: "جریان نقد عملیاتی به سود خالص (کد ۱۶۲)", weight: 0.6 },
        { label: "نسبت تعهدی (کد ۱۶۹)", weight: 0.4 },
      ],
    },
    y: {
      formula: "۰٫۶۰ × حاشیه FCF + ۰٫۴۰ × FCF/EBITDA",
      components: [
        { label: "حاشیه جریان نقد آزاد (کد ۱۷۵)", weight: 0.6 },
        { label: "جریان نقد آزاد به EBITDA (کد ۱۷۰)", weight: 0.4 },
      ],
    },
  },
};

function scaleX(value: number) {
  return PLOT.left + (value / 10) * (PLOT.right - PLOT.left);
}

function scaleY(value: number) {
  return PLOT.bottom - (value / 10) * (PLOT.bottom - PLOT.top);
}

function bubbleRadius(value: number | null, min: number, max: number, fixed: boolean) {
  if (fixed || value === null || value <= 0 || max <= min) return 8;
  const transformed = Math.log1p(value);
  const minLog = Math.log1p(Math.max(0, min));
  const maxLog = Math.log1p(Math.max(0, max));
  return 7 + ((transformed - minLog) / Math.max(0.0001, maxLog - minLog)) * 11;
}

function spreadColor(point: ChartPoint) {
  if (point.spreadValue !== null) {
    if (point.spreadValue > 0.005) return "#16a34a";
    if (point.spreadValue < -0.005) return "#dc2626";
    return "#d97706";
  }
  if (point.spreadScore !== null) {
    if (point.spreadScore >= 7) return "#16a34a";
    if (point.spreadScore < 4) return "#dc2626";
    return "#d97706";
  }
  return "#94a3b8";
}

function serializeSvg(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const styles = document.querySelectorAll("style");
  const styleText = Array.from(styles)
    .map((style) => style.textContent ?? "")
    .join("\n");
  const styleNode = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleNode.textContent = styleText;
  clone.insertBefore(styleNode, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

async function downloadChart(svg: SVGSVGElement, title: string) {
  const source = serializeSvg(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH * 2;
    canvas.height = HEIGHT * 2;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(2, 2);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.drawImage(image, 0, 0, WIDTH, HEIGHT);
    URL.revokeObjectURL(url);
    const anchor = document.createElement("a");
    anchor.download = `${title}.png`;
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  };
  image.src = url;
}

function TooltipContent({ point, reportKind }: { point: ChartPoint; reportKind?: "annual"|"half-year" }) {
  return <div className="watch-point-tip" dir="rtl"><strong>{point.company}</strong><span>{reportKind==='half-year'?'شش‌ماهه':'سالانه'} {point.year.toLocaleString('fa-IR',{useGrouping:false})}</span></div>;
}

export default function ScatterChart({
  definition,
  points,
  showAverage,
  showLabels,
  showTrend,
  highlightSelected,
  narrative, reportKind, expectedCount,
}: ScatterChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{
    point: ChartPoint;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredAxis, setHoveredAxis] = useState<"x" | "y" | null>(null);
  const [pinnedAxis, setPinnedAxis] = useState<"x" | "y" | null>(null);

  const validBubbleValues = points
    .map((point) => point.bubbleValue)
    .filter((value): value is number => value !== null && value > 0);
  const minBubble = Math.min(...validBubbleValues, 0);
  const maxBubble = Math.max(...validBubbleValues, 0);
  const average = useMemo(() => {
    if (!points.length) return null;
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  }, [points]);

  const ordered = [...points].sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? 1 : -1;
    return a.year - b.year;
  });
  const trendPoints = points.filter((point) => point.selected).sort((a, b) => a.year - b.year);
  const trendPath = trendPoints.map((p,i)=>`${i ? "L" : "M"} ${scaleX(p.x)} ${scaleY(p.y)}`).join(" ");
  const trendLabels: {x:number;y:number}[] = [];
  for (const point of trendPoints) {
    const x=Math.max(PLOT.left+30,Math.min(PLOT.right-30,scaleX(point.x)));
    const options=[-24,32,-48,56,-72].map(offset=>Math.max(24,Math.min(PLOT.bottom+12,scaleY(point.y)+offset)));
    const y=options.find(y=>!trendLabels.some(p=>Math.abs(p.x-x)<55&&Math.abs(p.y-y)<22))??options[0];
    trendLabels.push({x,y});
  }
  const boundaries = [0, SCATTER_BOUNDARIES.low, SCATTER_BOUNDARIES.high, 10];
  const visibleAxis = pinnedAxis ?? hoveredAxis;
  const fallbackFormula = AXIS_FORMULAS[definition.key];

  function formulaSpec(axis: AxisResult | undefined, fallback: FormulaSpec): FormulaSpec {
    if (!axis?.components.length) return fallback;
    return {
      formula: axis.formula || fallback.formula,
      components: axis.components.map((component) => ({
        label: component.key.startsWith("code-")
          ? `${component.label} (کد ${component.key.replace("code-", "")})`
          : component.label,
        weight: component.originalWeight,
      })),
    };
  }

  const xFormula = formulaSpec(points[0]?.xAxis, fallbackFormula.x);
  const yFormula = formulaSpec(points[0]?.yAxis, fallbackFormula.y);

  function axisHelp(side: "x" | "y", label: string, spec: FormulaSpec) {
    const open = visibleAxis === side;
    return (
      <div
        className={`axis-title-control axis-title-${side} ${open ? "open" : ""}`}
        onMouseEnter={() => setHoveredAxis(side)}
        onMouseLeave={() => setHoveredAxis(null)}
      >
        <div className="axis-title-label">
          <span>{label}</span>
          <button
            type="button"
            aria-label={`مشاهده فرمول محور ${label}`}
            aria-expanded={open}
            onFocus={() => setHoveredAxis(side)}
            onBlur={() => setHoveredAxis(null)}
            onClick={() => setPinnedAxis((current) => (current === side ? null : side))}
          >
            <CircleHelp size={14} />
          </button>
        </div>
        {open && (
          <div className="axis-formula-popover" role="dialog" aria-label={`روش محاسبه محور ${label}`} dir="rtl">
            <header>
              <div>
                <span>{side === "x" ? "محور افقی" : "محور عمودی"}</span>
                <strong>{label}</strong>
              </div>
              <b>روش محاسبه</b>
            </header>
            <div className="axis-component-list">
              {spec.components.map((component, index) => (
                <div className="axis-component-row" key={`${component.label}-${index}`}>
                  <i>{(index + 1).toLocaleString("fa-IR")}</i>
                  <span>{component.label}</span>
                  <b>{component.weight.toLocaleString("fa-IR", { style: "percent", maximumFractionDigits: 0 })}</b>
                </div>
              ))}
            </div>
            <div className="axis-equation">
              <span>فرمول نهایی</span>
              <p>امتیاز {label} = {spec.formula}</p>
            </div>
            <small>تمام ورودی‌ها امتیاز نرمال‌شده صفر تا ۱۰ هستند؛ در صورت نبود هر کد، محور محاسبه نمی‌شود و وزن‌ها بازتوزیع نمی‌شوند.</small>
          </div>
        )}
      </div>
    );
  }

  return (
    <article className={`chart-card watch-chart ${showTrend ? "is-trend" : "is-portfolio"}`}>
      <header className="chart-card-header">
        <div>
          <p className="eyebrow">{showTrend ? `${trendPoints.length.toLocaleString("fa-IR")} دوره معتبر${trendPoints.length>1 ? ` · ${trendPoints[0].year.toLocaleString("fa-IR",{useGrouping:false})} تا ${trendPoints.at(-1)!.year.toLocaleString("fa-IR",{useGrouping:false})}` : ""}` : `${points.length.toLocaleString("fa-IR")} از ${(expectedCount??points.length).toLocaleString("fa-IR")} شرکت دارای داده`}</p>
          <h3>{definition.title}</h3>
        </div>
        <button
          type="button"
          className="icon-button"
          title="دانلود نمودار به‌صورت PNG"
          aria-label={`دانلود نمودار ${definition.title}`}
          onClick={() => svgRef.current && downloadChart(svgRef.current, definition.title)}
        >
          <Download size={17} />
        </button>
      </header>
      <div
        className="chart-wrap"
        onMouseLeave={() => setTooltip(null)}
        onPointerLeave={() => setTooltip(null)}
        onClick={(event) => {
          if (!(event.target as HTMLElement).closest(".axis-title-control")) setPinnedAxis(null);
        }}
      >
        <svg
          ref={svgRef}
          className="scatter-svg"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`نمودار ${definition.title}`}
        >
          <defs>
            <linearGradient id={`watch-gradient-${definition.key}`} gradientUnits="userSpaceOnUse" x1={scaleX(trendPoints[0]?.x??0)} y1={scaleY(trendPoints[0]?.y??0)} x2={scaleX(trendPoints.at(-1)?.x??10)} y2={scaleY(trendPoints.at(-1)?.y??10)}><stop offset="0%" stopColor="#60a5fa"/><stop offset="100%" stopColor="#0d9488"/></linearGradient>
            <marker
              id={`arrow-${definition.key}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#1d4ed8" />
            </marker>
            <filter id={`shadow-${definition.key}`} x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.4" floodColor="#0f172a" floodOpacity="0.18" />
            </filter>
          </defs>

          <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#ffffff" rx="18" />
          {[0, 1, 2].map((xIndex) =>
            [0, 1, 2].map((yIndex) => {
              const xStart = scaleX(boundaries[xIndex]);
              const xEnd = scaleX(boundaries[xIndex + 1]);
              const yTop = scaleY(boundaries[yIndex + 1]);
              const yBottom = scaleY(boundaries[yIndex]);
              return (
                <rect
                  key={`${xIndex}-${yIndex}`}
                  x={xStart}
                  y={yTop}
                  width={xEnd - xStart}
                  height={yBottom - yTop}
                  fill={ZONE_COLORS[xIndex][yIndex]}
                />
              );
            }),
          )}

          {[0, 2, 4, 6, 8, 10].map((tick) => (
            <g key={`grid-${tick}`}>
              <line
                x1={scaleX(tick)}
                x2={scaleX(tick)}
                y1={PLOT.top}
                y2={PLOT.bottom}
                stroke="#dfe6ef"
                strokeWidth="1"
              />
              <line
                x1={PLOT.left}
                x2={PLOT.right}
                y1={scaleY(tick)}
                y2={scaleY(tick)}
                stroke="#dfe6ef"
                strokeWidth="1"
              />
              <text x={scaleX(tick)} y={PLOT.bottom + 25} textAnchor="middle" className="axis-tick">
                {tick}
              </text>
              <text x={PLOT.left - 18} y={scaleY(tick) + 4} textAnchor="middle" className="axis-tick">
                {tick}
              </text>
            </g>
          ))}

          {[SCATTER_BOUNDARIES.low, SCATTER_BOUNDARIES.high].map((boundary) => (
            <g key={`boundary-${boundary}`}>
              <line
                x1={scaleX(boundary)}
                x2={scaleX(boundary)}
                y1={PLOT.top}
                y2={PLOT.bottom}
                stroke="#7c8798"
                strokeWidth="1.6"
                strokeDasharray="6 5"
              />
              <line
                x1={PLOT.left}
                x2={PLOT.right}
                y1={scaleY(boundary)}
                y2={scaleY(boundary)}
                stroke="#7c8798"
                strokeWidth="1.6"
                strokeDasharray="6 5"
              />
              <text
                x={scaleX(boundary)}
                y={PLOT.top - 10}
                textAnchor="middle"
                className="boundary-label"
              >
                {boundary.toFixed(2)}
              </text>
            </g>
          ))}

          {showAverage && points.length > 1 && average && (
            <g className="average-lines">
              <line
                x1={scaleX(average.x)}
                x2={scaleX(average.x)}
                y1={PLOT.top}
                y2={PLOT.bottom}
              />
              <line
                x1={PLOT.left}
                x2={PLOT.right}
                y1={scaleY(average.y)}
                y2={scaleY(average.y)}
              />
              <text x={scaleX(average.x) + 7} y={PLOT.top + 15}>
                میانگین گروه · {points.length.toLocaleString("fa-IR")} شرکت
              </text>
            </g>
          )}

          {showTrend && trendPoints.length > 1 && <g className="watch-trend-path" aria-hidden="true">
            <path d={trendPath} fill="none" stroke="#dbeafe" strokeWidth="7" strokeLinecap="round"/>
            <path className="watch-dash-flow" d={trendPath} fill="none" stroke={`url(#watch-gradient-${definition.key})`} strokeWidth="2.8" strokeDasharray="3 8" strokeLinecap="round"/>
            {trendPoints.slice(1).map((p,i)=><line key={p.year} x1={scaleX(trendPoints[i].x)} y1={scaleY(trendPoints[i].y)} x2={scaleX(p.x)} y2={scaleY(p.y)} stroke="transparent" markerEnd={`url(#arrow-${definition.key})`}/>)}
            <circle className="watch-traveller" r="4.5" fill="#0d9488" stroke="white" strokeWidth="2"><animateMotion path={trendPath} dur="4s" repeatCount="indefinite" calcMode="paced"/></circle>
          </g>}

          {ordered.map((point) => {
            const trendIndex = trendPoints.findIndex(
              (trendPoint) => trendPoint.company === point.company && trendPoint.year === point.year,
            );
            const radius = showTrend && point.selected
              ? 6.5 + Math.max(0, trendIndex) * 1.5
              : bubbleRadius(point.bubbleValue, minBubble, maxBubble, validBubbleValues.length === 0);
            const selectedActive = point.selected && (showTrend || highlightSelected);
            return (
              <g
                key={`${point.company}-${point.year}`}
                className="scatter-point"
                tabIndex={0}
                role="button"
                aria-label={`${point.company}، ${reportKind=== "half-year"?"شش‌ماهه":"سالانه"} ${point.year}`}
                onKeyDown={event=>{if(event.key==="Escape")setTooltip(null)}}
                onFocus={() => setTooltip({
                  point,
                  x: (scaleX(point.x) / WIDTH) * 100,
                  y: (scaleY(point.y) / HEIGHT) * 100,
                })}
                onBlur={() => setTooltip(null)}
                onPointerMove={(event) => {
                  const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (!bounds) return;
                  setTooltip({
                    point,
                    x: ((event.clientX - bounds.left) / bounds.width) * 100,
                    y: ((event.clientY - bounds.top) / bounds.height) * 100,
                  });
                }}
                onPointerEnter={(event) => {
                  const bounds = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (!bounds) return;
                  setTooltip({
                    point,
                    x: ((event.clientX - bounds.left) / bounds.width) * 100,
                    y: ((event.clientY - bounds.top) / bounds.height) * 100,
                  });
                }}
              >
                {selectedActive && (
                  <circle
                    className="selected-halo"
                    cx={scaleX(point.x)}
                    cy={scaleY(point.y)}
                    r={radius + 7}
                    fill="none"
                    stroke="#1d4ed8"
                    strokeWidth="2.2"
                    strokeOpacity="0.32"
                  />
                )}
                <circle
                  cx={scaleX(point.x)}
                  cy={scaleY(point.y)}
                  r={radius}
                  fill={selectedActive ? "#1d4ed8" : "#64748b"}
                  fillOpacity={selectedActive ? Math.min(1, 0.72 + Math.max(0, trendIndex) * 0.14) : highlightSelected ? 0.27 : 0.48}
                  stroke={selectedActive ? (trendIndex === trendPoints.length-1 ? "#0d9488" : "#3b82f6") : "#64748b"}
                  strokeWidth={selectedActive ? 3.8 : 2.2}
                  filter={selectedActive ? `url(#shadow-${definition.key})` : undefined}
                />
                {(showLabels || (showTrend && point.selected)) && (
                  <text
                    x={showTrend ? trendLabels[trendIndex]?.x : Math.max(PLOT.left+30,Math.min(PLOT.right-30,scaleX(point.x)))}
                    y={showTrend ? trendLabels[trendIndex]?.y : Math.max(24,scaleY(point.y)-radius-10)}
                    textAnchor="middle"
                    className={selectedActive ? "point-label selected" : "point-label"}
                  >
                    {showTrend && point.selected ? point.year.toLocaleString("fa-IR",{useGrouping:false}) : point.company}
                  </text>
                )}
              </g>
            );
          })}

          <line
            x1={PLOT.left}
            x2={PLOT.right}
            y1={PLOT.bottom}
            y2={PLOT.bottom}
            stroke="#475569"
            strokeWidth="1.5"
          />
          <line
            x1={PLOT.left}
            x2={PLOT.left}
            y1={PLOT.top}
            y2={PLOT.bottom}
            stroke="#475569"
            strokeWidth="1.5"
          />
          {!points.length && (
            <g className="empty-chart">
              <circle cx={WIDTH / 2} cy={HEIGHT / 2 - 12} r="28" />
              <text x={WIDTH / 2} y={HEIGHT / 2 - 7} textAnchor="middle">
                !
              </text>
              <text x={WIDTH / 2} y={HEIGHT / 2 + 38} textAnchor="middle">
                برای این انتخاب داده کافی وجود ندارد
              </text>
            </g>
          )}
        </svg>
        {axisHelp("x", definition.xLabel, xFormula)}
        {axisHelp("y", definition.yLabel, yFormula)}
        {tooltip && (
          <div
            className="chart-tooltip"
            style={{
              left: `${Math.min(72, Math.max(8, tooltip.x))}%`,
              top: `${Math.min(68, Math.max(8, tooltip.y))}%`,
            }}
          >
            <TooltipContent point={tooltip.point} reportKind={reportKind} />
          </div>
        )}
      </div>
      {!showTrend && points.length === 1 && showAverage && <small className="watch-chart-footnote">تنها یک شرکت دارای داده است؛ میانگین مقایسه‌ای نمایش داده نمی‌شود.</small>}
      {showTrend && trendPoints.length === 1 && <small className="watch-chart-footnote">فقط یک دوره معتبر موجود است؛ مسیری برای مقایسه ترسیم نمی‌شود.</small>}
      {narrative && <p className="chart-narrative">{narrative}</p>}
    </article>
  );
}
