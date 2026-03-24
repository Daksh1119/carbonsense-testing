export interface TEMEConstraints {
	max_land_area_hectare: number;
	time_horizon_years: 5 | 10 | 15 | 20 | 25 | 30;
	preferred_species?: string[];
	exclude_species?: string[];
}

export interface TEMEMLConfig {
	enable_monte_carlo?: boolean;
	monte_carlo_trials?: number;
}

export interface TEMERequest {
	project_name: string;
	location: string;
	emission_kg: number;
	start_year: number;
	project_goal?: string;
	activity_breakdown?: {
		transport?: number;
		food?: number;
		energy?: number;
		shopping?: number;
		other?: number;
	};
	constraints: TEMEConstraints;
	ml_config?: TEMEMLConfig;
}

export interface OffsetPlanItem {
	species: string;
	tree_count: number;
	survival_curve: number[];
	annual_sequestration_kg: number[];
	land_required_hectare?: number;
}

export interface MonteCarloResult {
	mean_curve: number[];
	p5_curve: number[];
	p95_curve: number[];
}

export interface TEMEResult {
	offset_plan: OffsetPlanItem[];
	total_trees: number;
	time_to_neutral_years: number;
	confidence_score: number;
	land_required_hectare: number;
	status?: "completed" | "infeasible" | "pending";
	ml_metadata?: {
		monte_carlo?: {
			mean_curve?: number[];
			p5_curve?: number[];
			p95_curve?: number[];
			curves?: MonteCarloResult;
			enabled?: boolean;
			trials?: number;
		};
	};
}

export interface TEMERunRecord {
	id: string;
	user_id: string;
	project_name: string;
	emission_kg: number;
	input_payload: TEMERequest;
	result: TEMEResult;
	total_trees: number;
	time_to_neutral_years: number;
	confidence_score: number;
	land_required_hectare: number;
	status: "completed" | "infeasible" | "pending";
	created_at: string;
}

export const VALID_SPECIES = [
	"Neem",
	"Peepal",
	"Bamboo",
	"Banyan",
	"Mango",
	"Acacia",
	"Teak",
	"Pongamia",
	"Jamun",
	"Tamarind",
	"Arjuna",
	"Moringa",
	"Casuarina",
	"Sheesham",
	"Khejri",
	"Amla",
	"Mahua",
	"Sal",
	"Eucalyptus",
	"Chir Pine",
] as const;

export const VALID_LOCATIONS = [
	// Tropical belt
	"Maharashtra",
	"Karnataka",
	"Tamil Nadu",
	"West Bengal",
	"Andhra Pradesh",
	"Odisha",
	"Chhattisgarh",
	"Jharkhand",
	// Semi-arid / Deccan
	"Telangana",
	// Arid
	"Gujarat",
	"Rajasthan",
	// Coastal
	"Kerala",
	"Goa",
	// Subtropical plains
	"Delhi NCR",
	"Uttar Pradesh",
	"Madhya Pradesh",
	"Bihar",
	"Punjab",
	"Haryana",
	// Himalayan
	"Himachal Pradesh",
	"Uttarakhand",
	"Jammu and Kashmir",
	// Northeastern
	"Assam",
	"Meghalaya",
] as const;

export const PROJECT_GOALS = [
	{ value: "", label: "No preference (balanced)" },
	{ value: "fastest_offset", label: "Fastest Carbon Offset" },
	{ value: "lowest_cost", label: "Lowest Planting Cost" },
	{ value: "drought_resilient", label: "Drought-Resilient Portfolio" },
	{ value: "native_species", label: "Native Species Only" },
	{ value: "biodiversity", label: "Maximum Biodiversity" },
] as const;

export const TEME_VALIDATION = {
	emission_kg: { min: 1, max: 1000000000 },
	time_horizon_years: { min: 5, max: 30 },
	max_land_area_hectare: { min: 0.01, max: 10000 },
} as const;

export function validateTEMERequest(payload: TEMERequest): string[] {
	const errors: string[] = [];

	if (
		payload.emission_kg < TEME_VALIDATION.emission_kg.min ||
		payload.emission_kg > TEME_VALIDATION.emission_kg.max
	) {
		errors.push(
			`emission_kg must be between ${TEME_VALIDATION.emission_kg.min} and ${TEME_VALIDATION.emission_kg.max}`
		);
	}

	if (
		payload.constraints.time_horizon_years < TEME_VALIDATION.time_horizon_years.min ||
		payload.constraints.time_horizon_years > TEME_VALIDATION.time_horizon_years.max
	) {
		errors.push(
			`time_horizon_years must be between ${TEME_VALIDATION.time_horizon_years.min} and ${TEME_VALIDATION.time_horizon_years.max}`
		);
	}

	if (
		payload.constraints.max_land_area_hectare < TEME_VALIDATION.max_land_area_hectare.min ||
		payload.constraints.max_land_area_hectare > TEME_VALIDATION.max_land_area_hectare.max
	) {
		errors.push(
			`max_land_area_hectare must be between ${TEME_VALIDATION.max_land_area_hectare.min} and ${TEME_VALIDATION.max_land_area_hectare.max}`
		);
	}

	return errors;
}
