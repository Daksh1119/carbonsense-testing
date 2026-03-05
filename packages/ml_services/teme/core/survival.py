from typing import List


def generate_survival_curve(
    annual_survival_rate: float,
    time_horizon: int
) -> List[float]:
    """
    Generate survival fraction curve σ(t).

    annual_survival_rate:
        Fraction of trees surviving each year (0 < rate ≤ 1)

    Returns:
        List of length time_horizon + 1
    """
    if not (0 < annual_survival_rate <= 1):
        raise ValueError("annual_survival_rate must be in (0, 1]")

    survival = [1.0]

    for t in range(1, time_horizon + 1):
        survival.append(survival[t - 1] * annual_survival_rate)

    return survival
