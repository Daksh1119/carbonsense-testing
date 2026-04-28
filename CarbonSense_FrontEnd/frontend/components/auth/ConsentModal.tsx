'use client';

import { useState } from 'react';
import { X, FileText, Shield, CheckCircle2 } from 'lucide-react';

interface ConsentModalProps {
  isOpen: boolean;
  onConsent: (digitalSignature: string) => void;
  onClose: () => void;
  loading?: boolean;
}

const AGREEMENT_SECTIONS = [
  {
    title: '1. Data Processing Agreement',
    content:
      'By using CarbonSense, you agree to process organizational carbon emissions data in accordance with applicable data protection regulations. All data submitted will be used exclusively for carbon management, analytics, and reporting purposes.',
  },
  {
    title: '2. Data Security Responsibilities',
    content:
      'As a designated Manager, you assume responsibility for the accuracy and security of the data you upload. You agree to implement reasonable security measures to protect data credentials and to report any suspected data breaches immediately.',
  },
  {
    title: '3. Unauthorized Data Sharing',
    content:
      'You agree not to share, export, or distribute organizational carbon data to unauthorized third parties without explicit written consent from your organization. CarbonSense data shall not be used for competitive intelligence or any purpose outside its intended use.',
  },
  {
    title: '4. Compliance Obligations',
    content:
      'You acknowledge that carbon reporting data may be subject to regulatory requirements. You agree to ensure that data submitted is truthful and accurate to the best of your knowledge, and that any discrepancies will be corrected promptly.',
  },
  {
    title: '5. Platform Usage Terms',
    content:
      'You agree to use the CarbonSense platform in good faith and in accordance with the platform\'s acceptable use policy. Misuse of the platform, including data manipulation or fraudulent reporting, may result in account suspension.',
  },
];

const CHECKBOXES = [
  {
    id: 'consent-dpa',
    label: 'I agree to the CarbonSense Data Processing Agreement',
  },
  {
    id: 'consent-responsibility',
    label: 'I understand my responsibility for organizational data',
  },
  {
    id: 'consent-authorized',
    label: "I confirm I am authorized to manage this organization's carbon data",
  },
];

export default function ConsentModal({
  isOpen,
  onConsent,
  onClose,
  loading = false,
}: ConsentModalProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [signature, setSignature] = useState('');

  const allChecked = CHECKBOXES.every((cb) => checked[cb.id]);
  const canProceed = allChecked && signature.trim().length >= 2 && !loading;

  if (!isOpen) return null;

  const handleProceed = () => {
    if (canProceed) onConsent(signature.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 rounded-lg">
              <Shield className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Manager Agreement</h2>
              <p className="text-xs text-slate-400">Review and accept before proceeding</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Agreement sections */}
          <div className="space-y-4">
            {AGREEMENT_SECTIONS.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-teal-300 mb-1">{section.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{section.content}</p>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700/50" />

          {/* Checkboxes */}
          <div className="space-y-3">
            {CHECKBOXES.map((cb) => (
              <label
                key={cb.id}
                className="flex items-start gap-3 cursor-pointer group"
              >
                <div className="mt-0.5 flex-shrink-0">
                  <input
                    id={cb.id}
                    type="checkbox"
                    checked={!!checked[cb.id]}
                    onChange={(e) =>
                      setChecked((prev) => ({ ...prev, [cb.id]: e.target.checked }))
                    }
                    className="sr-only"
                  />
                  <div
                    className={`
                      w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
                      ${checked[cb.id]
                        ? 'bg-teal-500 border-teal-500'
                        : 'border-slate-500 group-hover:border-teal-400'
                      }
                    `}
                  >
                    {checked[cb.id] && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    )}
                  </div>
                </div>
                <span className="text-sm text-slate-200">{cb.label}</span>
              </label>
            ))}
          </div>

          {/* Digital Signature */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Digital Signature (type your full name)
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="e.g. Jane Doe"
              className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/30 font-serif italic text-lg"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between gap-3">
          <button
            onClick={() => window.open('/consent-agreement', '_blank')}
            className="text-sm text-slate-400 hover:text-teal-300 flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Print agreement
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-xl hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleProceed}
              disabled={!canProceed}
              className={`
                px-6 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200
                ${canProceed
                  ? 'bg-teal-500 text-white hover:bg-teal-400 shadow-lg shadow-teal-500/25 active:scale-[0.98]'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }
              `}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : (
                'Proceed to Platform'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
