import React from 'react';
import { Skeleton } from './Skeleton';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

/**
 * TableSkeleton component
 * Loading placeholder for data tables
 */
export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 5,
}) => {
  return (
    <div className="bg-slate-800 rounded-lg p-6 shadow-lg">
      {/* Table Header */}
      <div className="flex items-center gap-4 mb-4">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} className="h-10 flex-1" />
        ))}
      </div>

      {/* Table Rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex items-center gap-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton 
                key={`cell-${rowIndex}-${colIndex}`} 
                className="h-12 flex-1" 
              />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <Skeleton className="h-10 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
    </div>
  );
};

export default TableSkeleton;
