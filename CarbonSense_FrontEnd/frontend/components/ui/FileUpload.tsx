'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle, FileText, Image, FileSpreadsheet } from 'lucide-react';
import { clsx } from 'clsx';

export interface FileUploadProps {
  onFilesAccepted: (files: File[]) => void | Promise<void>;
  onFilesRejected?: (fileRejections: FileRejection[]) => void;
  maxFiles?: number;
  maxSize?: number; // in bytes
  acceptedFileTypes?: { [key: string]: string[] };
  multiple?: boolean;
  disabled?: boolean;
  showPreview?: boolean;
  uploadProgress?: number; // 0-100
  isUploading?: boolean;
}

interface FileWithPreview extends File {
  preview?: string;
}

/**
 * FileUpload Component
 * Drag-and-drop file upload with validation, preview, and progress
 */
const FileUpload: React.FC<FileUploadProps> = ({
  onFilesAccepted,
  onFilesRejected,
  maxFiles = 5,
  maxSize = 10 * 1024 * 1024, // 10MB default
  acceptedFileTypes = {
    'text/csv': ['.csv'],
    'application/pdf': ['.pdf'],
    'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
  },
  multiple = true,
  disabled = false,
  showPreview = true,
  uploadProgress,
  isUploading = false,
}) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const onDrop = useCallback(
    async (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      setErrors([]);

      // Handle rejected files
      if (fileRejections.length > 0) {
        const rejectionErrors = fileRejections.map((rejection) => {
          const fileName = rejection.file.name;
          const errorMessages = rejection.errors.map((e) => e.message).join(', ');
          return `${fileName}: ${errorMessages}`;
        });
        setErrors(rejectionErrors);
        onFilesRejected?.(fileRejections);
      }

      // Handle accepted files – only add to preview list if processing succeeds
      if (acceptedFiles.length > 0) {
        const filesWithPreview = acceptedFiles.map((file) =>
          Object.assign(file, {
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
          })
        );

        try {
          await onFilesAccepted(acceptedFiles);
          // Only add files to the preview list after successful processing
          setFiles((prev) => [...prev, ...filesWithPreview]);
        } catch {
          // Processing failed – revoke any preview URLs and don't add to list
          filesWithPreview.forEach((f) => {
            if (f.preview) URL.revokeObjectURL(f.preview);
          });
        }
      }
    },
    [onFilesAccepted, onFilesRejected]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    maxFiles,
    maxSize,
    accept: acceptedFileTypes,
    multiple,
    disabled: disabled || isUploading,
  });

  const removeFile = (fileToRemove: FileWithPreview) => {
    setFiles((prev) => prev.filter((file) => file !== fileToRemove));
    if (fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
  };

  const clearFiles = () => {
    files.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });
    setFiles([]);
    setErrors([]);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type === 'text/csv' || file.type.includes('spreadsheet')) return FileSpreadsheet;
    if (file.type === 'application/pdf') return FileText;
    return File;
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={clsx(
          'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
          isDragActive && !isDragReject && 'border-emerald-500 bg-emerald-500/10',
          isDragReject && 'border-red-500 bg-red-500/10',
          !isDragActive && !disabled && 'border-slate-600 hover:border-slate-500 bg-slate-800/50',
          disabled && 'border-slate-700 bg-slate-800/30 cursor-not-allowed opacity-50'
        )}
      >
        <input {...getInputProps()} />

        {/* Upload Icon */}
        <div className="flex justify-center mb-4">
          <div
            className={clsx(
              'w-16 h-16 rounded-full flex items-center justify-center',
              isDragActive && !isDragReject && 'bg-emerald-500/20',
              isDragReject && 'bg-red-500/20',
              !isDragActive && 'bg-slate-700'
            )}
          >
            <Upload
              className={clsx(
                'w-8 h-8',
                isDragActive && !isDragReject && 'text-emerald-500',
                isDragReject && 'text-red-500',
                !isDragActive && 'text-slate-400'
              )}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-2">
          {isDragActive && !isDragReject ? (
            <p className="text-lg font-semibold text-emerald-500">Drop files here...</p>
          ) : isDragReject ? (
            <p className="text-lg font-semibold text-red-500">Some files will be rejected</p>
          ) : (
            <>
              <p className="text-lg font-semibold text-slate-200">
                Drag & drop files here, or click to select
              </p>
              <p className="text-sm text-slate-400">
                {multiple ? `Upload up to ${maxFiles} files` : 'Upload a single file'} (max {formatFileSize(maxSize)} each)
              </p>
            </>
          )}
        </div>

        {/* Supported Formats */}
        <div className="mt-4">
          <p className="text-xs text-slate-500">
            Supported formats: {Object.values(acceptedFileTypes).flat().join(', ')}
          </p>
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && uploadProgress !== undefined && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-300">Uploading...</span>
            <span className="text-sm font-semibold text-emerald-500">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-400 mb-1">Upload Errors</h4>
              <ul className="text-sm text-red-300 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* File Preview List */}
      {showPreview && files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-300">
              Selected Files ({files.length})
            </h4>
            {!isUploading && (
              <button
                onClick={clearFiles}
                className="text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="space-y-2">
            {files.map((file, index) => {
              const FileIcon = getFileIcon(file);
              return (
                <div
                  key={`${file.name}-${index}`}
                  className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center gap-3"
                >
                  {/* Preview or Icon */}
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-12 h-12 object-cover rounded"
                      onLoad={() => {
                        if (file.preview) URL.revokeObjectURL(file.preview);
                      }}
                    />
                  ) : (
                    <div className="w-12 h-12 bg-slate-700 rounded flex items-center justify-center">
                      <FileIcon className="w-6 h-6 text-slate-400" />
                    </div>
                  )}

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                  </div>

                  {/* Status/Remove */}
                  {isUploading ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <button
                      onClick={() => removeFile(file)}
                      className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                      aria-label="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
