"""
TEME Full Benchmark Runner

Executes all evaluation modules and produces a comprehensive
metric report. This is the single command that proves TEME
is scientifically defensible.

Run: python -m tests.evaluation.run_full_benchmark
"""

import sys
import time
from typing import Dict

from tests.evaluation.suitability_metrics import run_suitability_evaluation
from tests.evaluation.time_debt_validation import run_time_debt_validation
from tests.evaluation.ranking_stability import run_ranking_stability
from tests.evaluation.cost_realism import run_cost_realism
from tests.evaluation.edge_cases import run_edge_case_tests
from teme.calibration.reliability import run_full_calibration_report


def run_full_benchmark() -> Dict:
    """Execute all evaluation modules and produce report."""
    start_time = time.time()

    print("\n" + "█" * 70)
    print("█" + " " * 68 + "█")
    print("█" + "  TEME FORMAL EVALUATION SUITE — FULL BENCHMARK".center(68) + "█")
    print("█" + " " * 68 + "█")
    print("█" * 70)

    all_results = {}
    pass_count = 0
    fail_count = 0

    # ===================================================================
    # 1. SUITABILITY VIOLATION RATE
    # ===================================================================
    print(f"\n{'─'*70}")
    print(f"  [1/6] SUITABILITY VIOLATION RATE")
    print(f"{'─'*70}")
    try:
        suit = run_suitability_evaluation()
        all_results["suitability"] = suit

        status = "✅ PASS" if suit["passed"] else "❌ FAIL"
        print(f"\n  Result: {status}")
        print(f"  Violation rate: {suit['violation_rate']*100:.2f}% "
              f"(target: 0.00%)")
        print(f"  Test cases: {suit['total_test_cases']} | "
              f"Recommendations: {suit['total_recommendations']} | "
              f"Violations: {suit['total_violations']}")

        for r in suit["results"]:
            icon = "✅" if r["status"] == "PASS" else "❌" if r["status"] == "FAIL" else "⚠️"
            print(f"    {icon} {r['name']}: {r['species_recommended']}")
            for v in r.get("violations", []):
                print(f"       ❌ {v}")

        if suit["passed"]:
            pass_count += 1
        else:
            fail_count += 1

    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        all_results["suitability"] = {"error": str(e), "passed": False}
        fail_count += 1

    # ===================================================================
    # 2. SURVIVAL CALIBRATION (Brier + ECE)
    # ===================================================================
    print(f"\n{'─'*70}")
    print(f"  [2/6] SURVIVAL CALIBRATION (Brier Score + ECE)")
    print(f"{'─'*70}")
    try:
        cal_report = run_full_calibration_report()
        s = cal_report["summary"]
        ps = cal_report["post_calibration_per_species"]

        brier_before = s["brier_score_weighted"]
        brier_after = ps["brier_score_after"]
        ece_after = ps["ece_after"]

        # Pass if post-calibration Brier < 0.01 and ECE < 0.02
        calibration_passed = brier_after < 0.01 and ece_after < 0.02

        all_results["calibration"] = {
            "brier_before": brier_before,
            "brier_after": brier_after,
            "ece_before": s["expected_calibration_error"],
            "ece_after": ece_after,
            "bias_before": s["mean_bias"],
            "bias_after": ps["mean_bias_after"],
            "direction_after": ps["direction_after"],
            "improvement_pct": round(
                (brier_before - brier_after) / brier_before * 100, 1
            ) if brier_before > 0 else 0,
            "passed": calibration_passed,
        }

        status = "✅ PASS" if calibration_passed else "❌ FAIL"
        print(f"\n  Result: {status}")
        print(f"  Brier: {brier_before:.6f} → {brier_after:.6f} "
              f"(target: < 0.01)")
        print(f"  ECE:   {s['expected_calibration_error']:.6f} → "
              f"{ece_after:.6f} (target: < 0.02)")
        print(f"  Direction: {ps['direction_after']}")

        if calibration_passed:
            pass_count += 1
        else:
            fail_count += 1

    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        all_results["calibration"] = {"error": str(e), "passed": False}
        fail_count += 1

    # ===================================================================
    # 3. TIME-DEBT VALIDATION
    # ===================================================================
    print(f"\n{'─'*70}")
    print(f"  [3/6] TIME-DEBT VALIDATION (MC Consistency + Divergence)")
    print(f"{'─'*70}")
    try:
        td = run_time_debt_validation()
        all_results["time_debt"] = td

        status = "✅ PASS" if td["passed"] else "❌ FAIL"
        print(f"\n  Result: {status}")
        print(f"  Avg MC consistency (mean vs P50): "
              f"{td['avg_mc_consistency_pct']:.2f}% (target: < 15%)")
        print(f"  Avg model divergence (det vs MC): "
              f"{td['avg_model_divergence_pct']:.2f}% (target: < 50%)")

        for sc in td["scenarios"]:
            icon = "✅" if sc["passed"] else "❌"
            checks = []
            if not sc["mc_consistency_ok"]:
                checks.append(f"MC noise={sc['mc_consistency_pct']:.1f}%")
            if not sc["divergence_bounded"]:
                checks.append(f"divergence={sc['model_divergence_mape_pct']:.1f}%")
            if not sc["monotonic"]:
                checks.append("non-monotonic")
            if not sc["ratio_bounded"]:
                checks.append(f"ratio={sc['final_mc_det_ratio']:.2f}")
            issues = f" [{', '.join(checks)}]" if checks else ""

            print(f"    {icon} {sc['name']}: "
                  f"MCnoise={sc['mc_consistency_pct']:.1f}% | "
                  f"Diverge={sc['model_divergence_mape_pct']:.1f}% | "
                  f"Ratio={sc['final_mc_det_ratio']:.2f} | "
                  f"Payback: det={sc['payback_deterministic']}yr, "
                  f"MC={sc['payback_mc_mean']}yr, "
                  f"P5={sc['payback_risk_aware']}yr"
                  f"{issues}")

        if td["passed"]:
            pass_count += 1
        else:
            fail_count += 1

    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        all_results["time_debt"] = {"error": str(e), "passed": False}
        fail_count += 1

    # ===================================================================
    # 4. RANKING STABILITY
    # ===================================================================
    print(f"\n{'─'*70}")
    print(f"  [4/6] RANKING STABILITY (Perturbation Test)")
    print(f"{'─'*70}")
    try:
        rs = run_ranking_stability(n_perturbations=100, seed=42)
        all_results["ranking_stability"] = rs

        status = "✅ PASS" if rs["passed"] else "❌ FAIL"
        print(f"\n  Result: {status}")
        print(f"  Base ranking: {rs['base_ranking']}")
        print(f"  Top-1 consistency: {rs['top1_consistency_pct']:.1f}% "
              f"(target: > 80%)")
        print(f"  Avg Kendall Tau:   {rs['avg_kendall_tau']:.4f} "
              f"(target: > 0.6)")
        print(f"  Tau range:         [{rs['min_kendall_tau']}, "
              f"{rs['max_kendall_tau']}]")
        print(f"  Valid runs:        {rs['valid_runs']}/{rs['n_perturbations']}")

        if rs["passed"]:
            pass_count += 1
        else:
            fail_count += 1

    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        all_results["ranking_stability"] = {"error": str(e), "passed": False}
        fail_count += 1

    # ===================================================================
    # 5. COST REALISM
    # ===================================================================
    print(f"\n{'─'*70}")
    print(f"  [5/6] COST REALISM (vs IPCC benchmarks)")
    print(f"{'─'*70}")
    try:
        cr = run_cost_realism()
        all_results["cost_realism"] = cr

        status = "✅ PASS" if cr["passed"] else "❌ FAIL"
        print(f"\n  Result: {status}")

        for sc in cr["scenarios"]:
            ipcc = "✅" if sc["in_ipcc_range"] else "⚠️"
            ok = "✅" if sc["in_acceptable_range"] else "❌"
            print(f"    {ok} {sc['emission_kg']}kg: "
                  f"₹{sc['cost_per_kg_mc_mean']:.2f}/kg (MC mean) | "
                  f"₹{sc['cost_per_kg_p5_conservative']:.2f}/kg (P5) | "
                  f"IPCC: {ipcc} | Trees: {sc['total_trees']}")
            for flag in sc["flags"]:
                print(f"       ⚠️ {flag}")

        if cr["passed"]:
            pass_count += 1
        else:
            fail_count += 1

    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        all_results["cost_realism"] = {"error": str(e), "passed": False}
        fail_count += 1

    # ===================================================================
    # 6. EDGE CASE HARDENING
    # ===================================================================
    print(f"\n{'─'*70}")
    print(f"  [6/6] EDGE CASE HARDENING (Stress Tests)")
    print(f"{'─'*70}")
    try:
        ec = run_edge_case_tests()
        all_results["edge_cases"] = ec

        status = "✅ PASS" if ec["passed"] else "❌ FAIL"
        print(f"\n  Result: {status}")
        print(f"  Total: {ec['total_cases']} | Crashes: {ec['crashes']} | "
              f"Expected errors: {ec['expected_errors']} | "
              f"Completed: {ec['completed']}")

        for r in ec["results"]:
            if r["crashed"]:
                icon = "💀"
            elif r["status"] == "expected_error":
                icon = "🛡️"
            else:
                icon = "✅"
            extra = f" ({r['exception']}: {r.get('exception_msg', '')})" if r.get("exception") else ""
            print(f"    {icon} {r['name']}: {r['status']}{extra}")

        if ec["passed"]:
            pass_count += 1
        else:
            fail_count += 1

    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        all_results["edge_cases"] = {"error": str(e), "passed": False}
        fail_count += 1

    # ===================================================================
    # FINAL SUMMARY
    # ===================================================================
    elapsed = time.time() - start_time
    total = pass_count + fail_count
    all_passed = fail_count == 0

    print(f"\n{'█'*70}")
    print(f"█" + " " * 68 + "█")
    print(f"█" + "  BENCHMARK SUMMARY".center(68) + "█")
    print(f"█" + " " * 68 + "█")
    print(f"█{'─'*68}█")

    metrics = [
        ("Suitability (0% violations)", all_results.get("suitability", {}).get("passed", False)),
        ("Calibration (Brier<0.01, ECE<0.02)", all_results.get("calibration", {}).get("passed", False)),
        ("Time-Debt (MC<15%, Diverge<50%, Mono, Ratio)", all_results.get("time_debt", {}).get("passed", False)),
        ("Ranking Stability (Top1>80%, Tau>0.6)", all_results.get("ranking_stability", {}).get("passed", False)),
        ("Cost Realism (₹0.1-15/kg)", all_results.get("cost_realism", {}).get("passed", False)),
        ("Edge Cases (0 crashes)", all_results.get("edge_cases", {}).get("passed", False)),
    ]

    for name, passed in metrics:
        icon = "✅" if passed else "❌"
        print(f"█  {icon}  {name:<50s}█")

    print(f"█{'─'*68}█")
    verdict = "ALL BENCHMARKS PASSED" if all_passed else f"{fail_count} BENCHMARK(S) FAILED"
    verdict_icon = "✅" if all_passed else "❌"
    print(f"█  {verdict_icon}  {verdict:<50s}  {pass_count}/{total}  █")
    print(f"█  ⏱️  Elapsed: {elapsed:.1f}s{' '*48}█")
    print(f"█" + " " * 68 + "█")
    print(f"{'█'*70}\n")

    return {
        "verdict": "PASS" if all_passed else "FAIL",
        "passed": pass_count,
        "failed": fail_count,
        "total": total,
        "elapsed_seconds": round(elapsed, 1),
        "results": all_results,
    }


if __name__ == "__main__":
    report = run_full_benchmark()
    if report["verdict"] != "PASS":
        sys.exit(1)