'use client';

/**
 * /onboarding/company-profile
 * ============================
 * Manager onboarding form — first-time setup of org profile fields.
 * Groups 2.1 + 2.2 + 2.3 from CarbonSense_Dynamic_Platform_Plan.
 *
 * Rules:
 *  - Organization Name, Sector, Company Size Category are REQUIRED.
 *  - "Skip for now" is disabled until all three required fields are valid.
 *  - Once required fields are set, Skip sets profile_status = 'partial'.
 *  - Full submit sets profile_status = 'complete' and fires baseline estimation.
 *  - All labels use plain language; technical terms get info tooltips.
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/store';
import { supabase } from '@/lib/supabaseClient';
import { showSuccessToast, showErrorToast } from '@/lib/toast';
import {
  Building2,
  Zap,
  Truck,
  Cog,
  FileText,
  ChevronRight,
  ChevronLeft,
  Leaf,
  Info,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgProfileForm {
  // Required
  name: string;
  sector: string;
  company_size_category: string;
  // Section 1 optional
  employee_count: string;
  state: string;
  // Section 2 optional
  electricity_usage_kwh_monthly: string;
  renewable_energy_pct: string;
  computers_count: string;
  facility_area_sqft: string;
  // Section 3 optional
  vehicle_fleet_count: string;
  business_travel_km_annual: string;
  // Section 4 optional
  water_usage_kl_monthly: string;
  waste_generated_kg_monthly: string;
  working_days_per_week: string;
  // Section 5 optional
  annual_turnover_range: string;
  has_sustainability_certification: boolean;
  udyam_registration_number: string;
  udyam_category: string;
}

const EMPTY_FORM: OrgProfileForm = {
  name: '',
  sector: '',
  company_size_category: '',
  employee_count: '',
  state: '',
  electricity_usage_kwh_monthly: '',
  renewable_energy_pct: '',
  computers_count: '',
  facility_area_sqft: '',
  vehicle_fleet_count: '',
  business_travel_km_annual: '',
  water_usage_kl_monthly: '',
  waste_generated_kg_monthly: '',
  working_days_per_week: '',
  annual_turnover_range: '',
  has_sustainability_certification: false,
  udyam_registration_number: '',
  udyam_category: '',
};

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const SECTORS = [
  'Manufacturing', 'IT/ITES', 'Textiles', 'F&B', 'Retail',
  'Logistics', 'Construction', 'Healthcare', 'Other',
];

const SIZE_CATEGORIES = [
  { value: 'Micro',   label: 'Micro (≤ 10 employees or ≤ ₹1 Cr turnover)' },
  { value: 'Small',   label: 'Small (11–50 employees or ≤ ₹10 Cr turnover)' },
  { value: 'Medium',  label: 'Medium (51–250 employees or ≤ ₹50 Cr turnover)' },
  { value: 'Large',   label: 'Large (250+ employees)' },
];

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
  'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
  'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
  'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
  'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli','Daman & Diu',
  'Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
];

const TURNOVER_RANGES = [
  'Under ₹40 lakh', '₹40 lakh – ₹1 Cr', '₹1 Cr – ₹5 Cr',
  '₹5 Cr – ₹10 Cr', '₹10 Cr – ₹50 Cr', '₹50 Cr – ₹250 Cr', 'Over ₹250 Cr',
];

const UDYAM_CATEGORIES = ['Micro', 'Small', 'Medium'];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block ml-1">
      <button
        type="button"
        className="text-slate-500 hover:text-teal-400 transition-colors"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        aria-label="More information"
      >
        <Info className="size-3.5 inline" />
      </button>
      {open && (
        <span className="absolute left-5 top-0 z-50 w-56 bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 shadow-xl">
          {text}
        </span>
      )}
    </span>
  );
}

function FieldLabel({
  label,
  required,
  tooltip,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  tooltip?: string;
  htmlFor: string;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-300 mb-1.5">
      {label}
      {required && <span className="text-rose-400 ml-1">*</span>}
      {tooltip && <InfoTooltip text={tooltip} />}
    </label>
  );
}

function FormInput({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  min,
  max,
}: {
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  min?: string;
  max?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors"
    />
  );
}

function FormSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[] | string[];
  placeholder?: string;
}) {
  const normalised = (options as Array<string | { value: string; label: string }>).map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  );
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition-colors appearance-none"
    >
      <option value="">{placeholder ?? 'Select…'}</option>
      {normalised.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Section definitions (5 sections matching natural manager mental model)
// ---------------------------------------------------------------------------

const SECTIONS = [
  {
    id: 'basics',
    title: 'Company Basics',
    subtitle: 'Required information to identify your organisation in the system.',
    icon: Building2,
  },
  {
    id: 'energy',
    title: 'Facilities & Energy',
    subtitle: 'Used to estimate your Scope 1 & 2 electricity and HVAC emissions.',
    icon: Zap,
  },
  {
    id: 'transport',
    title: 'Transport',
    subtitle: 'Used to estimate your Scope 1 & 3 vehicle and travel emissions.',
    icon: Truck,
  },
  {
    id: 'operations',
    title: 'Operations',
    subtitle: 'Used to estimate Scope 3 waste and water-related emissions.',
    icon: Cog,
  },
  {
    id: 'context',
    title: 'Optional Context',
    subtitle: 'Helps us match you with relevant Indian regulatory policies.',
    icon: FileText,
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CompanyProfileOnboardingPage() {
  const router = useRouter();
  const { user } = useUserStore();

  const [form, setForm] = useState<OrgProfileForm>(EMPTY_FORM);
  const [step, setStep] = useState(0);   // 0–4 → 5 sections
  const [saving, setSaving] = useState(false);

  const set = useCallback(
    (field: keyof OrgProfileForm, value: string | boolean) =>
      setForm((f) => ({ ...f, [field]: value })),
    []
  );

  // Required field check
  const coreValid =
    form.name.trim().length > 0 &&
    form.sector.length > 0 &&
    form.company_size_category.length > 0;

  // Build patch payload (only non-empty fields)
  function buildPatch(status: 'partial' | 'complete') {
    const num = (v: string) => (v === '' ? undefined : parseFloat(v));
    const int = (v: string) => (v === '' ? undefined : parseInt(v, 10));
    return {
      name: form.name.trim() || undefined,
      sector: form.sector || undefined,
      company_size_category: form.company_size_category || undefined,
      employee_count: int(form.employee_count),
      state: form.state || undefined,
      electricity_usage_kwh_monthly: num(form.electricity_usage_kwh_monthly),
      renewable_energy_pct: num(form.renewable_energy_pct),
      computers_count: int(form.computers_count),
      facility_area_sqft: num(form.facility_area_sqft),
      vehicle_fleet_count: int(form.vehicle_fleet_count),
      business_travel_km_annual: num(form.business_travel_km_annual),
      water_usage_kl_monthly: num(form.water_usage_kl_monthly),
      waste_generated_kg_monthly: num(form.waste_generated_kg_monthly),
      working_days_per_week: int(form.working_days_per_week),
      annual_turnover_range: form.annual_turnover_range || undefined,
      has_sustainability_certification: form.has_sustainability_certification,
      udyam_registration_number: form.udyam_registration_number || undefined,
      udyam_category: form.udyam_category || undefined,
      profile_status: status,
      profile_completed_at: status === 'complete' ? new Date().toISOString() : undefined,
    };
  }

  async function handleSave(status: 'partial' | 'complete') {
    if (!user?.id) {
      showErrorToast('You must be logged in to complete onboarding.');
      return;
    }
    setSaving(true);
    try {
      const patch = buildPatch(status);
      let targetOrgId = user.organizationId;

      if (!targetOrgId) {
        // Create new organization for the manager
        const { data: newOrg, error: createOrgErr } = await supabase
          .from('organizations')
          .insert(patch)
          .select('id')
          .single();

        if (createOrgErr || !newOrg) {
          throw new Error(createOrgErr?.message ?? 'Failed to create organization.');
        }

        targetOrgId = newOrg.id;

        // Link organization_id to user_profile
        await supabase
          .from('user_profiles')
          .update({
            organization_id: targetOrgId,
            organization_name: form.name.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        useUserStore.getState().updateUser({
          organizationId: targetOrgId,
          organization: form.name.trim(),
        });
      } else {
        // Update existing organization
        const { error } = await supabase
          .from('organizations')
          .update(patch)
          .eq('id', targetOrgId);

        if (error) throw error;
      }

      // Fire baseline cycle creation on the backend (fire-and-forget)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
      fetch(`${apiUrl}/assessment-cycles/from-profile/${targetOrgId}`, {
        method: 'POST',
      }).catch(() => {/* non-fatal */});

      showSuccessToast(
        status === 'complete'
          ? 'Company profile saved! Calculating your baseline footprint…'
          : 'Progress saved. You can finish this later from Settings.'
      );
      router.push('/dashboard');
    } catch (err: unknown) {
      showErrorToast((err as Error)?.message ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  }


  // ---------------------------------------------------------------------------
  // Section renderers
  // ---------------------------------------------------------------------------

  function renderBasics() {
    return (
      <div className="space-y-5">
        <div>
          <FieldLabel htmlFor="org-name" label="Organisation name" required tooltip="The legal or trading name of your company." />
          <FormInput
            id="org-name"
            value={form.name}
            onChange={(v) => set('name', v)}
            placeholder="e.g. Sunrise Industries Pvt Ltd"
          />
        </div>
        <div>
          <FieldLabel
            htmlFor="sector"
            label="Industry sector"
            required
            tooltip="Your primary business activity. We use this to match relevant policies and emission benchmarks."
          />
          <FormSelect
            id="sector"
            value={form.sector}
            onChange={(v) => set('sector', v)}
            options={SECTORS}
            placeholder="Select your sector"
          />
        </div>
        <div>
          <FieldLabel
            htmlFor="size"
            label="Company size"
            required
            tooltip="Approximate classification. If you have a Udyam registration, you can enter the official category in Section 5."
          />
          <FormSelect
            id="size"
            value={form.company_size_category}
            onChange={(v) => set('company_size_category', v)}
            options={SIZE_CATEGORIES}
            placeholder="Select company size"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel
              htmlFor="employees"
              label="Number of employees"
              tooltip="Helps estimate commute-related emissions (Scope 3)."
            />
            <FormInput
              id="employees"
              type="number"
              min="1"
              value={form.employee_count}
              onChange={(v) => set('employee_count', v)}
              placeholder="e.g. 45"
            />
          </div>
          <div>
            <FieldLabel
              htmlFor="state"
              label="State (strongly recommended)"
              tooltip="Indian state your main facility is in. State Pollution Control Board rules vary significantly — we use this to show you the right compliance requirements."
            />
            <FormSelect
              id="state"
              value={form.state}
              onChange={(v) => set('state', v)}
              options={INDIAN_STATES}
              placeholder="Select state"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderEnergy() {
    return (
      <div className="space-y-5">
        <div>
          <FieldLabel
            htmlFor="kwh"
            label="Monthly electricity usage (kWh)"
            tooltip="Check your last electricity bill — it shows kWh consumed. This is the single biggest input for your energy emissions estimate."
          />
          <FormInput
            id="kwh"
            type="number"
            min="0"
            value={form.electricity_usage_kwh_monthly}
            onChange={(v) => set('electricity_usage_kwh_monthly', v)}
            placeholder="e.g. 5000"
          />
          <p className="text-xs text-slate-500 mt-1">Check your last electricity bill (units = kWh)</p>
        </div>
        <div>
          <FieldLabel
            htmlFor="renewable"
            label="How much of your electricity comes from renewables? (%)"
            tooltip="If you have rooftop solar or a green tariff, enter the percentage. This reduces your grid emission factor."
          />
          <FormInput
            id="renewable"
            type="number"
            min="0"
            max="100"
            value={form.renewable_energy_pct}
            onChange={(v) => set('renewable_energy_pct', v)}
            placeholder="e.g. 20"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel
              htmlFor="computers"
              label="Number of computers / laptops"
              tooltip="We use this to estimate the electricity used by your IT equipment."
            />
            <FormInput
              id="computers"
              type="number"
              min="0"
              value={form.computers_count}
              onChange={(v) => set('computers_count', v)}
              placeholder="e.g. 30"
            />
          </div>
          <div>
            <FieldLabel
              htmlFor="area"
              label="Office / facility area (sq ft)"
              tooltip="Used to estimate heating, cooling, and ventilation (HVAC) energy. Check your lease or floor plan."
            />
            <FormInput
              id="area"
              type="number"
              min="0"
              value={form.facility_area_sqft}
              onChange={(v) => set('facility_area_sqft', v)}
              placeholder="e.g. 8000"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderTransport() {
    return (
      <div className="space-y-5">
        <div>
          <FieldLabel
            htmlFor="fleet"
            label="Company vehicle fleet size"
            tooltip="Total number of vehicles owned or leased by the company (cars, vans, trucks). Not employee personal cars."
          />
          <FormInput
            id="fleet"
            type="number"
            min="0"
            value={form.vehicle_fleet_count}
            onChange={(v) => set('vehicle_fleet_count', v)}
            placeholder="e.g. 5"
          />
        </div>
        <div>
          <FieldLabel
            htmlFor="travel"
            label="Approximate annual business travel (km)"
            tooltip="Total km travelled by employees for business — flights, trains, taxis. A rough annual estimate is fine."
          />
          <FormInput
            id="travel"
            type="number"
            min="0"
            value={form.business_travel_km_annual}
            onChange={(v) => set('business_travel_km_annual', v)}
            placeholder="e.g. 25000"
          />
          <p className="text-xs text-slate-500 mt-1">Include flights, trains, taxis for business trips</p>
        </div>
      </div>
    );
  }

  function renderOperations() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel
              htmlFor="water"
              label="Monthly water usage (kL)"
              tooltip="Check your water bill. 1 kilolitre = 1,000 litres. Water treatment and pumping generates a small but real carbon footprint."
            />
            <FormInput
              id="water"
              type="number"
              min="0"
              value={form.water_usage_kl_monthly}
              onChange={(v) => set('water_usage_kl_monthly', v)}
              placeholder="e.g. 50"
            />
          </div>
          <div>
            <FieldLabel
              htmlFor="waste"
              label="Monthly waste generated (kg)"
              tooltip="Total waste sent to landfill or collection per month. Check with your facility manager or waste contractor."
            />
            <FormInput
              id="waste"
              type="number"
              min="0"
              value={form.waste_generated_kg_monthly}
              onChange={(v) => set('waste_generated_kg_monthly', v)}
              placeholder="e.g. 200"
            />
          </div>
        </div>
        <div>
          <FieldLabel
            htmlFor="workdays"
            label="Working days per week"
            tooltip="Typical number of days your office is open each week. Used to calculate annual operating hours."
          />
          <FormInput
            id="workdays"
            type="number"
            min="1"
            max="7"
            value={form.working_days_per_week}
            onChange={(v) => set('working_days_per_week', v)}
            placeholder="e.g. 5"
          />
        </div>
      </div>
    );
  }

  function renderContext() {
    return (
      <div className="space-y-5">
        <div>
          <FieldLabel
            htmlFor="turnover"
            label="Annual turnover range"
            tooltip="Used for more precise MSME policy matching. India's official MSME classification uses turnover thresholds, not just headcount."
          />
          <FormSelect
            id="turnover"
            value={form.annual_turnover_range}
            onChange={(v) => set('annual_turnover_range', v)}
            options={TURNOVER_RANGES}
            placeholder="Select range (optional)"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <FieldLabel
              htmlFor="udyam-num"
              label="Udyam registration number"
              tooltip="Your official MSME registration number (e.g. UDYAM-XX-00-0000000). If you have one, your official Udyam category will take priority over the size estimate above."
            />
            <FormInput
              id="udyam-num"
              value={form.udyam_registration_number}
              onChange={(v) => set('udyam_registration_number', v)}
              placeholder="e.g. UDYAM-MH-00-1234567"
            />
          </div>
          <div>
            <FieldLabel
              htmlFor="udyam-cat"
              label="Official Udyam category"
              tooltip="Micro / Small / Medium as shown on your Udyam certificate."
            />
            <FormSelect
              id="udyam-cat"
              value={form.udyam_category}
              onChange={(v) => set('udyam_category', v)}
              options={UDYAM_CATEGORIES}
              placeholder="Select (optional)"
            />
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 bg-slate-800/40 border border-slate-700 rounded-lg">
          <input
            id="cert"
            type="checkbox"
            checked={form.has_sustainability_certification}
            onChange={(e) => set('has_sustainability_certification', e.target.checked)}
            className="mt-0.5 accent-teal-500"
          />
          <label htmlFor="cert" className="text-sm text-slate-300 cursor-pointer">
            We already hold a sustainability certification
            <InfoTooltip text="e.g. ISO 14001, BEE Star, GreenCo. This improves your Compliance score baseline." />
            <span className="block text-xs text-slate-500 mt-0.5">e.g. ISO 14001, BEE Star, GreenCo</span>
          </label>
        </div>
      </div>
    );
  }

  const sectionRenderers = [renderBasics, renderEnergy, renderTransport, renderOperations, renderContext];
  const totalSteps = SECTIONS.length;
  const isLast = step === totalSteps - 1;

  return (
    <div className="min-h-screen bg-background-dark flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-teal-500/10 rounded-xl border border-teal-500/20">
            <Leaf className="size-6 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Set up your company profile</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              This helps us calculate your carbon footprint and match relevant policies.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full h-1 rounded-full transition-all duration-300 ${
                    i <= step ? 'bg-teal-500' : 'bg-slate-700'
                  }`}
                />
                <Icon
                  className={`size-3.5 transition-colors ${
                    i <= step ? 'text-teal-400' : 'text-slate-600'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Card */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-teal-400 uppercase tracking-widest">
                Step {step + 1} of {totalSteps}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{SECTIONS[step].title}</h2>
            <p className="text-sm text-slate-400 mt-1">{SECTIONS[step].subtitle}</p>
            {step === 0 && (
              <p className="text-xs text-amber-400/80 mt-2 flex items-center gap-1">
                <span>Fields marked</span>
                <span className="text-rose-400 font-bold">*</span>
                <span>are required before you can continue or skip.</span>
              </p>
            )}
            {step > 0 && (
              <p className="text-xs text-slate-500 mt-2">All fields on this step are optional.</p>
            )}
          </div>

          {/* Section content */}
          <div className="mb-8">{sectionRenderers[step]()}</div>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
                >
                  <ChevronLeft className="size-4" />
                  Back
                </button>
              )}

              {/* Skip — disabled until core 3 fields are valid */}
              <button
                type="button"
                onClick={() => handleSave('partial')}
                disabled={!coreValid || saving}
                title={
                  !coreValid
                    ? 'Enter Organisation name, Sector, and Company size to enable Skip'
                    : 'Save what you have and finish later'
                }
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving…' : 'Skip for now'}
              </button>
            </div>

            {isLast ? (
              <button
                type="button"
                onClick={() => handleSave('complete')}
                disabled={!coreValid || saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-background-dark font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                {saving ? 'Saving…' : 'Save profile'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="flex items-center gap-2 px-6 py-2.5 bg-teal-500 hover:bg-teal-400 text-background-dark font-semibold rounded-lg transition-colors"
              >
                Continue
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-4">
          You can always edit these details later from <strong className="text-slate-400">Settings → Organisation</strong>.
        </p>
      </div>
    </div>
  );
}
