'use client';

/**
 * ReportDetailView — read-only view of a submitted plantation report.
 * Shown inline in the manager dashboard when a report row is clicked.
 * Shows: overview stats, species table, flags (manager-visible), photos, imagery snapshot.
 */

import { useEffect, useState } from 'react';
import {
  TreePine, MapPin, Calendar, Leaf, Camera, ShieldCheck,
  AlertTriangle, Info, CheckCircle2, Clock, X, TrendingUp,
  Image as ImageIcon, BarChart3,
} from 'lucide-react';
import Badge from '@/components/Badge';
import ProgressBar from '@/components/ProgressBar';
import {
  getReportPhotos,
  getReportFlags,
  getImagerySnapshot,
  getPhotoSignedUrl,
  getImagerySignedUrl,
  FLAG_LABELS,
  type PlantationReport,
  type PlantationSite,
  type PlantationReportPhoto,
  type PlantationFlag,
  type PlantationImagerySnapshot,
} from '@/lib/plantation-api';

interface ReportDetailViewProps {
  report: PlantationReport;
  site: PlantationSite;
  onClose?: () => void;
}

function statusBadge(s: PlantationReport['review_status']) {
  if (s === 'reviewed') return <Badge variant="success">Reviewed</Badge>;
  if (s === 'needs_attention') return <Badge variant="danger">Needs Attention</Badge>;
  return <Badge variant="warning">Pending Review</Badge>;
}

function imagerySeverityIcon(status: PlantationImagerySnapshot['status'] | undefined) {
  if (status === 'ready') return <CheckCircle2 className="w-4 h-4 text-primary" />;
  if (status === 'failed') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  return <Clock className="w-4 h-4 text-slate-500" />;
}

function flagIcon(severity: PlantationFlag['severity']) {
  if (severity === 'alert') return <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />;
  if (severity === 'warn') return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
  return <Info className="w-3.5 h-3.5 text-primary" />;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ReportDetailView({ report, site, onClose }: ReportDetailViewProps) {
  const [photos, setPhotos] = useState<(PlantationReportPhoto & { signedUrl?: string })[]>([]);
  const [flags, setFlags] = useState<PlantationFlag[]>([]);
  const [imagery, setImagery] = useState<PlantationImagerySnapshot | null>(null);
  const [imageryUrl, setImageryUrl] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [loadingPhotos, setLoadingPhotos] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [rawPhotos, rawFlags, snap] = await Promise.all([
          getReportPhotos(report.id),
          getReportFlags(report.id),
          getImagerySnapshot(report.id),
        ]);
        if (cancelled) return;

        // Load signed URLs for photos
        const withUrls = await Promise.all(
          rawPhotos.map(async (p) => {
            const url = await getPhotoSignedUrl(p.storage_path);
            return { ...p, signedUrl: url ?? undefined };
          })
        );
        if (cancelled) return;
        setPhotos(withUrls);
        setFlags(rawFlags);
        setImagery(snap);

        if (snap?.image_path) {
          const url = await getImagerySignedUrl(snap.image_path);
          if (!cancelled) setImageryUrl(url);
        }
      } finally {
        if (!cancelled) setLoadingPhotos(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [report.id]);

  const speciesList = Array.isArray(report.species) ? report.species : [];
  const alertFlags = flags.filter((f) => f.severity === 'alert');
  const warnFlags = flags.filter((f) => f.severity === 'warn');
  const infoFlags = flags.filter((f) => f.severity === 'info');

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="text-xl font-bold text-white">
              Report: <span className="text-primary">{report.period_label}</span>
            </h3>
            {statusBadge(report.review_status)}
            {report.is_interim && <Badge variant="info">Interim</Badge>}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {site.name} · Submitted {formatDate(report.submitted_at)}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Flags (manager-visible) */}
      {flags.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
            Verification Notices ({flags.length})
          </p>
          {[...alertFlags, ...warnFlags, ...infoFlags].map((f) => {
            const label = FLAG_LABELS[f.code];
            return (
              <div key={f.id} className="flex items-start gap-2.5 text-sm">
                {flagIcon(f.severity)}
                <div>
                  <span className="text-white font-medium">{label?.title ?? f.code}</span>
                  <span className="text-slate-400"> — {label?.desc ?? JSON.stringify(f.detail)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin note */}
      {report.admin_note && (
        <div className="rounded-xl border border-slate-600/50 bg-slate-800/40 p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Admin Note</p>
          <p className="text-sm text-slate-200">{report.admin_note}</p>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            icon: TreePine, label: 'Trees This Period', color: 'text-primary', bg: 'bg-primary/10',
            value: report.trees_planted_this_period.toLocaleString('en-IN'),
          },
          {
            icon: TrendingUp, label: 'Cumulative Total', color: 'text-emerald-400', bg: 'bg-emerald-500/10',
            value: report.trees_planted_cumulative.toLocaleString('en-IN'),
          },
          {
            icon: Leaf, label: 'Survival Rate', color: 'text-amber-400', bg: 'bg-amber-500/10',
            value: report.survival_rate_pct != null ? `${report.survival_rate_pct}%` : '—',
          },
          {
            icon: MapPin, label: 'Area', color: 'text-sky-400', bg: 'bg-sky-500/10',
            value: `${report.area_hectares} ha`,
          },
        ].map(({ icon: Icon, label, color, bg, value }) => (
          <div key={label} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
            <div className={`inline-flex p-2 rounded-lg ${bg} mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Target progress */}
      {site.target_trees && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">Progress toward TEME target</span>
            <span className="text-sm font-semibold text-white">
              {Math.min(100, Math.round((report.trees_planted_cumulative / site.target_trees) * 100))}%
            </span>
          </div>
          <ProgressBar
            value={Math.min(100, Math.round((report.trees_planted_cumulative / site.target_trees) * 100))}
            color={report.trees_planted_cumulative >= site.target_trees ? 'success' : 'warning'}
            size="sm"
          />
          <p className="text-xs text-slate-500 mt-1.5">
            {report.trees_planted_cumulative.toLocaleString('en-IN')} of {site.target_trees.toLocaleString('en-IN')} target trees planted
          </p>
        </div>
      )}

      {/* Period info */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Planting Period</p>
          <p className="text-white">{formatDate(report.planting_start_date)} – {formatDate(report.planting_end_date)}</p>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Planting Method</p>
          <p className="text-white capitalize">{report.planting_method?.replace(/_/g, ' ') ?? '—'}</p>
        </div>
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Implementing Partner</p>
          <p className="text-white">{report.implementing_partner || 'Self-implemented'}</p>
        </div>
        {(report.maintenance_activities?.length ?? 0) > 0 && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 col-span-2 md:col-span-3">
            <p className="text-xs text-slate-500 mb-2">Maintenance Activities</p>
            <div className="flex flex-wrap gap-1.5">
              {report.maintenance_activities!.map((a) => (
                <span key={a} className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20">{a}</span>
              ))}
            </div>
          </div>
        )}
        {report.notes && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 col-span-2 md:col-span-3">
            <p className="text-xs text-slate-500 mb-1">Notes</p>
            <p className="text-slate-300 text-sm">{report.notes}</p>
          </div>
        )}
      </div>

      {/* Species table */}
      {speciesList.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 pt-4 pb-2">
            Species Mix
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-4 pb-2 text-xs text-slate-500 font-semibold">Species</th>
                <th className="text-right px-4 pb-2 text-xs text-slate-500 font-semibold">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {speciesList.map((s, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 text-white">{s.name}</td>
                  <td className="px-4 py-2.5 text-right text-slate-300">
                    {s.count != null ? s.count.toLocaleString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Photos */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Camera className="w-3.5 h-3.5" />
          Photo Evidence{loadingPhotos ? ' (loading…)' : ` (${photos.length})`}
        </p>
        {loadingPhotos ? (
          <div className="grid grid-cols-3 gap-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <p className="text-sm text-slate-500">No photos attached.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {photos.map((p, i) => (
                <div
                  key={p.id}
                  className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => setSelectedPhoto(i)}
                >
                  {p.signedUrl ? (
                    <img src={p.signedUrl} alt={p.caption ?? `Photo ${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-slate-800">
                      <ImageIcon className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                  {p.gps_lat && (
                    <div className="absolute top-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-primary/90 text-white flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />GPS
                    </div>
                  )}
                  {p.distance_from_site_m != null && (
                    <div className={`absolute bottom-1 right-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                      p.distance_from_site_m > 1000 ? 'bg-amber-500/90' : 'bg-slate-900/80'
                    } text-white`}>
                      {p.distance_from_site_m > 999 ? `${(p.distance_from_site_m / 1000).toFixed(1)}km` : `${p.distance_from_site_m}m`}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Lightbox */}
            {selectedPhoto !== null && photos[selectedPhoto]?.signedUrl && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
                onClick={() => setSelectedPhoto(null)}
              >
                <div className="relative max-w-3xl w-full p-4" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setSelectedPhoto(null)}
                    className="absolute top-2 right-2 z-10 p-2 bg-slate-800/80 rounded-full text-white hover:bg-slate-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <img
                    src={photos[selectedPhoto].signedUrl}
                    alt={photos[selectedPhoto].caption ?? `Photo ${selectedPhoto + 1}`}
                    className="w-full max-h-[80vh] object-contain rounded-xl"
                  />
                  {photos[selectedPhoto].caption && (
                    <p className="text-center text-sm text-slate-300 mt-2">{photos[selectedPhoto].caption}</p>
                  )}
                  {photos[selectedPhoto].gps_lat && (
                    <p className="text-center text-xs text-slate-500 mt-1">
                      GPS: {photos[selectedPhoto].gps_lat?.toFixed(5)}, {photos[selectedPhoto].gps_lng?.toFixed(5)}
                      {photos[selectedPhoto].distance_from_site_m != null &&
                        ` · ${photos[selectedPhoto].distance_from_site_m} m from site`}
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Satellite imagery */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          {imagerySeverityIcon(imagery?.status)}
          Satellite Imagery
          {imagery && <Badge variant={imagery.status === 'ready' ? 'info' : imagery.status === 'failed' ? 'warning' : 'default'}>
            {imagery.status}
          </Badge>}
        </p>

        {!imagery ? (
          <p className="text-sm text-slate-500">Imagery job not yet run.</p>
        ) : imagery.status === 'skipped' ? (
          <p className="text-sm text-slate-500">{imagery.error_message ?? 'Imagery skipped.'}</p>
        ) : imagery.status === 'failed' ? (
          <p className="text-sm text-amber-400">{imagery.error_message ?? 'Imagery fetch failed.'}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {imageryUrl && (
              <div className="rounded-xl overflow-hidden border border-slate-700/50">
                <img src={imageryUrl} alt="Sentinel-2 satellite view" className="w-full h-48 object-cover" />
                <p className="text-xs text-slate-500 text-center py-1.5">
                  Sentinel-2 L2A · {imagery.scene_date ?? 'Date unknown'}
                  {imagery.cloud_pct != null && ` · Cloud ${imagery.cloud_pct}%`}
                </p>
              </div>
            )}
            {imagery.ndvi_series && imagery.ndvi_series.length > 0 && (
              <div className="rounded-xl border border-slate-700/50 p-4">
                <p className="text-xs text-slate-400 mb-3 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  NDVI (12-month trend)
                </p>
                <div className="space-y-1.5">
                  {imagery.ndvi_series.slice(-6).map((iv, i) => {
                    const mean = iv.mean ?? 0;
                    const pct = Math.round(Math.min(100, Math.max(0, ((mean + 1) / 2) * 100)));
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 w-20 shrink-0">{iv.from?.slice(0, 7) ?? '—'}</span>
                        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-slate-300 w-10 text-right">{mean != null ? mean.toFixed(2) : '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
