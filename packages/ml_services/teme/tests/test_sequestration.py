from ml_services.teme.core.sequestration import generate_sequestration_curve


def test_sequestration_curve_shape():
    curve = generate_sequestration_curve(
        maturity_years=5,
        peak_sequestration_kg=10,
        time_horizon=10
    )

    assert len(curve) == 11
    assert curve[0] == 0
    assert curve[5] == 10
    assert curve[6] == 10
    assert all(v >= 0 for v in curve)

