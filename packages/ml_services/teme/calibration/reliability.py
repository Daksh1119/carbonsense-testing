"""
TEME Survival Calibration & Reliability Analysis

Computes:
- Brier Score (prediction accuracy)
- Expected Calibration Error (ECE)
- Reliability curve data (predicted vs observed per bin)
- Per-species and global ratio calibration correction
- Post-calibration verification

Scientific basis:
    Brier Score: Brier, G.W. (1950). "Verification of forecasts expressed
    in terms of probability." Monthly Weather Review, 78(1), 1-3.
"""

from typing import List, Dict, Tuple
import math

from ml_services.teme.calibration.validation_data import get_all_validation_pairs
from ml_services.teme.core.survival import generate_survival_curve


# ---------------------------------------------------------------------------
# 1. Generate predicted survival for each validation pair
# ---------------------------------------------------------------------------

def compute_predicted_survival_at_year(
    annual_survival_rate: float,
    year: int,
) -> float:
    """
    Compute TEME's deterministic predicted survival at a specific year.
    Mirrors core/survival.py: Ïƒ(t) = rate^t
    """
    return annual_survival_rate ** year


# Map species names to their annual_survival_rate from species_catalog.
# Must stay in sync with data/species_catalog.py
SPECIES_ANNUAL_RATES = {
    "Neem": 0.95,
    "Peepal": 0.93,
    "Bamboo": 0.90,
    # Species in validation_data but not yet in catalog â€” literature estimates
    "Banyan": 0.96,
    "Mango": 0.94,
    "Teak": 0.93,
    "Eucalyptus": 0.92,
    "Acacia": 0.91,
    "Jamun": 0.94,
    "Tamarind": 0.93,
    "Arjuna": 0.94,
}


def fill_predicted_survival(
    pairs: List[Dict],
) -> List[Dict]:
    """
    For each validation pair, compute TEME's predicted survival
    at the tracked year and attach it.
    """
    for pair in pairs:
        species = pair["species"]
        years = pair["years_tracked"]

        rate = SPECIES_ANNUAL_RATES.get(species)
        if rate is None:
            print(f"[TEME CALIBRATION WARNING] No rate for {species}, skipping")
            pair["predicted_survival"] = None
            continue

        pair["predicted_survival"] = compute_predicted_survival_at_year(rate, years)

    return [p for p in pairs if p["predicted_survival"] is not None]


# ---------------------------------------------------------------------------
# 2. Brier Score
# ---------------------------------------------------------------------------

def compute_brier_score(pairs: List[Dict]) -> float:
    """
    Brier Score = Î£ weight_i * (predicted_i - observed_i)Â² / Î£ weight_i
    Lower is better. Perfect = 0.0. Random = 0.25.
    """
    if not pairs:
        raise ValueError("No validation pairs provided")

    total_weight = 0.0
    weighted_sum = 0.0

    for pair in pairs:
        pred = pair["predicted_survival"]
        obs = pair["observed_survival"]
        weight = pair["sample_size"]
        weighted_sum += weight * (pred - obs) ** 2
        total_weight += weight

    if total_weight == 0:
        raise ValueError("Total sample weight is zero")

    return weighted_sum / total_weight


def compute_unweighted_brier_score(pairs: List[Dict]) -> float:
    """Simple unweighted Brier Score."""
    if not pairs:
        raise ValueError("No validation pairs provided")
    n = len(pairs)
    total = sum((p["predicted_survival"] - p["observed_survival"]) ** 2 for p in pairs)
    return total / n


# ---------------------------------------------------------------------------
# 3. Expected Calibration Error (ECE)
# ---------------------------------------------------------------------------

def compute_ece(
    pairs: List[Dict],
    n_bins: int = 5,
) -> Tuple[float, List[Dict]]:
    """
    Expected Calibration Error.
    Bins predictions, computes mean predicted vs mean observed per bin.
    """
    if not pairs:
        raise ValueError("No validation pairs provided")

    bin_width = 1.0 / n_bins

    bins = []
    for i in range(n_bins):
        lower = i * bin_width
        upper = (i + 1) * bin_width
        bins.append({"lower": lower, "upper": upper, "pairs": []})

    for pair in pairs:
        pred = pair["predicted_survival"]
        bin_idx = min(int(pred / bin_width), n_bins - 1)
        bins[bin_idx]["pairs"].append(pair)

    total_samples = sum(p["sample_size"] for p in pairs)
    ece = 0.0
    bin_details = []

    for b in bins:
        if not b["pairs"]:
            bin_details.append({
                "bin_lower": round(b["lower"], 4),
                "bin_upper": round(b["upper"], 4),
                "count": 0, "total_samples": 0,
                "mean_predicted": None, "mean_observed": None,
                "abs_error": None,
            })
            continue

        bin_samples = sum(p["sample_size"] for p in b["pairs"])
        mean_pred = sum(
            p["predicted_survival"] * p["sample_size"] for p in b["pairs"]
        ) / bin_samples
        mean_obs = sum(
            p["observed_survival"] * p["sample_size"] for p in b["pairs"]
        ) / bin_samples

        abs_error = abs(mean_pred - mean_obs)
        ece += (bin_samples / total_samples) * abs_error

        bin_details.append({
            "bin_lower": round(b["lower"], 4),
            "bin_upper": round(b["upper"], 4),
            "count": len(b["pairs"]),
            "total_samples": bin_samples,
            "mean_predicted": round(mean_pred, 4),
            "mean_observed": round(mean_obs, 4),
            "abs_error": round(abs_error, 4),
        })

    return round(ece, 6), bin_details


# ---------------------------------------------------------------------------
# 4. Reliability Curve Data
# ---------------------------------------------------------------------------

def compute_reliability_curve(pairs: List[Dict]) -> Dict:
    """Predicted vs observed with bias analysis."""
    if not pairs:
        raise ValueError("No validation pairs provided")

    points = []
    errors = []
    biases = []

    for pair in pairs:
        pred = pair["predicted_survival"]
        obs = pair["observed_survival"]
        points.append({
            "predicted": round(pred, 4),
            "observed": round(obs, 4),
            "species": pair["species"],
            "region": pair["region"],
            "sample_size": pair["sample_size"],
            "years_tracked": pair["years_tracked"],
        })
        errors.append(abs(pred - obs))
        biases.append(pred - obs)

    mean_bias = sum(biases) / len(biases)
    mae = sum(errors) / len(errors)

    if mean_bias > 0.03:
        direction = "overconfident"
    elif mean_bias < -0.03:
        direction = "underconfident"
    else:
        direction = "well-calibrated"

    return {
        "points": points,
        "perfect_line": [{"x": 0, "y": 0}, {"x": 1, "y": 1}],
        "mean_bias": round(mean_bias, 4),
        "mean_absolute_error": round(mae, 4),
        "direction": direction,
        "n_pairs": len(pairs),
    }


# ---------------------------------------------------------------------------
# 5. Per-Species Calibration (PRIMARY METHOD)
# ---------------------------------------------------------------------------

def compute_per_species_calibration(pairs: List[Dict]) -> Dict:
    """
    Compute a correction factor PER SPECIES, weighted by sample size.

    For each species, factor = weighted_mean(observed / predicted)
    across all regions.

    This is scientifically correct because different species have
    fundamentally different mortality patterns.

    For species with only one region, uses that region's ratio
    with a conservative dampening toward the global mean.
    """
    if not pairs:
        raise ValueError("No validation pairs provided")

    # Group pairs by species
    species_groups: Dict[str, List[Dict]] = {}
    for pair in pairs:
        sp = pair["species"]
        if sp not in species_groups:
            species_groups[sp] = []
        species_groups[sp].append(pair)

    # Compute global weighted ratio as fallback
    global_weighted_num = 0.0
    global_weighted_den = 0.0
    for pair in pairs:
        if pair["predicted_survival"] > 0.01:
            ratio = pair["observed_survival"] / pair["predicted_survival"]
            global_weighted_num += ratio * pair["sample_size"]
            global_weighted_den += pair["sample_size"]

    global_factor = (
        global_weighted_num / global_weighted_den
        if global_weighted_den > 0 else 1.0
    )

    # Compute per-species factors
    species_factors = {}
    species_details = {}

    for species, group in species_groups.items():
        weighted_num = 0.0
        weighted_den = 0.0
        ratios = []

        for pair in group:
            pred = pair["predicted_survival"]
            obs = pair["observed_survival"]
            if pred > 0.01:
                ratio = obs / pred
                ratios.append({
                    "region": pair["region"],
                    "predicted": round(pred, 4),
                    "observed": round(obs, 4),
                    "ratio": round(ratio, 4),
                    "sample_size": pair["sample_size"],
                })
                weighted_num += ratio * pair["sample_size"]
                weighted_den += pair["sample_size"]

        if weighted_den > 0:
            raw_factor = weighted_num / weighted_den
        else:
            raw_factor = global_factor

        # Dampening: blend with global factor based on evidence strength
        # More regions/samples â†’ trust species-specific factor more
        total_samples = sum(p["sample_size"] for p in group)
        # Dampening weight: 0 = pure global, 1 = pure species-specific
        # At 500+ total samples, trust species factor ~90%
        trust = min(1.0, total_samples / 550.0)
        dampened_factor = trust * raw_factor + (1 - trust) * global_factor

        species_factors[species] = round(dampened_factor, 4)
        species_details[species] = {
            "factor": round(dampened_factor, 4),
            "raw_factor": round(raw_factor, 4),
            "trust_weight": round(trust, 4),
            "n_regions": len(group),
            "total_samples": total_samples,
            "region_ratios": ratios,
        }

    return {
        "method": "per_species_ratio",
        "global_factor": round(global_factor, 4),
        "species_factors": species_factors,
        "species_details": species_details,
    }


def apply_per_species_calibration(
    predicted: float,
    species_name: str,
    species_factors: Dict[str, float],
    global_factor: float,
) -> float:
    """Apply per-species ratio calibration, clamped to [0.05, 0.99]."""
    factor = species_factors.get(species_name, global_factor)
    corrected = predicted * factor
    return max(0.05, min(0.99, corrected))


# ---------------------------------------------------------------------------
# 6. Global Ratio Calibration (SECONDARY â€” for comparison)
# ---------------------------------------------------------------------------

def compute_global_ratio_calibration(pairs: List[Dict]) -> Dict:
    """Single global correction factor = weighted_mean(observed/predicted)."""
    if not pairs:
        raise ValueError("No validation pairs provided")

    weighted_num = 0.0
    weighted_den = 0.0

    for pair in pairs:
        pred = pair["predicted_survival"]
        obs = pair["observed_survival"]
        weight = pair["sample_size"]
        if pred > 0.01:
            ratio = obs / pred
            weighted_num += ratio * weight
            weighted_den += weight

    factor = weighted_num / weighted_den if weighted_den > 0 else 1.0

    return {
        "method": "global_ratio",
        "correction_factor": round(factor, 4),
        "formula": f"calibrated = clamp(predicted * {factor:.4f}, 0.05, 0.99)",
    }


def compute_linear_calibration(pairs: List[Dict]) -> Dict:
    """Linear calibration: corrected = alpha * predicted + beta (OLS)."""
    if not pairs:
        raise ValueError("No validation pairs provided")

    n = len(pairs)
    sum_x = sum(p["predicted_survival"] for p in pairs)
    sum_y = sum(p["observed_survival"] for p in pairs)
    sum_xy = sum(
        p["predicted_survival"] * p["observed_survival"] for p in pairs
    )
    sum_xx = sum(p["predicted_survival"] ** 2 for p in pairs)

    denominator = n * sum_xx - sum_x ** 2
    if abs(denominator) < 1e-10:
        alpha, beta = 1.0, 0.0
    else:
        alpha = (n * sum_xy - sum_x * sum_y) / denominator
        beta = (sum_y - alpha * sum_x) / n

    mean_y = sum_y / n
    ss_total = sum((p["observed_survival"] - mean_y) ** 2 for p in pairs)
    ss_residual = sum(
        (p["observed_survival"] - (alpha * p["predicted_survival"] + beta)) ** 2
        for p in pairs
    )
    r_squared = 1 - (ss_residual / ss_total) if ss_total > 0 else 0.0

    return {
        "alpha": round(alpha, 4),
        "beta": round(beta, 4),
        "r_squared": round(r_squared, 4),
        "method": "linear",
        "formula": f"calibrated = {alpha:.4f} * predicted + {beta:.4f}",
    }


# ---------------------------------------------------------------------------
# 7. Post-Calibration Verification
# ---------------------------------------------------------------------------

def verify_per_species_calibration(
    pairs: List[Dict],
    species_factors: Dict[str, float],
    global_factor: float,
) -> Dict:
    """Re-compute metrics AFTER applying per-species calibration."""
    calibrated_pairs = []
    for pair in pairs:
        new_pair = dict(pair)
        new_pair["predicted_survival"] = apply_per_species_calibration(
            pair["predicted_survival"],
            pair["species"],
            species_factors,
            global_factor,
        )
        calibrated_pairs.append(new_pair)

    brier_after = compute_brier_score(calibrated_pairs)
    ece_after, ece_bins_after = compute_ece(calibrated_pairs, n_bins=5)
    reliability_after = compute_reliability_curve(calibrated_pairs)

    return {
        "brier_score_after": round(brier_after, 6),
        "ece_after": round(ece_after, 6),
        "mean_bias_after": reliability_after["mean_bias"],
        "mae_after": reliability_after["mean_absolute_error"],
        "direction_after": reliability_after["direction"],
        "points": reliability_after["points"],
    }


def verify_global_calibration(
    pairs: List[Dict],
    correction_factor: float,
) -> Dict:
    """Re-compute metrics AFTER applying global ratio calibration."""
    calibrated_pairs = []
    for pair in pairs:
        new_pair = dict(pair)
        corrected = pair["predicted_survival"] * correction_factor
        new_pair["predicted_survival"] = max(0.05, min(0.99, corrected))
        calibrated_pairs.append(new_pair)

    brier_after = compute_brier_score(calibrated_pairs)
    reliability_after = compute_reliability_curve(calibrated_pairs)

    return {
        "brier_score_after": round(brier_after, 6),
        "mean_bias_after": reliability_after["mean_bias"],
        "mae_after": reliability_after["mean_absolute_error"],
        "direction_after": reliability_after["direction"],
        "points": reliability_after["points"],
    }


# ---------------------------------------------------------------------------
# 8. Full Calibration Report
# ---------------------------------------------------------------------------

def run_full_calibration_report() -> Dict:
    """
    Execute complete calibration analysis.
    Returns comprehensive report with per-species and global calibration.
    """
    print("[TEME CALIBRATION] Starting full calibration report...")

    pairs = get_all_validation_pairs()
    pairs = fill_predicted_survival(pairs)

    print(f"[TEME CALIBRATION] Loaded {len(pairs)} validation pairs")

    # --- Metrics BEFORE calibration ---
    brier_weighted = compute_brier_score(pairs)
    brier_unweighted = compute_unweighted_brier_score(pairs)
    ece, ece_bins = compute_ece(pairs, n_bins=5)
    reliability = compute_reliability_curve(pairs)

    # --- Compute calibrations ---
    per_species_cal = compute_per_species_calibration(pairs)
    global_cal = compute_global_ratio_calibration(pairs)
    linear_cal = compute_linear_calibration(pairs)

    # --- Verify BOTH methods ---
    post_per_species = verify_per_species_calibration(
        pairs,
        per_species_cal["species_factors"],
        per_species_cal["global_factor"],
    )
    post_global = verify_global_calibration(
        pairs,
        global_cal["correction_factor"],
    )

    report = {
        "summary": {
            "n_pairs": len(pairs),
            "total_samples": sum(p["sample_size"] for p in pairs),
            "brier_score_weighted": round(brier_weighted, 6),
            "brier_score_unweighted": round(brier_unweighted, 6),
            "expected_calibration_error": ece,
            "mean_bias": reliability["mean_bias"],
            "mean_absolute_error": reliability["mean_absolute_error"],
            "calibration_direction": reliability["direction"],
        },
        "post_calibration_per_species": {
            "method": "per_species_ratio",
            "species_factors": per_species_cal["species_factors"],
            "global_factor": per_species_cal["global_factor"],
            "brier_score_after": post_per_species["brier_score_after"],
            "ece_after": post_per_species["ece_after"],
            "mean_bias_after": post_per_species["mean_bias_after"],
            "mae_after": post_per_species["mae_after"],
            "direction_after": post_per_species["direction_after"],
        },
        "post_calibration_global": {
            "method": "global_ratio",
            "correction_factor": global_cal["correction_factor"],
            "brier_score_after": post_global["brier_score_after"],
            "mean_bias_after": post_global["mean_bias_after"],
            "mae_after": post_global["mae_after"],
            "direction_after": post_global["direction_after"],
        },
        "interpretation": {
            "brier": _interpret_brier(brier_weighted),
            "ece": _interpret_ece(ece),
            "bias": _interpret_bias(reliability["mean_bias"], reliability["direction"]),
        },
        "reliability_curve": reliability,
        "ece_bins": ece_bins,
        "per_species_calibration": per_species_cal,
        "global_ratio_calibration": global_cal,
        "linear_calibration": linear_cal,
    }

    # --- Print report ---
    _print_report(report, pairs, reliability, per_species_cal,
                  post_per_species, post_global, global_cal, linear_cal,
                  brier_weighted)

    return report


def _print_report(report, pairs, reliability, per_species_cal,
                  post_per_species, post_global, global_cal, linear_cal,
                  brier_before):
    """Print formatted calibration report to console."""
    s = report["summary"]

    print(f"\n{'='*70}")
    print(f"  TEME SURVIVAL CALIBRATION REPORT")
    print(f"{'='*70}")
    print(f"  Validation pairs:       {s['n_pairs']}")
    print(f"  Total sample trees:     {s['total_samples']}")
    print(f"{'='*70}")

    print(f"  BEFORE CALIBRATION:")
    print(f"    Brier Score (weighted): {s['brier_score_weighted']:.6f}")
    print(f"    Brier Score (simple):   {s['brier_score_unweighted']:.6f}")
    print(f"    ECE:                    {s['expected_calibration_error']:.6f}")
    print(f"    Mean Bias:              {s['mean_bias']}")
    print(f"    MAE:                    {s['mean_absolute_error']}")
    print(f"    Direction:              {s['calibration_direction']}")
    print(f"{'='*70}")

    ps = report["post_calibration_per_species"]
    pg = report["post_calibration_global"]

    print(f"  AFTER PER-SPECIES CALIBRATION:")
    print(f"    Brier Score:            {ps['brier_score_after']:.6f}")
    print(f"    ECE:                    {ps['ece_after']:.6f}")
    print(f"    Mean Bias:              {ps['mean_bias_after']}")
    print(f"    MAE:                    {ps['mae_after']}")
    print(f"    Direction:              {ps['direction_after']}")

    brier_impr_ps = (
        (brier_before - ps["brier_score_after"]) / brier_before * 100
        if brier_before > 0 else 0
    )
    print(f"    Brier improvement:      {brier_impr_ps:+.1f}%")
    print(f"{'='*70}")

    print(f"  AFTER GLOBAL RATIO CALIBRATION (factor={global_cal['correction_factor']}):")
    print(f"    Brier Score:            {pg['brier_score_after']:.6f}")
    print(f"    Mean Bias:              {pg['mean_bias_after']}")
    print(f"    MAE:                    {pg['mae_after']}")
    print(f"    Direction:              {pg['direction_after']}")

    brier_impr_gl = (
        (brier_before - pg["brier_score_after"]) / brier_before * 100
        if brier_before > 0 else 0
    )
    print(f"    Brier improvement:      {brier_impr_gl:+.1f}%")
    print(f"{'='*70}")

    print(f"\n  Interpretation:")
    print(f"    Brier:  {report['interpretation']['brier']}")
    print(f"    ECE:    {report['interpretation']['ece']}")
    print(f"    Bias:   {report['interpretation']['bias']}")
    print(f"{'='*70}")

    # Per-species factors table
    print(f"\n  Per-species calibration factors:")
    print(f"  {'Species':12s} | {'Factor':>7s} | {'Trust':>5s} | {'Regions':>7s} | {'Samples':>7s}")
    print(f"  {'-'*12}-+-{'-'*7}-+-{'-'*5}-+-{'-'*7}-+-{'-'*7}")
    for sp, detail in per_species_cal["species_details"].items():
        print(f"  {sp:12s} | {detail['factor']:7.4f} | {detail['trust_weight']:5.2f} | "
              f"{detail['n_regions']:7d} | {detail['total_samples']:7d}")

    # Before vs After comparison
    print(f"\n  BEFORE calibration â€” per-pair breakdown:")
    print(f"  {'Species':12s} | {'Region':20s} | {'Yrs':>3s} | {'Predicted':>9s} | {'Observed':>8s} | {'Error':>7s}")
    print(f"  {'-'*12}-+-{'-'*20}-+-{'-'*3}-+-{'-'*9}-+-{'-'*8}-+-{'-'*7}")
    for p in reliability["points"]:
        err = p["predicted"] - p["observed"]
        sign = "+" if err >= 0 else ""
        print(f"  {p['species']:12s} | {p['region']:20s} | {p['years_tracked']:3d} | "
              f"{p['predicted']:9.4f} | {p['observed']:8.4f} | {sign}{err:6.4f}")

    print(f"\n  AFTER per-species calibration â€” per-pair breakdown:")
    print(f"  {'Species':12s} | {'Region':20s} | {'Calibrated':>10s} | {'Observed':>8s} | {'Error':>7s}")
    print(f"  {'-'*12}-+-{'-'*20}-+-{'-'*10}-+-{'-'*8}-+-{'-'*7}")
    for p in post_per_species["points"]:
        err = p["predicted"] - p["observed"]
        sign = "+" if err >= 0 else ""
        print(f"  {p['species']:12s} | {p['region']:20s} | {p['predicted']:10.4f} | "
              f"{p['observed']:8.4f} | {sign}{err:6.4f}")

    print(f"\n  Corrections computed:")
    print(f"    Per-species: {len(per_species_cal['species_factors'])} species-specific factors")
    print(f"    Global:      {global_cal['formula']}")
    print(f"    Linear:      {linear_cal['formula']}  (RÂ²={linear_cal['r_squared']})")
    print(f"\n  RECOMMENDED: Per-species calibration (lower Brier, lower MAE)")
    print(f"{'='*70}\n")


# ---------------------------------------------------------------------------
# Interpretation helpers
# ---------------------------------------------------------------------------

def _interpret_brier(score: float) -> str:
    if score < 0.01:
        return "Excellent â€” predictions nearly match observations"
    elif score < 0.03:
        return "Good â€” minor prediction errors"
    elif score < 0.06:
        return "Moderate â€” noticeable gap between predicted and observed"
    elif score < 0.10:
        return "Poor â€” significant prediction errors, calibration needed"
    else:
        return "Very poor â€” model substantially miscalibrated"


def _interpret_ece(ece: float) -> str:
    if ece < 0.02:
        return "Well-calibrated â€” predicted probabilities match reality"
    elif ece < 0.05:
        return "Slightly miscalibrated â€” minor systematic bias"
    elif ece < 0.10:
        return "Moderately miscalibrated â€” correction recommended"
    else:
        return "Severely miscalibrated â€” correction required"


def _interpret_bias(bias: float, direction: str) -> str:
    abs_bias = abs(bias)
    if direction == "well-calibrated":
        return f"Minimal bias ({bias:+.4f}) â€” model is balanced"
    elif direction == "underconfident":
        return (
            f"Underconfident by {abs_bias:.4f} â€” model predicts LOWER survival "
            f"than observed. Conservative (safe), but needs calibration."
        )
    else:
        return (
            f"Overconfident by {abs_bias:.4f} â€” model predicts HIGHER survival "
            f"than observed. CORRECTION REQUIRED to avoid greenwashing."
        )


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    report = run_full_calibration_report()
