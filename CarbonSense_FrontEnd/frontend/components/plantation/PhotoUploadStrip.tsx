'use client';

/**
 * PhotoUploadStrip — drag-and-drop photo upload with EXIF GPS extraction.
 * Renders a strip of up to MAX_PHOTOS thumbnail slots.
 * Calls onChange with the selected File array and extracted PhotoMeta array.
 */

import { useCallback, useRef, useState } from 'react';
import { Camera, X, MapPin, AlertCircle, CheckCircle2 } from 'lucide-react';
import { type PhotoMeta } from '@/lib/plantation-api';

const MAX_PHOTOS = 6;
const MIN_PHOTOS = 1;
const PHOTO_MAX_BYTES = 3 * 1024 * 1024; // 3 MB — mirrors server

interface PhotoEntry {
  file: File;
  previewUrl: string;
  meta: PhotoMeta;
  error?: string;
}

interface PhotoUploadStripProps {
  onChange: (files: File[], metas: PhotoMeta[]) => void;
  existingCount?: number;
  disabled?: boolean;
}

async function extractExifMeta(file: File): Promise<PhotoMeta> {
  try {
    // Dynamically import exifr to keep bundle lean
    const exifr = (await import('exifr')).default;
    const parsed = await exifr.parse(file, { gps: true, pick: ['GPSLatitude', 'GPSLongitude', 'DateTimeOriginal'] });
    if (!parsed) return { gps_source: 'none' };

    const lat = parsed.latitude ?? parsed.GPSLatitude ?? null;
    const lng = parsed.longitude ?? parsed.GPSLongitude ?? null;
    const dt = parsed.DateTimeOriginal ?? null;

    return {
      gps_lat: typeof lat === 'number' ? Number(lat.toFixed(6)) : null,
      gps_lng: typeof lng === 'number' ? Number(lng.toFixed(6)) : null,
      gps_source: lat != null ? 'exif' : 'none',
      taken_at: dt ? new Date(dt).toISOString() : null,
    };
  } catch {
    return { gps_source: 'none' };
  }
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export default function PhotoUploadStrip({ onChange, disabled = false }: PhotoUploadStripProps) {
  const [entries, setEntries] = useState<PhotoEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pushFiles = useCallback(async (rawFiles: File[]) => {
    const next: PhotoEntry[] = [...entries];
    for (const file of rawFiles) {
      if (next.length >= MAX_PHOTOS) break;
      // Basic validation
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        next.push({ file, previewUrl: '', meta: { gps_source: 'none' }, error: 'Unsupported file type (JPG, PNG, WebP only)' });
        continue;
      }
      if (file.size > PHOTO_MAX_BYTES) {
        next.push({ file, previewUrl: '', meta: { gps_source: 'none' }, error: `File too large (max 3 MB, got ${humanSize(file.size)})` });
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      const meta = await extractExifMeta(file);
      next.push({ file, previewUrl, meta });
    }
    setEntries(next);
    const valid = next.filter((e) => !e.error);
    onChange(valid.map((e) => e.file), valid.map((e) => e.meta));
  }, [entries, onChange]);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await pushFiles(files);
  }, [pushFiles]);

  const handleInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    await pushFiles(files);
    if (inputRef.current) inputRef.current.value = '';
  }, [pushFiles]);

  const remove = (idx: number) => {
    const next = entries.filter((_, i) => i !== idx);
    // Revoke preview URLs
    URL.revokeObjectURL(entries[idx].previewUrl);
    setEntries(next);
    const valid = next.filter((e) => !e.error);
    onChange(valid.map((e) => e.file), valid.map((e) => e.meta));
  };

  const canAddMore = entries.length < MAX_PHOTOS && !disabled;

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {canAddMore && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          aria-label="Upload plantation photos"
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 px-4 cursor-pointer transition-colors ${
            dragging
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-slate-600 hover:border-primary/60 hover:bg-primary/5 text-slate-400 hover:text-slate-300'
          }`}
        >
          <Camera className="w-7 h-7" />
          <p className="text-sm font-medium">
            {entries.length === 0
              ? 'Drag photos here or click to browse'
              : `Add more photos (${entries.length}/${MAX_PHOTOS})`}
          </p>
          <p className="text-xs text-slate-500">JPG · PNG · WebP · max 3 MB each</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleInput}
          />
        </div>
      )}

      {/* Photo thumbnails */}
      {entries.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {entries.map((entry, i) => (
            <div
              key={i}
              className={`relative rounded-lg overflow-hidden border ${
                entry.error ? 'border-rose-500/50' : 'border-slate-700'
              } aspect-square bg-slate-800`}
            >
              {entry.previewUrl ? (
                <img src={entry.previewUrl} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center w-full h-full">
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                </div>
              )}

              {/* GPS badge */}
              {!entry.error && (
                <div className={`absolute top-1 left-1 rounded-full px-1.5 py-0.5 flex items-center gap-1 text-[9px] font-medium ${
                  entry.meta.gps_lat ? 'bg-primary/90 text-white' : 'bg-slate-800/80 text-slate-400'
                }`}>
                  <MapPin className="w-2.5 h-2.5" />
                  {entry.meta.gps_lat ? 'GPS' : 'No GPS'}
                </div>
              )}

              {/* Remove button */}
              <button
                onClick={() => remove(i)}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/80 hover:bg-rose-500 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3" />
              </button>

              {/* Error overlay */}
              {entry.error && (
                <div className="absolute inset-0 bg-rose-900/70 flex items-end p-1">
                  <p className="text-[9px] text-rose-200 leading-tight">{entry.error}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Validation summary */}
      <div className="flex items-center gap-2 text-xs">
        {entries.filter((e) => !e.error).length >= MIN_PHOTOS ? (
          <span className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {entries.filter((e) => !e.error).length} photo(s) ready
          </span>
        ) : (
          <span className="text-slate-500">Minimum {MIN_PHOTOS} photo required</span>
        )}
        {entries.some((e) => e.error) && (
          <span className="text-rose-400 ml-auto">
            {entries.filter((e) => e.error).length} rejected
          </span>
        )}
      </div>
    </div>
  );
}
