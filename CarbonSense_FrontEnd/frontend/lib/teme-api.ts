import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { getCurrentUserContext } from "@/lib/recommendations-api";
import {
	TEMERequest,
	TEMEResult,
	TEMERunRecord,
	validateTEMERequest,
} from "@/lib/teme-types";

function normalizeTEMEResult(body: any): TEMEResult {
	const monteCarlo = body?.ml_metadata?.monte_carlo || body?.monte_carlo;
	const curves = monteCarlo?.curves || {};
	const meanCurve =
		monteCarlo?.mean_curve || curves?.mean_curve || monteCarlo?.mean || curves?.mean || [];
	const p5Curve = monteCarlo?.p5_curve || curves?.p5_curve || monteCarlo?.p5 || curves?.p5 || [];
	const p95Curve =
		monteCarlo?.p95_curve || curves?.p95_curve || monteCarlo?.p95 || curves?.p95 || [];
	const totalTrees = Number(body?.total_trees || 0);
	const totalLand = Number(body?.land_required_hectare || 0);
	const landPerTree = totalTrees > 0 ? totalLand / totalTrees : null;

	return {
		...body,
		status: body?.status || "completed",
		offset_plan: (body?.offset_plan || []).map((item: any) => {
			const treeCount = item?.tree_count ?? item?.count ?? 0;
			return {
				...item,
				tree_count: treeCount,
				land_required_hectare:
					item?.land_required_hectare ??
					(landPerTree !== null ? Number((treeCount * landPerTree).toFixed(4)) : null),
			};
		}),
		ml_metadata: {
			...(body?.ml_metadata || {}),
			monte_carlo: monteCarlo
				? {
					...monteCarlo,
					mean_curve: meanCurve,
					p5_curve: p5Curve,
					p95_curve: p95Curve,
					curves: {
						mean_curve: meanCurve,
						p5_curve: p5Curve,
						p95_curve: p95Curve,
					},
				}
				: body?.ml_metadata?.monte_carlo,
		},
	};
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const useMockTeme = process.env.NEXT_PUBLIC_USE_TEME_MOCK === "true";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	// eslint-disable-next-line no-console
	console.warn(
		"Supabase env vars are missing. TEME persistence will fail until NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
	);
}

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
	if (supabaseClient) {
		return supabaseClient;
	}

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error(
			"Supabase env vars are missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
		);
	}

	supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
	return supabaseClient;
}

function getCurrentUserId(): string {
	if (typeof window === "undefined") return "anonymous";
	try {
		const { userId } = getCurrentUserContext();
		return userId || "anonymous";
	} catch {
		return "anonymous";
	}
}

function getCurrentOrgId(): string | null {
	if (typeof window === "undefined") return null;
	try {
		const { organizationId } = getCurrentUserContext();
		return organizationId || null;
	} catch {
		return null;
	}
}

function mapRowToRecord(row: any): TEMERunRecord {
	const normalizedResult = normalizeTEMEResult(row.result || {});

	return {
		id: row.id,
		user_id: row.user_id,
		project_name: row.project_name,
		emission_kg: row.emission_kg,
		input_payload: row.input_payload,
		result: normalizedResult,
		total_trees: row.total_trees,
		time_to_neutral_years: row.time_to_neutral_years,
		confidence_score: row.confidence_score,
		land_required_hectare: row.land_required_hectare,
		status: row.status,
		created_at: row.created_at,
	};
}

export async function runTEME(payload: TEMERequest): Promise<TEMEResult> {
	const validationErrors = validateTEMERequest(payload);
	if (validationErrors.length > 0) {
		throw new Error(validationErrors.join("; "));
	}

	const primaryEndpoint = useMockTeme
		? "/api/teme/run"
		: apiUrl
			? `${apiUrl}/teme/run`
			: "/api/teme/run";

	let response: Response;

	const enrichedPayload = {
		...payload,
		user_id: getCurrentUserId(),
		organization_id: getCurrentOrgId() || "anonymous",
	};

	try {
		response = await fetch(primaryEndpoint, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(enrichedPayload),
		});
	} catch (error) {
		if (primaryEndpoint !== "/api/teme/run") {
			response = await fetch("/api/teme/run", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(enrichedPayload),
			});
		} else {
			throw error;
		}
	}

	let body: any = null;
	try {
		body = await response.json();
	} catch {
		body = null;
	}

	if (!response.ok) {
		if (response.status === 422) {
			throw new Error("No feasible plan found");
		}

		if (response.status === 400) {
			throw new Error(body?.detail || body?.message || "Invalid TEME payload");
		}

		throw new Error(
			body?.detail || body?.message || `TEME request failed with status ${response.status}`
		);
	}

	return normalizeTEMEResult(body);
}

export async function saveTEMERun(
	projectName: string,
	inputPayload: TEMERequest,
	result: TEMEResult
): Promise<TEMERunRecord> {
	const supabase = getSupabaseClient();
	const userId = getCurrentUserId();
	const organizationId = getCurrentOrgId();

	const { data, error } = await supabase
		.from("teme_runs")
		.insert({
			user_id: userId,
			organization_id: organizationId,
			project_name: projectName,
			emission_kg: inputPayload.emission_kg,
			input_payload: inputPayload,
			result,
			total_trees: result.total_trees,
			time_to_neutral_years: result.time_to_neutral_years,
			confidence_score: result.confidence_score,
			land_required_hectare: result.land_required_hectare,
			status: result.status || "completed",
		})
		.select("*")
		.single();

	if (error) {
		throw new Error(`Failed to save TEME run: ${error.message}`);
	}

	return mapRowToRecord(data);
}

export async function getTEMEHistory(): Promise<TEMERunRecord[]> {
	const supabase = getSupabaseClient();
	const userId = getCurrentUserId();

	const { data, error } = await supabase
		.from("teme_runs")
		.select("*")
		.eq("user_id", userId)
		.order("created_at", { ascending: false })
		.limit(50);

	if (error) {
		throw new Error(`Failed to fetch TEME history: ${error.message}`);
	}

	return (data || []).map(mapRowToRecord);
}

export async function getPlantingProjects(): Promise<TEMERunRecord[]> {
	const supabase = getSupabaseClient();
	const userId = getCurrentUserId();

	const { data, error } = await supabase
		.from("teme_runs")
		.select("*")
		.eq("user_id", userId)
		.eq("status", "completed")
		.order("created_at", { ascending: false });

	if (error) {
		throw new Error(`Failed to fetch planting projects: ${error.message}`);
	}

	return (data || []).map(mapRowToRecord);
}
