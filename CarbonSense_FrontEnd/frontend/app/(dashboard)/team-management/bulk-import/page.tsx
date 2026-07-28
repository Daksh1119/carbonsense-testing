"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import DashboardCard from "@/components/DashboardCard";
import Button from "@/components/Button";
import { Breadcrumb, BackButton } from "@/components/navigation";
import FileUpload from "@/components/ui/FileUpload";
import { showSuccessToast, showErrorToast, showInfoToast } from "@/lib/toast";
import { supabase } from "@/lib/supabaseClient";
import { useUserStore } from "@/store";
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet, Loader2, X } from "lucide-react";
import type { FileRejection } from "react-dropzone";


type RbacRole = "manager" | "viewer";

interface ParsedRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  email: string;
  role: RbacRole;
  department: string;
  errors: string[];
}

const VALID_ROLES: RbacRole[] = ["manager", "viewer"];

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // First line is header — detect columns
  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const colIndex = (names: string[]) =>
    names.map((n) => headers.indexOf(n)).find((i) => i >= 0) ?? -1;

  const firstNameIdx = colIndex(["firstname", "first_name", "first name"]);
  const lastNameIdx = colIndex(["lastname", "last_name", "last name"]);
  const emailIdx = colIndex(["email"]);
  const roleIdx = colIndex(["role"]);
  const deptIdx = colIndex(["department", "dept"]);

  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const row: ParsedRow = {
      rowNumber: i + 1,
      firstName: firstNameIdx >= 0 ? cols[firstNameIdx] ?? "" : "",
      lastName: lastNameIdx >= 0 ? cols[lastNameIdx] ?? "" : "",
      email: emailIdx >= 0 ? cols[emailIdx] ?? "" : "",
      role: "viewer",
      department: deptIdx >= 0 ? cols[deptIdx] ?? "" : "",
      errors: [],
    };

    // Validate
    if (!row.firstName) row.errors.push("First name is required");
    if (!row.email) row.errors.push("Email is required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
      row.errors.push("Email is not valid");

    if (roleIdx >= 0) {
      const rawRole = (cols[roleIdx] ?? "").toLowerCase().trim() as RbacRole;
      if (VALID_ROLES.includes(rawRole)) {
        row.role = rawRole;
      } else if (rawRole) {
        row.errors.push(`Role "${cols[roleIdx]}" is invalid — must be "manager" or "viewer"`);
      }
    }

    rows.push(row);
  }

  return rows;
}

function downloadTemplate() {
  const csv = "FirstName,LastName,Email,Role,Department\nJane,Smith,jane@company.com,viewer,Sustainability\nJohn,Doe,john@company.com,manager,Operations\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "carbonsense_bulk_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkImportPage() {
  const router = useRouter();
  const { user } = useUserStore();

  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);

  const validRows = parsedRows?.filter((r) => r.errors.length === 0) ?? [];
  const invalidRows = parsedRows?.filter((r) => r.errors.length > 0) ?? [];

  const handleFilesAccepted = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsProcessing(true);
    setParsedRows(null);
    showInfoToast("Parsing CSV file…");

    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        showErrorToast("CSV is empty or contains only a header row");
        return;
      }
      setParsedRows(rows);
    } catch (err) {
      showErrorToast("Could not read CSV file");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleFilesRejected = (rejections: FileRejection[]) => {
    rejections.forEach((r) => showErrorToast(`${r.file.name}: ${r.errors[0]?.message}`));
  };


  const handleImport = async () => {
    if (validRows.length === 0) return;
    if (!user?.organizationId || !user?.organization) {
      showErrorToast("Organization context missing — contact your administrator.");
      return;
    }

    setIsSubmitting(true);
    setSubmitProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const { error } = await supabase.from("employee_signup_requests").insert({
        organization_name: user.organization,
        manager_email: user.email,
        status: "pending",
        form_data: {
          firstName: row.firstName,
          lastName: row.lastName,
          invitedEmail: row.email,
          role: row.role,
          department: row.department || null,
          organizationId: user.organizationId,
          organizationName: user.organization,
          managerEmail: user.email,
        },
      });

      if (error) {
        failCount++;
      } else {
        successCount++;
      }

      setSubmitProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setIsSubmitting(false);

    if (failCount === 0) {
      showSuccessToast(`${successCount} member request(s) created successfully`);
      setTimeout(() => router.push("/team-management"), 1500);
    } else {
      showErrorToast(`${failCount} request(s) failed. ${successCount} succeeded.`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Breadcrumb />
          <h1 className="text-3xl font-bold text-white mb-2 mt-4">Bulk Import Members</h1>
          <p className="text-slate-400">Upload a CSV to create signup requests for multiple members at once</p>
        </div>
        <BackButton href="/team-management" label="Back" variant="outline" />
      </div>

      {/* Step 1: Template */}
      <DashboardCard
        title="Step 1: Download Template"
        subtitle="Get the CSV template with required columns"
        icon={<Download className="size-5" />}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-slate-300 mb-4">
              Required columns: <code className="text-primary">FirstName</code>, <code className="text-primary">Email</code>, <code className="text-primary">Role</code> (manager or viewer). Optional: LastName, Department.
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

      {/* Step 2: Upload */}
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
          maxSize={5 * 1024 * 1024}
          multiple={false}
          isUploading={isProcessing}
          uploadProgress={0}
        />
        {isProcessing && (
          <div className="mt-4 flex items-center gap-3 text-slate-400 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Parsing CSV…
          </div>
        )}
      </DashboardCard>

      {/* Step 3: Preview & Confirm */}
      {parsedRows !== null && !isProcessing && (
        <DashboardCard
          title="Step 3: Review & Import"
          subtitle={`${validRows.length} valid · ${invalidRows.length} with errors`}
          icon={<CheckCircle className="size-5 text-emerald-400" />}
        >
          {/* Error rows */}
          {invalidRows.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                <AlertCircle className="size-4" />
                {invalidRows.length} row(s) have errors — they will be skipped
              </h4>
              <div className="space-y-2">
                {invalidRows.map((row) => (
                  <div
                    key={row.rowNumber}
                    className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-lg"
                  >
                    <X className="size-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs">
                      <span className="text-slate-300 font-medium">
                        Row {row.rowNumber}: {row.email || "(no email)"}
                      </span>
                      <ul className="mt-1 space-y-0.5">
                        {row.errors.map((err, i) => (
                          <li key={i} className="text-red-400">• {err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valid rows preview */}
          {validRows.length > 0 && (
            <>
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                  <CheckCircle className="size-4" />
                  {validRows.length} row(s) ready to import
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {validRows.map((row) => (
                    <div
                      key={row.rowNumber}
                      className="flex items-center justify-between p-3 bg-navy-muted/50 border border-navy-border rounded-lg text-xs"
                    >
                      <div>
                        <span className="text-white font-medium">
                          {[row.firstName, row.lastName].filter(Boolean).join(" ")}
                        </span>
                        <span className="text-slate-400 ml-2">{row.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {row.department && (
                          <span className="text-slate-500">{row.department}</span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full font-medium ${
                            row.role === "manager"
                              ? "bg-teal-500/10 text-teal-400"
                              : "bg-sky-500/10 text-sky-400"
                          }`}
                        >
                          {row.role}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Import progress */}
              {isSubmitting && (
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-400">Creating requests…</span>
                    <span className="text-primary font-semibold">{submitProgress}%</span>
                  </div>
                  <div className="h-2 bg-navy-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${submitProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-navy-border">
                <Button
                  variant="primary"
                  icon={
                    isSubmitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Upload className="size-4" />
                    )
                  }
                  onClick={handleImport}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Importing…" : `Import ${validRows.length} Member(s)`}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setParsedRows(null)}
                  disabled={isSubmitting}
                >
                  Choose Different File
                </Button>
              </div>
            </>
          )}

          {validRows.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              No valid rows found. Fix the errors above and re-upload.
            </div>
          )}
        </DashboardCard>
      )}
    </div>
  );
}
