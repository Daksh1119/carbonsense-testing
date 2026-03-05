"""
TEME Full Benchmark Runner

Runs ALL evaluation modules in sequence and produces a unified report.

Usage:
    python -m evaluation.run_full_benchmark

Modules executed:
    1. Survival Calibration (calibration/reliability.py)
    2. Suitability Constraints (evaluation/suitability_metrics.py)
    3. Time-Debt & Cost Realism (evaluation/time_debt_validation.py)
    4. Ranking Stability (evaluation/ranking_stability.py)
"""

import time
from typing import Dict


def run_full_benchmark() -> Dict:
    """
    Execute the complete TEME evaluation suite.
    Returns unified report dict.
    """
    print("\n" + "â–ˆ" * 70)
    print("â–ˆ" + " " * 68 + "â–ˆ")
    print("â–ˆ" + "  TEME FULL BENCHMARK SUITE".center(68) + "â–ˆ")
    print("â–ˆ" + "  CarbonSense â€” Validation Engineering Phase 1".center(68) + "â–ˆ")
    print("â–ˆ" + " " * 68 + "â–ˆ")
    print("â–ˆ" * 70 + "\n")

    overall_start = time.time()
    results = {}

    # ------------------------------------------------------------------
    # 1. Survival Calibration
    # ------------------------------------------------------------------
    print("\n" + "â”€" * 70)
    print("  BLOCK 1/4: SURVIVAL CALIBRATION")
    print("â”€" * 70)

    from ml_services.teme.calibration.reliability import run_full_calibration_report
    t0 = time.time()
    results["calibration"] = run_full_calibration_report()
    results["calibration"]["_runtime_sec"] = round(time.time() - t0, 3)

    # ------------------------------------------------------------------
    # 2. Suitability Constraints
    # ------------------------------------------------------------------
    print("\n" + "â”€" * 70)
    print("  BLOCK 2/4: SUITABILITY CONSTRAINTS")
    print("â”€" * 70)

    from ml_services.teme.evaluation.suitability_metrics import run_suitability_evaluation
    t0 = time.time()
    results["suitability"] = run_suitability_evaluation()
    results["suitability"]["_runtime_sec"] = round(time.time() - t0, 3)

    # ------------------------------------------------------------------
    # 3. Time-Debt & Cost Realism
    # ------------------------------------------------------------------
    print("\n" + "â”€" * 70)
    print("  BLOCK 3/4: TIME-DEBT & COST REALISM")
    print("â”€" * 70)

    from ml_services.teme.evaluation.time_debt_validation import run_time_debt_validation
    t0 = time.time()
    results["time_debt"] = run_time_debt_validation()
    results["time_debt"]["_runtime_sec"] = round(time.time() - t0, 3)

    # ------------------------------------------------------------------
    # 4. Ranking Stability
    # ------------------------------------------------------------------
    print("\n" + "â”€" * 70)
    print("  BLOCK 4/4: RANKING STABILITY")
    print("â”€" * 70)

    from ml_services.teme.evaluation.ranking_stability import run_ranking_stability_evaluation
    t0 = time.time()
    results["ranking_stability"] = run_ranking_stability_evaluation()
    results["ranking_stability"]["_runtime_sec"] = round(time.time() - t0, 3)

    # ------------------------------------------------------------------
    # Final Summary
    # ------------------------------------------------------------------
    total_time = round(time.time() - overall_start, 2)

    cal = results["calibration"]
    suit = results["suitability"]
    td = results["time_debt"]
    rs = results["ranking_stability"]

    brier_after = cal["post_calibration_per_species"]["brier_score_after"]
    ece_after = cal["post_calibration_per_species"]["ece_after"]
    cal_direction = cal["post_calibration_per_species"]["direction_after"]

    print("\n" + "â–ˆ" * 70)
    print("â–ˆ" + " " * 68 + "â–ˆ")
    print("â–ˆ" + "  BENCHMARK SUMMARY".center(68) + "â–ˆ")
    print("â–ˆ" + " " * 68 + "â–ˆ")
    print("â–ˆ" * 70)

    print(f"""
  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
  â”‚ Metric                      â”‚ Value        â”‚ Status   â”‚
  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
  â”‚ Brier Score (calibrated)    â”‚ {brier_after:<12.6f} â”‚ {'âœ… <0.01' if brier_after < 0.01 else 'âš ï¸  â‰¥0.01' if brier_after < 0.03 else 'âŒ â‰¥0.03':8s} â”‚
  â”‚ ECE (calibrated)            â”‚ {ece_after:<12.6f} â”‚ {'âœ… <0.02' if ece_after < 0.02 else 'âš ï¸  â‰¥0.02' if ece_after < 0.05 else 'âŒ â‰¥0.05':8s} â”‚
  â”‚ Calibration Direction       â”‚ {cal_direction:<12s} â”‚ {'âœ… OK   ' if cal_direction == 'well-calibrated' else 'âš ï¸  Bias ':8s} â”‚
  â”‚ Suitability Violation Rate  â”‚ {suit['violation_rate']:<12.4f} â”‚ {'âœ… = 0  ' if suit['meets_target'] else 'âŒ > 0  ':8s} â”‚
  â”‚ Time-Debt Pass Rate         â”‚ {td['pass_rate']*100:<11.1f}% â”‚ {'âœ… 100% ' if td['pass_rate'] == 1.0 else 'âš ï¸  <100%':8s} â”‚
  â”‚ Top-1 Ranking Consistency   â”‚ {rs['overall_top1_consistency']*100:<11.1f}% â”‚ {'âœ… â‰¥80% ' if rs['meets_top1_target'] else 'âŒ <80% ':8s} â”‚
  â”‚ Kendall Tau (avg)           â”‚ {rs['overall_avg_kendall_tau']:<12.4f} â”‚ {'âœ… â‰¥0.60' if rs['meets_tau_target'] else 'âŒ <0.60':8s} â”‚
  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

  Total runtime: {total_time}s
""")

    # Overall pass/fail
    all_pass = (
        brier_after < 0.03
        and ece_after < 0.05
        and suit["meets_target"]
        and td["pass_rate"] >= 0.75
        and rs["meets_top1_target"]
        and rs["meets_tau_target"]
    )

    if all_pass:
        print("  ðŸŸ¢ OVERALL: PASS â€” TEME is ready for Phase 2 (Monte Carlo)")
    else:
        print("  ðŸ”´ OVERALL: ISSUES DETECTED â€” Review failing metrics above")

    print(f"\n{'â–ˆ' * 70}\n")

    results["_overall"] = {
        "all_pass": all_pass,
        "total_runtime_sec": total_time,
    }

    return results


if __name__ == "__main__":
    run_full_benchmark()
