'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useEmissions } from '@/hooks';
import DataTable from '@/components/ui/DataTable';
import { CardSkeleton, TableSkeleton, ErrorState, EmptyState } from '@/components/ui';
import Button from '@/components/Button';
import { Breadcrumb, BackButton } from '@/components/navigation';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/lib/toast';
import {
  Edit,
  Trash2,
  Eye,
  FileDown,
  Plus,
} from 'lucide-react';
import { clsx } from 'clsx';

export default function DetailedEmissionsLogPage() {
  const { emissions, total, isLoading, error, refetch } = useEmissions();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const router = useRouter();

  // Filter data by category
  const filteredData = selectedCategory === 'all' 
    ? emissions 
    : emissions.filter(e => e.category === selectedCategory);

  // Table columns
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
      cell: (info) => (
        <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'date',
      header: 'Date',
      cell: (info) => {
        const dateStr = info.getValue() as string;
        const date = new Date(dateStr);
        return (
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        );
      },
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: (info) => {
        const category = info.getValue() as string;
        const colors: Record<string, string> = {
          transport: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
          energy: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
          food: 'bg-green-500/10 text-green-600 dark:text-green-400',
          waste: 'bg-red-500/10 text-red-600 dark:text-red-400',
          purchases: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
        };
        return (
          <span className={clsx('px-2 py-1 rounded text-xs font-medium capitalize', colors[category] || 'bg-gray-500/10 text-gray-600')}>
            {category}
          </span>
        );
      },
    },
    {
      accessorKey: 'activity',
      header: 'Activity',
      cell: (info) => (
        <span className="text-sm text-slate-700 dark:text-slate-300">{info.getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: (info) => {
        const row = info.row.original;
        return (
          <span className="text-sm text-slate-600 dark:text-slate-400">
            {info.getValue()} {row.unit}
          </span>
        );
      },
    },
    {
      accessorKey: 'co2Amount',
      header: 'CO₂ Impact',
      cell: (info) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {(info.getValue() as number).toFixed(2)} kg
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const row = info.row.original;
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => showInfoToast(`Viewing details for ${row.activity}`)}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-400/10 rounded transition-colors"
              title="View"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                showInfoToast('Opening edit form...');
                // In real app, would navigate to /emissions/edit/[id]
              }}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 rounded transition-colors"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => showErrorToast(`Delete "${row.activity}"? This action cannot be undone.`)}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-400/10 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    },
  ];

  const handleExport = () => {
    showSuccessToast('Emissions log exported successfully!');
  };

  // Show error state
  if (error && !isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <Breadcrumb />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Detailed Emissions Log
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Audit-ready granular activity tracking
              </p>
            </div>
            <BackButton href="/dashboard" label="Back to Dashboard" />
          </div>
        </div>
        <ErrorState
          title="Failed to load emissions"
          message={error}
          onRetry={refetch}
        />
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  // Show empty state
  if (!emissions || emissions.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <Breadcrumb />
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Detailed Emissions Log
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Audit-ready granular activity tracking
              </p>
            </div>
            <div className="flex items-center gap-3">
              <BackButton href="/dashboard" label="Back to Dashboard" variant="outline" />
              <button 
                onClick={() => router.push('/emissions')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Log New Activity
              </button>
            </div>
          </div>
        </div>
        <EmptyState
          title="No emissions recorded"
          message="Start by adding your first carbon activity to track your environmental impact."
          actionLabel="Log First Activity"
          onAction={() => router.push('/emissions')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb />
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Detailed Emissions Log
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Audit-ready granular activity tracking • Total: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{total.toFixed(2)} kg CO₂e</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BackButton href="/dashboard" label="Back to Dashboard" variant="outline" showIcon={true} />
          <button 
            onClick={() => router.push('/emissions')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors shadow-lg shadow-emerald-600/20"
          >
            <Plus className="w-4 h-4" />
            Log New Activity
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filter:</span>
        {['all', 'transport', 'energy', 'food', 'waste', 'purchases'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              selectedCategory === cat
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500'
            )}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredData}
          pageSize={10}
          showPagination={true}
          showSearch={true}
          showExport={true}
          onExport={handleExport}
          searchPlaceholder="Search emissions by activity, category..."
        />
      </div>

      {/* Summary Footer */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Total Entries</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{filteredData.length}</p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Total CO₂</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {filteredData.reduce((sum, e) => sum + e.co2Amount, 0).toFixed(2)} kg
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Average per Entry</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {filteredData.length > 0 
                ? (filteredData.reduce((sum, e) => sum + e.co2Amount, 0) / filteredData.length).toFixed(2)
                : '0.00'} kg
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
