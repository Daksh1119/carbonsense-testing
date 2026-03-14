import React from 'react';
import { Inbox, Plus } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

/**
 * EmptyState component
 * Displays when there is no data to show
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No data found',
  message = 'Get started by adding your first entry.',
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="bg-slate-700/50 p-3 rounded-full mb-4">
        {icon || <Inbox className="w-8 h-8 text-slate-400" />}
      </div>
      <h3 className="text-xl font-semibold text-slate-50 mb-2">{title}</h3>
      <p className="text-slate-400 text-center max-w-md mb-6">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
