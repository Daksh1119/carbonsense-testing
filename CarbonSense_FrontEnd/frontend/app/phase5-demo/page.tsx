'use client';

import React, { useState } from 'react';
import ThemeToggle from '@/components/ui/ThemeToggle';
import InteractiveChart from '@/components/ui/InteractiveChart';
import RealtimeChart from '@/components/ui/RealtimeChart';
import { 
  Palette, 
  LineChart as LineChartIcon, 
  Activity,
  CheckCircle,
  Sun,
  Moon,
  TrendingUp,
  BarChart3,
  AreaChart as AreaChartIcon,
} from 'lucide-react';
import { clsx } from 'clsx';

/**
 * Phase 5 Demo Page
 * Demonstrates Theme Toggle and Enhanced Charts with Recharts
 */
export default function Phase5DemoPage() {
  const [chartType, setChartType] = useState<'line' | 'bar' | 'area'>('line');

  // Sample emissions data for charts
  const monthlyEmissions = [
    { name: 'Jan', value: 420, Transport: 150, Energy: 180, Food: 90 },
    { name: 'Feb', value: 380, Transport: 140, Energy: 160, Food: 80 },
    { name: 'Mar', value: 450, Transport: 160, Energy: 190, Food: 100 },
    { name: 'Apr', value: 390, Transport: 145, Energy: 165, Food: 80 },
    { name: 'May', value: 370, Transport: 130, Energy: 155, Food: 85 },
    { name: 'Jun', value: 340, Transport: 120, Energy: 145, Food: 75 },
    { name: 'Jul', value: 320, Transport: 110, Energy: 140, Food: 70 },
    { name: 'Aug', value: 310, Transport: 105, Energy: 135, Food: 70 },
    { name: 'Sep', value: 330, Transport: 115, Energy: 145, Food: 70 },
    { name: 'Oct', value: 350, Transport: 125, Energy: 155, Food: 70 },
    { name: 'Nov', value: 380, Transport: 140, Energy: 165, Food: 75 },
    { name: 'Dec', value: 400, Transport: 150, Energy: 175, Food: 75 },
  ];

  const categoryData = [
    { name: 'Transport', value: 1640 },
    { name: 'Energy', value: 1910 },
    { name: 'Food', value: 940 },
    { name: 'Waste', value: 420 },
    { name: 'Purchases', value: 680 },
  ];

  const reductionTrend = [
    { name: 'Week 1', value: 450 },
    { name: 'Week 2', value: 420 },
    { name: 'Week 3', value: 380 },
    { name: 'Week 4', value: 350 },
    { name: 'Week 5', value: 330 },
    { name: 'Week 6', value: 310 },
    { name: 'Week 7', value: 290 },
    { name: 'Week 8', value: 280 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">
            Phase 5 Feature Demonstration
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Theme switching with next-themes and enhanced interactive charts with Recharts
          </p>
        </div>

        {/* Feature 1: Theme Toggle */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-500" />
            1. Theme Toggle (Light/Dark Mode)
          </h2>

          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Features Demonstrated:</h3>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li>✓ Light, Dark, and System theme modes</li>
                <li>✓ Persistent theme selection (localStorage)</li>
                <li>✓ Smooth transitions between themes</li>
                <li>✓ Multiple toggle variants (button, dropdown, icon-only)</li>
                <li>✓ No hydration errors (SSR-safe)</li>
              </ul>
            </div>

            {/* Theme Toggle Variants */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Button Variant */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <Sun className="w-4 h-4" />
                  Button Variant
                </h4>
                <ThemeToggle variant="button" />
              </div>

              {/* Dropdown Variant */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <Moon className="w-4 h-4" />
                  Dropdown Variant
                </h4>
                <ThemeToggle variant="dropdown" />
              </div>

              {/* Icon-Only Variant */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Icon-Only Variant
                </h4>
                <ThemeToggle variant="icon-only" />
              </div>
            </div>

            {/* Theme Demonstration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg p-6 text-white">
                <h4 className="text-lg font-semibold mb-2">Components Adapt</h4>
                <p className="text-sm text-emerald-50">
                  All UI components automatically adjust to the selected theme
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-6 text-white">
                <h4 className="text-lg font-semibold mb-2">System Sync</h4>
                <p className="text-sm text-blue-50">
                  System mode follows your OS theme preference
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature 2: Interactive Charts */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
            <LineChartIcon className="w-5 h-5 text-blue-500" />
            2. Interactive Charts (Recharts)
          </h2>

          <div className="space-y-6">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Features Demonstrated:</h3>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li>✓ Custom tooltips with formatted data</li>
                <li>✓ Smooth animations on load and interactions</li>
                <li>✓ Responsive design (adapts to container)</li>
                <li>✓ Theme-aware styling (dark/light mode)</li>
                <li>✓ Multiple chart types (line, bar, area)</li>
              </ul>
            </div>

            {/* Chart Type Selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Chart Type:</span>
              <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1">
                <button
                  onClick={() => setChartType('line')}
                  className={clsx(
                    'px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
                    chartType === 'line'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  <TrendingUp className="w-4 h-4" />
                  Line
                </button>
                <button
                  onClick={() => setChartType('bar')}
                  className={clsx(
                    'px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
                    chartType === 'bar'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                  Bar
                </button>
                <button
                  onClick={() => setChartType('area')}
                  className={clsx(
                    'px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2',
                    chartType === 'area'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  )}
                >
                  <AreaChartIcon className="w-4 h-4" />
                  Area
                </button>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Emissions Trend */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                  Monthly Emissions Trend (kg CO₂)
                </h4>
                <InteractiveChart
                  data={monthlyEmissions}
                  type={chartType}
                  dataKey="value"
                  xAxisKey="name"
                  color="#10b981"
                  height={300}
                  showGrid={true}
                  showLegend={false}
                  animate={true}
                />
              </div>

              {/* Emissions by Category */}
              <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                  Emissions by Category (Total kg CO₂)
                </h4>
                <InteractiveChart
                  data={categoryData}
                  type="bar"
                  dataKey="value"
                  xAxisKey="name"
                  color="#3b82f6"
                  height={300}
                  showGrid={true}
                  showLegend={false}
                  animate={true}
                />
              </div>
            </div>

            {/* Reduction Trend */}
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
                8-Week Reduction Trend (kg CO₂ per week)
              </h4>
              <InteractiveChart
                data={reductionTrend}
                type="area"
                dataKey="value"
                xAxisKey="name"
                color="#8b5cf6"
                height={300}
                showGrid={true}
                showLegend={false}
                animate={true}
              />
            </div>
          </div>
        </div>

        {/* Feature 3: Real-Time Chart */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-500" />
            3. Real-Time Chart Updates
          </h2>

          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Features Demonstrated:</h3>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li>✓ Live data streaming with automatic updates</li>
                <li>✓ Play/Pause controls for data flow</li>
                <li>✓ Reset functionality to restart simulation</li>
                <li>✓ Sliding window (shows last 20 data points)</li>
                <li>✓ Live indicator when data is streaming</li>
              </ul>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">
                Live Emissions Monitor (Updates every 2 seconds)
              </h4>
              <RealtimeChart
                maxDataPoints={20}
                updateInterval={2000}
                type="line"
                color="#f59e0b"
              />
            </div>
          </div>
        </div>

        {/* Success Summary */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-400 mb-2">
                Phase 5 Implementation Complete!
              </h3>
              <p className="text-slate-700 dark:text-slate-300 text-sm mb-3">
                Theme management and advanced chart visualizations fully functional.
              </p>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li>✅ Dark/Light/System theme toggle with next-themes</li>
                <li>✅ Enhanced interactive charts with Recharts</li>
                <li>✅ Custom tooltips and animations</li>
                <li>✅ Real-time chart updates with controls</li>
                <li>✅ Theme-aware styling across all components</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
