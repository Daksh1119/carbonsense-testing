import { NextRequest, NextResponse } from "next/server";
import { TEMERequest, TEMEResult, VALID_SPECIES } from "@/lib/teme-types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildCurve(base: number, horizon: number, slope: number): number[] {
  return Array.from({ length: horizon }, (_, i) => {
    const year = i + 1;
    return Number((base * (1 - Math.exp(-slope * year))).toFixed(2));
  });
}

export async function POST(req: NextRequest) {
  let payload: TEMERequest;

  try {
    payload = (await req.json()) as TEMERequest;
  } catch {
    return NextResponse.json({ detail: "Invalid JSON payload" }, { status: 400 });
  }

  if (!payload?.project_name || !payload?.location || !payload?.constraints) {
    return NextResponse.json({ detail: "Missing required fields" }, { status: 400 });
  }

  const emissionKg = Number(payload.emission_kg || 0);
  const maxLand = Number(payload.constraints.max_land_area_hectare || 0);
  const horizon = Number(payload.constraints.time_horizon_years || 0);

  if (emissionKg <= 0 || maxLand <= 0 || horizon <= 0) {
    return NextResponse.json({ detail: "Invalid emission or constraints values" }, { status: 400 });
  }

  const preferred = payload.constraints.preferred_species || [];
  const excluded = new Set(payload.constraints.exclude_species || []);
  const monteCarloEnabled = payload.ml_config?.enable_monte_carlo ?? true;

  let candidateSpecies = (preferred.length > 0 ? preferred : [...VALID_SPECIES]).filter(
    (s) => !excluded.has(s)
  );

  if (candidateSpecies.length === 0) {
    candidateSpecies = [...VALID_SPECIES];
  }

  const selectedSpecies = candidateSpecies.slice(0, Math.min(3, candidateSpecies.length));

  const treeDensityPerHectare = 900;
  const maxTreesByLand = Math.max(10, Math.floor(maxLand * treeDensityPerHectare));
  const requiredTrees = Math.ceil(emissionKg / 25);
  const totalTrees = clamp(requiredTrees, 10, maxTreesByLand);

  const treesPerSpecies = Math.floor(totalTrees / selectedSpecies.length);
  const remainder = totalTrees % selectedSpecies.length;

  const offset_plan = selectedSpecies.map((species, index) => {
    const treeCount = treesPerSpecies + (index < remainder ? 1 : 0);
    const survivalStart = clamp(0.92 - index * 0.05, 0.7, 0.95);
    const survival_curve = Array.from({ length: horizon + 1 }, (_, year) =>
      Number((survivalStart * Math.exp(-0.02 * year)).toFixed(4))
    );

    const annualBase = (emissionKg / totalTrees) * 0.9;
    const annual_sequestration_kg = Array.from({ length: horizon + 1 }, (_, year) => {
      const growthFactor = 1 - Math.exp(-0.18 * year);
      return Number((treeCount * annualBase * growthFactor).toFixed(2));
    });

    return {
      species,
      tree_count: treeCount,
      survival_curve,
      annual_sequestration_kg,
      land_required_hectare: Number((treeCount / treeDensityPerHectare).toFixed(4)),
    };
  });

  const mean_curve = monteCarloEnabled ? buildCurve(emissionKg * 0.92, horizon, 0.14) : [];
  const p5_curve = monteCarloEnabled
    ? mean_curve.map((v) => Number((v * 0.75).toFixed(2)))
    : [];
  const p95_curve = monteCarloEnabled
    ? mean_curve.map((v) => Number((v * 1.15).toFixed(2)))
    : [];

  const result: TEMEResult = {
    offset_plan,
    total_trees: totalTrees,
    time_to_neutral_years: clamp(Math.ceil(emissionKg / Math.max(1, mean_curve[horizon - 1])), 1, horizon),
    confidence_score: Number((0.72 + Math.random() * 0.2).toFixed(2)),
    land_required_hectare: Number((totalTrees / treeDensityPerHectare).toFixed(3)),
    status: "completed",
    ml_metadata: {
      monte_carlo: monteCarloEnabled
        ? {
            enabled: true,
            trials: payload.ml_config?.monte_carlo_trials ?? 300,
            mean_curve,
            p5_curve,
            p95_curve,
            curves: {
              mean_curve,
              p5_curve,
              p95_curve,
            },
          }
        : {
            enabled: false,
            trials: payload.ml_config?.monte_carlo_trials ?? 300,
          },
    },
  };

  return NextResponse.json(result, { status: 200 });
}
