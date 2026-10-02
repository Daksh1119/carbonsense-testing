'use client';

/**
 * PlantationDashboard — Manager's plantation tracker tab.
 * Shows:
 *  - KPI strip (sites, trees, reports pending review)
 *  - Site list with per-site report history (expandable)
 *  - "Register Site" modal
 *  - "Submit Report" modal (per site)
 *  - Report detail inline drawer
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TreePine, Plus, MapPin, CheckCircle2, Clock, AlertTriangle,
  RefreshCw, ChevronDown, ChevronUp, Leaf, Camera, FileText,
} from 'lucide-react';
import DashboardCard from '@/components/DashboardCard';
import StatsCard from '@/components/StatsCard';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import { BackButton, Breadcrumb } from '@/components/navigation';
import { showErrorToast } from '@/lib/toast';
import {
  listSites,
  listReports,
  fyQuarter,
  type PlantationSite,
  type PlantationReport,
} from '@/lib/plantation-api';
import NewSiteModal from './NewSiteModal';
import ReportSubmitForm from './ReportSubmitForm';
import ReportDetailView from './ReportDetailView';

// Lazy load to avoid SSR issue
import dynamic from 'next/dynamic';
const PlantationMap = dynamic(() => import('./PlantationMap'), { ssr: false });

function reviewBadge(s: PlantationReport['review_status']) {
  if (s === 'reviewed') return <Badge variant="success" size="sm">Reviewed</Badge>;
  if (s === 'needs_attention') return <Badge variant="danger" size="sm">Attention</Badge>;
  return <Badge variant="warning" size="sm">Pending</Badge>;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function PlantationDashboard() {
  const [sites, setSites] = useState<PlantationSite[]>([]);
  const [allReports, setAllReports] = useState<PlantationReport[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);
  const [showNewSite, setShowNewSite] = useState(false);
  const [submitSite, setSubmitSite] = useState<PlantationSite | null>(null);
  const [detailReport, setDetailReport] = useState<{ report: PlantationReport; site: PlantationSite } | null>(null);

  const { label: currentPeriod, end: periodEnd } = fyQuarter();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([listSites(), listReports()]);
      setSites(s);
      setAllReports(r);
    } catch (err: any) {
      showErrorToast(err?.message ?? 'Failed to load plantation data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // KPIs
  const totalTrees = useMemo(
    () => allReports.reduce((max, r) => {
      // Latest cumulative per site
      return max + r.trees_planted_cumulative;
    }, 0) / Math.max(1, allReports.length > 0 ? 1 : 1),
    [allReports],
  );
  const maxCumulativePerSite: Record<string, number> = {};
  for (const r of allReports) {
    maxCumulativePerSite[r.site_id] = Math.max(
      maxCumulativePerSite[r.site_id] ?? 0,
      r.trees_planted_cumulative,
    );
  }
  const totalTreesCumulative = Object.values(maxCumulativePerSite).reduce((a, b) => a + b, 0);
  const pendingCount = allReports.filter((r) => r.review_status === 'pending').length;
  const attentionCount = allReports.filter((r) => r.review_status === 'needs_attention').length;

  const reportsForSite = (siteId: string) => allReports.filter((r) => r.site_id === siteId);

  const expandedSite = sites.find((s) => s.id === expandedSiteId) ?? null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'TEME', href: '/tree-engine' },
        { label: 'Plantation Tracker', href: '/tree-engine/plantation' },
      ]} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <TreePine className="w-7 h-7 text-primary" />
            Plantation Tracker
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Current period: <span className="text-white font-medium">{currentPeriod}</span>
            {' · '}Due:{' '}
            <span className="text-amber-400">
              {new Date(periodEnd.getTime() + 15 * 86400_000).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric',
              })}
            </span>
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={load}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Button onClick={() => setShowNewSite(true)}>
            <Plus className="w-4 h-4" /> Register Site
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          title="Plantation Sites"
          value={loading ? '—' : sites.length}
          icon={<MapPin className="w-6 h-6" />}
        />
        <StatsCard
          title="Trees Planted (Cumulative)"
          value={loading ? '—' : totalTreesCumulative.toLocaleString('en-IN')}
          icon={<TreePine className="w-6 h-6" />}
        />
        <StatsCard
          title="Reports Submitted"
          value={loading ? '—' : allReports.length}
          icon={<FileText className="w-6 h-6" />}
        />
        <StatsCard
          title="Pending / Needs Attention"
          value={loading ? '—' : `${pendingCount} / ${attentionCount}`}
          icon={<Clock className="w-6 h-6" />}
        />
      </div>

      {/* Site list */}
      <DashboardCard
        title="Plantation Sites"
        subtitle={loading ? 'Loading…' : `${sites.length} site${sites.length !== 1 ? 's' : ''}`}
        icon={<MapPin className="w-5 h-5" />}
      >
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : sites.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <TreePine className="w-12 h-12 text-slate-700 mx-auto" />
            <p className="text-slate-400">No plantation sites registered yet.</p>
            <Button onClick={() => setShowNewSite(true)}>
              <Plus className="w-4 h-4" /> Register your first site
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sites.map((site) => {
              const siteReports = reportsForSite(site.id);
              const isExpanded = expandedSiteId === site.id;
              const latestReport = siteReports[0];

              return (
                <div key={site.id} className="border border-slate-700/50 rounded-xl overflow-hidden">
                  {/* Site header row */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-700/20 transition-colors"
                    onClick={() => setExpandedSiteId(isExpanded ? null : site.id)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                      <TreePine className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{site.name}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                        </span>
                        <span>{site.area_hectares} ha</span>
                        {site.target_trees && (
                          <span className="text-primary">Target: {site.target_trees.toLocaleString('en-IN')} trees</span>
                        )}
                        {site.region_label && <span>{site.region_label}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-slate-500">Reports</p>
                        <p className="text-sm font-bold text-white">{siteReports.length}</p>
                      </div>
                      {latestReport && reviewBadge(latestReport.review_status)}
                      <Button
                        onClick={(e) => { e.stopPropagation(); setSubmitSite(site); }}
                        variant="outline"
                      >
                        <Plus className="w-3.5 h-3.5" /> Report
                      </Button>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-slate-400" />
                        : <ChevronDown className="w-4 h-4 text-slate-400" />
                      }
                    </div>
                  </div>

                  {/* Expanded: mini map + reports table */}
                  {isExpanded && (
                    <div className="border-t border-slate-700/40 bg-slate-800/30">
                      {/* Mini map */}
                      <div className="h-48 w-full">
                        <PlantationMap
                          latitude={site.latitude}
                          longitude={site.longitude}
                          readOnly
                          heightClass="h-48"
                        />
                      </div>

                      {/* Reports table */}
                      <div className="p-4">
                        {siteReports.length === 0 ? (
                          <p className="text-sm text-slate-500 text-center py-4">
                            No reports yet for this site.{' '}
                            <button
                              onClick={() => setSubmitSite(site)}
                              className="text-primary hover:underline"
                            >
                              Submit the first one
                            </button>
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-700/50">
                                  {['Period', 'Submitted', 'Trees (Period)', 'Cumulative', 'Status', ''].map((h) => (
                                    <th key={h} className="pb-2.5 pr-4 text-left text-xs text-slate-500 font-semibold whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-700/30">
                                {siteReports.map((r) => (
                                  <tr key={r.id} className="hover:bg-slate-700/20 transition-colors">
                                    <td className="py-2.5 pr-4">
                                      <div className="flex items-center gap-2">
                                        <span className="text-white font-medium">{r.period_label}</span>
                                        {r.is_interim && <Badge variant="info" size="sm">Interim</Badge>}
                                      </div>
                                    </td>
                                    <td className="py-2.5 pr-4 text-slate-400 whitespace-nowrap">{formatDate(r.submitted_at)}</td>
                                    <td className="py-2.5 pr-4 text-slate-300">{r.trees_planted_this_period.toLocaleString('en-IN')}</td>
                                    <td className="py-2.5 pr-4 text-slate-300">{r.trees_planted_cumulative.toLocaleString('en-IN')}</td>
                                    <td className="py-2.5 pr-4">{reviewBadge(r.review_status)}</td>
                                    <td className="py-2.5">
                                      <button
                                        onClick={() => setDetailReport({ report: r, site })}
                                        className="text-xs text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
                                      >
                                        View →
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DashboardCard>

      {/* Modals */}
      {showNewSite && (
        <NewSiteModal
          onClose={() => setShowNewSite(false)}
          onSuccess={(site) => {
            setSites((prev) => [site, ...prev]);
            setShowNewSite(false);
          }}
        />
      )}

      {submitSite && (
        <ReportSubmitForm
          siteId={submitSite.id}
          siteName={submitSite.name}
          onSuccess={() => {
            setSubmitSite(null);
            load();
          }}
          onCancel={() => setSubmitSite(null)}
        />
      )}

      {/* Report detail panel */}
      {detailReport && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setDetailReport(null)}
          />
          {/* Side drawer */}
          <div className="relative w-full max-w-2xl h-screen bg-navy-muted border-l border-primary/10 overflow-y-auto shadow-2xl">
            <div className="p-6">
              <ReportDetailView
                report={detailReport.report}
                site={detailReport.site}
                onClose={() => setDetailReport(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
