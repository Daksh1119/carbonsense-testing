import joblib, sys
from pathlib import Path

sys.path.insert(0, str(Path("packages").resolve()))

bundle = joblib.load("packages/ml_services/teme/ml/models/teme_survival_v4.joblib")
meta   = bundle.get("metadata", {})
print("=== V4 artifact metadata ===")
print(f"  version     : {meta.get('version')}")
print(f"  calibrated  : {meta.get('calibrated')}")
print(f"  calibrator  : {bundle.get('calibrator')}")
print(f"  real-only R2: {meta.get('cv_oof_real_only', {}).get('r2')}")
print(f"  real-only MAE:{meta.get('cv_oof_real_only', {}).get('mae')}")
print()

from ml_services.teme.ml.survival_v4 import predict_v4

test_cases = [
    dict(growth_rate_class=7, drought_score=2, fire_score=2, disease_score=5, planted_count=500,  species_name="neem",    label="Low stress   "),
    dict(growth_rate_class=5, drought_score=5, fire_score=4, disease_score=5, planted_count=1000, species_name="teak",    label="Medium stress"),
    dict(growth_rate_class=3, drought_score=8, fire_score=7, disease_score=5, planted_count=2000, species_name="bamboo",  label="High stress  "),
    dict(growth_rate_class=2, drought_score=9, fire_score=9, disease_score=8, planted_count=5000, species_name="unknown", label="Extreme     "),
]

print(f"{'Case':<16} {'Point':>7}  {'P10':>7}  {'P90':>7}  {'Band width':>10}")
print("-" * 56)
for tc in test_cases:
    r = predict_v4(
        bundle,
        growth_rate_class=tc["growth_rate_class"],
        drought_score=tc["drought_score"],
        fire_score=tc["fire_score"],
        disease_score=tc["disease_score"],
        planted_count=tc["planted_count"],
        species_name=tc["species_name"],
    )
    band = r["p90"] - r["p10"]
    print(f"{tc['label']:<16} {r['point']:>7.4f}  {r['p10']:>7.4f}  {r['p90']:>7.4f}  {band:>10.4f}")

print()
# Check legacy model
from ml_services.teme.ml.survival import predict_survival_adjustment, load_model, get_loaded_model_version, get_last_uncertainty

try:
    load_model(prefer_v4=False)
    print(f"=== Legacy model version: {get_loaded_model_version()} ===")
    for tc in test_cases:
        adj = predict_survival_adjustment(
            growth_rate_class=tc["growth_rate_class"],
            drought_score=tc["drought_score"],
            fire_score=tc["fire_score"],
            disease_score=tc["disease_score"],
            planted_count=tc["planted_count"],
            rule_based_survival=0.85,
            prefer_v4=False,
        )
        print(f"{tc['label']:<16} adj_factor={adj:.4f}  (implied survival={0.85*adj:.4f})")
except Exception as e:
    print(f"Legacy model error: {e}")
