"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import FileUpload from "@/components/ui/FileUpload";
import { showSuccessToast, showErrorToast, showInfoToast } from "@/lib/toast";
import {
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";

export default function BulkImportPage() {
  const router = useRouter();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const handleFilesAccepted = async (files: File[]) => {
    setIsUploading(true);
    showInfoToast("Processing CSV file...");

    // Simulate upload progress
    for (let i = 0; i <= 100; i += 10) {
      setUploadProgress(i);
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    showSuccessToast(`Successfully imported ${files.length} member(s)!`);
    setIsUploading(false);
    setUploadProgress(0);

    setTimeout(() => {
      router.push("/team");
    }, 1500);
  };

  const handleFilesRejected = (rejections: any[]) => {
    rejections.forEach((rejection) => {
      showErrorToast(`${rejection.file.name}: ${rejection.errors[0].message}`);
    });
  };

  const downloadTemplate = () => {
    showInfoToast("CSV template downloaded");
    // In real app, trigger actual download
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb />
          <h1 className="text-3xl font-bold text-white mb-2 mt-4">
            Bulk Import Members
          </h1>
          <p className="text-slate-400">
            Upload a CSV file to add multiple team members at once
          </p>
        </div>
        <BackButton href="/team" label="Back" variant="outline" />
      </div>

      {/* Download Template */}
      <DashboardCard
        title="Step 1: Download Template"
        subtitle="Get the CSV template with required columns"
        icon={<Download className="size-5" />}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-slate-300 mb-4">
              Download our CSV template to ensure your file has the correct format.
              Required columns: Name, Email, Role, Department
            </p>
            <Button
              variant="outline"
              icon={<FileSpreadsheet className="size-4" />}
              onClick={downloadTemplate}
            >
              Download Template
            </Button>
          </div>
        </div>
      </DashboardCard>

      {/* Upload File */}
      <DashboardCard
        title="Step 2: Upload Your CSV"
        subtitle="Select the file with your team member data"
        icon={<Upload className="size-5" />}
      >
        <FileUpload
          onFilesAccepted={handleFilesAccepted}
          onFilesRejected={handleFilesRejected}
          acceptedFileTypes={{ "text/csv": [".csv"] }}
          maxFiles={1}
          maxSize={5 * 1024 * 1024} // 5MB
          multiple={false}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
        />
        {isUploading && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-400">Processing members...</span>
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
          <p>• Maximum file size: 5MB</p>
          <p>• Format: CSV only</p>
          <p>• Up to 1000 members per file</p>
        </div>
      </DashboardCard>

      {/* CSV Format Requirements */}
      <DashboardCard
        title="CSV Format Requirements"
        subtitle="Ensure your file follows these guidelines"
        icon={<CheckCircle className="size-5 text-emerald-400" />}
      >
        <div className="space-y-4">
          <div className="bg-navy-deep border border-navy-border rounded-lg p-4 font-mono text-xs text-slate-300">
            <div className="text-primary mb-2">Name,Email,Role,Department</div>
            <div>John Doe,john@company.com,Carbon Analyst,Sustainability</div>
            <div>Jane Smith,jane@company.com,Data Entry,Operations</div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-300">
                <strong>Name:</strong> Full name of the team member (required)
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-300">
                <strong>Email:</strong> Valid email address (required, must be unique)
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-300">
                <strong>Role:</strong> One of: Admin, Manager, Analyst, Viewer
              </p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="size-4 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-300">
                <strong>Department:</strong> Team or department name (optional)
              </p>
            </div>
          </div>
        </div>
      </DashboardCard>

      {/* Common Errors */}
      <DashboardCard
        title="Common Errors to Avoid"
        subtitle="Tips for successful import"
        icon={<AlertCircle className="size-5 text-amber-400" />}
      >
        <div className="space-y-2 text-sm text-slate-300">
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <span>Ensure the first row contains headers (Name, Email, Role, Department)</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <span>Check for duplicate email addresses</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <span>Verify role names match exactly (case-sensitive)</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="size-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <span>Remove any special characters that might break CSV format</span>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}
