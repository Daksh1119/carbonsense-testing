"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardCard from '@/components/DashboardCard';
import Button from '@/components/Button';
import FileUpload from '@/components/ui/FileUpload';
import { Breadcrumb, BackButton } from '@/components/navigation';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/lib/toast';
import { calculateEmissionsFromCSV } from '@/lib/ingestion-api';
import { persistCsvUpload } from '@/lib/emissions-api';
import { getCurrentUserContext } from '@/lib/recommendations-api';
import {
  Upload,
  FileText,
  Database,
  CheckCircle,
  AlertCircle,
  Table,
  ChevronDown,
  Info,
} from 'lucide-react';

export default function DataIngestionPage() {
  const router = useRouter();
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [csvProcessed, setCsvProcessed] = useState(false);
  const [schemaExpanded, setSchemaExpanded] = useState(false);

  const handleFilesAccepted = async (files: File[], type: string) => {
    setUploadingType(type);
    setCsvProcessed(false);
    showInfoToast(`Uploading ${files.length} file(s)...`);

    try {
      if (type === 'csv' && files.length > 0) {
        const { userId, organizationId } = getCurrentUserContext();
        if (!userId || !organizationId) {
          throw new Error('Missing logged-in user/organization context. Please login again.');
        }

        let processedCount = 0;
        let latestSummary: unknown = null;
        const failedFiles: string[] = [];

        for (let index = 0; index < files.length; index += 1) {
          const file = files[index];
          const progressStart = Math.round((index / files.length) * 100);
          const progressEnd = Math.round(((index + 1) / files.length) * 100);
          setUploadProgress(progressStart);

          try {
            showInfoToast(`Processing ${index + 1}/${files.length}: ${file.name}`);
            const summary = await calculateEmissionsFromCSV(file, organizationId, userId);
            await persistCsvUpload({
              organizationId,
              userId,
              file,
              summary,
            });

            latestSummary = summary;
            processedCount += 1;
          } catch (fileError) {
            const fileMessage = fileError instanceof Error ? fileError.message : 'Unknown processing error';
            failedFiles.push(`${file.name} (${fileMessage})`);
          }

          setUploadProgress(progressEnd);
        }

        if (processedCount === 0) {
          throw new Error(`All selected files failed. ${failedFiles.join(' | ')}`);
        }

        if (latestSummary) {
          sessionStorage.setItem('latest_csv_emissions_summary', JSON.stringify(latestSummary));
        }

        if (failedFiles.length > 0) {
          showErrorToast(`${failedFiles.length} file(s) failed to ingest. Check format/schema and retry.`);
        }

        showSuccessToast(`Successfully processed ${processedCount}/${files.length} file(s)`);
        setCsvProcessed(true);
      } else {
        setUploadProgress(100);
        showSuccessToast(`Successfully uploaded ${files.length} file(s)`);
      }

      setUploadingType(null);
      setUploadProgress(0);

      if (type !== 'csv') {
        router.push('/detailed-log');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      if (message.toLowerCase().includes('not found')) {
        showErrorToast('Upload API route not found. Restart backend server and try again.');
      } else {
        showErrorToast(`Failed to process files: ${message}`);
      }
      setUploadingType(null);
      setUploadProgress(0);
      // Re-throw so the FileUpload component knows the upload failed
      // and does not add the file to the "Selected Files" list
      throw error;
    }
  };

  const handleFilesRejected = (rejections: any[]) => {
    rejections.forEach((rejection) => {
      showErrorToast(`${rejection.file.name}: ${rejection.errors[0].message}`);
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Data Ingestion
          </h1>
          <p className="text-slate-400">
            Upload CSV files and bank statements for automatic carbon tracking
          </p>
        </div>
        <BackButton href="/dashboard" label="Back to Dashboard" variant="outline" />
      </div>

      {csvProcessed && (
        <DashboardCard title="CSV Processed Successfully" subtitle="Choose where you want to continue">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => router.push('/detailed-log')}>
              View Detailed Log
            </Button>
            <Button variant="outline" onClick={() => router.push('/analytics')}>
              View Analytics
            </Button>
          </div>
        </DashboardCard>
      )}

      {/* CSV Schema Reference — collapsible */}
      <div className="glass-card rounded-xl overflow-hidden">
        <button
          onClick={() => setSchemaExpanded(!schemaExpanded)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-700/20 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Table className="size-4 text-emerald-400" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-white">CSV Schema Reference</h3>
              <p className="text-xs text-slate-500">Required format for CSV file uploads</p>
            </div>
          </div>
          <ChevronDown className={`size-4 text-slate-400 transition-transform duration-200 ${schemaExpanded ? 'rotate-180' : ''}`} />
        </button>

        {schemaExpanded && (
          <div className="px-5 pb-4 space-y-4 border-t border-slate-700/40">
            {/* Required Columns */}
            <div className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle className="size-3.5" />
                  Required Columns (Approach B Unified Schema)
                </h4>
                <span className="text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                  Legacy <code className="text-emerald-300">employee_id</code> &amp; <code className="text-emerald-300">employee_name</code> backward-compatible
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'record_id', hint: 'Unique row ID' },
                  { name: 'organization_id', hint: 'Your org ID' },
                  { name: 'emitter_type', hint: 'facility | machinery | employee' },
                  { name: 'emitter_id', hint: 'Asset or Person ID' },
                  { name: 'emitter_name', hint: 'Asset or Person Name' },
                  { name: 'department', hint: 'Dept name' },
                  { name: 'date', hint: 'YYYY-MM-DD' },
                  { name: 'activity_type', hint: 'See activity types' },
                  { name: 'quantity', hint: 'Numeric value' },
                  { name: 'unit', hint: 'e.g. kWh, liter, km' },
                ].map((col) => (
                  <span
                    key={col.name}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 font-mono"
                    title={col.hint}
                  >
                    {col.name}
                    <span className="text-emerald-500/50 font-sans text-[10px]">({col.hint})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Emitter Types Guide */}
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="size-3.5 text-sky-400" />
                Emitter Categories (GHG Protocol Asset Mapping)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-slate-900/60 rounded-md p-2 border border-slate-700/40">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    facility
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Building grid power (Scope 2), HVAC chillers, natural gas heating, office waste.
                  </p>
                </div>
                <div className="bg-slate-900/60 rounded-md p-2 border border-slate-700/40">
                  <div className="font-semibold text-amber-400 flex items-center gap-1 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    machinery
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Backup diesel generators (DG sets), warehouse forklifts, delivery fleet vehicles.
                  </p>
                </div>
                <div className="bg-slate-900/60 rounded-md p-2 border border-slate-700/40">
                  <div className="font-semibold text-sky-400 flex items-center gap-1 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                    employee
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Business air travel, train journeys, daily commuting, hotel stays, cafeteria meals.
                  </p>
                </div>
              </div>
            </div>

            {/* Optional Columns */}
            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="size-3.5" />
                Optional Columns
              </h4>
              <div className="flex flex-wrap gap-2">
                {['source_category', 'spend_inr', 'vendor', 'location', 'scope', 'notes'].map((col) => (
                  <span
                    key={col}
                    className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-700/50 border border-slate-600/30 text-xs text-slate-400 font-mono"
                  >
                    {col}
                  </span>
                ))}
              </div>
            </div>

            {/* Accepted Activity Types */}
            <div>
              <h4 className="text-xs font-semibold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Info className="size-3.5" />
                Accepted Activity Types
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {[
                  { type: 'electricity_grid_kwh', scope: 'Scope 2' },
                  { type: 'diesel_liter', scope: 'Scope 1' },
                  { type: 'petrol_liter', scope: 'Scope 1' },
                  { type: 'cng_kg', scope: 'Scope 1' },
                  { type: 'flight_km_economy', scope: 'Scope 3' },
                  { type: 'rail_km', scope: 'Scope 3' },
                  { type: 'bus_km', scope: 'Scope 3' },
                  { type: 'landfill_waste_kg', scope: 'Scope 3' },
                  { type: 'recycled_waste_kg', scope: 'Scope 3' },
                  { type: 'paper_kg', scope: 'Scope 3' },
                  { type: 'hotel_night', scope: 'Scope 3' },
                  { type: 'purchased_goods_inr', scope: 'Scope 3' },
                ].map((a) => (
                  <div
                    key={a.type}
                    className="flex items-center justify-between px-2 py-1.5 rounded bg-slate-800/70 border border-slate-700/40"
                  >
                    <code className="text-[11px] text-slate-300 truncate">{a.type}</code>
                    <span className="text-[10px] text-slate-500 ml-1 shrink-0">{a.scope}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample row hint */}
            <div className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3 space-y-1.5 font-mono text-[11px]">
              <p className="text-slate-400 font-semibold mb-1 font-sans text-xs">Example Rows by Emitter Type:</p>
              <p className="text-slate-300 truncate">
                <span className="text-emerald-400 font-semibold">[Facility]</span> REC-001, ORG-01, facility, FAC-MUM-HQ, Mumbai Main Campus, Operations, 2026-04-03, electricity_grid_kwh, 1120, kWh
              </p>
              <p className="text-slate-300 truncate">
                <span className="text-amber-400 font-semibold">[Machinery]</span> REC-002, ORG-01, machinery, DG-SET-01, Cummins 500kVA Generator, Facilities, 2026-04-08, diesel_liter, 250, liter
              </p>
              <p className="text-slate-300 truncate">
                <span className="text-sky-400 font-semibold">[Employee]</span> REC-003, ORG-01, employee, EMP-104, Sarah Chen, Sales, 2026-04-12, flight_km_economy, 1350, km
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Upload Options Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CSV Upload */}
        <DashboardCard
          title="CSV Import"
          subtitle="Upload emissions data in bulk (CSV/TSV/JSON/XLSX/XLS)"
          icon={<Database className="size-5" />}
        >
          <FileUpload
            onFilesAccepted={(files) => handleFilesAccepted(files, 'csv')}
            onFilesRejected={handleFilesRejected}
            acceptedFileTypes={{
              'text/csv': ['.csv'],
              'text/tab-separated-values': ['.tsv'],
              'application/json': ['.json'],
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
              'application/vnd.ms-excel': ['.xls'],
            }}
            maxFiles={15}
            maxSize={10 * 1024 * 1024} // 10MB
            multiple={true}
          />
          {uploadingType === 'csv' && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-400">Processing...</span>
                <span className="text-primary font-semibold">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-navy-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          <div className="mt-4 text-xs text-slate-500">
            <p>• Supported formats: CSV, TSV, JSON, XLSX, XLS</p>
            <p>• Max file size: 10MB</p>
            <p>• Up to 15 files at once</p>
          </div>
        </DashboardCard>

        {/* Bank Statement Upload */}
        <DashboardCard
          title="Bank Statements"
          subtitle="Automatic transaction parsing"
          icon={<FileText className="size-5" />}
        >
          <FileUpload
            onFilesAccepted={(files) => handleFilesAccepted(files, 'bank')}
            onFilesRejected={handleFilesRejected}
            acceptedFileTypes={{
              'application/pdf': ['.pdf'],
              'text/csv': ['.csv'],
            }}
            maxFiles={3}
            maxSize={20 * 1024 * 1024} // 20MB
            multiple={true}
          />
          {uploadingType === 'bank' && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-400">Parsing statements...</span>
                <span className="text-primary font-semibold">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-navy-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          <div className="mt-4 text-xs text-slate-500">
            <p>• Supported: PDF, CSV</p>
            <p>• Max file size: 20MB</p>
            <p>• Up to 3 files at once</p>
          </div>
        </DashboardCard>
      </div>

      {/* Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard title="Upload Guidelines" icon={<CheckCircle className="size-5 text-emerald-400" />}>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>CSV/TSV/JSON/XLSX/XLS must follow the same emissions schema and activity_type rules</span>
            </li>

            <li className="flex items-start gap-2">
              <CheckCircle className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>Bank statements are parsed to identify emissions-related transactions</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>All data is processed securely and stored encrypted</span>
            </li>
          </ul>
        </DashboardCard>

        <DashboardCard title="Common Issues" icon={<AlertCircle className="size-5 text-amber-400" />}>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <AlertCircle className="size-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <span>Ensure CSV files have headers in the first row</span>
            </li>

            <li className="flex items-start gap-2">
              <AlertCircle className="size-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <span>Password-protected PDFs cannot be processed</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="size-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <span>File names should not contain special characters</span>
            </li>
          </ul>
        </DashboardCard>
      </div>
    </div>
  );
}
