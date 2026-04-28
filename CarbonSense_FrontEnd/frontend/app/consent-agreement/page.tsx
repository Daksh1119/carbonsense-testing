export default function ConsentAgreementPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-10 text-slate-900 bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-2">CarbonSense Manager Consent Agreement</h1>
      <p className="text-sm text-slate-600 mb-8">Version v1.0</p>

      <section className="space-y-5 text-sm leading-6">
        <div>
          <h2 className="font-semibold">1. Data Processing Agreement</h2>
          <p>
            By using CarbonSense, you agree to process organizational carbon emissions data in accordance with applicable data protection regulations.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">2. Data Security Responsibilities</h2>
          <p>
            You are responsible for protecting account credentials and maintaining data integrity for all organization records entered on the platform.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">3. Unauthorized Data Sharing</h2>
          <p>
            Organizational carbon data must not be shared with unauthorized third parties or used outside legitimate reporting and reduction workflows.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">4. Compliance Obligations</h2>
          <p>
            You acknowledge regulatory obligations and agree to submit accurate and timely carbon data, correcting discrepancies when identified.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">5. Platform Usage Terms</h2>
          <p>
            Misuse of CarbonSense, including fraudulent manipulation of emissions data, may result in suspension and formal compliance escalation.
          </p>
        </div>
      </section>

      <div className="mt-10 text-xs text-slate-500">
        CarbonSense • Reduction-first platform policy
      </div>
    </main>
  );
}
