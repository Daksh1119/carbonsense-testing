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
    print("\n" + "█" * 70)
    print("█" + " " * 68 + "█")
    print("█" + "  TEME FULL BENCHMARK SUITE".center(68) + "█")
    print("█" + "  CarbonSense — Validation Engineering Phase 1".center(68) + "█")
    print("█" + " " * 68 + "█")
    print("█" * 70 + "\n")

    overall_start = time.time()
    results = {}

    # ------------------------------------------------------------------
    # 1. Survival Calibration
    # ------------------------------------------------------------------
    print("\n" + "─" * 70)
    print("  BLOCK 1/4: SURVIVAL CALIBRATION")
    print("─" * 70)

    from teme.calibration.reliability import run_full_calibration_report
    t0 = time.time()
    results["calibration"] = run_full_calibration_report()
    results["calibration"]["_runtime_sec"] = round(time.time() - t0, 3)

    # ------------------------------------------------------------------
    # 2. Suitability Constraints
    # ------------------------------------------------------------------
    print("\n" + "─" * 70)
    print("  BLOCK 2/4: SUITABILITY CONSTRAINTS")
    print("─" * 70)

    from teme.evaluation.suitability_metrics import run_suitability_evaluation
    t0 = time.time()
    results["suitability"] = run_suitability_evaluation()
    results["suitability"]["_runtime_sec"] = round(time.time() - t0, 3)

    # ------------------------------------------------------------------
    # 3. Time-Debt & Cost Realism
    # ------------------------------------------------------------------
    print("\n" + "─" * 70)
    print("  BLOCK 3/4: TIME-DEBT & COST REALISM")
    print("─" * 70)

    from teme.evaluation.time_debt_validation import run_time_debt_validation
    t0 = time.time()
    results["time_debt"] = run_time_debt_validation()
    results["time_debt"]["_runtime_sec"] = round(time.time() - t0, 3)

    # ------------------------------------------------------------------
    # 4. Ranking Stability
    # ------------------------------------------------------------------
    print("\n" + "─" * 70)
    print("  BLOCK 4/4: RANKING STABILITY")
    print("─" * 70)

    from teme.evaluation.ranking_stability import run_ranking_stability_evaluation
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

    print("\n" + "█" * 70)
    print("█" + " " * 68 + "█")
    print("█" + "  BENCHMARK SUMMARY".center(68) + "█")
    print("█" + " " * 68 + "█")
    print("█" * 70)

    print(f"""
  ┌─────────────────────────────┬──────────────┬──────────┐
  │ Metric                      │ Value        │ Status   │
  ├─────────────────────────────┼──────────────┼──────────┤
  │ Brier Score (calibrated)    │ {brier_after:<12.6f} │ {'✅ <0.01' if brier_after < 0.01 else '⚠️  ≥0.01' if brier_after < 0.03 else '❌ ≥0.03':8s} │
  │ ECE (calibrated)            │ {ece_after:<12.6f} │ {'✅ <0.02' if ece_after < 0.02 else '⚠️  ≥0.02' if ece_after < 0.05 else '❌ ≥0.05':8s} │
  │ Calibration Direction       │ {cal_direction:<12s} │ {'✅ OK   ' if cal_direction == 'well-calibrated' else '⚠️  Bias ':8s} │
  │ Suitability Violation Rate  │ {suit['violation_rate']:<12.4f} │ {'✅ = 0  ' if suit['meets_target'] else '❌ > 0  ':8s} │
  │ Time-Debt Pass Rate         │ {td['pass_rate']*100:<11.1f}% │ {'✅ 100% ' if td['pass_rate'] == 1.0 else '⚠️  <100%':8s} │
  │ Top-1 Ranking Consistency   │ {rs['overall_top1_consistency']*100:<11.1f}% │ {'✅ ≥80% ' if rs['meets_top1_target'] else '❌ <80% ':8s} │
  │ Kendall Tau (avg)           │ {rs['overall_avg_kendall_tau']:<12.4f} │ {'✅ ≥0.60' if rs['meets_tau_target'] else '❌ <0.60':8s} │
  └─────────────────────────────┴──────────────┴──────────┘

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
        print("  🟢 OVERALL: PASS — TEME is ready for Phase 2 (Monte Carlo)")
    else:
        print("  🔴 OVERALL: ISSUES DETECTED — Review failing metrics above")

    print(f"\n{'█' * 70}\n")

    results["_overall"] = {
        "all_pass": all_pass,
        "total_runtime_sec": total_time,
    }

    return results


if __name__ == "__main__":
    run_full_benchmark()