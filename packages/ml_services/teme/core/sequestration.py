from typing import List


def generate_sequestration_curve(
    maturity_years: int,
    peak_sequestration_kg: float,
    time_horizon: int
) -> List[float]:
    """
    Generate per-tree annual sequestration curve α(t).

    Rules:
    - α(0) = 0
    - Linear growth until maturity
    - Plateau after maturity
    - No negative values

    Returns:
        List of length time_horizon + 1
    """
    if maturity_years <= 0:
        raise ValueError("maturity_years must be positive")

    if peak_sequestration_kg < 0:
        raise ValueError("peak_sequestration_kg must be non-negative")

    curve = []

    for t in range(time_horizon + 1):
        if t == 0:
            curve.append(0.0)
        elif t < maturity_years:
            value = peak_sequestration_kg * (t / maturity_years)
            curve.append(value)
        else:
            curve.append(peak_sequestration_kg)

    return curve
