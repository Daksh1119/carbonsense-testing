'use client';

/**
 * NewSiteModal — Manager creates a new plantation site.
 * Optional prefill from a TEME run.
 */

import dynamic from 'next/dynamic';
import { FormEvent, useEffect, useState } from 'react';
import { X, MapPin, TreePine, Info } from 'lucide-react';
import Button from '@/components/Button';
import { showSuccessToast, showErrorToast } from '@/lib/toast';
import { createSite, type PlantationSite } from '@/lib/plantation-api';
import { VALID_LOCATIONS } from '@/lib/teme-types';

// SSR-safe map
const PlantationMap = dynamic(() => import('./PlantationMap'), { ssr: false });

interface NewSiteModalProps {
  onClose: () => void;
  onSuccess: (site: PlantationSite) => void;
  prefill?: {
    teme_run_id?: string;
    target_trees?: number;
    area_hectares?: number;
    location_label?: string;
  } | null;
}

export default function NewSiteModal({ onClose, onSuccess, prefill }: NewSiteModalProps) {
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [areaHa, setAreaHa] = useState<string>(prefill?.area_hectares ? String(prefill.area_hectares.toFixed(2)) : '');
  const [targetTrees, setTargetTrees] = useState<string>(prefill?.target_trees ? String(prefill.target_trees) : '');
  const [regionLabel, setRegionLabel] = useState<string>(prefill?.location_label ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lat/lng from map click
  const handleMapPick = (lat: number, lng: number) => {
    setLatitude(String(lat));
    setLongitude(String(lng));
  };

  const validate = () => {
    if (name.trim().length < 2) return 'Site name must be at least 2 characters.';
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!latitude || isNaN(lat) || lat < -90 || lat > 90) return 'Invalid latitude (must be between -90 and 90).';
    if (!longitude || isNaN(lng) || lng < -180 || lng > 180) return 'Invalid longitude (must be between -180 and 180).';
    const area = parseFloat(areaHa);
    if (!areaHa || isNaN(area) || area <= 0) return 'Area must be a positive number.';
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);
    setLoading(true);
    try {
      const site = await createSite({
        name: name.trim(),
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        area_hectares: parseFloat(areaHa),
        target_trees: targetTrees ? parseInt(targetTrees, 10) : null,
        region_label: regionLabel || null,
        teme_run_id: prefill?.teme_run_id ?? null,
      });
      showSuccessToast(`Site "${site.name}" registered.`);
      onSuccess(site);
    } catch (err: any) {
      showErrorToast(err?.message ?? 'Failed to create site');
    } finally {
      setLoading(false);
    }
  };

  const lat = parseFloat(latitude) || null;
  const lng = parseFloat(longitude) || null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto pt-10">
      <div className="w-full max-w-xl bg-navy-muted border border-primary/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Register Plantation Site</h2>
              {prefill?.teme_run_id && (
                <p className="text-xs text-amber-400/80 mt-0.5 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Prefilled from TEME run — coordinates need manual entry
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Site name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="site-name">
              Site Name <span className="text-rose-400">*</span>
            </label>
            <input
              id="site-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bhandardara North Plot"
              maxLength={120}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 transition-colors"
              required
            />
          </div>

          {/* Map — click to pick coordinates */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Location <span className="text-rose-400">*</span>{' '}
              <span className="text-slate-500 font-normal">— click the map to drop a pin</span>
            </label>
            <div className="rounded-xl overflow-hidden border border-slate-700/50">
              <PlantationMap
                latitude={lat}
                longitude={lng}
                onLocationPicked={handleMapPick}
                heightClass="h-52"
              />
            </div>
          </div>

          {/* Lat/lng manual inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="lat">
                Latitude <span className="text-rose-400">*</span>
              </label>
              <input
                id="lat"
                type="number"
                step="0.000001"
                min={-90}
                max={90}
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="e.g. 19.5937"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="lng">
                Longitude <span className="text-rose-400">*</span>
              </label>
              <input
                id="lng"
                type="number"
                step="0.000001"
                min={-180}
                max={180}
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="e.g. 73.8777"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* Area + target trees */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="area">
                Area (hectares) <span className="text-rose-400">*</span>
              </label>
              <input
                id="area"
                type="number"
                step="0.01"
                min="0.01"
                value={areaHa}
                onChange={(e) => setAreaHa(e.target.value)}
                placeholder="e.g. 2.5"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="target">
                Target Trees{' '}
                <span className="text-slate-500 font-normal">(optional)</span>
              </label>
              <input
                id="target"
                type="number"
                min="0"
                value={targetTrees}
                onChange={(e) => setTargetTrees(e.target.value)}
                placeholder="e.g. 500"
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          {/* Region label */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5" htmlFor="region">
              Region / State{' '}
              <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <select
              id="region"
              value={regionLabel}
              onChange={(e) => setRegionLabel(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-sm text-white focus:outline-none focus:border-primary/50"
            >
              <option value="">— Select region —</option>
              {VALID_LOCATIONS.map((loc) => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-2.5">
              {error}
            </p>
          )}

          {/* Coordinate lock notice */}
          <p className="text-xs text-amber-400/70 bg-amber-500/5 border border-amber-500/10 rounded-lg px-3 py-2.5 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>Site coordinates and area are <strong>locked</strong> once the first report is submitted. Register a new site if the location changes.</span>
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Registering…' : 'Register Site'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
