"use client";

import { FormEvent, useMemo, useState } from "react";
import { X, ChevronDown, ChevronUp, Database } from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/lib/toast";
import { runTEME, saveTEMERun } from "@/lib/teme-api";
import { useAutoEmissions } from "@/hooks/useAutoEmissions";
import {
	TEMEResult,
	TEMERequest,
	VALID_LOCATIONS,
	VALID_SPECIES,
	PROJECT_GOALS,
} from "@/lib/teme-types";

interface NewProjectModalProps {
	onSuccess: (result: TEMEResult) => void;
	onClose: () => void;
	/** Pre-fill emission_kg from an uploaded CSV file */
	prefillEmissionKg?: number;
	/** Display label for the upload source (filename) */
	prefillDataSource?: string;
}

const timeHorizons: Array<5 | 10 | 15 | 20 | 25 | 30> = [5, 10, 15, 20, 25, 30];

export default function NewProjectModal({ onSuccess, onClose, prefillEmissionKg, prefillDataSource }: NewProjectModalProps) {
	const toNumber = (value: string, fallback: number) => {
		if (value.trim() === "") return fallback;
		const parsed = Number(value);
		return Number.isNaN(parsed) ? fallback : parsed;
	};

	const [projectName, setProjectName] = useState("");
	const [location, setLocation] = useState<string>(VALID_LOCATIONS[0]);
	const [projectGoal, setProjectGoal] = useState<string>("");
	const [emissionKgInput, setEmissionKgInput] = useState<string>(
		prefillEmissionKg != null ? String(Math.round(prefillEmissionKg)) : "1000"
	);
	const [startYearInput, setStartYearInput] = useState<string>(String(new Date().getFullYear()));

	const [landAreaInput, setLandAreaInput] = useState<string>("1");
	const [timeHorizon, setTimeHorizon] = useState<5 | 10 | 15 | 20 | 25 | 30>(15);

	const [preferredSpecies, setPreferredSpecies] = useState<string[]>([]);
	const [excludeSpecies, setExcludeSpecies] = useState<string[]>([]);
	const [preferredSelection, setPreferredSelection] = useState<string>(VALID_SPECIES[0]);
	const [excludedSelection, setExcludedSelection] = useState<string>(VALID_SPECIES[0]);
	const [enableMonteCarlo, setEnableMonteCarlo] = useState(true);
	const [monteCarloTrialsInput, setMonteCarloTrialsInput] = useState<string>("300");

	const [showActivityBreakdown, setShowActivityBreakdown] = useState(false);
	const [activityBreakdownInput, setActivityBreakdownInput] = useState<Record<string, string>>({
		transport: "",
		food: "",
		energy: "",
		shopping: "",
		other: "",
	});

	const activityBreakdown = useMemo(() => ({
		transport: toNumber(activityBreakdownInput.transport, 0),
		food: toNumber(activityBreakdownInput.food, 0),
		energy: toNumber(activityBreakdownInput.energy, 0),
		shopping: toNumber(activityBreakdownInput.shopping, 0),
		other: toNumber(activityBreakdownInput.other, 0),
	}), [activityBreakdownInput]);

	const { totalEmissionKg } = useAutoEmissions(activityBreakdown);

	const [loading, setLoading] = useState(false);
	const [errorText, setErrorText] = useState<string | null>(null);

	const speciesPool = useMemo(() => [...VALID_SPECIES], []);

	const addPreferred = () => {
		if (!preferredSelection) return;
		setPreferredSpecies((prev) => {
			if (prev.includes(preferredSelection)) return prev;
			return [...prev, preferredSelection];
		});
		setExcludeSpecies((list) => list.filter((s) => s !== preferredSelection));
	};

	const addExcluded = () => {
		if (!excludedSelection) return;
		setExcludeSpecies((prev) => {
			if (prev.includes(excludedSelection)) return prev;
			return [...prev, excludedSelection];
		});
		setPreferredSpecies((list) => list.filter((s) => s !== excludedSelection));
	};

	const removePreferred = (species: string) =>
		setPreferredSpecies((prev) => prev.filter((item) => item !== species));

	const removeExcluded = (species: string) =>
		setExcludeSpecies((prev) => prev.filter((item) => item !== species));

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
			emission_kg: toNumber(emissionKgInput, 1),
			start_year: toNumber(startYearInput, new Date().getFullYear()),
			project_goal: projectGoal || undefined,
			activity_breakdown: showActivityBreakdown ? activityBreakdown : undefined,
			constraints: {
				max_land_area_hectare: toNumber(landAreaInput, 0.01),
				time_horizon_years: timeHorizon,
				preferred_species: preferredSpecies,
				exclude_species: excludeSpecies,
			},
			ml_config: {
				enable_monte_carlo: enableMonteCarlo,
				monte_carlo_trials: toNumber(monteCarloTrialsInput, 300),
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

						<div>
							<label className="mb-1 block text-xs text-slate-400">
								Optimisation Goal
								<span className="ml-1 text-slate-600">(optional)</span>
							</label>
							<div className="flex flex-wrap gap-2">
								{PROJECT_GOALS.map((goal) => (
									<button
										type="button"
										key={goal.value}
										onClick={() => setProjectGoal(goal.value)}
										className={`rounded-lg px-3 py-1.5 text-xs border ${
											projectGoal === goal.value
												? "border-primary bg-primary/20 text-primary"
												: "border-slate-700 bg-slate-800 text-slate-300"
										}`}
									>
										{goal.label}
									</button>
								))}
							</div>
							<p className="mt-1 text-xs text-slate-600">
								Influences species ranking and portfolio composition.
							</p>
						</div>
					</section>

					<section className="space-y-4 rounded-xl border border-slate-700 p-4">
						<div className="flex items-center justify-between">
							<h3 className="text-sm font-semibold text-slate-200">SECTION B - Emission Details</h3>
							{prefillDataSource && (
								<span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
									<Database className="size-3" />
									From: {prefillDataSource.length > 30 ? prefillDataSource.slice(0, 28) + "…" : prefillDataSource}
								</span>
							)}
						</div>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<label className="mb-1 block text-xs text-slate-400">Emission (kg CO2e)</label>
								<input
									type="number"
									min={1}
									value={emissionKgInput}
									onChange={(e) => setEmissionKgInput(e.target.value)}
									className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
								/>
							</div>
							<div>
								<label className="mb-1 block text-xs text-slate-400">Start Year</label>
								<input
									type="number"
									value={startYearInput}
									onChange={(e) => setStartYearInput(e.target.value)}
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
												value={activityBreakdownInput[key]}
												onChange={(e) =>
													setActivityBreakdownInput((prev) => ({
														...prev,
														[key]: e.target.value,
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
											onClick={() => setEmissionKgInput(String(totalEmissionKg))}
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
									value={toNumber(landAreaInput, 0.01)}
									onChange={(e) => setLandAreaInput(e.target.value)}
									className="w-full"
								/>
								<input
									type="number"
									min={0.01}
									step={0.01}
									value={landAreaInput}
									onChange={(e) => setLandAreaInput(e.target.value)}
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
								<div className="flex items-center gap-2">
									<select
										value={preferredSelection}
										onChange={(e) => setPreferredSelection(e.target.value)}
										className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
									>
										{speciesPool.map((species) => (
											<option key={species} value={species}>
												{species}
											</option>
										))}
									</select>
									<button
										type="button"
										onClick={addPreferred}
										className="rounded-lg border border-emerald-500/60 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300"
									>
										Add
									</button>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{preferredSpecies.length === 0 && (
										<span className="text-xs text-slate-500">No preferred species selected</span>
									)}
									{preferredSpecies.map((species) => (
										<span
											key={species}
											title={species}
											className="inline-flex items-center gap-1 rounded-full border border-emerald-400 bg-emerald-400/20 px-3 py-1 text-xs text-emerald-300"
										>
											{species}
											<button
												type="button"
												onClick={() => removePreferred(species)}
												className="rounded-full p-0.5 text-emerald-200 hover:bg-emerald-400/30"
												aria-label={`Remove ${species}`}
												title={`Remove ${species}`}
											>
												<X className="size-3" />
											</button>
										</span>
									))}
								</div>
							</div>

							<div>
								<label className="mb-2 block text-xs text-slate-400">Excluded species</label>
								<div className="flex items-center gap-2">
									<select
										value={excludedSelection}
										onChange={(e) => setExcludedSelection(e.target.value)}
										className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
									>
										{speciesPool.map((species) => (
											<option key={species} value={species}>
												{species}
											</option>
										))}
									</select>
									<button
										type="button"
										onClick={addExcluded}
										className="rounded-lg border border-rose-500/60 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-300"
									>
										Add
									</button>
								</div>
								<div className="mt-3 flex flex-wrap gap-2">
									{excludeSpecies.length === 0 && (
										<span className="text-xs text-slate-500">No excluded species selected</span>
									)}
									{excludeSpecies.map((species) => (
										<span
											key={species}
											title={species}
											className="inline-flex items-center gap-1 rounded-full border border-rose-400 bg-rose-400/20 px-3 py-1 text-xs text-rose-300"
										>
											{species}
											<button
												type="button"
												onClick={() => removeExcluded(species)}
												className="rounded-full p-0.5 text-rose-200 hover:bg-rose-400/30"
												aria-label={`Remove ${species}`}
												title={`Remove ${species}`}
											>
												<X className="size-3" />
											</button>
										</span>
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
								value={monteCarloTrialsInput}
								onChange={(e) => setMonteCarloTrialsInput(e.target.value)}
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
