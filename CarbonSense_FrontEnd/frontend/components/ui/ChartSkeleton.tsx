import React from 'react';
import { Skeleton } from './Skeleton';

/**
 * ChartSkeleton component
 * Loading placeholder for charts and graphs
 */
export const ChartSkeleton: React.FC = () => {
  return (
    <div className="bg-slate-800 rounded-lg p-6 shadow-lg">
      {/* Chart Header */}
      <div className="mb-6">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>

      {/* Chart Area */}
      <div className="h-64 flex items-end justify-between gap-2">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
};

export default ChartSkeleton;
