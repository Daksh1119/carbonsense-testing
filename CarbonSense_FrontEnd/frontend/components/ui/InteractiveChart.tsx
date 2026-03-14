'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { clsx } from 'clsx';

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface InteractiveChartProps {
  data: ChartDataPoint[];
  type?: 'line' | 'bar' | 'area';
  dataKey?: string;
  xAxisKey?: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  animate?: boolean;
  enableZoom?: boolean;
  className?: string;
}

/**
 * Custom Tooltip Component
 */
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
        <p className="text-slate-300 text-sm font-medium mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-400">{entry.name}:</span>
            <span className="text-emerald-400 font-semibold">
              {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

/**
 * InteractiveChart Component
 * Enhanced chart with Recharts featuring tooltips, animations, and interactions
 */
export default function InteractiveChart({
  data,
  type = 'line',
  dataKey = 'value',
  xAxisKey = 'name',
  color = '#10b981',
  height = 300,
  showGrid = true,
  showLegend = true,
  animate = true,
  enableZoom = false,
  className,
}: InteractiveChartProps) {
  const [focusedBar, setFocusedBar] = useState<number | null>(null);
  const [zoomDomain, setZoomDomain] = useState<[number, number] | undefined>(undefined);

  const handleMouseEnter = (data: any, index: number) => {
    setFocusedBar(index);
  };

  const handleMouseLeave = () => {
    setFocusedBar(null);
  };

  const commonChartProps = {
    data,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
  };

  const commonAxisProps = {
    stroke: '#64748b',
    style: { fontSize: '12px', fill: '#94a3b8' },
  };

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return (
          <BarChart {...commonChartProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#334155" />}
            <XAxis dataKey={xAxisKey} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }} />
            {showLegend && <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />}
            <Bar
              dataKey={dataKey}
              fill={color}
              radius={[6, 6, 0, 0]}
              animationDuration={animate ? 1000 : 0}
              opacity={focusedBar !== null ? 0.7 : 1}
            />
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart {...commonChartProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#334155" />}
            <XAxis dataKey={xAxisKey} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={color}
              fillOpacity={0.2}
              strokeWidth={2}
              animationDuration={animate ? 1000 : 0}
            />
          </AreaChart>
        );

      case 'line':
      default:
        return (
          <LineChart {...commonChartProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#334155" />}
            <XAxis dataKey={xAxisKey} {...commonAxisProps} />
            <YAxis {...commonAxisProps} />
            <Tooltip content={<CustomTooltip />} />
            {showLegend && <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />}
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={{ fill: color, r: 4 }}
              activeDot={{ r: 6, fill: color }}
              animationDuration={animate ? 1000 : 0}
            />
          </LineChart>
        );
    }
  };

  return (
    <div className={clsx('w-full', className)}>
      <ResponsiveContainer width="100%" height={height}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
