"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	TreePine,
	TrendingUp,
	MapPin,
	Clock,
	Leaf,
	Target,
	CheckCircle2,
} from "lucide-react";
import DashboardCard from "@/components/DashboardCard";
import StatsCard from "@/components/StatsCard";
import Button from "@/components/Button";
import ProgressBar from "@/components/ProgressBar";
import Badge from "@/components/Badge";
import { BackButton, Breadcrumb } from "@/components/navigation";
import NewProjectModal from "@/components/teme/NewProjectModal";
import TimeDebtChart from "@/components/teme/TimeDebtChart";
import { getPlantingProjects, getTEMEHistory } from "@/lib/teme-api";
import { TEMEResult, TEMERunRecord } from "@/lib/teme-types";
import { showErrorToast } from "@/lib/toast";

function formatNumber(value: number | undefined): string {
	if (value === undefined || Number.isNaN(value)) return "--";
	return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function getSpeciesList(project: TEMERunRecord): string {
	const list = project.result?.offset_plan?.map((item) => item.species) || [];
	return list.join(", ") || "N/A";
}

function getSpeciesAnnualAbsorption(item: TEMEResult["offset_plan"][number], yearIndex: number): number {
	const sequestrationAtYear = item.annual_sequestration_kg?.[yearIndex] ?? 0;
	const survivalAtYear = item.survival_curve?.[yearIndex] ?? item.survival_curve?.[0] ?? 1;
	const trees = item.tree_count ?? 0;
	return sequestrationAtYear * survivalAtYear * trees;
}

function getMonteCarloCurves(result: TEMEResult | null) {
	const monteCarlo = result?.ml_metadata?.monte_carlo;
	const meanCurve = monteCarlo?.curves?.mean_curve || monteCarlo?.mean_curve;
	const p5Curve = monteCarlo?.curves?.p5_curve || monteCarlo?.p5_curve;
	const p95Curve = monteCarlo?.curves?.p95_curve || monteCarlo?.p95_curve;
	const hasCurves = Boolean(meanCurve?.length || p5Curve?.length || p95Curve?.length);
	const simulationEnabled = monteCarlo?.enabled === false ? false : hasCurves;

	return {
		monteCarlo,
		meanCurve,
		p5Curve,
		p95Curve,
		hasCurves,
		simulationEnabled,
		simulationTrials: monteCarlo?.trials,
	};
}

function getConfidenceLabel(score: number): string {
	if (score >= 0.8) return "High confidence";
	if (score >= 0.6) return "Moderate confidence";
	return "Low confidence";
}

function buildKeyInsight(result: TEMEResult | null, simulationEnabled: boolean, emissionKg?: number): string {
	if (!result) return "Create a TEME project to see personalized insights.";

	const years = result.time_to_neutral_years;

	if (simulationEnabled) {
		const { monteCarlo, meanCurve, p5Curve, p95Curve } = getMonteCarloCurves(result);
		const probability =
			typeof monteCarlo?.probability_of_offset === "number"
				? Math.round(monteCarlo.probability_of_offset * 100)
				: null;
		const riskAwareYears =
			typeof monteCarlo?.risk_aware_payback_years === "number"
				? monteCarlo.risk_aware_payback_years
				: null;

		if (probability !== null && riskAwareYears !== null) {
			return `Monte Carlo estimates a ${probability}% chance of full offset, with a risk-aware neutrality time of ${riskAwareYears} years.`;
		}

		const lastIndex = Math.max(
			(meanCurve?.length || 1) - 1,
			(p5Curve?.length || 1) - 1,
			(p95Curve?.length || 1) - 1
		);
		const meanFinal = Number(meanCurve?.[lastIndex] ?? 0);
		const p5Final = Number(p5Curve?.[lastIndex] ?? 0);
		const p95Final = Number(p95Curve?.[lastIndex] ?? 0);

		if (meanFinal > 0 || p95Final > 0) {
			const spread = Math.max(0, p95Final - p5Final);
			if (typeof emissionKg === "number" && emissionKg > 0) {
				const coveragePct = Math.min(999, Math.round((meanFinal / emissionKg) * 100));
				return `Monte Carlo expected offset at horizon is ${formatNumber(meanFinal)} kg (~${coveragePct}% of target), with uncertainty band ${formatNumber(p5Final)}-${formatNumber(p95Final)} kg.`;
			}

			return `Monte Carlo expected offset at horizon is ${formatNumber(meanFinal)} kg, with uncertainty band ${formatNumber(p5Final)}-${formatNumber(p95Final)} kg (spread ${formatNumber(spread)} kg).`;
		}

		return `Simulation is enabled. Deterministic payback is ${years} years; run with more trials for tighter uncertainty estimates.`;
	}

	return `Projected neutrality in ${years} years based on deterministic estimates. Enable simulation for risk range.`;
}

function buildRecommendation(result: TEMEResult | null, simulationEnabled: boolean): string {
	if (!result) return "Start with one baseline project and compare plans by location and time horizon.";

	if (!simulationEnabled) {
		return "Enable Monte Carlo to view best and worst-case offset timelines before finalizing your plantation plan.";
	}

	if (result.confidence_score < 0.6) {
		return "Confidence is low. Try increasing land area, extending time horizon, or adjusting species preferences.";
	}

	if (result.time_to_neutral_years > 10) {
		return "Payback is long. Prefer faster-maturing species or increase tree count to shorten neutrality time.";
	}

	return "This plan is strong. Keep survival high through maintenance during the first 3-5 years.";
}

export default function TEMEDashboard() {
	type TopCardKey = "active-projects" | "trees-planned" | "current-absorption" | "payback-period";

	const [showModal, setShowModal] = useState(false);
	const [projects, setProjects] = useState<TEMERunRecord[]>([]);
	const [latestResult, setLatestResult] = useState<TEMEResult | null>(null);
	const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
	const [selectedTopCard, setSelectedTopCard] = useState<TopCardKey>("active-projects");
	const [historyLoading, setHistoryLoading] = useState(true);
	const activeProjectsSectionRef = useRef<HTMLDivElement | null>(null);
	const speciesSectionRef = useRef<HTMLDivElement | null>(null);
	const timeDebtSectionRef = useRef<HTMLDivElement | null>(null);

	const loadProjects = async () => {
		try {
			const [completed, history] = await Promise.all([
				getPlantingProjects(),
				getTEMEHistory(),
			]);
			setProjects(completed);
			if (history[0]?.result) {
				setLatestResult(history[0].result);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Failed to load TEME data";
			showErrorToast(message);
		} finally {
			setHistoryLoading(false);
		}
	};

	useEffect(() => {
		loadProjects();
	}, []);

	useEffect(() => {
		if (projects.length === 0) {
			setSelectedProjectId(null);
			return;
		}

		if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
			setSelectedProjectId(projects[0].id);
		}
	}, [projects, selectedProjectId]);

	const selectedProject = useMemo(
		() => projects.find((project) => project.id === selectedProjectId) || null,
		[projects, selectedProjectId]
	);

	const focusedResult = selectedProject?.result || latestResult;

	const totalTrees = useMemo(
		() => projects.reduce((sum, project) => sum + (project.total_trees || 0), 0),
		[projects]
	);

	const averageConfidence = useMemo(() => {
		if (!projects.length) return 0;
		return projects.reduce((sum, project) => sum + (project.confidence_score || 0), 0) / projects.length;
	}, [projects]);

	const currentAbsorption = useMemo(() => {
		if (!focusedResult?.offset_plan) return 0;

		return focusedResult.offset_plan.reduce((sum, item) => {
			return sum + getSpeciesAnnualAbsorption(item, 1);
		}, 0);
	}, [focusedResult]);

	const { meanCurve, p5Curve, p95Curve, simulationEnabled, simulationTrials } =
		getMonteCarloCurves(focusedResult);
	const focusedEmissionKg = selectedProject?.emission_kg;
	const recommendation = buildRecommendation(focusedResult, simulationEnabled);

	const topCardDetail = useMemo(() => {
		switch (selectedTopCard) {
			case "active-projects":
				return {
					title: "Active Projects Detail",
					description: projects.length
						? `You currently have ${projects.length} active planting projects. Click any project below to inspect species mix and simulation output.`
						: "No active projects yet. Start by creating your first project.",
					f1: `Average confidence: ${(averageConfidence * 100).toFixed(0)}%`,
					f2: `Latest selected: ${selectedProject?.project_name || "N/A"}`,
					f3: "Tip: Use this card anytime to jump to the project list.",
				};
			case "trees-planned":
				return {
					title: "Trees to Plant Detail",
					description: `Across all active projects, your current plans recommend planting ${formatNumber(totalTrees)} trees. This is a projected plan volume, not a verified planted count.`,
					f1: `Projects counted: ${projects.length}`,
					f2: `Selected project planned trees: ${formatNumber(selectedProject?.total_trees || 0)}`,
					f3: `Top species in selected plan: ${focusedResult?.offset_plan?.[0]?.species || "N/A"}`,
				};
			case "current-absorption":
				return {
					title: "Current Absorption Detail",
					description: `Current Absorption is an early-year estimate for the selected project, combining species sequestration, survival, and tree counts.`,
					f1: `Estimated current absorption: ${formatNumber(currentAbsorption)} kg CO2/yr`,
					f2: `Simulation mode: ${simulationEnabled ? "Enabled" : "Disabled"}`,
					f3: simulationEnabled ? "Review uncertainty bands in Time-Debt Analysis." : "Enable simulation to see uncertainty ranges.",
				};
			case "payback-period":
				return {
					title: "Payback Period Detail",
					description: `Payback Period is the estimated time to neutralize the project emissions. Lower years generally indicate faster offset.`,
					f1: `Selected project payback: ${focusedResult?.time_to_neutral_years ?? "--"} years`,
					f2: `Selected confidence: ${((focusedResult?.confidence_score || 0) * 100).toFixed(0)}%`,
					f3: recommendation,
				};
			default:
				return {
					title: "Quick Detail",
					description: "Select a card to view more details.",
					f1: "",
					f2: "",
					f3: "",
				};
		}
	}, [
		averageConfidence,
		currentAbsorption,
		focusedResult?.confidence_score,
		focusedResult?.offset_plan,
		focusedResult?.time_to_neutral_years,
		projects.length,
		recommendation,
		selectedProject?.project_name,
		selectedProject?.total_trees,
		selectedTopCard,
		simulationEnabled,
		totalTrees,
	]);

	const handleTopCardClick = (card: TopCardKey) => {
		setSelectedTopCard(card);

		const sectionMap: Record<TopCardKey, { current: HTMLDivElement | null }> = {
			"active-projects": activeProjectsSectionRef,
			"trees-planned": speciesSectionRef,
			"current-absorption": timeDebtSectionRef,
			"payback-period": timeDebtSectionRef,
		};

		sectionMap[card].current?.scrollIntoView({ behavior: "smooth", block: "start" });
	};

	return (
		<div className="space-y-6">
			<Breadcrumb />

			<div className="flex items-start justify-between">
				<div>
					<h1 className="text-3xl font-bold text-white mb-2">Tree-Emission Matching Engine</h1>
					<p className="text-slate-400">Scientific tree offset modeling with time-debt analysis</p>
				</div>
				<div className="flex items-center gap-3">
					<BackButton href="/dashboard" label="Back" variant="outline" showIcon={false} />
					<Button
						variant="primary"
						icon={<TreePine className="size-4" />}
						onClick={() => setShowModal(true)}
					>
						NEW PROJECT
					</Button>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-4 gap-6">
				<button
					type="button"
					onClick={() => handleTopCardClick("active-projects")}
					className={`text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/70 ${selectedTopCard === "active-projects" ? "ring-2 ring-primary/60" : ""}`}
				>
					<StatsCard
						title="Active Projects"
						value={historyLoading ? "..." : String(projects.length)}
						icon={<TreePine className="size-6" />}
					/>
				</button>
				<button
					type="button"
					onClick={() => handleTopCardClick("trees-planned")}
					className={`text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/70 ${selectedTopCard === "trees-planned" ? "ring-2 ring-primary/60" : ""}`}
				>
					<StatsCard
						title="Trees to Plant"
						value={historyLoading ? "..." : formatNumber(totalTrees)}
						icon={<Leaf className="size-6" />}
					/>
				</button>
				<button
					type="button"
					onClick={() => handleTopCardClick("current-absorption")}
					className={`text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/70 ${selectedTopCard === "current-absorption" ? "ring-2 ring-primary/60" : ""}`}
				>
					<StatsCard
						title="Current Absorption"
						value={historyLoading ? "..." : formatNumber(currentAbsorption)}
						unit="kg CO2/yr"
						icon={<TrendingUp className="size-6" />}
					/>
				</button>
				<button
					type="button"
					onClick={() => handleTopCardClick("payback-period")}
					className={`text-left rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/70 ${selectedTopCard === "payback-period" ? "ring-2 ring-primary/60" : ""}`}
				>
					<StatsCard
						title="Payback Period"
						value={
							focusedResult?.time_to_neutral_years
								? formatNumber(focusedResult.time_to_neutral_years)
								: "--"
						}
						unit="years"
						icon={<Clock className="size-6" />}
					/>
				</button>
			</div>

			<DashboardCard
				title={topCardDetail.title}
				subtitle="Card-specific details and guidance"
				icon={<Target className="size-5" />}
			>
				<p className="text-sm text-slate-300 mb-3">{topCardDetail.description}</p>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
					<div className="rounded-md border border-slate-700 bg-slate-900/40 p-3 text-slate-300">{topCardDetail.f1}</div>
					<div className="rounded-md border border-slate-700 bg-slate-900/40 p-3 text-slate-300">{topCardDetail.f2}</div>
					<div className="rounded-md border border-slate-700 bg-slate-900/40 p-3 text-slate-300">{topCardDetail.f3}</div>
				</div>
			</DashboardCard>

			<div ref={timeDebtSectionRef}>
			<DashboardCard
				title="Time-Debt Analysis"
				subtitle="Projected CO2 absorption over years from TEME Monte Carlo output"
				icon={<Target className="size-5" />}
				className={
					selectedTopCard === "current-absorption" || selectedTopCard === "payback-period"
						? "ring-2 ring-primary/40"
						: undefined
				}
			>
				<div className="mb-3 flex items-center gap-2 text-xs">
					<span
						className={`rounded-full border px-2 py-1 ${
							simulationEnabled
								? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
								: "border-slate-600 bg-slate-800/70 text-slate-300"
						}`}
					>
						Simulation: {simulationEnabled ? "Enabled" : "Disabled"}
					</span>
					{typeof simulationTrials === "number" && simulationEnabled && (
						<span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-cyan-300">
							Trials: {simulationTrials}
						</span>
					)}
				</div>
				<TimeDebtChart mean_curve={meanCurve} p5_curve={p5Curve} p95_curve={p95Curve} />
				<div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
					<div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-slate-300">
						<p className="text-slate-200 font-medium mb-1">How to read this chart</p>
						<p>
							Expected line is the most likely absorption path. Best and worst lines show uncertainty range.
						</p>
					</div>
					<div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3 text-slate-300">
						<p className="text-slate-200 font-medium mb-1">Recommendation</p>
						<p>{recommendation}</p>
					</div>
				</div>
			</DashboardCard>
			</div>

			<div ref={speciesSectionRef}>
			<DashboardCard
				title="Species Recommendations"
				subtitle="Generated from latest TEME offset plan"
				icon={<TreePine className="size-5" />}
				className={selectedTopCard === "trees-planned" ? "ring-2 ring-primary/40" : undefined}
			>
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{(focusedResult?.offset_plan || []).map((item, index) => {
						const survivalYear5 =
							item.survival_curve?.[5] ??
							item.survival_curve?.[item.survival_curve.length - 1] ??
							0;
						const endYearIndex = Math.max((item.annual_sequestration_kg?.length || 1) - 1, 0);
						const annualAbsorption = getSpeciesAnnualAbsorption(item, endYearIndex);
						const survivalPercent = Math.round(survivalYear5 * 100);

						return (
							<div
								key={`${item.species}-${index}`}
								className="p-5 rounded-lg border-2 bg-primary/5 border-primary/30"
							>
								<div className="flex items-start justify-between mb-3">
									<div>
										<h4 className="text-sm font-bold text-white">{item.species}</h4>
										<p className="text-xs text-slate-400 mt-1">
											{formatNumber(item.tree_count)} planned trees
										</p>
									</div>
									<CheckCircle2 className="size-5 text-primary" />
								</div>

								<div className="space-y-3 mb-4">
									<div>
										<div className="flex items-center justify-between mb-1">
											<span className="text-xs text-slate-400">Survival Rate (Year 5)</span>
											<span className="text-xs font-semibold text-white">{survivalPercent}%</span>
										</div>
										<ProgressBar
											value={survivalPercent}
											color={survivalPercent > 75 ? "success" : "warning"}
											size="sm"
										/>
									</div>

									<div className="grid grid-cols-2 gap-2 text-xs">
										<div>
											<p className="text-slate-500">CO2 / Year</p>
											<p className="text-white font-medium">{formatNumber(annualAbsorption)} kg</p>
										</div>
										<div>
											<p className="text-slate-500">Land (ha)</p>
											<p className="text-white font-medium">{item.land_required_hectare?.toFixed(2) || "--"}</p>
										</div>
									</div>
								</div>
							</div>
						);
					})}
				</div>
				{(!focusedResult?.offset_plan || focusedResult.offset_plan.length === 0) && (
					<p className="text-sm text-slate-400">Run a project to view species recommendations.</p>
				)}
			</DashboardCard>
			</div>

			<div ref={activeProjectsSectionRef}>
			<DashboardCard
				title="Active Planting Projects"
				icon={<MapPin className="size-5" />}
				className={selectedTopCard === "active-projects" ? "ring-2 ring-primary/40" : undefined}
			>
				<p className="mb-3 text-xs text-slate-400">Click a project to see detailed breakdown and project-specific simulation.</p>
				<p className="mb-3 text-xs text-slate-500">Confidence guide: High is 0.80 and above, Moderate is 0.60 to 0.79, Low is below 0.60.</p>
				<div className="space-y-3">
					{projects.map((project) => (
						<div
							key={project.id}
							onClick={() => setSelectedProjectId(project.id)}
							className={`cursor-pointer p-4 bg-navy-muted/50 border rounded-lg transition-colors ${
								selectedProjectId === project.id
									? "border-primary/60"
									: "border-navy-border hover:border-primary/30"
							}`}
						>
							<div className="flex items-start justify-between mb-3">
								<div>
									<h4 className="text-sm font-semibold text-white">{project.project_name}</h4>
									<div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
										<span>{formatNumber(project.total_trees)} planned trees</span>
										<span>{getSpeciesList(project)}</span>
									</div>
								</div>
								<Badge variant="success">{project.confidence_score.toFixed(2)} confidence</Badge>
							</div>

							<div className="flex items-center justify-between text-xs text-slate-400 mb-1">
								<span>Created</span>
								<span>{new Date(project.created_at).toLocaleDateString()}</span>
							</div>
							<ProgressBar
								value={Math.max(5, Math.min(100, project.confidence_score * 100))}
								color="success"
								size="sm"
							/>
						</div>
					))}
				</div>

				{selectedProject && (
					<div className="mt-5 rounded-lg border border-slate-700 bg-slate-900/30 p-4 space-y-4">
						<div className="flex items-start justify-between gap-4">
							<div>
								<p className="text-sm font-semibold text-white">Project Details: {selectedProject.project_name}</p>
								<p className="text-xs text-slate-400 mt-1">
									Location {selectedProject.input_payload?.location || "N/A"} • Created {new Date(selectedProject.created_at).toLocaleDateString()}
								</p>
							</div>
							<Badge variant="success">{getConfidenceLabel(selectedProject.confidence_score)}</Badge>
						</div>

						<div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
							<div className="rounded-md border border-slate-700 p-2">
								<p className="text-slate-400">Emission Target</p>
								<p className="text-white font-medium">{formatNumber(selectedProject.emission_kg)} kg</p>
							</div>
							<div className="rounded-md border border-slate-700 p-2">
								<p className="text-slate-400">Land Required</p>
								<p className="text-white font-medium">{selectedProject.land_required_hectare.toFixed(2)} ha</p>
							</div>
							<div className="rounded-md border border-slate-700 p-2">
								<p className="text-slate-400">Neutrality Time</p>
								<p className="text-white font-medium">{formatNumber(selectedProject.time_to_neutral_years)} years</p>
							</div>
							<div className="rounded-md border border-slate-700 p-2">
								<p className="text-slate-400">Simulation</p>
								<p className="text-white font-medium">
									{getMonteCarloCurves(selectedProject.result).simulationEnabled ? "Enabled" : "Disabled"}
								</p>
							</div>
						</div>

						<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
							<div className="rounded-md border border-slate-700 p-3">
								<p className="text-xs text-slate-400 mb-2">Species Mix</p>
								<div className="space-y-2">
									{(selectedProject.result?.offset_plan || []).map((item, idx) => (
										<div key={`${item.species}-${idx}`} className="flex items-center justify-between text-xs">
											<span className="text-slate-300">{item.species}</span>
											<span className="text-white">{formatNumber(item.tree_count)} planned trees</span>
										</div>
									))}
								</div>
							</div>

							<div className="rounded-md border border-slate-700 p-3">
								<p className="text-xs text-slate-400 mb-2">Project Simulation View</p>
								<TimeDebtChart
									mean_curve={getMonteCarloCurves(selectedProject.result).meanCurve}
									p5_curve={getMonteCarloCurves(selectedProject.result).p5Curve}
									p95_curve={getMonteCarloCurves(selectedProject.result).p95Curve}
								/>
							</div>
						</div>
					</div>
				)}
				{projects.length === 0 && !historyLoading && (
					<p className="text-sm text-slate-400">No completed planting projects yet.</p>
				)}
			</DashboardCard>
			</div>

			{showModal && (
				<NewProjectModal
					onSuccess={(result) => {
						setLatestResult(result);
						setShowModal(false);
						loadProjects();
					}}
					onClose={() => setShowModal(false)}
				/>
			)}
		</div>
	);
}
