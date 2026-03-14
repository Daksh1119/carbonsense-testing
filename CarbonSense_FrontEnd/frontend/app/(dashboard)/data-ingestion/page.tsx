'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardCard from '@/components/DashboardCard';
import FileUpload from '@/components/ui/FileUpload';
import { Breadcrumb, BackButton } from '@/components/navigation';
import { showSuccessToast, showErrorToast, showInfoToast } from '@/lib/toast';
import {
  Upload,
  FileText,
  Receipt,
  Database,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export default function DataIngestionPage() {
  const router = useRouter();
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFilesAccepted = async (files: File[], type: string) => {
    setUploadingType(type);
    showInfoToast(`Uploading ${files.length} file(s)...`);

    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      setUploadProgress(i);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    showSuccessToast(`Successfully uploaded ${files.length} file(s)`);
    setUploadingType(null);
    setUploadProgress(0);

    // Navigate to detailed log to see results
    setTimeout(() => {
      router.push('/detailed-log');
    }, 1500);
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
            Upload receipts, CSV files, and bank statements for automatic carbon tracking
          </p>
        </div>
        <BackButton href="/dashboard" label="Back to Dashboard" variant="outline" />
      </div>

      {/* Upload Options Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CSV Upload */}
        <DashboardCard
          title="CSV Import"
          subtitle="Upload emissions data in bulk"
          icon={<Database className="size-5" />}
        >
          <FileUpload
            onFilesAccepted={(files) => handleFilesAccepted(files, 'csv')}
            onFilesRejected={handleFilesRejected}
            acceptedFileTypes={{ 'text/csv': ['.csv'] }}
            maxFiles={5}
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
            <p>• Supported format: CSV</p>
            <p>• Max file size: 10MB</p>
            <p>• Up to 5 files at once</p>
          </div>
        </DashboardCard>

        {/* Receipt Upload */}
        <DashboardCard
          title="Receipt Scanner"
          subtitle="OCR-powered receipt analysis"
          icon={<Receipt className="size-5" />}
        >
          <FileUpload
            onFilesAccepted={(files) => handleFilesAccepted(files, 'receipt')}
            onFilesRejected={handleFilesRejected}
            acceptedFileTypes={{
              'image/png': ['.png'],
              'image/jpeg': ['.jpg', '.jpeg'],
              'application/pdf': ['.pdf'],
            }}
            maxFiles={10}
            maxSize={5 * 1024 * 1024} // 5MB
            multiple={true}
          />
          {uploadingType === 'receipt' && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-slate-400">Scanning receipts...</span>
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
            <p>• Supported: PNG, JPG, PDF</p>
            <p>• Max file size: 5MB each</p>
            <p>• Up to 10 files at once</p>
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
              <span>CSV files should include: date, category, activity, amount, unit</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <span>Receipts will be automatically scanned for carbon-relevant purchases</span>
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
              <span>Receipt images should be clear and well-lit for best OCR results</span>
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
