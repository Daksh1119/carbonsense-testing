from ml_services.teme.core.survival import generate_survival_curve


def test_survival_monotonic():
    curve = generate_survival_curve(
        annual_survival_rate=0.9,
        time_horizon=10
    )

    assert curve[0] == 1.0
    for i in range(1, len(curve)):
        assert curve[i] <= curve[i - 1]

