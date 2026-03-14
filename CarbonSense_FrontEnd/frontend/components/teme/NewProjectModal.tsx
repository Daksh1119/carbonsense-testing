"use client";

import { FormEvent, useMemo, useState } from "react";
import { X, ChevronDown, ChevronUp } from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { runTEME, saveTEMERun } from "@/lib/teme-api";
import { useAutoEmissions } from "@/hooks/useAutoEmissions";
import {
	TEMEResult,
	TEMERequest,
	VALID_LOCATIONS,
	VALID_SPECIES,
} from "@/lib/teme-types";

interface NewProjectModalProps {
	onSuccess: (result: TEMEResult) => void;
	onClose: () => void;
}

const timeHorizons: Array<5 | 10 | 15 | 20 | 25 | 30> = [5, 10, 15, 20, 25, 30];

export default function NewProjectModal({ onSuccess, onClose }: NewProjectModalProps) {
	const [projectName, setProjectName] = useState("");
	const [location, setLocation] = useState<string>(VALID_LOCATIONS[0]);
	const [emissionKg, setEmissionKg] = useState<number>(1000);
	const [startYear, setStartYear] = useState<number>(new Date().getFullYear());

	const [landArea, setLandArea] = useState<number>(1);
	const [timeHorizon, setTimeHorizon] = useState<5 | 10 | 15 | 20 | 25 | 30>(15);

	const [preferredSpecies, setPreferredSpecies] = useState<string[]>([]);
	const [excludeSpecies, setExcludeSpecies] = useState<string[]>([]);
	const [enableMonteCarlo, setEnableMonteCarlo] = useState(true);
	const [monteCarloTrials, setMonteCarloTrials] = useState<number>(300);

	const [showActivityBreakdown, setShowActivityBreakdown] = useState(false);
	const [activityBreakdown, setActivityBreakdown] = useState({
		transport: 0,
		food: 0,
		energy: 0,
		shopping: 0,
		other: 0,
	});

	const { totalEmissionKg } = useAutoEmissions(activityBreakdown);

	const [loading, setLoading] = useState(false);
	const [errorText, setErrorText] = useState<string | null>(null);

	const speciesPool = useMemo(() => [...VALID_SPECIES], []);

	const togglePreferred = (species: string) => {
		setPreferredSpecies((prev) => {
			const next = prev.includes(species)
				? prev.filter((s) => s !== species)
				: [...prev, species];
			if (!prev.includes(species)) {
				setExcludeSpecies((list) => list.filter((s) => s !== species));
			}
			return next;
		});
	};

	const toggleExcluded = (species: string) => {
		setExcludeSpecies((prev) => {
			const next = prev.includes(species)
				? prev.filter((s) => s !== species)
				: [...prev, species];
			if (!prev.includes(species)) {
				setPreferredSpecies((list) => list.filter((s) => s !== species));
			}
			return next;
		});
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		setErrorText(null);

		if (!projectName.trim()) {
			setErrorText("Project name is required");
			return;
		}

		const payload: TEMERequest = {
			project_name: projectName.trim(),
			location,
			emission_kg: Number(emissionKg),
			start_year: Number(startYear),
			activity_breakdown: showActivityBreakdown ? activityBreakdown : undefined,
			constraints: {
				max_land_area_hectare: Number(landArea),
				time_horizon_years: timeHorizon,
				preferred_species: preferredSpecies,
				exclude_species: excludeSpecies,
			},
			ml_config: {
				enable_monte_carlo: enableMonteCarlo,
				monte_carlo_trials: Number(monteCarloTrials),
			},
		};

		try {
			setLoading(true);
			const result = await runTEME(payload);
			await saveTEMERun(projectName.trim(), payload, result);
			showSuccessToast("TEME run completed and saved");
			onSuccess(result);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown TEME error";

			if (message.toLowerCase().includes("no feasible")) {
				setErrorText("No feasible plan found");
			} else if (
				message.toLowerCase().includes("validation") ||
				message.toLowerCase().includes("invalid")
			) {
				setErrorText(message);
			} else {
				setErrorText("Server error while running TEME engine");
			}

			showErrorToast(message);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
			<div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

			<div className="relative w-full max-w-4xl max-h-[90vh] overflow-auto rounded-2xl border border-slate-700 bg-[#0d1117] shadow-2xl">
				<div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-[#0d1117] px-6 py-4">
					<div>
						<h2 className="text-xl font-semibold text-white">New TEME Project</h2>
						<p className="text-sm text-slate-400">Run TEME engine and persist output to Supabase</p>
					</div>
					<button
						onClick={onClose}
						className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
					>
						<X className="size-5" />
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6 px-6 py-5">
					<section className="space-y-4 rounded-xl border border-slate-700 p-4">
						<h3 className="text-sm font-semibold text-slate-200">SECTION A - Basic Info</h3>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<label className="mb-1 block text-xs text-slate-400">Project Name</label>
								<input
									value={projectName}
									onChange={(e) => setProjectName(e.target.value)}
									className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
									placeholder="FY26 Carbon Offset Plan"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs text-slate-400">Location</label>
								<select
									value={location}
									onChange={(e) => setLocation(e.target.value)}
									className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
								>
									{VALID_LOCATIONS.map((option) => (
										<option key={option} value={option}>
											{option}
										</option>
									))}
								</select>
							</div>
						</div>
					</section>

					<section className="space-y-4 rounded-xl border border-slate-700 p-4">
						<h3 className="text-sm font-semibold text-slate-200">SECTION B - Emission Details</h3>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<label className="mb-1 block text-xs text-slate-400">Emission (kg CO2e)</label>
								<input
									type="number"
									min={1}
									value={emissionKg}
									onChange={(e) => setEmissionKg(Number(e.target.value))}
									className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs text-slate-400">Start Year</label>
								<input
									type="number"
									value={startYear}
									onChange={(e) => setStartYear(Number(e.target.value))}
									className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
								/>
							</div>
						</div>

						<button
							type="button"
							onClick={() => setShowActivityBreakdown((v) => !v)}
							className="inline-flex items-center gap-2 text-xs text-slate-300"
						>
							{showActivityBreakdown ? (
								<ChevronUp className="size-4" />
							) : (
								<ChevronDown className="size-4" />
							)}
							Optional activity breakdown
						</button>

						{showActivityBreakdown && (
							<>
								<div className="grid grid-cols-1 gap-3 md:grid-cols-5">
									{Object.entries(activityBreakdown).map(([key, value]) => (
										<div key={key}>
											<label className="mb-1 block text-xs capitalize text-slate-400">{key}</label>
											<input
												type="number"
												min={0}
												value={value}
												onChange={(e) =>
													setActivityBreakdown((prev) => ({
														...prev,
														[key]: Number(e.target.value),
													}))
												}
												className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white"
											/>
										</div>
									))}
								</div>

								<div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2 text-xs">
									<span className="text-slate-400">Auto total from activity breakdown</span>
									<div className="flex items-center gap-3">
										<span className="font-semibold text-white">{totalEmissionKg} kg CO2e</span>
										<button
											type="button"
											onClick={() => setEmissionKg(totalEmissionKg)}
											className="rounded-md bg-primary px-2 py-1 text-slate-950"
										>
											Use this total
										</button>
									</div>
								</div>
							</>
						)}
					</section>

					<section className="space-y-4 rounded-xl border border-slate-700 p-4">
						<h3 className="text-sm font-semibold text-slate-200">SECTION C - Constraints</h3>

						<div>
							<label className="mb-1 block text-xs text-slate-400">Land area (hectare)</label>
							<div className="flex items-center gap-3">
								<input
									type="range"
									min={0.01}
									max={50}
									step={0.01}
									value={landArea}
									onChange={(e) => setLandArea(Number(e.target.value))}
									className="w-full"
								/>
								<input
									type="number"
									min={0.01}
									step={0.01}
									value={landArea}
									onChange={(e) => setLandArea(Number(e.target.value))}
									className="w-28 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-white"
								/>
							</div>
						</div>

						<div>
							<label className="mb-2 block text-xs text-slate-400">Time horizon (years)</label>
							<div className="flex flex-wrap gap-2">
								{timeHorizons.map((value) => (
									<button
										key={value}
										type="button"
										onClick={() => setTimeHorizon(value)}
										className={`rounded-lg px-3 py-1.5 text-xs ${
											timeHorizon === value
												? "bg-primary text-slate-950"
												: "bg-slate-800 text-slate-300"
										}`}
									>
										{value}
									</button>
								))}
							</div>
						</div>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<label className="mb-2 block text-xs text-slate-400">Preferred species</label>
								<div className="flex flex-wrap gap-2">
									{speciesPool.map((species) => (
										<button
											type="button"
											key={species}
											onClick={() => togglePreferred(species)}
											className={`rounded-full border px-3 py-1 text-xs ${
												preferredSpecies.includes(species)
													? "border-emerald-400 bg-emerald-400/20 text-emerald-300"
													: "border-slate-700 bg-slate-900 text-slate-300"
											}`}
										>
											{species}
										</button>
									))}
								</div>
							</div>

							<div>
								<label className="mb-2 block text-xs text-slate-400">Excluded species</label>
								<div className="flex flex-wrap gap-2">
									{speciesPool.map((species) => (
										<button
											type="button"
											key={species}
											onClick={() => toggleExcluded(species)}
											className={`rounded-full border px-3 py-1 text-xs ${
												excludeSpecies.includes(species)
													? "border-rose-400 bg-rose-400/20 text-rose-300"
													: "border-slate-700 bg-slate-900 text-slate-300"
											}`}
										>
											{species}
										</button>
									))}
								</div>
							</div>
						</div>
					</section>

					<section className="space-y-4 rounded-xl border border-slate-700 p-4">
						<h3 className="text-sm font-semibold text-slate-200">SECTION D - Simulation</h3>

						<div className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
							<div>
								<p className="text-sm text-white">Monte Carlo Simulation</p>
								<p className="text-xs text-slate-400">
									Enable uncertainty analysis and confidence curves.
								</p>
							</div>
							<label className="inline-flex items-center gap-2 text-sm text-slate-300">
								<input
									type="checkbox"
									checked={enableMonteCarlo}
									onChange={(e) => setEnableMonteCarlo(e.target.checked)}
									className="h-4 w-4 accent-primary"
								/>
								<span>{enableMonteCarlo ? "Enabled" : "Disabled"}</span>
							</label>
						</div>

						<div>
							<label className="mb-1 block text-xs text-slate-400">Simulation trials</label>
							<input
								type="number"
								min={50}
								max={5000}
								step={50}
								value={monteCarloTrials}
								onChange={(e) => setMonteCarloTrials(Number(e.target.value || 300))}
								disabled={!enableMonteCarlo}
								className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-50"
							/>
							<p className="mt-1 text-xs text-slate-500">
								Higher trials improve stability but increase compute time.
							</p>
						</div>
					</section>

					{errorText && (
						<div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
							{errorText}
						</div>
					)}

					<div className="flex items-center justify-end gap-3 border-t border-slate-700 pt-4">
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={loading}
							className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60"
						>
							{loading ? "Running TEME Engine..." : "Run TEME"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
