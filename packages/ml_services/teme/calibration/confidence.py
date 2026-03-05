"""
TEME Survival Confidence Intervals

Uses Beta distribution to model survival probability uncertainty.

Scientific basis:
    The Beta distribution is the conjugate prior for binomial observations.
    Given n planted trees and k survivors:
        alpha = k + 1 (successes + prior)
        beta  = (n - k) + 1 (failures + prior)
        Mean  = alpha / (alpha + beta)
"""

import math
from typing import Dict, Optional


def beta_mean(alpha: float, beta: float) -> float:
    """Mean of Beta(alpha, beta) distribution."""
    return alpha / (alpha + beta)


def beta_variance(alpha: float, beta: float) -> float:
    """Variance of Beta(alpha, beta) distribution."""
    total = alpha + beta
    return (alpha * beta) / (total ** 2 * (total + 1))


def beta_percentile(alpha: float, beta: float, p: float) -> float:
    """
    Approximate percentile of Beta distribution using
    Normal approximation (valid when alpha, beta > 5).
    """
    mean = beta_mean(alpha, beta)
    var = beta_variance(alpha, beta)
    std = math.sqrt(var) if var > 0 else 0.01

    z_map = {
        0.05: -1.645,
        0.10: -1.282,
        0.25: -0.674,
        0.50: 0.0,
        0.75: 0.674,
        0.90: 1.282,
        0.95: 1.645,
    }

    z = z_map.get(p)
    if z is None:
        if p < 0.5:
            z = -1.645 * (0.5 - p) / 0.45
        else:
            z = 1.645 * (p - 0.5) / 0.45

    value = mean + z * std
    return max(0.01, min(0.99, value))


def compute_survival_confidence(
    predicted_survival: float,
    sample_size: int,
    calibration_factor: float = 1.0,
) -> Dict:
    """
    Compute confidence band for a survival prediction.

    Args:
        predicted_survival: TEME's raw point prediction (0-1)
        sample_size: number of trees in validation data for this species
        calibration_factor: per-species ratio correction
    """
    calibrated = predicted_survival * calibration_factor
    calibrated = max(0.05, min(0.99, calibrated))

    k = int(calibrated * sample_size)
    n = sample_size

    alpha = k + 1
    beta_param = (n - k) + 1

    mean = beta_mean(alpha, beta_param)
    var = beta_variance(alpha, beta_param)
    std = math.sqrt(var) if var > 0 else 0.01

    return {
        "point_prediction": round(predicted_survival, 4),
        "calibrated_prediction": round(calibrated, 4),
        "mean": round(mean, 4),
        "std": round(std, 4),
        "p5": round(beta_percentile(alpha, beta_param, 0.05), 4),
        "p10": round(beta_percentile(alpha, beta_param, 0.10), 4),
        "p25": round(beta_percentile(alpha, beta_param, 0.25), 4),
        "p50": round(beta_percentile(alpha, beta_param, 0.50), 4),
        "p75": round(beta_percentile(alpha, beta_param, 0.75), 4),
        "p90": round(beta_percentile(alpha, beta_param, 0.90), 4),
        "p95": round(beta_percentile(alpha, beta_param, 0.95), 4),
        "beta_alpha": alpha,
        "beta_beta": beta_param,
        "sample_size": sample_size,
    }


def compute_confidence_for_species(
    species_name: str,
    predicted_survival: float,
    calibration_factor: float = 1.0,
) -> Dict:
    """
    Compute confidence band using ground truth sample size for a species.
    Falls back to default sample_size=100 if species not in validation data.
    """
    from ml_services.teme.calibration.validation_data import get_species_ground_truth

    ground_truth = get_species_ground_truth(species_name)

    if ground_truth:
        total_samples = sum(r["sample_size"] for r in ground_truth.values())
        n_regions = len(ground_truth)
        avg_sample = total_samples // n_regions
    else:
        print(f"[TEME CALIBRATION WARNING] No ground truth for {species_name}, "
              f"using default sample_size=100")
        avg_sample = 100

    result = compute_survival_confidence(
        predicted_survival=predicted_survival,
        sample_size=avg_sample,
        calibration_factor=calibration_factor,
    )
    result["species"] = species_name
    return result


# Cache for calibration factors to avoid recomputing
_calibration_cache: Optional[Dict] = None


def get_calibration_factors() -> Dict:
    """
    Run calibration and return per-species factors + global fallback.
    Cached after first call.
    """
    global _calibration_cache
    if _calibration_cache is None:
        from ml_services.teme.calibration.reliability import run_full_calibration_report
        report = run_full_calibration_report()
        _calibration_cache = {
            "species_factors": report["post_calibration_per_species"]["species_factors"],
            "global_factor": report["per_species_calibration"]["global_factor"],
        }
    return _calibration_cache


def get_factor_for_species(species_name: str) -> float:
    """Get calibration factor for a specific species."""
    cal = get_calibration_factors()
    return cal["species_factors"].get(species_name, cal["global_factor"])


# ---------------------------------------------------------------------------
# CLI test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from ml_services.teme.calibration.reliability import run_full_calibration_report

    report = run_full_calibration_report()
    sp_factors = report["post_calibration_per_species"]["species_factors"]
    global_factor = report["per_species_calibration"]["global_factor"]

    print(f"\n[TEME CONFIDENCE] Per-species calibration factors:")
    for sp, f in sp_factors.items():
        print(f"  {sp:12s}: {f}")
    print(f"  {'(global)':12s}: {global_factor}")

    print(f"\n[TEME CONFIDENCE] Testing confidence intervals...\n")

    test_cases = [
        ("Neem", 0.5987),      # 0.95^10
        ("Peepal", 0.4840),    # 0.93^10
        ("Bamboo", 0.3487),    # 0.90^8
        ("Mango", 0.5386),     # 0.94^10
        ("Teak", 0.3367),      # 0.93^15
    ]

    for species, pred in test_cases:
        factor = sp_factors.get(species, global_factor)
        result = compute_confidence_for_species(species, pred, calibration_factor=factor)
        print(f"  {species}:")
        print(f"    Raw prediction:    {result['point_prediction']}")
        print(f"    Factor applied:    {factor}")
        print(f"    After calibration: {result['calibrated_prediction']}")
        print(f"    90% CI:            [{result['p5']}, {result['p95']}]")
        print(f"    Std:               {result['std']}")
        print(f"    Sample size:       {result['sample_size']}")
        print()
