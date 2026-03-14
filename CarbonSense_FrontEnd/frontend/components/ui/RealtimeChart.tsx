'use client';

import { useState, useEffect, useCallback } from 'react';
import InteractiveChart from './InteractiveChart';
import { clsx } from 'clsx';
import { Play, Pause, RotateCcw } from 'lucide-react';

export interface RealtimeChartProps {
  initialData?: Array<{ name: string; value: number }>;
  maxDataPoints?: number;
  updateInterval?: number;
  type?: 'line' | 'bar' | 'area';
  color?: string;
  className?: string;
}

/**
 * RealtimeChart Component
 * Chart with live data updates and controls
 */
export default function RealtimeChart({
  initialData = [],
  maxDataPoints = 20,
  updateInterval = 2000,
  type = 'line',
  color = '#10b981',
  className,
}: RealtimeChartProps) {
  const [data, setData] = useState(initialData);
  const [isPlaying, setIsPlaying] = useState(false);
  const [counter, setCounter] = useState(initialData.length);

  // Generate random data point
  const generateDataPoint = useCallback(() => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    return {
      name: timeStr,
      value: Math.floor(Math.random() * 100) + 20,
    };
  }, []);

  // Initialize with data if empty
  useEffect(() => {
    if (data.length === 0) {
      const initial = Array.from({ length: 10 }, (_, i) => {
        const now = new Date();
        now.setSeconds(now.getSeconds() - (10 - i) * 2);
        return {
          name: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`,
          value: Math.floor(Math.random() * 100) + 20,
        };
      });
      setData(initial);
      setCounter(initial.length);
    }
  }, [data.length]);

  // Real-time data updates
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setData((prev) => {
        const newPoint = generateDataPoint();
        const updated = [...prev, newPoint];
        
        // Keep only the last maxDataPoints
        if (updated.length > maxDataPoints) {
          return updated.slice(updated.length - maxDataPoints);
        }
        
        return updated;
      });
      setCounter((c) => c + 1);
    }, updateInterval);

    return () => clearInterval(interval);
  }, [isPlaying, updateInterval, maxDataPoints, generateDataPoint]);

  const handleReset = () => {
    setIsPlaying(false);
    const initial = Array.from({ length: 10 }, (_, i) => {
      const now = new Date();
      now.setSeconds(now.getSeconds() - (10 - i) * 2);
      return {
        name: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`,
        value: Math.floor(Math.random() * 100) + 20,
      };
    });
    setData(initial);
    setCounter(initial.length);
  };

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors',
              isPlaying
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            )}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Start
              </>
            )}
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
        <div className="text-sm text-slate-400">
          <span className="font-medium text-slate-300">{data.length}</span> data points
          {isPlaying && (
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <InteractiveChart
        data={data}
        type={type}
        color={color}
        height={350}
        dataKey="value"
        xAxisKey="name"
        showGrid={true}
        showLegend={false}
        animate={false}
      />
    </div>
  );
}
