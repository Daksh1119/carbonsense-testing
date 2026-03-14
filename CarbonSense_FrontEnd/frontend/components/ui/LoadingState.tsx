import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * LoadingState component
 * Displays a loading spinner with optional message
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <Loader2
        className={`${sizeClasses[size]} text-emerald-500 animate-spin mb-4`}
      />
      <p className="text-slate-400 text-center">{message}</p>
    </div>
  );
};

export default LoadingState;
