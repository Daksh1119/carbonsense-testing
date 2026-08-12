'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useEmissions, useEmissionsUploads } from '@/hooks';
import { deleteEmissionsUpload, getUploadDisplayType, getUploadDisplayName, formatUploadDate } from '@/lib/emissions-api';
import { getCurrentUserContext } from '@/lib/recommendations-api';
import DataTable from '@/components/ui/DataTable';
import { CardSkeleton, TableSkeleton, ErrorState, EmptyState } from '@/components/ui';
import Button from '@/components/Button';
import { Breadcrumb, BackButton } from '@/components/navigation';
import Modal from '@/components/ui/Modal';
import FormModal from '@/components/ui/FormModal';
import { showSuccessToast, showErrorToast } from '@/lib/toast';
import {
  transportFactors,
  energyFactors,
  wasteFactors,
  purchasesFactors,
} from '@/lib/emissions-factors';
import {
  Edit,
  Trash2,
  Eye,
  FileDown,
  Plus,
  BarChart3,
} from 'lucide-react';
import { clsx } from 'clsx';

const MONTH_OPTIONS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
];

function DetailedEmissionsLogContent() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const minYear = currentYear - 19;

  const { uploads, isLoading: uploadsLoading, error: uploadsError, refetch: refetchUploads } = useEmissionsUploads();
  const searchParams = useSearchParams();
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const queryYearRaw = searchParams.get('year');
  const queryMonthRaw = searchParams.get('month');
  const hasExplicitPeriodQuery = Boolean(queryYearRaw || queryMonthRaw);
  const queryYear = queryYearRaw ? Number(queryYearRaw) : Number.NaN;
  const queryMonth = queryMonthRaw ? Number(queryMonthRaw) : Number.NaN;
  const queryYearValid =
    Number.isInteger(queryYear) && queryYear >= minYear && queryYear <= currentYear
      ? queryYear
      : currentYear;
  const queryMonthValid = Number.isInteger(queryMonth) && queryMonth >= 1 && queryMonth <= 12 ? queryMonth : currentMonth;
  const queryIsFuture =
    queryYearValid > currentYear ||
    (queryYearValid === currentYear && queryMonthValid > currentMonth);

  const initialYear = queryIsFuture ? currentYear : queryYearValid;
  const initialMonth = queryIsFuture ? currentMonth : queryMonthValid;

  const [selectedYear, setSelectedYear] = useState<number>(initialYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(initialMonth);
  const [isAllPeriods, setIsAllPeriods] = useState<boolean>(!hasExplicitPeriodQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewEntryId, setViewEntryId] = useState<string | null>(null);
  const [editEntryId, setEditEntryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    date: '',
    activity: '',
    amount: '',
    unit: '',
    co2Amount: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [recomputedCycleId, setRecomputedCycleId] = useState<string | null>(null);
  const router = useRouter();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const { organizationId, userId } = getCurrentUserContext();

  // Group 1.10 — call backend to recompute cycle after edit/delete
  const callEntryRecompute = async (entryId: string, method: 'PUT' | 'DELETE', body?: object): Promise<string | null> => {
    try {
      const params = method === 'DELETE'
        ? new URLSearchParams({ organization_id: organizationId || '', user_id: userId || '' })
        : null;
      const url = method === 'DELETE'
        ? `${apiUrl}/ingestion/entries/${entryId}?${params}`
        : `${apiUrl}/ingestion/entries/${entryId}`;
      const res = await fetch(url, {
        method,
        headers: method === 'PUT' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'PUT' ? JSON.stringify({ organization_id: organizationId, user_id: userId, ...body }) : undefined,
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (data.recomputed_cycle_id as string | null) ?? null;
    } catch {
      return null; // non-fatal
    }
  };

  const parseDateValue = (value?: string | null): Date | null => {
    if (!value) return null;

    const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);
      const localDate = new Date(year, month - 1, day);
      if (!Number.isNaN(localDate.getTime())) {
        return localDate;
      }
    }

    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const parsePeriodDate = (upload: { period_start: string | null; period_end: string | null; created_at: string }): Date | null => {
    const source = upload.period_end || upload.period_start || upload.created_at;
    return parseDateValue(source);
  };

  const availableYears = useMemo(() => {
    const result: number[] = [];
    for (let year = currentYear; year >= minYear; year -= 1) {
      result.push(year);
    }
    return result;
  }, [currentYear, minYear]);

  const allowedMonths = useMemo(() => {
    const maxMonth = selectedYear === currentYear ? currentMonth : 12;
    return MONTH_OPTIONS.filter((option) => option.value <= maxMonth);
  }, [selectedYear, currentYear, currentMonth]);

  const uploadsForSelectedPeriod = useMemo(() => {
    return uploads
      .filter((upload) => {
        const periodDate = parsePeriodDate(upload);
        if (!periodDate) return false;
        return (
          periodDate.getFullYear() === selectedYear &&
          periodDate.getMonth() + 1 === selectedMonth
        );
      })
      .sort((left, right) => {
        const leftTime = parsePeriodDate(left)?.getTime() || 0;
        const rightTime = parsePeriodDate(right)?.getTime() || 0;
        return rightTime - leftTime;
      });
  }, [uploads, selectedYear, selectedMonth]);

  const uploadsForDisplay = useMemo(() => {
    const source = isAllPeriods ? uploads : uploadsForSelectedPeriod;
    return [...source].sort((left, right) => {
      const leftTime = parsePeriodDate(left)?.getTime() || 0;
      const rightTime = parsePeriodDate(right)?.getTime() || 0;
      return rightTime - leftTime;
    });
  }, [isAllPeriods, uploads, uploadsForSelectedPeriod]);

  const activeUploadIds = useMemo(
    () => (selectedUploadId ? [selectedUploadId] : uploadsForDisplay.map((upload) => upload.id)),
    [selectedUploadId, uploadsForDisplay]
  );

  const { emissions, total, isLoading, error, refetch, updateEmission, deleteEmission } = useEmissions({
    uploadIds: activeUploadIds,
  });

  const factorMap = useMemo(
    () =>
      new Map(
        [...transportFactors, ...energyFactors, ...wasteFactors, ...purchasesFactors].map((factor) => [
          factor.value,
          factor.factorKgPerUnit,
        ])
      ),
    []
  );

  useEffect(() => {
    if (selectedYear < minYear) {
      setSelectedYear(minYear);
      setSelectedMonth(1);
      return;
    }

    if (selectedYear > currentYear) {
      setSelectedYear(currentYear);
      setSelectedMonth(currentMonth);
      return;
    }

    if (selectedYear === currentYear && selectedMonth > currentMonth) {
      setSelectedMonth(currentMonth);
    }
  }, [selectedYear, selectedMonth, currentYear, currentMonth, minYear]);

  useEffect(() => {
    if (!selectedUploadId) return;

    const stillValid = uploadsForDisplay.some((upload) => upload.id === selectedUploadId);
    if (!stillValid) {
      setSelectedUploadId(null);
    }
  }, [uploadsForDisplay, selectedUploadId]);

  const selectedUpload = uploadsForDisplay.find((upload) => upload.id === selectedUploadId) || null;
  const periodLabel = isAllPeriods
    ? 'All Uploads'
    : new Date(selectedYear, selectedMonth - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      });

  const viewEntry = useMemo(
    () => emissions.find((entry) => entry.id === viewEntryId) || null,
    [emissions, viewEntryId]
  );

  const editEntry = useMemo(
    () => emissions.find((entry) => entry.id === editEntryId) || null,
    [emissions, editEntryId]
  );

  const computedEditCo2 = useMemo(() => {
    const activityKey = editForm.activity.trim().toLowerCase();
    const factor = factorMap.get(activityKey);
    if (!factor) return 0;
    const amount = Number(editForm.amount || 0);
    if (Number.isNaN(amount)) return 0;
    return Number((amount * factor).toFixed(2));
  }, [editForm.activity, editForm.amount, factorMap]);

  useEffect(() => {
    if (!editEntry) return;
    setEditForm({
      date: editEntry.date,
      activity: editEntry.activity,
      amount: String(editEntry.amount),
      unit: editEntry.unit,
      co2Amount: String(editEntry.co2Amount),
    });
  }, [editEntry]);

  const getSourceBadge = (sourceType?: string) => {
    const type = String(sourceType || '').toLowerCase();
    if (type === 'manual') {
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    }
    return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  };

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
              onClick={() => {
                setViewEntryId(row.id);
              }}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-400/10 rounded transition-colors"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (row.uploadId) {
                  router.push(`/analytics?uploadId=${row.uploadId}`);
                } else {
                  router.push(`/analytics`);
                }
              }}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-400/10 rounded transition-colors"
              title="View Analytics for Dataset"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
            <button
              onClick={async () => {
                setEditEntryId(row.id);
              }}
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-400/10 rounded transition-colors"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={async () => {
                const confirmed = window.confirm(`Delete "${row.activity}"? This action cannot be undone.`);
                if (!confirmed) return;

                try {
                  await deleteEmission(row.id);
                  // Group 1.10 — recompute affected cycle
                  const cycleId = await callEntryRecompute(row.id, 'DELETE');
                  if (cycleId) {
                    setRecomputedCycleId(cycleId);
                    showSuccessToast('Entry deleted — cycle totals recomputed automatically.');
                  } else {
                    showSuccessToast('Entry deleted successfully.');
                  }
                } catch (err) {
                  showErrorToast(err instanceof Error ? err.message : 'Failed to delete entry.');
                }
              }}
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

  const combinedError = error || uploadsError;
  const combinedLoading = isLoading || uploadsLoading;

  // Show error state
  if (combinedError && !combinedLoading) {
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
          message={combinedError}
          onRetry={() => {
            refetch();
            refetchUploads();
          }}
        />
      </div>
    );
  }

  // Show loading state
  if (combinedLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  // Show empty state
  if ((!emissions || emissions.length === 0) && uploads.length === 0) {
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
          title="No uploads recorded"
          message="Upload your first monthly emissions file to view the detailed log."
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

      {/* Group 1.10 — recompute banner */}
      {recomputedCycleId && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 text-sm">
          <BarChart3 className="size-4 flex-shrink-0" />
          <span>Cycle totals recomputed — dashboard and analytics are now up-to-date.</span>
          <button onClick={() => setRecomputedCycleId(null)} className="ml-auto text-teal-400 hover:text-white">
            ✕
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Detailed Emissions Log
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Audit-ready granular activity tracking • Period: {periodLabel} • Total:{' '}
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{total.toFixed(2)} kg CO₂e</span>
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

      {/* Period Controls */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 min-w-[120px]">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Year
            </label>
            <select
              value={selectedYear}
              onChange={(event) => {
                setSelectedYear(Number(event.target.value));
                setIsAllPeriods(false);
              }}
              className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 text-sm text-slate-900 dark:text-slate-100"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1 min-w-[110px]">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Month
            </label>
            <select
              value={selectedMonth}
              onChange={(event) => {
                setSelectedMonth(Number(event.target.value));
                setIsAllPeriods(false);
              }}
              className="h-9 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 text-sm text-slate-900 dark:text-slate-100"
            >
              {allowedMonths.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              setIsAllPeriods(false);
              setSelectedYear(currentYear);
              setSelectedMonth(currentMonth);
            }}
            className="h-9"
          >
            Current Month
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setIsAllPeriods(true);
              setSelectedUploadId(null);
            }}
            className="h-9"
          >
            All
          </Button>

          <p className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
            {isAllPeriods
              ? `Showing all uploads • Range: ${minYear}-${currentYear}`
              : `Range: ${minYear}-${currentYear} • Future periods blocked.`}
          </p>
        </div>
      </div>

      {/* Uploads List */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Uploads</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAllPeriods
                ? 'Showing all uploads. Select one upload to narrow the table, or keep All Uploads selected.'
                : `Filtered for ${periodLabel}. Select one upload to narrow the table, or keep All Uploads selected.`}
            </p>
          </div>
          {selectedUpload && (
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border',
                  getSourceBadge(selectedUpload.source_type)
                )}
              >
                {getUploadDisplayType(selectedUpload)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {new Date(selectedUpload.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          )}
        </div>
        {uploadsForDisplay.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {isAllPeriods
                ? 'No uploads found yet. Upload a file to start tracking.'
                : `No uploads found for ${periodLabel}. Select another month or upload a new activity file.`}
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setSelectedUploadId(null)}
            className={clsx(
              'px-3 py-2 rounded-lg text-left border transition-all min-w-[180px]',
              selectedUploadId === null
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500'
            )}
          >
            <span className="block text-sm font-semibold">All Uploads</span>
            <span className={clsx('text-xs', selectedUploadId === null ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}>
              {uploadsForDisplay.length} upload(s) in current view
            </span>
          </button>

          {uploadsForDisplay.map((upload) => {
            const isActive = upload.id === selectedUploadId;
            const uploadDate = formatUploadDate(upload.created_at);
            return (
              <div
                key={upload.id}
                className={clsx(
                  'px-3 py-2 rounded-lg text-left border transition-all min-w-[180px]',
                  isActive
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUploadId(upload.id)}
                    className="text-left"
                  >
                    <span className="block text-sm font-semibold">{uploadDate}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border',
                        getSourceBadge(upload.source_type),
                        isActive ? 'border-transparent' : ''
                      )}
                    >
                      {getUploadDisplayType(upload)}
                    </span>
                    <button
                      type="button"
                      onClick={() => router.push(`/analytics?uploadId=${upload.id}`)}
                      className={clsx(
                        'p-1 rounded-md border text-xs transition-colors',
                        isActive
                          ? 'border-white/30 text-white hover:bg-white/10'
                          : 'border-slate-300/60 text-slate-500 hover:border-emerald-500 hover:text-emerald-500 dark:border-slate-600 dark:text-slate-400 dark:hover:border-emerald-400 dark:hover:text-emerald-400'
                      )}
                      title="View analytics"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const confirmed = window.confirm(
                          `Delete upload \"${upload.original_file_name}\" permanently? This will also remove all linked emission entries for this upload.`
                        );
                        if (!confirmed) return;

                        try {
                          const { organizationId, userId } = getCurrentUserContext();
                          if (!organizationId) {
                            throw new Error('Missing organization context.');
                          }

                          await deleteEmissionsUpload(organizationId, upload.id, userId || undefined);

                          if (selectedUploadId === upload.id) {
                            setSelectedUploadId(null);
                          }

                          await refetchUploads();
                          await refetch();
                          showSuccessToast('Upload deleted permanently.');
                        } catch (err) {
                          showErrorToast(err instanceof Error ? err.message : 'Failed to delete upload.');
                        }
                      }}
                      className={clsx(
                        'p-1 rounded-md border text-xs transition-colors',
                        isActive
                          ? 'border-white/30 text-white hover:bg-white/10'
                          : 'border-slate-300/60 text-slate-500 hover:border-red-500 hover:text-red-500 dark:border-slate-600 dark:text-slate-400 dark:hover:border-red-400 dark:hover:text-red-400'
                      )}
                      title="Delete upload"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUploadId(upload.id)}
                  className={clsx('text-xs truncate text-left w-full', isActive ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}
                >
                  {getUploadDisplayName(upload)}
                </button>
              </div>
            );
          })}
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

      {/* View Entry Modal */}
      <Modal
        isOpen={Boolean(viewEntry)}
        onClose={() => setViewEntryId(null)}
        title="Emission Entry Details"
        description="Review the recorded emissions entry."
        size="md"
      >
        {viewEntry && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400">Date</p>
                <p className="text-sm text-slate-100 font-medium">
                  {new Date(viewEntry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400">Category</p>
                <p className="text-sm text-slate-100 font-medium capitalize">{viewEntry.category}</p>
              </div>
              <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3 sm:col-span-2">
                <p className="text-xs text-slate-400">Activity</p>
                <p className="text-sm text-slate-100 font-medium">{viewEntry.activity}</p>
              </div>
              <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400">Amount</p>
                <p className="text-sm text-slate-100 font-medium">{viewEntry.amount} {viewEntry.unit}</p>
              </div>
              <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400">CO₂ Impact</p>
                <p className="text-sm text-emerald-400 font-semibold">{viewEntry.co2Amount.toFixed(2)} kg CO₂e</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Entry Modal */}
      <FormModal
        isOpen={Boolean(editEntry)}
        onClose={() => setEditEntryId(null)}
        title="Edit Emissions Entry"
        description="Update editable values and save changes."
        submitLabel="Save Changes"
        cancelLabel="Cancel"
        isSubmitting={isSaving}
        isValid={Boolean(editForm.activity.trim())}
        onSubmit={async () => {
          if (!editEntry) return;
          const nextAmount = Number(editForm.amount);
          if (Number.isNaN(nextAmount)) {
            showErrorToast('Amount must be a valid number.');
            return;
          }

          setIsSaving(true);
          try {
            await updateEmission(editEntry.id, {
              date: editForm.date,
              activity: editForm.activity.trim(),
              amount: nextAmount,
              unit: editForm.unit,
              co2Amount: computedEditCo2,
            });
            // Group 1.10 — recompute affected cycle
            const cycleId = await callEntryRecompute(editEntry.id, 'PUT', {
              kg_co2e: computedEditCo2,
              date: editForm.date,
            });
            if (cycleId) setRecomputedCycleId(cycleId);
            showSuccessToast(
              cycleId
                ? 'Entry updated — cycle totals recomputed automatically.'
                : 'Entry updated successfully.'
            );
            setEditEntryId(null);
          } catch (err) {
            showErrorToast(err instanceof Error ? err.message : 'Failed to update entry.');
          } finally {
            setIsSaving(false);
          }
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-1 text-sm text-slate-300">
            Date
            <input
              type="date"
              value={editForm.date}
              onChange={(event) => setEditForm((prev) => ({ ...prev, date: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-300">
            Category
            <input
              type="text"
              value={editEntry?.category ? editEntry.category.charAt(0).toUpperCase() + editEntry.category.slice(1) : ''}
              disabled={true}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-400"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-300 sm:col-span-2">
            Activity
            <input
              type="text"
              value={editForm.activity}
              onChange={(event) => setEditForm((prev) => ({ ...prev, activity: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
              placeholder="Activity description"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-300">
            Amount
            <input
              type="number"
              value={editForm.amount}
              onChange={(event) => setEditForm((prev) => ({ ...prev, amount: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-300">
            Unit
            <input
              type="text"
              value={editForm.unit}
              onChange={(event) => setEditForm((prev) => ({ ...prev, unit: event.target.value }))}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-300 sm:col-span-2">
            CO₂ Impact (kg)
            <input
              type="number"
              value={computedEditCo2}
              disabled={true}
              className="w-full rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-400"
            />
          </label>
        </div>
      </FormModal>
    </div>
  );
}

export default function DetailedEmissionsLogPage() {
  return (
    <Suspense fallback={<div className="space-y-6"><div className="h-32 bg-slate-800 rounded-xl animate-pulse" /><div className="h-64 bg-slate-800 rounded-xl animate-pulse" /></div>}>
      <DetailedEmissionsLogContent />
    </Suspense>
  );
}
