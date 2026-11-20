import React, { useState } from 'react';

export interface ChartSeries {
  label: string;
  color: string;
  values: number[];
  unit?: string;
}

interface TimeSeriesChartProps {
  title: string;
  labels: string[];
  series: ChartSeries[];
  height?: number;
  maxY?: number;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  title,
  labels,
  series,
  height = 200,
  maxY,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 640;
  const padLeft = 42;
  const padRight = 14;
  const padTop = 14;
  const padBottom = 26;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const allValues = series.flatMap((s) => s.values);
  const rawMax = maxY ?? Math.max(10, ...allValues);
  const yMax = Math.ceil(rawMax * 1.15);

  const count = Math.max(2, labels.length);
  const getX = (i: number) => padLeft + (i / (count - 1)) * innerW;
  const getY = (val: number) => padTop + innerH - (Math.min(yMax, Math.max(0, val)) / yMax) * innerH;

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
          {series.map((s) => {
            const val = hoverIdx !== null ? s.values[hoverIdx] : s.values[s.values.length - 1];
            return (
              <div key={s.label} className="flex items-center gap-1.5 tabular-nums">
                <span className="inline-block w-2.5 h-0.5 rounded" style={{ backgroundColor: s.color }} />
                <span>{s.label}:</span>
                <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                  {val !== undefined ? `${val}${s.unit ?? ''}` : '--'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {ticks.map((t) => {
            const y = padTop + innerH * (1 - t);
            const labelVal = Math.round(yMax * t);
            return (
              <g key={t}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeDasharray={t === 0 ? undefined : '3 3'}
                  strokeWidth={1}
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tabular-nums"
                >
                  {labelVal}
                </text>
              </g>
            );
          })}

          {series.map((s) => {
            if (s.values.length < 2) return null;
            const pathD = s.values
              .map((v, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(v).toFixed(1)}`)
              .join(' ');
            const areaD = `${pathD} L ${getX(s.values.length - 1).toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${getX(0).toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;

            return (
              <g key={s.label}>
                <path d={areaD} fill={s.color} fillOpacity={0.07} />
                <path d={pathD} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              </g>
            );
          })}

          {labels.map((lbl, idx) => {
            const showTick = idx === 0 || idx === labels.length - 1 || idx === Math.floor(labels.length / 2);
            const x = getX(idx);
            return (
              <g key={`${lbl}-${idx}`}>
                {showTick && (
                  <text
                    x={x}
                    y={height - 6}
                    textAnchor={idx === 0 ? 'start' : idx === labels.length - 1 ? 'end' : 'middle'}
                    className="fill-slate-400 dark:fill-slate-500 text-[10px] font-mono tabular-nums"
                  >
                    {lbl}
                  </text>
                )}
                <rect
                  x={x - innerW / count / 2}
                  y={padTop}
                  width={innerW / count}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(idx)}
                />
              </g>
            );
          })}

          {hoverIdx !== null && (
            <g>
              <line
                x1={getX(hoverIdx)}
                y1={padTop}
                x2={getX(hoverIdx)}
                y2={padTop + innerH}
                className="stroke-slate-400 dark:stroke-slate-500"
                strokeWidth={1}
                strokeDasharray="2 2"
              />
              {series.map((s) => {
                const v = s.values[hoverIdx];
                if (v === undefined) return null;
                return (
                  <circle
                    key={s.label}
                    cx={getX(hoverIdx)}
                    cy={getY(v)}
                    r={3.5}
                    fill={s.color}
                    className="stroke-white dark:stroke-slate-900"
                    strokeWidth={1.5}
                  />
                );
              })}
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};

interface MiniSparklineProps {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  ariaLabel?: string;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({
  values,
  color,
  width = 88,
  height = 14,
  ariaLabel,
}) => {
  const safeValues = values.length >= 2 ? values : [0, 0];
  const minVal = Math.min(...safeValues);
  const maxVal = Math.max(...safeValues);
  const span = maxVal - minVal || 1;
  const padY = 2;
  const innerH = height - padY * 2;

  const points = safeValues.map((val, idx) => {
    const x = (idx / (safeValues.length - 1)) * (width - 2) + 1;
    const y = padY + innerH - ((val - minVal) / span) * innerH;
    return { x, y };
  });

  const lineD = points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;
  const lastPt = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label={ariaLabel}
    >
      <path d={areaD} fill={color} fillOpacity={0.12} />
      <path d={lineD} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastPt.x} cy={lastPt.y} r={1.8} fill={color} />
    </svg>
  );
};
