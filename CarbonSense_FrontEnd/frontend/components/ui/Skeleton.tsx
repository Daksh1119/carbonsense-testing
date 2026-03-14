import React from 'react';

interface SkeletonProps {
  className?: string;
}

/**
 * Base Skeleton component
 * Displays an animated loading placeholder
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-slate-700 rounded ${className}`}
      aria-label="Loading..."
    />
  );
};

export default Skeleton;
