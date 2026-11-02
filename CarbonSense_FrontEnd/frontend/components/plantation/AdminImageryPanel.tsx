'use client';

/**
 * AdminImageryPanel — satellite snapshot + NDVI trend for the admin review modal.
 *
 * Mirrors the imagery section of ReportDetailView (manager view).
 * Accepts only `reportId` and `imageryStatus` so the modal needs no extra
 * Supabase fetching.  Uses the same plantation-api helpers already imported
 * by ReportDetailView.
 *
 * CONSTRAINTS (do NOT relax):
 *  - Does not import or render PlantationMap / ReportDetailView.
 *  - Does not add any new npm dependencies.
 *  - Stays TypeScript-strict.
 *  - Adds no new Supabase table reads beyond getImagerySnapshot / getImagerySignedUrl.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, Clock, BarChart3, Image as ImageIcon } from 'lucide-react';
import Badge from '@/components/Badge';
import {
  getImagerySnapshot,
  getImagerySignedUrl,
  type PlantationImagerySnapshot,
} from '@/lib/plantation-api';

interface AdminImageryPanelProps {
  /** ID of the plantation report currently being reviewed. */
  reportId: string;
  /**
   * Coarse status from the admin row (used while the full snapshot is loading
   * so we can show the right badge immediately without waiting for the fetch).
   */
  imageryStatus: 'pending' | 'ready' | 'failed' | 'skipped';
}

function statusIcon(status: PlantationImagerySnapshot['status'] | undefined) {
  if (status === 'ready') return <CheckCircle2 className="w-4 h-4 text-primary" />;
  if (status === 'failed') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  return <Clock className="w-4 h-4 text-slate-500" />;
}

export default function AdminImageryPanel({ reportId, imageryStatus }: AdminImageryPanelProps) {
  const [loading, setLoading] = useState(true);
  const [snap, setSnap] = useState<PlantationImagerySnapshot | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSnap(null);
    setImgUrl(null);
    setError(null);

    async function load() {
      try {
        const snapshot = await getImagerySnapshot(reportId);
        if (cancelled) return;
        setSnap(snapshot);

        if (snapshot?.image_path) {
          const url = await getImagerySignedUrl(snapshot.image_path);
          if (!cancelled) setImgUrl(url);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load imagery.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [reportId]);

  return (
    <div>
      {/* Section header */}
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
        {snap ? statusIcon(snap.status) : <Clock className="w-4 h-4 text-slate-500" />}
        Satellite Imagery
        {snap ? (
          <Badge variant={snap.status === 'ready' ? 'info' : snap.status === 'failed' ? 'warning' : 'default'}>
            {snap.status}
          </Badge>
        ) : (
          <Badge variant={imageryStatus === 'ready' ? 'info' : imageryStatus === 'failed' ? 'warning' : 'default'}>
            {imageryStatus}
          </Badge>
        )}
      </p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl h-48 bg-slate-800 animate-pulse" />
          <div className="rounded-xl border border-slate-700/50 p-4 space-y-2.5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-20 h-2 bg-slate-800 rounded-full animate-pulse shrink-0" />
                <div className="flex-1 h-2 bg-slate-800 rounded-full animate-pulse" />
                <div className="w-10 h-2 bg-slate-800 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <p className="text-sm text-amber-400">{error}</p>
      ) : !snap ? (
        <p className="text-sm text-slate-500">Imagery job not yet run.</p>
      ) : snap.status === 'skipped' ? (
        <p className="text-sm text-slate-500">{snap.error_message ?? 'Imagery skipped.'}</p>
      ) : snap.status === 'failed' ? (
        <p className="text-sm text-amber-400">{snap.error_message ?? 'Imagery fetch failed.'}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {imgUrl ? (
            <div className="rounded-xl overflow-hidden border border-slate-700/50">
              <img src={imgUrl} alt="Sentinel-2 satellite view" className="w-full h-48 object-cover" />
              <p className="text-xs text-slate-500 text-center py-1.5">
                Sentinel-2 L2A · {snap.scene_date ?? 'Date unknown'}
                {snap.cloud_pct != null &&  · Cloud %}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-700/50 h-48 flex flex-col items-center justify-center gap-2">
              <ImageIcon className="w-6 h-6 text-slate-600" />
              <p className="text-xs text-slate-500">Image not available</p>
            </div>
          )}
          {snap.ndvi_series && snap.ndvi_series.length > 0 && (
            <div className="rounded-xl border border-slate-700/50 p-4">
              <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                NDVI (12-month trend)
              </p>
              <div className="space-y-1.5">
                {snap.ndvi_series.slice(-6).map((iv, i) => {
                  const mean = iv.mean ?? 0;
                  const pct = Math.round(Math.min(100, Math.max(0, ((mean + 1) / 2) * 100)));
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 w-20 shrink-0">{iv.from?.slice(0, 7) ?? 'E2014E'}</span>
                      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: ${pct}% }} />
                      </div>
                      <span className="text-slate-300 w-10 text-right">
                        {iv.mean != null ? iv.mean.toFixed(2) : 'E2014E'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
