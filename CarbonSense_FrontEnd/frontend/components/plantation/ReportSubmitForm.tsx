'use client';

/**
 * ReportSubmitForm — multi-step plantation report submission form.
 * Step 1: Period + planting stats
 * Step 2: Species mix
 * Step 3: Photos (PhotoUploadStrip)
 * Step 4: Declaration
 */

import { FormEvent, useCallback, useState } from 'react';
import {
  TreePine, Leaf, Camera, FileCheck, ChevronRight, ChevronLeft,
  Plus, Trash2, Info, AlertCircle,
} from 'lucide-react';
import Button from '@/components/Button';
import ProgressBar from '@/components/ProgressBar';
import { showSuccessToast, showErrorToast } from '@/lib/toast';
import { submitReport, fyQuarter, reportDueDate, type SubmitReportPayload, type PhotoMeta } from '@/lib/plantation-api';
import { VALID_SPECIES } from '@/lib/teme-types';
import PhotoUploadStrip from './PhotoUploadStrip';

const PLANTING_METHODS = [
  { value: 'nursery_saplings', label: 'Nursery saplings' },
  { value: 'direct_seeding', label: 'Direct seeding' },
  { value: 'miyawaki_dense', label: 'Miyawaki dense planting' },
  { value: 'other', label: 'Other' },
];

const MAINTENANCE_OPTIONS = [
  'Watering', 'Weeding', 'Fertilizing', 'Pest control',
  'Fencing', 'Replanting (mortality)', 'Mulching',
];

interface ReportSubmitFormProps {
  siteId: string;
  siteName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function today() { return new Date().toISOString().split('T')[0]; }
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export default function ReportSubmitForm({ siteId, siteName, onSuccess, onCancel }: ReportSubmitFormProps) {
  const { label: periodLabel, end: periodEnd } = fyQuarter();
  const dueDate = reportDueDate(periodEnd);

  // Step state
  const [step, setStep] = useState(0);
  const STEPS = ['Period & Stats', 'Species Mix', 'Photo Evidence', 'Declaration'];

  // Step 1: planting stats
  const [isInterim, setIsInterim] = useState(false);
  const [plantingStart, setPlantingStart] = useState(daysAgo(30));
  const [plantingEnd, setPlantingEnd] = useState(today());
  const [treesThisPeriod, setTreesThisPeriod] = useState('');
  const [treesCumulative, setTreesCumulative] = useState('');
  const [survivalRate, setSurvivalRate] = useState('');
  const [plantingMethod, setPlantingMethod] = useState('nursery_saplings');
  const [implementingPartner, setImplementingPartner] = useState('');
  const [maintenanceActivities, setMaintenanceActivities] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  // Step 2: species
  const [speciesEntries, setSpeciesEntries] = useState<{ name: string; count: string }[]>([
    { name: VALID_SPECIES[0], count: '' },
  ]);

  const addSpeciesRow = () => {
    if (speciesEntries.length >= 10) return;
    setSpeciesEntries((prev) => [...prev, { name: VALID_SPECIES[0], count: '' }]);
  };
  const removeSpeciesRow = (i: number) => setSpeciesEntries((prev) => prev.filter((_, idx) => idx !== i));
  const updateSpecies = (i: number, key: 'name' | 'count', val: string) =>
    setSpeciesEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, [key]: val } : e)));

  // Step 3: photos
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoMetas, setPhotoMetas] = useState<PhotoMeta[]>([]);
  const handlePhotosChange = useCallback((files: File[], metas: PhotoMeta[]) => {
    setPhotos(files);
    setPhotoMetas(metas);
  }, []);

  // Step 4: declaration
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  // Submission
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const toggleMaintenance = (opt: string) => {
    setMaintenanceActivities((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  // Step-level validation
  const validateStep = () => {
    switch (step) {
      case 0: {
        const tp = parseInt(treesThisPeriod, 10);
        const tc = parseInt(treesCumulative, 10);
        if (!treesThisPeriod || isNaN(tp) || tp < 0) return 'Trees planted this period must be ≥ 0.';
        if (!treesCumulative || isNaN(tc) || tc < tp) return 'Cumulative trees must be ≥ trees this period.';
        if (plantingEnd < plantingStart) return 'Planting end date must be on or after start date.';
        if (plantingEnd > today()) return 'Planting end date cannot be in the future.';
        return null;
      }
      case 1: {
        for (const e of speciesEntries) {
          if (!e.name) return 'All species entries must have a species selected.';
        }
        return null;
      }
      case 2: {
        if (photos.length < 1) return 'At least 1 photo is required.';
        return null;
      }
      case 3: {
        if (!declarationAccepted) return 'You must accept the declaration to submit.';
        return null;
      }
      default: return null;
    }
  };

  const goNext = () => {
    const err = validateStep();
    if (err) { setFormError(err); return; }
    setFormError(null);
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setFormError(null);
    setStep((s) => s - 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateStep();
    if (err) { setFormError(err); return; }
    setFormError(null);
    setLoading(true);

    try {
      const payload: SubmitReportPayload = {
        site_id: siteId,
        is_interim: isInterim,
        planting_start_date: plantingStart,
        planting_end_date: plantingEnd,
        trees_planted_this_period: parseInt(treesThisPeriod, 10),
        trees_planted_cumulative: parseInt(treesCumulative, 10),
        species: speciesEntries
          .filter((e) => e.name)
          .map((e) => ({ name: e.name, count: e.count ? parseInt(e.count, 10) : null })),
        survival_rate_pct: survivalRate ? parseFloat(survivalRate) : null,
        planting_method: plantingMethod || null,
        implementing_partner: implementingPartner || null,
        maintenance_activities: maintenanceActivities,
        notes: notes || null,
        declaration_accepted: true,
      };

      const res = await submitReport(payload, photos, photoMetas);
      showSuccessToast(`Report submitted for ${periodLabel}. Report ID: ${res.report_id.slice(0, 8)}…`);

      // Show manager-visible flags
      const flags = (res.flags_visible_to_manager ?? []) as any[];
      if (flags.length > 0) {
        for (const f of flags) {
          showErrorToast(`⚠ ${f.code}: ${JSON.stringify(f.detail)}`);
        }
      }
      onSuccess();
    } catch (err: any) {
      showErrorToast(err?.message ?? 'Submission failed');
      setFormError(err?.message ?? 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const progress = Math.round(((step) / (STEPS.length - 1)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto pt-8">
      <div className="w-full max-w-2xl bg-navy-muted border border-primary/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-white">Submit Plantation Report</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Site: <span className="text-white font-medium">{siteName}</span>
                {' · '}Period: <span className="text-primary font-medium">{periodLabel}</span>
                {' · '}Due: <span className="text-amber-400">{dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              </p>
            </div>
          </div>
          {/* Step progress */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < step ? 'bg-primary text-white' :
                  i === step ? 'bg-primary/20 border-2 border-primary text-primary' :
                  'bg-slate-800 border border-slate-700 text-slate-500'
                }`}>{i + 1}</div>
                <span className={`text-xs hidden sm:block transition-colors ${i === step ? 'text-white font-semibold' : 'text-slate-500'}`}>{s}</span>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-slate-700 hidden sm:block" />}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* ── Step 0: Period & Stats ─────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                <input
                  id="interim"
                  type="checkbox"
                  checked={isInterim}
                  onChange={(e) => setIsInterim(e.target.checked)}
                  className="accent-primary w-4 h-4"
                />
                <label htmlFor="interim" className="text-sm text-slate-300 cursor-pointer">
                  This is an <strong>interim</strong> report (mid-quarter update, not the final period submission)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'ps', label: 'Planting Start Date', val: plantingStart, set: setPlantingStart },
                  { id: 'pe', label: 'Planting End Date', val: plantingEnd, set: setPlantingEnd },
                ].map(({ id, label, val, set }) => (
                  <div key={id}>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor={id}>{label}</label>
                    <input
                      id={id}
                      type="date"
                      value={val}
                      max={today()}
                      onChange={(e) => set(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-primary/50"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="tp">
                    Trees This Period <span className="text-rose-400">*</span>
                  </label>
                  <input id="tp" type="number" min="0" value={treesThisPeriod}
                    onChange={(e) => setTreesThisPeriod(e.target.value)}
                    placeholder="e.g. 120"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="tc">
                    Cumulative Total <span className="text-rose-400">*</span>
                  </label>
                  <input id="tc" type="number" min="0" value={treesCumulative}
                    onChange={(e) => setTreesCumulative(e.target.value)}
                    placeholder="e.g. 350"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="sr">
                    Survival Rate (%) <span className="text-slate-500 font-normal">optional</span>
                  </label>
                  <input id="sr" type="number" min="0" max="100" step="0.1" value={survivalRate}
                    onChange={(e) => setSurvivalRate(e.target.value)}
                    placeholder="e.g. 87.5"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="method">
                    Planting Method
                  </label>
                  <select id="method" value={plantingMethod} onChange={(e) => setPlantingMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-primary/50">
                    {PLANTING_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="partner">
                  Implementing Partner <span className="text-slate-500 font-normal">optional</span>
                </label>
                <input id="partner" type="text" maxLength={120} value={implementingPartner}
                  onChange={(e) => setImplementingPartner(e.target.value)}
                  placeholder="NGO, contractor, or self-implemented"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50" />
              </div>

              {/* Maintenance activities */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Maintenance Activities <span className="text-slate-500 font-normal">optional</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {MAINTENANCE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleMaintenance(opt)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        maintenanceActivities.includes(opt)
                          ? 'bg-primary/20 border-primary text-primary'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-primary/40 hover:text-slate-300'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="notes">
                  Notes <span className="text-slate-500 font-normal">optional · max 1000 chars</span>
                </label>
                <textarea id="notes" rows={3} maxLength={1000} value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observations, challenges, weather conditions…"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 resize-none" />
                <p className="text-xs text-slate-600 text-right mt-0.5">{notes.length}/1000</p>
              </div>
            </div>
          )}

          {/* ── Step 1: Species Mix ──────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">Add at least one species. Count is optional if not tracked per-species.</p>
              <div className="space-y-2">
                {speciesEntries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={entry.name}
                      onChange={(e) => updateSpecies(i, 'name', e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-primary/50"
                    >
                      {VALID_SPECIES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={entry.count}
                      onChange={(e) => updateSpecies(i, 'count', e.target.value)}
                      placeholder="Count"
                      className="w-24 px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
                    />
                    {speciesEntries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSpeciesRow(i)}
                        className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                        aria-label="Remove species"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {speciesEntries.length < 10 && (
                <button
                  type="button"
                  onClick={addSpeciesRow}
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add species
                </button>
              )}
            </div>
          )}

          {/* ── Step 2: Photos ───────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                Photos with GPS EXIF data are <strong className="text-primary">automatically geocoded</strong> when taken on a mobile device.
                Upload photos from <strong>the planting site</strong> for verification.
              </p>
              <PhotoUploadStrip onChange={handlePhotosChange} />
            </div>
          )}

          {/* ── Step 3: Declaration ──────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-3 text-sm text-slate-300 leading-relaxed">
                <p className="text-white font-semibold flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-primary" />
                  Declaration of Accuracy
                </p>
                <p>
                  I, as the authorised representative of my organisation, declare that all information provided in this
                  plantation report — including tree counts, species data, survival rates, and site photographs — is
                  accurate to the best of my knowledge.
                </p>
                <p>
                  I understand that <strong className="text-white">this report is immutable once submitted</strong> and that
                  providing false information may result in the suspension of my organisation's access to the CarbonSense platform.
                </p>
                <p className="text-xs text-slate-400">
                  Period: <strong className="text-white">{periodLabel}</strong>
                  {' · '}Site: <strong className="text-white">{siteName}</strong>
                  {' · '}Trees planted (this period): <strong className="text-white">{treesThisPeriod || '—'}</strong>
                  {' · '}Cumulative: <strong className="text-white">{treesCumulative || '—'}</strong>
                </p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <input
                  id="declaration"
                  type="checkbox"
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                  className="accent-primary w-4 h-4 mt-0.5 flex-shrink-0"
                />
                <label htmlFor="declaration" className="text-sm text-slate-200 cursor-pointer">
                  I confirm that the above declaration is true and accurate, and I accept sole responsibility for this submission.
                </label>
              </div>
            </div>
          )}

          {/* Form error */}
          {formError && (
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-2.5 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {formError}
            </p>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-1">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={goBack} disabled={loading}>
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onCancel} disabled={loading} className="ml-auto">
              Cancel
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext} disabled={loading}>
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={!declarationAccepted || loading}>
                {loading ? 'Submitting…' : 'Submit Report'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
