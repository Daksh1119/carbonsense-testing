import React from 'react';
import { Skeleton } from './Skeleton';

/**
 * CardSkeleton component
 * Loading placeholder for dashboard cards
 */
export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-slate-800 rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
      <Skeleton className="h-4 w-20" />
    </div>
  );
};

/**
 * Multiple Card Skeletons
 */
export const DashboardCardsSkeleton: React.FC<{ count?: number }> = ({ 
  count = 4 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={index} />
      ))}
    </div>
  );
};

export default CardSkeleton;
